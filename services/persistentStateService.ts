import { db } from '../firebase.ts';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { cleanForFirestore } from '../firebaseUtils.ts';
import { SchoolProfile } from '../types/school.ts';
import { SchoolMembership, TeacherProfile, TeacherTeachingContext } from '../types/teacherOnboarding.ts';
import { ElmsConnectionRecord } from './elmsConnectionService.ts';
import { ContentArtifact } from '../types.ts';
import { TeacherActionPlan, TeacherActionFollowUpComparison } from '../types/teacherAction.ts';
import {
  Assessment,
  AssessmentAttempt,
  AssessmentResponse,
  AssessmentEvaluation,
  LearningOutcomeEvidence,
  ElmsAssessmentEvidenceRecord,
} from '../types/assessmentEvidence.ts';
import {
  ElmsResourcePublication,
  ElmsLearnerMapping,
  ElmsClassMapping,
  ElmsAssignment,
  ElmsLearningEvent,
} from '../types/elmsIntegration.ts';

export interface DurableTenantStorageAdapter {
  getDoc(collectionPath: string, docId: string): Promise<any | null>;
  setDoc(collectionPath: string, docId: string, data: any, merge?: boolean): Promise<void>;
  deleteDoc(collectionPath: string, docId: string): Promise<void>;
  listDocs(collectionPath: string, filters?: Record<string, any>): Promise<any[]>;
}

// Durable backing store used in unit/integration tests and as fallback when offline.
// Crucially, this store is independent of individual service in-memory Maps so
// simulated process restarts (`simulateProcessRestart()`) can wipe service Maps
// and prove full state recovery from the durable store.
const durableBackingCollections = new Map<string, Map<string, any>>();
let simulateDurableFailure = false;
let strictDurableMode = false;
let lastPersistenceError: Error | null = null;

function isProductionRuntime(): boolean {
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  } catch {
    return false;
  }
}

function shouldEnforceStrictDurableFailure(): boolean {
  return simulateDurableFailure || strictDurableMode || isProductionRuntime();
}

function normalizeCollectionPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

function getDurableCollection(collectionPath: string): Map<string, any> {
  const norm = normalizeCollectionPath(collectionPath);
  if (!durableBackingCollections.has(norm)) {
    durableBackingCollections.set(norm, new Map());
  }
  return durableBackingCollections.get(norm)!;
}

export function createDurableMemoryFirestoreAdapter(): DurableTenantStorageAdapter {
  return {
    async getDoc(collectionPath: string, docId: string) {
      if (simulateDurableFailure) {
        throw new Error('FIRESTORE_DURABLE_UNAVAILABLE: Simulated durable storage read failure');
      }
      const col = getDurableCollection(collectionPath);
      const docData = col.get(docId);
      return docData ? JSON.parse(JSON.stringify(docData)) : null;
    },
    async setDoc(collectionPath: string, docId: string, data: any, merge = true) {
      if (simulateDurableFailure) {
        throw new Error('FIRESTORE_DURABLE_UNAVAILABLE: Simulated durable storage write failure');
      }
      const col = getDurableCollection(collectionPath);
      const serialized = JSON.parse(JSON.stringify(cleanForFirestore(data)));
      const existing = col.get(docId);
      if (merge && existing && typeof existing === 'object' && typeof serialized === 'object') {
        col.set(docId, { ...existing, ...serialized });
      } else {
        col.set(docId, serialized);
      }
    },
    async deleteDoc(collectionPath: string, docId: string) {
      if (simulateDurableFailure) {
        throw new Error('FIRESTORE_DURABLE_UNAVAILABLE: Simulated durable storage delete failure');
      }
      const col = getDurableCollection(collectionPath);
      col.delete(docId);
    },
    async listDocs(collectionPath: string, filters?: Record<string, any>) {
      if (simulateDurableFailure) {
        throw new Error('FIRESTORE_DURABLE_UNAVAILABLE: Simulated durable storage list failure');
      }
      const col = getDurableCollection(collectionPath);
      let docs = Array.from(col.values()).map((d) => JSON.parse(JSON.stringify(d)));
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v !== undefined) {
            docs = docs.filter((item) => item && item[k] === v);
          }
        }
      }
      return docs;
    },
  };
}

function isAutomatedTestRuntime(): boolean {
  try {
    return (
      typeof process !== 'undefined' &&
      Boolean(process.env?.JEST_WORKER_ID || process.env?.NODE_ENV === 'test')
    );
  } catch {
    return false;
  }
}

export function createFirestoreClientTenantAdapter(firestoreDb: any = db): DurableTenantStorageAdapter {
  const memoryFallback = createDurableMemoryFirestoreAdapter();

  return {
    async getDoc(collectionPath: string, docId: string) {
      const normPath = normalizeCollectionPath(collectionPath);
      if (simulateDurableFailure) {
        const err = new Error(`FIRESTORE_DURABLE_UNAVAILABLE: Simulated durable storage read failure for ${normPath}/${docId}`);
        lastPersistenceError = err;
        throw err;
      }
      // Always keep durable backing store updated for fast recovery
      try {
        if (firestoreDb && typeof window !== 'undefined' && !isAutomatedTestRuntime()) {
          const segments = normPath.split('/');
          const docRef = doc(firestoreDb, ...segments, docId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const rawData = (snap.data() || {}) as Record<string, any>;
            const data = { ...rawData, id: snap.id };
            await memoryFallback.setDoc(normPath, docId, data, true);
            return data;
          }
        }
      } catch (err: any) {
        if (shouldEnforceStrictDurableFailure()) {
          const persistenceErr = new Error(
            `FIRESTORE_PERSISTENCE_FAILED: Client getDoc failed for ${normPath}/${docId}: ${err?.message || String(err)}`
          );
          lastPersistenceError = persistenceErr;
          throw persistenceErr;
        }
      }
      return memoryFallback.getDoc(normPath, docId);
    },

    async setDoc(collectionPath: string, docId: string, data: any, merge = true) {
      const normPath = normalizeCollectionPath(collectionPath);
      if (simulateDurableFailure) {
        const err = new Error(`FIRESTORE_DURABLE_UNAVAILABLE: Simulated durable storage write failure for ${normPath}/${docId}`);
        lastPersistenceError = err;
        throw err;
      }
      const cleaned = cleanForFirestore(data);
      try {
        if (firestoreDb && typeof window !== 'undefined' && !isAutomatedTestRuntime()) {
          const segments = normPath.split('/');
          const docRef = doc(firestoreDb, ...segments, docId);
          await setDoc(docRef, cleaned, { merge });
        }
      } catch (err: any) {
        if (shouldEnforceStrictDurableFailure()) {
          const persistenceErr = new Error(
            `FIRESTORE_PERSISTENCE_FAILED: Client setDoc failed for ${normPath}/${docId}: ${err?.message || String(err)}`
          );
          lastPersistenceError = persistenceErr;
          throw persistenceErr;
        }
      }
      await memoryFallback.setDoc(normPath, docId, cleaned, merge);
    },

    async deleteDoc(collectionPath: string, docId: string) {
      const normPath = normalizeCollectionPath(collectionPath);
      if (simulateDurableFailure) {
        const err = new Error(`FIRESTORE_DURABLE_UNAVAILABLE: Simulated durable storage delete failure for ${normPath}/${docId}`);
        lastPersistenceError = err;
        throw err;
      }
      try {
        if (firestoreDb && typeof window !== 'undefined' && !isAutomatedTestRuntime()) {
          const segments = normPath.split('/');
          const docRef = doc(firestoreDb, ...segments, docId);
          await deleteDoc(docRef);
        }
      } catch (err: any) {
        if (shouldEnforceStrictDurableFailure()) {
          const persistenceErr = new Error(
            `FIRESTORE_PERSISTENCE_FAILED: Client deleteDoc failed for ${normPath}/${docId}: ${err?.message || String(err)}`
          );
          lastPersistenceError = persistenceErr;
          throw persistenceErr;
        }
      }
      await memoryFallback.deleteDoc(normPath, docId);
    },

    async listDocs(collectionPath: string, filters?: Record<string, any>) {
      const normPath = normalizeCollectionPath(collectionPath);
      if (simulateDurableFailure) {
        const err = new Error(`FIRESTORE_DURABLE_UNAVAILABLE: Simulated durable storage list failure for ${normPath}`);
        lastPersistenceError = err;
        throw err;
      }
      try {
        if (firestoreDb && typeof window !== 'undefined' && !isAutomatedTestRuntime()) {
          const segments = normPath.split('/');
          const colRef = collection(firestoreDb, ...(segments as [string, ...string[]]));
          const constraints = filters
            ? Object.entries(filters)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => where(k, '==', v))
            : [];
          const qRef = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef);
          const snap = await getDocs(qRef);
          const results: any[] = [];
          for (const d of snap.docs) {
            const rawData = (d.data() || {}) as Record<string, any>;
            const item = { ...rawData, id: d.id };
            await memoryFallback.setDoc(normPath, d.id, item, true);
            results.push(item);
          }
          if (results.length > 0) {
            return results;
          }
        }
      } catch (err: any) {
        if (shouldEnforceStrictDurableFailure()) {
          const persistenceErr = new Error(
            `FIRESTORE_PERSISTENCE_FAILED: Client listDocs failed for ${normPath}: ${err?.message || String(err)}`
          );
          lastPersistenceError = persistenceErr;
          throw persistenceErr;
        }
      }
      return memoryFallback.listDocs(normPath, filters);
    },
  };
}

export function createFirestoreAdminTenantAdapter(dbAdmin: any): DurableTenantStorageAdapter {
  const memoryFallback = createDurableMemoryFirestoreAdapter();

  return {
    async getDoc(collectionPath: string, docId: string) {
      const normPath = normalizeCollectionPath(collectionPath);
      if (simulateDurableFailure) {
        const err = new Error(`FIRESTORE_DURABLE_UNAVAILABLE: Simulated admin durable read failure for ${normPath}/${docId}`);
        lastPersistenceError = err;
        throw err;
      }
      try {
        if (!dbAdmin && shouldEnforceStrictDurableFailure()) {
          throw new Error('Admin Firestore instance is uninitialized in strict/production mode');
        }
        if (dbAdmin) {
          const snap = await dbAdmin.collection(normPath).doc(docId).get();
          if (snap.exists) {
            const data = snap.data() || {};
            await memoryFallback.setDoc(normPath, docId, data, true);
            return data;
          }
        }
      } catch (err: any) {
        if (shouldEnforceStrictDurableFailure()) {
          const persistenceErr = new Error(
            `FIRESTORE_PERSISTENCE_FAILED: Admin getDoc failed for ${normPath}/${docId}: ${err?.message || String(err)}`
          );
          lastPersistenceError = persistenceErr;
          throw persistenceErr;
        }
        console.warn(`[PersistentStateService] Admin getDoc fallback for ${normPath}/${docId}:`, err?.message);
      }
      return memoryFallback.getDoc(normPath, docId);
    },

    async setDoc(collectionPath: string, docId: string, data: any, merge = true) {
      const normPath = normalizeCollectionPath(collectionPath);
      if (simulateDurableFailure) {
        const err = new Error(`FIRESTORE_DURABLE_UNAVAILABLE: Simulated admin durable write failure for ${normPath}/${docId}`);
        lastPersistenceError = err;
        throw err;
      }
      const cleaned = cleanForFirestore(data);
      try {
        if (!dbAdmin && shouldEnforceStrictDurableFailure()) {
          throw new Error('Admin Firestore instance is uninitialized in strict/production mode');
        }
        if (dbAdmin) {
          await dbAdmin.collection(normPath).doc(docId).set(cleaned, { merge });
        }
      } catch (err: any) {
        if (shouldEnforceStrictDurableFailure()) {
          const persistenceErr = new Error(
            `FIRESTORE_PERSISTENCE_FAILED: Admin setDoc failed for ${normPath}/${docId}: ${err?.message || String(err)}`
          );
          lastPersistenceError = persistenceErr;
          throw persistenceErr;
        }
        console.warn(`[PersistentStateService] Admin setDoc fallback for ${normPath}/${docId}:`, err?.message);
      }
      await memoryFallback.setDoc(normPath, docId, cleaned, merge);
    },

    async deleteDoc(collectionPath: string, docId: string) {
      const normPath = normalizeCollectionPath(collectionPath);
      if (simulateDurableFailure) {
        const err = new Error(`FIRESTORE_DURABLE_UNAVAILABLE: Simulated admin durable delete failure for ${normPath}/${docId}`);
        lastPersistenceError = err;
        throw err;
      }
      try {
        if (!dbAdmin && shouldEnforceStrictDurableFailure()) {
          throw new Error('Admin Firestore instance is uninitialized in strict/production mode');
        }
        if (dbAdmin) {
          await dbAdmin.collection(normPath).doc(docId).delete();
        }
      } catch (err: any) {
        if (shouldEnforceStrictDurableFailure()) {
          const persistenceErr = new Error(
            `FIRESTORE_PERSISTENCE_FAILED: Admin deleteDoc failed for ${normPath}/${docId}: ${err?.message || String(err)}`
          );
          lastPersistenceError = persistenceErr;
          throw persistenceErr;
        }
        console.warn(`[PersistentStateService] Admin deleteDoc fallback for ${normPath}/${docId}:`, err?.message);
      }
      await memoryFallback.deleteDoc(normPath, docId);
    },

    async listDocs(collectionPath: string, filters?: Record<string, any>) {
      const normPath = normalizeCollectionPath(collectionPath);
      if (simulateDurableFailure) {
        const err = new Error(`FIRESTORE_DURABLE_UNAVAILABLE: Simulated admin durable list failure for ${normPath}`);
        lastPersistenceError = err;
        throw err;
      }
      try {
        if (!dbAdmin && shouldEnforceStrictDurableFailure()) {
          throw new Error('Admin Firestore instance is uninitialized in strict/production mode');
        }
        if (dbAdmin) {
          let q: any = dbAdmin.collection(normPath);
          if (filters) {
            for (const [k, v] of Object.entries(filters)) {
              if (v !== undefined) {
                q = q.where(k, '==', v);
              }
            }
          }
          const snap = await q.get();
          const results: any[] = [];
          for (const d of snap.docs) {
            const rawData = (d.data() || {}) as Record<string, any>;
            const item = { ...rawData, id: d.id };
            await memoryFallback.setDoc(normPath, d.id, item, true);
            results.push(item);
          }
          if (results.length > 0) {
            return results;
          }
        }
      } catch (err: any) {
        if (shouldEnforceStrictDurableFailure()) {
          const persistenceErr = new Error(
            `FIRESTORE_PERSISTENCE_FAILED: Admin listDocs failed for ${normPath}: ${err?.message || String(err)}`
          );
          lastPersistenceError = persistenceErr;
          throw persistenceErr;
        }
        console.warn(`[PersistentStateService] Admin listDocs fallback for ${normPath}:`, err?.message);
      }
      return memoryFallback.listDocs(normPath, filters);
    },
  };
}

let activeTenantAdapter: DurableTenantStorageAdapter = createFirestoreClientTenantAdapter();
const pendingWritePromises = new Set<Promise<any>>();

// Registered hydration callbacks from each domain service to avoid circular import issues
interface DomainHydrationCallbacks {
  clearInMemoryOnly: () => void;
  ingestState: (data: any) => void;
}

const registeredServices = new Map<string, DomainHydrationCallbacks>();

function trackWrite(promise: Promise<any>): void {
  const tracked = promise
    .catch((err: any) => {
      lastPersistenceError = err instanceof Error ? err : new Error(String(err));
    })
    .finally(() => {
      pendingWritePromises.delete(tracked);
    });
  pendingWritePromises.add(tracked);
}

export function getCanonicalMembershipDocId(userId: string, schoolId: string): string {
  return `mem_${userId}_${schoolId}`;
}

export const PersistentStateService = {
  setStorageAdapter(adapter: DurableTenantStorageAdapter): void {
    activeTenantAdapter = adapter;
  },

  getStorageAdapter(): DurableTenantStorageAdapter {
    return activeTenantAdapter;
  },

  setSimulateDurableFailure(fail: boolean): void {
    simulateDurableFailure = fail;
    if (!fail) {
      lastPersistenceError = null;
    }
  },

  setStrictDurableMode(strict: boolean): void {
    strictDurableMode = strict;
    if (!strict) {
      lastPersistenceError = null;
    }
  },

  getLastPersistenceError(): Error | null {
    return lastPersistenceError;
  },

  clearLastPersistenceError(): void {
    lastPersistenceError = null;
  },

  registerDomainService(domainName: string, callbacks: DomainHydrationCallbacks): void {
    registeredServices.set(domainName, callbacks);
  },

  async flushPendingWrites(options?: { throwOnError?: boolean }): Promise<void> {
    while (pendingWritePromises.size > 0) {
      await Promise.all(Array.from(pendingWritePromises));
    }
    if ((options?.throwOnError || shouldEnforceStrictDurableFailure()) && lastPersistenceError) {
      const errToThrow = lastPersistenceError;
      lastPersistenceError = null;
      throw errToThrow;
    }
  },

  resetAllDurableState(): void {
    durableBackingCollections.clear();
    simulateDurableFailure = false;
    strictDurableMode = false;
    lastPersistenceError = null;
    pendingWritePromises.clear();
    for (const svc of registeredServices.values()) {
      svc.clearInMemoryOnly();
    }
  },

  // --- 1. SCHOOLS (schools/{schoolId}) ---
  persistSchoolProfile(school: SchoolProfile): void {
    if (!school || !school.id) return;
    trackWrite(activeTenantAdapter.setDoc('schools', school.id, school, true));
  },

  async hydrateSchools(): Promise<SchoolProfile[]> {
    await this.flushPendingWrites();
    const docs = await activeTenantAdapter.listDocs('schools');
    const svc = registeredServices.get('SchoolConfigService');
    if (svc && docs.length > 0) {
      svc.ingestState({ schools: docs });
    }
    return docs as SchoolProfile[];
  },

  async hydrateSchoolById(schoolId: string): Promise<SchoolProfile | null> {
    if (!schoolId) return null;
    await this.flushPendingWrites();
    const docData = await activeTenantAdapter.getDoc('schools', schoolId);
    if (docData) {
      const svc = registeredServices.get('SchoolConfigService');
      if (svc) {
        svc.ingestState({ schools: [docData] });
      }
      return docData as SchoolProfile;
    }
    return null;
  },

  // --- 2. SCHOOL MEMBERSHIPS & TEACHER CONTEXTS (schoolMemberships/{membershipId}, teacher_profiles/{userId}) ---
  persistSchoolMembership(membership: SchoolMembership): void {
    if (!membership || !membership.userId || !membership.schoolId) return;
    const canonicalId = getCanonicalMembershipDocId(membership.userId, membership.schoolId);
    const payload: SchoolMembership = {
      ...membership,
      id: membership.id || canonicalId,
    };
    // Write under canonical ID `mem_${userId}_${schoolId}` for Firestore security rule compatibility
    trackWrite(activeTenantAdapter.setDoc('schoolMemberships', canonicalId, payload, true));
    if (membership.id && membership.id !== canonicalId) {
      trackWrite(activeTenantAdapter.setDoc('schoolMemberships', membership.id, payload, true));
    }
  },

  persistTeacherProfileState(params: {
    userId: string;
    profile?: TeacherProfile;
    activeSchoolId?: string;
    teachingContext?: TeacherTeachingContext;
  }): void {
    if (!params.userId) return;
    const payload: Record<string, any> = {
      userId: params.userId,
      updatedAt: new Date().toISOString(),
    };
    if (params.profile) payload.profile = params.profile;
    if (params.activeSchoolId !== undefined) payload.activeSchoolId = params.activeSchoolId;
    if (params.teachingContext) {
      payload[`context_${params.teachingContext.schoolId}`] = params.teachingContext;
    }
    trackWrite(activeTenantAdapter.setDoc('teacher_profiles', params.userId, payload, true));
  },

  async hydrateMembershipsForUser(userId: string): Promise<SchoolMembership[]> {
    if (!userId) return [];
    await this.flushPendingWrites();
    const docs = await activeTenantAdapter.listDocs('schoolMemberships', { userId });
    const profileDoc = await activeTenantAdapter.getDoc('teacher_profiles', userId);
    const svc = registeredServices.get('SchoolMembershipService');
    if (svc) {
      svc.ingestState({
        memberships: docs,
        teacherProfileDoc: profileDoc,
      });
    }
    return docs as SchoolMembership[];
  },

  async hydrateMembershipsForSchool(schoolId: string): Promise<SchoolMembership[]> {
    if (!schoolId) return [];
    await this.flushPendingWrites();
    const docs = await activeTenantAdapter.listDocs('schoolMemberships', { schoolId });
    const svc = registeredServices.get('SchoolMembershipService');
    if (svc && docs.length > 0) {
      svc.ingestState({ memberships: docs });
    }
    return docs as SchoolMembership[];
  },

  // --- 3. ELMS CONNECTIONS (schools/{schoolId}/elms_connections/{connectionId}) ---
  persistElmsConnection(record: ElmsConnectionRecord): void {
    if (!record || !record.schoolId) return;
    const colPath = `schools/${record.schoolId}/elms_connections`;
    trackWrite(activeTenantAdapter.setDoc(colPath, 'default', record, true));
    trackWrite(activeTenantAdapter.setDoc(colPath, record.schoolId, record, true));
  },

  async hydrateElmsConnection(schoolId: string): Promise<ElmsConnectionRecord | null> {
    if (!schoolId) return null;
    await this.flushPendingWrites();
    const colPath = `schools/${schoolId}/elms_connections`;
    const record =
      (await activeTenantAdapter.getDoc(colPath, 'default')) ||
      (await activeTenantAdapter.getDoc(colPath, schoolId));
    if (record) {
      const svc = registeredServices.get('ElmsConnectionService');
      if (svc) {
        svc.ingestState({ connections: [record] });
      }
      return record as ElmsConnectionRecord;
    }
    return null;
  },

  // --- 4. CONTENT ARTIFACTS (schools/{schoolId}/content_artifacts/{artifactId}) ---
  persistContentArtifactVersions(schoolId: string, artifactId: string, versions: ContentArtifact[]): void {
    if (!schoolId || !artifactId || !Array.isArray(versions) || versions.length === 0) return;
    const latest = versions[versions.length - 1];
    const colPath = `schools/${schoolId}/content_artifacts`;
    trackWrite(
      activeTenantAdapter.setDoc(
        colPath,
        artifactId,
        {
          id: artifactId,
          schoolId,
          latestVersion: latest.version,
          artifactType: latest.artifactType,
          status: latest.status,
          gradeLevelId: latest.gradeLevelId,
          learningAreaId: latest.learningAreaId,
          teacherActionId: latest.teacherActionId,
          versions,
          updatedAt: latest.updatedAt || new Date().toISOString(),
        },
        true
      )
    );
  },

  async hydrateSchoolArtifacts(schoolId: string): Promise<ContentArtifact[]> {
    if (!schoolId) return [];
    await this.flushPendingWrites();
    const colPath = `schools/${schoolId}/content_artifacts`;
    const docs = await activeTenantAdapter.listDocs(colPath);
    const svc = registeredServices.get('ContentArtifactRepository');
    if (svc && docs.length > 0) {
      svc.ingestState({ schoolId, artifactDocs: docs });
    }
    const latestList: ContentArtifact[] = [];
    for (const d of docs) {
      if (Array.isArray(d.versions) && d.versions.length > 0) {
        latestList.push(d.versions[d.versions.length - 1]);
      }
    }
    return latestList;
  },

  // --- 5. TEACHER ACTION PLANS & FOLLOW-UP COMPARISONS (schools/{schoolId}/teacher_actions/{actionId}) ---
  persistTeacherActionPlan(action: TeacherActionPlan): void {
    if (!action || !action.actionId || !action.schoolId) return;
    const colPath = `schools/${action.schoolId}/teacher_actions`;
    trackWrite(activeTenantAdapter.setDoc(colPath, action.actionId, action, true));
  },

  persistTeacherActionFollowUpComparison(
    schoolId: string,
    actionId: string,
    followUpArtifactId: string,
    comparison: TeacherActionFollowUpComparison
  ): void {
    if (!schoolId || !actionId || !followUpArtifactId || !comparison) return;
    const colPath = `schools/${schoolId}/teacher_action_comparisons`;
    const docId = `${actionId}__${followUpArtifactId}`;
    trackWrite(
      activeTenantAdapter.setDoc(
        colPath,
        docId,
        {
          id: docId,
          schoolId,
          actionId,
          followUpArtifactId,
          comparison,
          updatedAt: new Date().toISOString(),
        },
        true
      )
    );
  },

  async hydrateSchoolTeacherActions(schoolId: string): Promise<TeacherActionPlan[]> {
    if (!schoolId) return [];
    await this.flushPendingWrites();
    const actionsCol = `schools/${schoolId}/teacher_actions`;
    const comparisonsCol = `schools/${schoolId}/teacher_action_comparisons`;
    const [actionDocs, comparisonDocs] = await Promise.all([
      activeTenantAdapter.listDocs(actionsCol),
      activeTenantAdapter.listDocs(comparisonsCol),
    ]);
    const svc = registeredServices.get('TeacherActionService');
    if (svc && (actionDocs.length > 0 || comparisonDocs.length > 0)) {
      svc.ingestState({
        schoolId,
        actions: actionDocs,
        comparisons: comparisonDocs,
      });
    }
    return actionDocs as TeacherActionPlan[];
  },

  // --- 6. ASSESSMENT & ELMS EVIDENCE (schools/{schoolId}/assessments, schools/{schoolId}/elms_evidence) ---
  persistAssessment(assessment: Assessment): void {
    if (!assessment || !assessment.assessmentId || !assessment.schoolId) return;
    const colPath = `schools/${assessment.schoolId}/assessments`;
    trackWrite(activeTenantAdapter.setDoc(colPath, assessment.assessmentId, assessment, true));
  },

  persistAssessmentAttemptBundle(params: {
    schoolId: string;
    attempt: AssessmentAttempt;
    responses?: AssessmentResponse[];
    evaluation?: AssessmentEvaluation;
    outcomeEvidence?: LearningOutcomeEvidence[];
  }): void {
    if (!params.schoolId || !params.attempt?.attemptId) return;
    const colPath = `schools/${params.schoolId}/assessment_attempts`;
    trackWrite(
      activeTenantAdapter.setDoc(
        colPath,
        params.attempt.attemptId,
        {
          id: params.attempt.attemptId,
          schoolId: params.schoolId,
          attempt: params.attempt,
          ...(params.responses ? { responses: params.responses } : {}),
          ...(params.evaluation ? { evaluation: params.evaluation } : {}),
          ...(params.outcomeEvidence ? { outcomeEvidence: params.outcomeEvidence } : {}),
          updatedAt: new Date().toISOString(),
        },
        true
      )
    );
  },

  persistOutcomeEvidence(evidence: LearningOutcomeEvidence): void {
    if (!evidence || !evidence.evidenceId || !evidence.schoolId) return;
    const colPath = `schools/${evidence.schoolId}/outcome_evidence`;
    trackWrite(activeTenantAdapter.setDoc(colPath, evidence.evidenceId, evidence, true));
  },

  persistElmsAssessmentEvidenceRecord(record: ElmsAssessmentEvidenceRecord): void {
    if (!record || !record.evidenceRecordId || !record.schoolId) return;
    const colPath = `schools/${record.schoolId}/elms_evidence`;
    trackWrite(activeTenantAdapter.setDoc(colPath, record.evidenceRecordId, record, true));
  },

  async hydrateSchoolAssessmentEvidence(schoolId: string): Promise<{
    assessments: Assessment[];
    elmsEvidenceRecords: ElmsAssessmentEvidenceRecord[];
  }> {
    if (!schoolId) return { assessments: [], elmsEvidenceRecords: [] };
    await this.flushPendingWrites();
    const [assessments, attemptBundles, outcomeEvidence, elmsEvidenceRecords] = await Promise.all([
      activeTenantAdapter.listDocs(`schools/${schoolId}/assessments`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/assessment_attempts`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/outcome_evidence`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/elms_evidence`),
    ]);
    const svc = registeredServices.get('AssessmentEvidenceService');
    if (
      svc &&
      (assessments.length > 0 ||
        attemptBundles.length > 0 ||
        outcomeEvidence.length > 0 ||
        elmsEvidenceRecords.length > 0)
    ) {
      svc.ingestState({
        schoolId,
        assessments,
        attemptBundles,
        outcomeEvidence,
        elmsEvidenceRecords,
      });
    }
    return {
      assessments: assessments as Assessment[],
      elmsEvidenceRecords: elmsEvidenceRecords as ElmsAssessmentEvidenceRecord[],
    };
  },

  // --- 7. ELMS INTEGRATION STATE (publications, events, mappings, assignments) ---
  persistElmsPublication(pub: ElmsResourcePublication): void {
    const pubId = pub?.publicationId || (pub as any)?.id;
    if (!pub || !pubId || !pub.schoolId) return;
    trackWrite(
      activeTenantAdapter.setDoc(`schools/${pub.schoolId}/elms_publications`, pubId, pub, true)
    );
  },

  persistElmsLearnerMapping(mapping: ElmsLearnerMapping): void {
    if (!mapping || !mapping.id || !mapping.schoolId) return;
    const payload = {
      ...mapping,
      mappingKind: 'LEARNER',
    };
    trackWrite(
      activeTenantAdapter.setDoc(`schools/${mapping.schoolId}/elms_learner_mappings`, mapping.id, payload, true)
    );
    trackWrite(
      activeTenantAdapter.setDoc(`schools/${mapping.schoolId}/elms_mappings`, mapping.id, payload, true)
    );
  },

  persistElmsClassMapping(mapping: ElmsClassMapping): void {
    if (!mapping || !mapping.id || !mapping.schoolId) return;
    const payload = {
      ...mapping,
      mappingKind: 'CLASS',
    };
    trackWrite(
      activeTenantAdapter.setDoc(`schools/${mapping.schoolId}/elms_class_mappings`, mapping.id, payload, true)
    );
    trackWrite(
      activeTenantAdapter.setDoc(`schools/${mapping.schoolId}/elms_mappings`, mapping.id, payload, true)
    );
  },

  persistElmsAssignment(assignment: ElmsAssignment): void {
    if (!assignment || !assignment.assignmentId || !assignment.schoolId) return;
    trackWrite(
      activeTenantAdapter.setDoc(
        `schools/${assignment.schoolId}/elms_assignments`,
        assignment.assignmentId,
        assignment,
        true
      )
    );
  },

  persistElmsLearningEvent(event: ElmsLearningEvent): void {
    if (!event || !event.eventId || !event.schoolId) return;
    trackWrite(
      activeTenantAdapter.setDoc(
        `schools/${event.schoolId}/elms_learning_events`,
        event.eventId,
        event,
        true
      )
    );
    trackWrite(
      activeTenantAdapter.setDoc(
        `schools/${event.schoolId}/elms_events`,
        event.eventId,
        event,
        true
      )
    );
  },

  async hydrateSchoolElmsIntegration(schoolId: string): Promise<{
    publications: ElmsResourcePublication[];
    events: ElmsLearningEvent[];
  }> {
    if (!schoolId) return { publications: [], events: [] };
    await this.flushPendingWrites();
    const [
      publications,
      learnerMappings,
      classMappings,
      legacyMappings,
      assignments,
      learningEvents,
      legacyEvents,
    ] = await Promise.all([
      activeTenantAdapter.listDocs(`schools/${schoolId}/elms_publications`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/elms_learner_mappings`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/elms_class_mappings`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/elms_mappings`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/elms_assignments`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/elms_learning_events`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/elms_events`),
    ]);

    const mappingById = new Map<string, any>();
    for (const m of [...legacyMappings, ...learnerMappings, ...classMappings]) {
      if (m?.id) mappingById.set(m.id, m);
    }
    const mappings = Array.from(mappingById.values());

    const eventById = new Map<string, any>();
    for (const ev of [...legacyEvents, ...learningEvents]) {
      const evId = ev?.eventId || ev?.id;
      if (evId) eventById.set(evId, ev);
    }
    const events = Array.from(eventById.values());

    const svc = registeredServices.get('ElmsIntegrationService');
    if (
      svc &&
      (publications.length > 0 ||
        mappings.length > 0 ||
        assignments.length > 0 ||
        events.length > 0)
    ) {
      svc.ingestState({
        schoolId,
        publications,
        mappings,
        assignments,
        events,
      });
    }
    return {
      publications: publications as ElmsResourcePublication[],
      events: events as ElmsLearningEvent[],
    };
  },

  // --- 7b. ASSESSMENT OVERRIDES (schools/{schoolId}/assessment_overrides/{overrideId}) ---
  persistAssessmentOverride(params: {
    schoolId: string;
    ecgArtifactId: string;
    learnerId: string;
    override: Record<string, any>;
  }): void {
    if (!params?.schoolId || !params?.ecgArtifactId || !params?.learnerId || !params?.override) return;
    const docId = `${params.ecgArtifactId}__${params.learnerId}`;
    trackWrite(
      activeTenantAdapter.setDoc(
        `schools/${params.schoolId}/assessment_overrides`,
        docId,
        {
          id: docId,
          schoolId: params.schoolId,
          ecgArtifactId: params.ecgArtifactId,
          learnerId: params.learnerId,
          override: params.override,
          updatedAt: new Date().toISOString(),
        },
        true
      )
    );
  },

  async hydrateSchoolAssessmentOverrides(schoolId: string): Promise<void> {
    if (!schoolId) return;
    await this.flushPendingWrites();
    const docs = await activeTenantAdapter.listDocs(`schools/${schoolId}/assessment_overrides`);
    const svc = registeredServices.get('LearningOutcomeInterpretationService');
    if (svc && docs.length > 0) {
      svc.ingestState({ schoolId, overrides: docs });
    }
  },

  // --- 7c. CLASS GROUPS & LEARNER ROSTERS (schools/{schoolId}/class_groups, learners, class_rosters) ---
  persistClassGroup(classGroup: Record<string, any>): void {
    if (!classGroup?.id || !classGroup?.schoolId) return;
    trackWrite(
      activeTenantAdapter.setDoc(
        `schools/${classGroup.schoolId}/class_groups`,
        classGroup.id,
        classGroup,
        true
      )
    );
  },

  persistLearner(learner: Record<string, any>): void {
    if (!learner?.id || !learner?.schoolId) return;
    trackWrite(
      activeTenantAdapter.setDoc(
        `schools/${learner.schoolId}/learners`,
        learner.id,
        learner,
        true
      )
    );
  },

  persistClassRoster(roster: Record<string, any>): void {
    if (!roster?.id || !roster?.schoolId) return;
    trackWrite(
      activeTenantAdapter.setDoc(
        `schools/${roster.schoolId}/class_rosters`,
        roster.id,
        roster,
        true
      )
    );
  },

  async hydrateSchoolClassesAndLearners(schoolId: string): Promise<void> {
    if (!schoolId) return;
    await this.flushPendingWrites();
    const [classGroups, learners, rosters] = await Promise.all([
      activeTenantAdapter.listDocs(`schools/${schoolId}/class_groups`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/learners`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/class_rosters`),
    ]);
    const cgSvc = registeredServices.get('ClassGroupService');
    if (cgSvc && classGroups.length > 0) {
      cgSvc.ingestState({ schoolId, classGroups });
    }
    const lrnSvc = registeredServices.get('LearnerRosterService');
    if (lrnSvc && (learners.length > 0 || rosters.length > 0)) {
      lrnSvc.ingestState({ schoolId, learners, rosters });
    }
  },

  // --- 7d. TEACHING & LEARNER ACTIVITIES (schools/{schoolId}/teaching_activities, learner_activities) ---
  persistTeachingActivity(activity: Record<string, any>): void {
    if (!activity?.activityId || !activity?.schoolId) return;
    trackWrite(
      activeTenantAdapter.setDoc(
        `schools/${activity.schoolId}/teaching_activities`,
        activity.activityId,
        activity,
        true
      )
    );
  },

  persistLearnerActivity(activity: Record<string, any>): void {
    if (!activity?.activityId || !activity?.schoolId) return;
    trackWrite(
      activeTenantAdapter.setDoc(
        `schools/${activity.schoolId}/learner_activities`,
        activity.activityId,
        activity,
        true
      )
    );
  },

  async hydrateSchoolActivities(schoolId: string): Promise<void> {
    if (!schoolId) return;
    await this.flushPendingWrites();
    const [teachingActivities, learnerActivities] = await Promise.all([
      activeTenantAdapter.listDocs(`schools/${schoolId}/teaching_activities`),
      activeTenantAdapter.listDocs(`schools/${schoolId}/learner_activities`),
    ]);
    const actSvc = registeredServices.get('TeachingActivityService');
    if (actSvc && (teachingActivities.length > 0 || learnerActivities.length > 0)) {
      actSvc.ingestState({ schoolId, teachingActivities, learnerActivities });
    }
  },

  // --- 8. FULL TENANT HYDRATION & PROCESS RESTART RECOVERY ---
  async hydrateSchoolTenantState(schoolId: string): Promise<void> {
    if (!schoolId) return;
    await this.flushPendingWrites();
    await Promise.all([
      this.hydrateSchoolById(schoolId),
      this.hydrateMembershipsForSchool(schoolId),
      this.hydrateSchoolClassesAndLearners(schoolId),
      this.hydrateSchoolActivities(schoolId),
      this.hydrateElmsConnection(schoolId),
      this.hydrateSchoolArtifacts(schoolId),
      this.hydrateSchoolTeacherActions(schoolId),
      this.hydrateSchoolAssessmentEvidence(schoolId),
      this.hydrateSchoolElmsIntegration(schoolId),
      this.hydrateSchoolAssessmentOverrides(schoolId),
    ]);
  },

  async simulateProcessRestart(schoolIdsToHydrate: string[] = [], userIdsToHydrate: string[] = []): Promise<void> {
    await this.flushPendingWrites();
    // 1. Wipe all volatile in-memory service stores (simulating Cloud Run instance cold-start or browser reload)
    for (const svc of registeredServices.values()) {
      svc.clearInMemoryOnly();
    }
    // 2. Rehydrate global schools and specified user/school tenant state from durable Firestore storage
    await this.hydrateSchools();
    for (const uid of userIdsToHydrate) {
      await this.hydrateMembershipsForUser(uid);
    }
    for (const schoolId of schoolIdsToHydrate) {
      await this.hydrateSchoolTenantState(schoolId);
    }
  },
};
