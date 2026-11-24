import { KENYA_COUNTIES } from '../constants/kenyaCounties.ts';
import { isValidKenyanPhone, normalizeKenyanPhone } from '../utils/phoneUtils.ts';
import { LEGACY_SCHOOL_PLACEHOLDERS } from '../utils/profileUtils.ts';
import { AuditService } from './auditService.ts';

function sanitizeString(value: any, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export const AUTHORITATIVE_WELCOME_CREDITS_DEFAULT = 5;
export const AUTHORITATIVE_WELCOME_CREDITS_MAX = 5;
export const AUTHORITATIVE_REFERRAL_CREDITS = 10;

export interface AuthenticatedTokenContext {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  claims?: {
    admin?: boolean;
    role?: string;
    [key: string]: any;
  };
}

export interface ProfileInitializationInput {
  firstName?: string;
  lastName?: string;
  name?: string;
  phoneNumber?: string;
  schoolName?: string;
  county?: string;
  inviterId?: string;
  referralCode?: string;
  initializeOnly?: boolean;
  // Untrusted client fields that MUST be ignored if supplied:
  role?: any;
  isAdmin?: any;
  schoolId?: any;
  tenantId?: any;
  credits?: any;
  creditLogs?: any;
  firstLoginBonusGranted?: any;
  welcomeCreditsGranted?: any;
}

export interface CreditReservationRequest {
  uid: string;
  endpoint: '/api/generate' | '/api/generate-stream' | '/api/illustrations/generate';
  contentType?: string;
  operationId?: string;
  totalChunks?: number;
  // Untrusted client fields that MUST be ignored:
  clientCredits?: any;
  localStorageCredits?: any;
  sessionStorageCredits?: any;
}

export interface CreditReservationResult {
  reservationId: string;
  uid: string;
  costDeducted: number;
  remainingCredits: number;
  reusedOperationReservation: boolean;
}

export interface TransactionalStorageAdapter {
  runTransaction<T>(updateFn: (tx: {
    getDoc(collection: string, docId: string): Promise<any | null>;
    setDoc(collection: string, docId: string, data: any, merge?: boolean): Promise<void>;
    updateDoc(collection: string, docId: string, data: any): Promise<void>;
    deleteDoc?(collection: string, docId: string): Promise<void>;
  }) => Promise<T>): Promise<T>;
  getDoc(collection: string, docId: string): Promise<any | null>;
  deleteDoc?(collection: string, docId: string): Promise<void>;
  listDocs?(collection: string): Promise<any[]>;
}

// Per-user async mutex to guarantee strict serialization of concurrent credit & initialization operations
const userLocks = new Map<string, Promise<any>>();

async function withUserLock<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(uid) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  userLocks.set(uid, prev.then(() => next, () => next));

  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(uid) === next) {
      userLocks.delete(uid);
    }
  }
}

// Default in-memory transactional store for unit tests when Firestore Admin is not injected
const inMemoryCollections = new Map<string, Map<string, any>>();
let simulateStorageFailure = false;

function getCollectionMap(name: string): Map<string, any> {
  if (!inMemoryCollections.has(name)) {
    inMemoryCollections.set(name, new Map());
  }
  return inMemoryCollections.get(name)!;
}

export function createInMemoryStorageAdapter(): TransactionalStorageAdapter {
  return {
    async getDoc(collection: string, docId: string) {
      if (simulateStorageFailure) {
        throw new Error('FIRESTORE_UNAVAILABLE: Simulated database read failure');
      }
      const col = getCollectionMap(collection);
      const data = col.get(docId);
      return data ? JSON.parse(JSON.stringify(data)) : null;
    },
    async deleteDoc(collection: string, docId: string) {
      if (simulateStorageFailure) {
        throw new Error('FIRESTORE_UNAVAILABLE: Simulated database delete failure');
      }
      const col = getCollectionMap(collection);
      col.delete(docId);
    },
    async listDocs(collection: string) {
      if (simulateStorageFailure) {
        throw new Error('FIRESTORE_UNAVAILABLE: Simulated database list failure');
      }
      const col = getCollectionMap(collection);
      return Array.from(col.entries()).map(([id, data]) => ({
        ...JSON.parse(JSON.stringify(data)),
        id: data?.id || id,
      }));
    },
    async runTransaction<T>(updateFn: (tx: any) => Promise<T>): Promise<T> {
      if (simulateStorageFailure) {
        throw new Error('FIRESTORE_UNAVAILABLE: Simulated database transaction failure');
      }
      // Snapshot before transaction for rollback on error
      const snapshot = new Map<string, Map<string, any>>();
      for (const [colName, colMap] of inMemoryCollections.entries()) {
        const copy = new Map<string, any>();
        for (const [k, v] of colMap.entries()) {
          copy.set(k, JSON.parse(JSON.stringify(v)));
        }
        snapshot.set(colName, copy);
      }

      const tx = {
        async getDoc(collection: string, docId: string) {
          if (simulateStorageFailure) {
            throw new Error('FIRESTORE_UNAVAILABLE: Simulated database read failure');
          }
          const col = getCollectionMap(collection);
          const val = col.get(docId);
          return val ? JSON.parse(JSON.stringify(val)) : null;
        },
        async setDoc(collection: string, docId: string, data: any, merge = true) {
          const col = getCollectionMap(collection);
          const existing = col.get(docId);
          if (merge && existing) {
            col.set(docId, { ...existing, ...JSON.parse(JSON.stringify(data)) });
          } else {
            col.set(docId, JSON.parse(JSON.stringify(data)));
          }
        },
        async updateDoc(collection: string, docId: string, data: any) {
          const col = getCollectionMap(collection);
          const existing = col.get(docId);
          if (!existing) {
            throw new Error(`Document ${collection}/${docId} does not exist`);
          }
          col.set(docId, { ...existing, ...JSON.parse(JSON.stringify(data)) });
        },
        async deleteDoc(collection: string, docId: string) {
          const col = getCollectionMap(collection);
          col.delete(docId);
        },
      };

      try {
        return await updateFn(tx);
      } catch (err) {
        // Atomic rollback
        inMemoryCollections.clear();
        for (const [colName, colMap] of snapshot.entries()) {
          inMemoryCollections.set(colName, colMap);
        }
        throw err;
      }
    },
  };
}

export function createFirestoreAdminStorageAdapter(dbAdmin: FirebaseFirestore.Firestore): TransactionalStorageAdapter {
  return {
    async getDoc(collection: string, docId: string) {
      const snap = await dbAdmin.collection(collection).doc(docId).get();
      return snap.exists ? snap.data() || null : null;
    },
    async deleteDoc(collection: string, docId: string) {
      await dbAdmin.collection(collection).doc(docId).delete();
    },
    async listDocs(collection: string) {
      const snap = await dbAdmin.collection(collection).get();
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
    async runTransaction<T>(updateFn: (tx: any) => Promise<T>): Promise<T> {
      return await dbAdmin.runTransaction(async (firestoreTx) => {
        const pendingWrites: Array<() => void> = [];
        const localCache = new Map<string, any>();

        const tx = {
          async getDoc(collection: string, docId: string) {
            const key = `${collection}/${docId}`;
            if (localCache.has(key)) {
              return localCache.get(key);
            }
            const ref = dbAdmin.collection(collection).doc(docId);
            const snap = await firestoreTx.get(ref);
            const data = snap.exists ? snap.data() || null : null;
            localCache.set(key, data ? { ...data } : null);
            return data ? { ...data } : null;
          },
          async setDoc(collection: string, docId: string, data: any, merge = true) {
            const key = `${collection}/${docId}`;
            const existing = localCache.get(key) || {};
            localCache.set(key, merge ? { ...existing, ...data } : { ...data });
            pendingWrites.push(() => {
              const ref = dbAdmin.collection(collection).doc(docId);
              firestoreTx.set(ref, data, { merge });
            });
          },
          async updateDoc(collection: string, docId: string, data: any) {
            const key = `${collection}/${docId}`;
            const existing = localCache.get(key) || {};
            localCache.set(key, { ...existing, ...data });
            pendingWrites.push(() => {
              const ref = dbAdmin.collection(collection).doc(docId);
              firestoreTx.update(ref, data);
            });
          },
          async deleteDoc(collection: string, docId: string) {
            const key = `${collection}/${docId}`;
            localCache.set(key, null);
            pendingWrites.push(() => {
              const ref = dbAdmin.collection(collection).doc(docId);
              firestoreTx.delete(ref);
            });
          },
        };

        const result = await updateFn(tx);
        for (const write of pendingWrites) {
          write();
        }
        return result;
      });
    },
  };
}

let activeStorageAdapter: TransactionalStorageAdapter = createInMemoryStorageAdapter();

export const AuthoritativeAccountService = {
  setStorageAdapter(adapter: TransactionalStorageAdapter): void {
    activeStorageAdapter = adapter;
  },

  getStorageAdapter(): TransactionalStorageAdapter {
    return activeStorageAdapter;
  },

  resetInMemoryStore(): void {
    inMemoryCollections.clear();
    simulateStorageFailure = false;
    activeStorageAdapter = createInMemoryStorageAdapter();
  },

  setSimulateStorageFailure(fail: boolean): void {
    simulateStorageFailure = fail;
  },

  /**
   * Resolves the authoritative role for a user.
   * NEVER trusts client-supplied role, isAdmin, schoolId, or tenantId.
   * NEVER uses hardcoded client email comparison as the sole authority.
   */
  resolveAuthoritativeRole(
    authContext: AuthenticatedTokenContext,
    existingUserDoc?: any | null
  ): 'Admin' | 'School Admin' | 'Teacher' | 'Student' {
    // Inactive or Suspended accounts can never exercise Admin or School Admin authority
    if (
      existingUserDoc &&
      (existingUserDoc.status === 'Inactive' || existingUserDoc.status === 'Suspended')
    ) {
      return 'Teacher';
    }

    // 1. Verified Firebase Custom Claims take top authority
    if (authContext.claims?.admin === true || authContext.claims?.role === 'Admin') {
      return 'Admin';
    }
    if (authContext.claims?.role === 'School Admin') {
      return 'School Admin';
    }

    // 2. Existing server-persisted role on the authoritative user document
    const existingRole = existingUserDoc?.role;
    if (existingRole === 'Admin' || existingRole === 'School Admin' || existingRole === 'Student') {
      return existingRole;
    }

    // 3. Default all new/standard accounts to 'Teacher'
    return 'Teacher';
  },

  /**
   * Determines the authoritative credit cost for a generation request.
   */
  resolveGenerationCreditCost(
    req: CreditReservationRequest,
    systemSettings?: {
      creditCostSow?: number;
      creditCostCba?: number;
      creditCostLesson?: number;
      creditCostQuiz?: number;
    } | null
  ): number {
    if (req.endpoint === '/api/illustrations/generate') {
      return 1;
    }
    if (req.endpoint === '/api/generate-stream') {
      return 1;
    }

    const cType = (req.contentType || '').trim();
    if (cType === 'Scheme of Work') {
      return Math.max(1, Number(systemSettings?.creditCostSow ?? 2));
    }
    if (
      cType === 'Assessment' ||
      cType === 'Topic Exam' ||
      cType === 'Term Exam' ||
      cType === 'Competency-Based Assessment (CBA)' ||
      cType === 'Midterm Exam' ||
      cType === 'Endterm Exam'
    ) {
      return Math.max(1, Number(systemSettings?.creditCostCba ?? 2));
    }
    if (
      cType === 'Lesson Plan' ||
      cType === 'Lesson Notes' ||
      cType === 'Record of Work Covered' ||
      cType === 'Study Guide'
    ) {
      return Math.max(1, Number(systemSettings?.creditCostLesson ?? 1));
    }
    return Math.max(1, Number(systemSettings?.creditCostQuiz ?? 1));
  },

  /**
   * Sanitizes a client fallback user when Firestore is unreachable or uninitialized.
   * Guarantees 0 credits and 'Teacher' role so Firestore failures never grant privileges or free credits.
   */
  buildSafeUninitializedUserFallback(params: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  }) {
    return {
      id: params.uid,
      name: (params.displayName || 'Teacher').trim() || 'Teacher',
      email: (params.email || '').trim(),
      role: 'Teacher' as const,
      status: 'Active' as const,
      credits: 0,
      creditLogs: [],
      avatarColor: 'bg-emerald-600',
      schoolName: '',
      profileComplete: false,
      firstLoginBonusGranted: false,
    };
  },

  /**
   * Authoritative server-side user initialization & profile completion.
   * - Idempotent welcome credit allocation (never grants twice).
   * - Ignores client-supplied role, isAdmin, schoolId, tenantId, credits.
   * - Atomically validates and awards referral credits if inviterId/referralCode is provided.
   */
  async completeOrInitializeProfile(
    authContext: AuthenticatedTokenContext,
    input: ProfileInitializationInput,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{
    user: any;
    welcomeCreditsGrantedNow: boolean;
    referralCreditsGrantedNow: boolean;
  }> {
    if (!authContext || !authContext.uid || typeof authContext.uid !== 'string' || !authContext.uid.trim()) {
      throw new Error('UNAUTHORIZED: Valid authenticated user UID is required.');
    }

    const uid = authContext.uid.trim();
    const email = (authContext.email || '').trim();
    const isInitOnly = Boolean(input.initializeOnly);

    // Extract non-privileged profile fields
    const rawName = (input.name || '').trim();
    const inferredFirst = rawName ? rawName.split(/\s+/)[0] : '';
    const inferredLast = rawName ? rawName.split(/\s+/).slice(1).join(' ') || inferredFirst : '';

    const firstName = (input.firstName !== undefined ? String(input.firstName) : inferredFirst).trim();
    const lastName = (input.lastName !== undefined ? String(input.lastName) : inferredLast).trim();
    const rawPhone = (input.phoneNumber !== undefined ? String(input.phoneNumber) : '').trim();
    const schoolName = (input.schoolName !== undefined ? String(input.schoolName) : '').trim();
    const county = (input.county !== undefined ? String(input.county) : '').trim();
    const rawInviterId = (input.inviterId || input.referralCode || '').toString().trim();

    if (!isInitOnly) {
      if (!firstName || !lastName || !rawPhone || !schoolName || !county) {
        throw new Error('All fields are required: First Name, Last Name, Phone Number, School Name, County');
      }
      if (!isValidKenyanPhone(rawPhone)) {
        throw new Error('Invalid Kenyan phone number. Please enter a valid number (e.g. 0717 713 493 or +254717713493).');
      }
      const normalizedCountyInput = county.toLowerCase() === 'nairobi' ? 'Nairobi City' : county;
      const matchedCounty = KENYA_COUNTIES.find(
        (c) => (typeof c === 'string' ? c : (c as any).value || '').toLowerCase() === normalizedCountyInput.toLowerCase()
      );
      if (!matchedCounty) {
        throw new Error(`Invalid county selection: ${county}`);
      }
    }

    const normalizedPhone = rawPhone ? (normalizeKenyanPhone(rawPhone) || rawPhone) : '';

    // Pre-validate self-referral before transaction
    if (rawInviterId && rawInviterId === uid) {
      throw new Error('SELF_REFERRAL_REJECTED: You cannot claim a referral using your own user ID.');
    }
    if (rawInviterId && !/^[a-zA-Z0-9_-]{1,128}$/.test(rawInviterId)) {
      throw new Error('INVALID_INVITER_REJECTED: Malformed referral inviter ID.');
    }

    return await withUserLock(uid, async () => {
      return await adapter.runTransaction(async (tx) => {
        const existingData = await tx.getDoc('users', uid);
        const globalSettings = await tx.getDoc('settings', 'global');

        const authoritativeRole = this.resolveAuthoritativeRole(authContext, existingData);

        if (!isInitOnly && authoritativeRole !== 'Admin' && LEGACY_SCHOOL_PLACEHOLDERS.includes(schoolName)) {
          throw new Error('Please provide your actual school name. "Exameno ECG" and "Exameno School" are system placeholders.');
        }

        const alreadyGrantedWelcome = Boolean(
          existingData?.firstLoginBonusGranted ||
          existingData?.welcomeCreditsGranted ||
          existingData?.profileComplete
        );

        let currentCredits = typeof existingData?.credits === 'number' ? existingData.credits : 0;
        let newCreditLogs = Array.isArray(existingData?.creditLogs) ? [...existingData.creditLogs] : [];
        let welcomeCreditsGrantedNow = false;

        if (!alreadyGrantedWelcome) {
          const welcomeEnabled = globalSettings?.welcomeCreditsEnabled !== false;
          const configuredWelcome = typeof globalSettings?.welcomeCredits === 'number'
            ? globalSettings.welcomeCredits
            : AUTHORITATIVE_WELCOME_CREDITS_DEFAULT;
          const allowedWelcome = welcomeEnabled
            ? Math.min(Math.max(0, configuredWelcome), AUTHORITATIVE_WELCOME_CREDITS_MAX)
            : 0;

          if (allowedWelcome > 0) {
            currentCredits += allowedWelcome;
            newCreditLogs.push({
              id: `welcome_${uid}`,
              date: new Date().toISOString(),
              action: `First Login Welcome Bonus (${allowedWelcome} Credits)`,
              creditsUsed: allowedWelcome,
              balance: currentCredits,
            });
          }
          welcomeCreditsGrantedNow = true;
        }

        // Referral Validation & Atomic Credit Award
        let referralCreditsGrantedNow = false;
        let referredBy = existingData?.referredBy || null;
        let referralClaimed = Boolean(existingData?.referralClaimed || existingData?.referredBy);

        if (rawInviterId) {
          const referralDocId = `ref_${uid}`;
          const existingReferralDoc = await tx.getDoc('referrals', referralDocId);

          if (referralClaimed || existingReferralDoc) {
            throw new Error('DUPLICATE_REFERRAL_REJECTED: A referral bonus has already been claimed for this account.');
          }

          const inviterDoc = await tx.getDoc('users', rawInviterId);
          if (!inviterDoc || inviterDoc.status === 'Inactive') {
            throw new Error('INVALID_INVITER_REJECTED: Referral inviter account does not exist or is inactive.');
          }

          const nowIso = new Date().toISOString();
          const inviterCurrentCredits = typeof inviterDoc.credits === 'number' ? inviterDoc.credits : 0;
          const inviterNewCredits = inviterCurrentCredits + AUTHORITATIVE_REFERRAL_CREDITS;
          const inviterLogs = Array.isArray(inviterDoc.creditLogs) ? [...inviterDoc.creditLogs] : [];
          inviterLogs.push({
            id: `ref_reward_${uid}`,
            date: nowIso,
            action: `Referral Bonus (Invitee: ${email || uid})`,
            creditsUsed: AUTHORITATIVE_REFERRAL_CREDITS,
            balance: inviterNewCredits,
          });

          // 1. Update inviter credits atomically
          await tx.setDoc('users', rawInviterId, {
            credits: inviterNewCredits,
            creditLogs: inviterLogs,
            updatedAt: nowIso,
          }, true);

          // 2. Award invitee referral bonus atomically
          currentCredits += AUTHORITATIVE_REFERRAL_CREDITS;
          newCreditLogs.push({
            id: `ref_welcome_${uid}`,
            date: nowIso,
            action: `Referral Signup Bonus (+${AUTHORITATIVE_REFERRAL_CREDITS} Credits)`,
            creditsUsed: AUTHORITATIVE_REFERRAL_CREDITS,
            balance: currentCredits,
          });

          referredBy = rawInviterId;
          referralClaimed = true;
          referralCreditsGrantedNow = true;

          // 3. Record immutable referral completion document keyed by invitee UID
          await tx.setDoc('referrals', referralDocId, {
            id: referralDocId,
            inviterId: rawInviterId,
            inviteeId: uid,
            inviteeEmail: email,
            status: 'completed',
            creditsAwarded: AUTHORITATIVE_REFERRAL_CREDITS,
            createdAt: nowIso,
          }, false);

          // 4. Create notification for inviter
          const notifId = `notif_ref_${uid}`;
          await tx.setDoc('notifications', notifId, {
            id: notifId,
            title: 'Successful Referral!',
            message: 'A new teacher has joined using your referral link. You have earned 10 credits!',
            userId: rawInviterId,
            isRead: false,
            createdAt: nowIso,
          }, false);
        }

        const nowIso = new Date().toISOString();
        const resolvedFirstName = firstName || existingData?.firstName || 'Teacher';
        const resolvedLastName = lastName || existingData?.lastName || '';
        const fullName = `${resolvedFirstName} ${resolvedLastName}`.trim() || existingData?.name || 'Teacher';
        const isCompleteNow = !isInitOnly
          ? true
          : Boolean(existingData?.profileComplete);

        const updatedUserPayload: Record<string, any> = {
          id: uid,
          email: email || existingData?.email || '',
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          name: fullName,
          phoneNumber: normalizedPhone || existingData?.phoneNumber || '',
          schoolName: schoolName || existingData?.schoolName || '',
          county: county || existingData?.county || '',
          profileComplete: isCompleteNow,
          firstLoginBonusGranted: true,
          welcomeCreditsGranted: true,
          referralClaimed,
          ...(referredBy ? { referredBy } : {}),
          credits: currentCredits,
          creditLogs: newCreditLogs,
          role: authoritativeRole,
          status: existingData?.status || 'Active',
          avatarColor: existingData?.avatarColor || 'bg-emerald-600',
          createdAt: existingData?.createdAt || nowIso,
          dateJoined: existingData?.dateJoined || existingData?.createdAt || nowIso,
          updatedAt: nowIso,
        };

        // Preserve existing server-assigned schoolId/tenantId if already present on existingData, never from client input
        if (existingData?.schoolId) {
          updatedUserPayload.schoolId = existingData.schoolId;
        }
        if (existingData?.tenantId) {
          updatedUserPayload.tenantId = existingData.tenantId;
        }

        await tx.setDoc('users', uid, updatedUserPayload, true);

        return {
          user: updatedUserPayload,
          welcomeCreditsGrantedNow,
          referralCreditsGrantedNow,
        };
      });
    });
  },

  /**
   * Atomically verifies and reserves/deducts authoritative credits before AI generation.
   * - Completely ignores client-reported, localStorage, or sessionStorage credits.
   * - Fails closed if Firestore read fails or user has insufficient credits.
   * - Prevents concurrent double-spending via per-user lock + atomic transaction.
   */
  async verifyAndReserveCredits(
    req: CreditReservationRequest,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<CreditReservationResult> {
    if (!req.uid || typeof req.uid !== 'string' || !req.uid.trim()) {
      throw new Error('UNAUTHORIZED: Authentication required for credit verification.');
    }

    const uid = req.uid.trim();

    return await withUserLock(uid, async () => {
      return await adapter.runTransaction(async (tx) => {
        const userDoc = await tx.getDoc('users', uid);
        if (!userDoc) {
          throw new Error('ACCOUNT_NOT_INITIALIZED: Authoritative user profile not found. Complete profile initialization first.');
        }
        if (userDoc.status === 'Inactive') {
          throw new Error('ACCOUNT_INACTIVE: User account is inactive.');
        }

        const globalSettings = await tx.getDoc('settings', 'global');
        const cost = this.resolveGenerationCreditCost(req, globalSettings);

        // Multi-chunk SOW operation reuse check (bounded to same uid, active reservation, and max 8 chunks)
        if (req.operationId && req.contentType === 'Scheme of Work') {
          const cleanOpId = String(req.operationId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
          if (cleanOpId) {
            const opResId = `sow_op_${uid}_${cleanOpId}`;
            const existingReservation = await tx.getDoc('credit_reservations', opResId);
            const nowMs = Date.now();
            if (
              existingReservation &&
              existingReservation.uid === uid &&
              existingReservation.status === 'RESERVED' &&
              existingReservation.expiresAtMs > nowMs &&
              existingReservation.chunksUsed < existingReservation.maxChunks
            ) {
              await tx.updateDoc('credit_reservations', opResId, {
                chunksUsed: existingReservation.chunksUsed + 1,
                updatedAt: new Date().toISOString(),
              });
              return {
                reservationId: opResId,
                uid,
                costDeducted: 0,
                remainingCredits: typeof userDoc.credits === 'number' ? userDoc.credits : 0,
                reusedOperationReservation: true,
              };
            }
          }
        }

        // Strict server-side balance check (ignores any clientCredits / localStorage / sessionStorage)
        const authoritativeCredits = typeof userDoc.credits === 'number' ? userDoc.credits : 0;
        if (!Number.isFinite(authoritativeCredits) || authoritativeCredits < cost || authoritativeCredits - cost < 0) {
          throw new Error(
            `INSUFFICIENT_CREDITS: Required ${cost} credit(s), but authoritative balance is ${Math.max(0, authoritativeCredits)}.`
          );
        }

        const newBalance = authoritativeCredits - cost;
        const nowIso = new Date().toISOString();
        const reservationId =
          req.operationId && req.contentType === 'Scheme of Work'
            ? `sow_op_${uid}_${String(req.operationId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}`
            : `res_${uid}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const newLog = {
          id: `log_${reservationId}`,
          date: nowIso,
          action: `Generated: ${req.contentType || req.endpoint}`,
          creditsUsed: -cost,
          balance: newBalance,
        };

        const existingLogs = Array.isArray(userDoc.creditLogs) ? [...userDoc.creditLogs] : [];
        existingLogs.push(newLog);

        await tx.setDoc('users', uid, {
          credits: newBalance,
          creditLogs: existingLogs,
          updatedAt: nowIso,
        }, true);

        await tx.setDoc('credit_reservations', reservationId, {
          reservationId,
          uid,
          endpoint: req.endpoint,
          contentType: req.contentType || 'General',
          cost,
          chunksUsed: 1,
          maxChunks: Math.min(Math.max(Number(req.totalChunks) || 1, 1), 8),
          status: 'RESERVED',
          createdAt: nowIso,
          updatedAt: nowIso,
          expiresAtMs: Date.now() + 2 * 60 * 1000,
        }, false);

        return {
          reservationId,
          uid,
          costDeducted: cost,
          remainingCredits: newBalance,
          reusedOperationReservation: false,
        };
      });
    });
  },

  /**
   * Marks a credit reservation as completed after successful generation.
   */
  async commitCreditReservation(
    uid: string,
    reservationId: string,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<void> {
    if (!uid || !reservationId) return;
    await withUserLock(uid, async () => {
      await adapter.runTransaction(async (tx) => {
        const resDoc = await tx.getDoc('credit_reservations', reservationId);
        if (!resDoc || resDoc.uid !== uid || resDoc.status !== 'RESERVED') {
          return;
        }
        await tx.updateDoc('credit_reservations', reservationId, {
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
        });
      });
    });
  },

  /**
   * Atomically and idempotently refunds reserved credits when AI generation fails.
   * Guarantees a failed reservation can never be refunded more than once.
   */
  async refundCreditReservation(
    uid: string,
    reservationId: string,
    reason: string = 'Generation failed',
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ refunded: boolean; remainingCredits: number }> {
    if (!uid || !reservationId) {
      return { refunded: false, remainingCredits: 0 };
    }

    return await withUserLock(uid, async () => {
      return await adapter.runTransaction(async (tx) => {
        const resDoc = await tx.getDoc('credit_reservations', reservationId);
        const userDoc = await tx.getDoc('users', uid);
        const currentCredits = typeof userDoc?.credits === 'number' ? userDoc.credits : 0;

        if (!resDoc || resDoc.uid !== uid || resDoc.status !== 'RESERVED' || resDoc.cost <= 0) {
          return { refunded: false, remainingCredits: currentCredits };
        }

        const restoredBalance = currentCredits + resDoc.cost;
        const nowIso = new Date().toISOString();
        const existingLogs = Array.isArray(userDoc?.creditLogs) ? [...userDoc.creditLogs] : [];
        existingLogs.push({
          id: `refund_${reservationId}`,
          date: nowIso,
          action: `Refund (${reason})`,
          creditsUsed: resDoc.cost,
          balance: restoredBalance,
        });

        await tx.updateDoc('credit_reservations', reservationId, {
          status: 'REFUNDED',
          refundedAt: nowIso,
          refundReason: reason,
        });

        await tx.setDoc('users', uid, {
          credits: restoredBalance,
          creditLogs: existingLogs,
          updatedAt: nowIso,
        }, true);

        return {
          refunded: true,
          remainingCredits: restoredBalance,
        };
      });
    });
  },

  /**
   * Deterministic evaluator mirroring `/firestore.rules` for P0 security verification.
   */
  async evaluateFirestoreRuleAccess(
    params: {
      path: string;
      operation: 'read' | 'create' | 'update' | 'delete';
      auth: AuthenticatedTokenContext | null;
      resourceData?: Record<string, any> | null;
      requestData?: Record<string, any> | null;
    },
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ allowed: boolean; reason: string }> {
    const { path, operation, auth, resourceData, requestData } = params;
    const segments = path.replace(/^\/+|\/+$/g, '').split('/');

    const isSignedIn = Boolean(auth && auth.uid);
    if (!isSignedIn && segments[0] !== 'settings' && segments[0] !== 'test') {
      return { allowed: false, reason: 'UNAUTHENTICATED' };
    }

    const uid = auth?.uid || '';
    const emailVerified = auth?.emailVerified !== false;
    const callerUserDoc = isSignedIn ? await adapter.getDoc('users', uid) : null;
    const isCallerActive =
      !callerUserDoc ||
      (callerUserDoc.status !== 'Inactive' && callerUserDoc.status !== 'Suspended');
    const isPlatformAdmin = Boolean(
      isSignedIn &&
      isCallerActive &&
      (auth?.claims?.admin === true ||
        auth?.claims?.role === 'Admin' ||
        callerUserDoc?.role === 'Admin')
    );

    const isSchoolAdminFor = async (schoolId?: string): Promise<boolean> => {
      if (!isSignedIn || !schoolId) return false;
      if (isPlatformAdmin) return true;
      const memDoc = await adapter.getDoc('schoolMemberships', `mem_${uid}_${schoolId}`);
      return Boolean(
        memDoc &&
        memDoc.userId === uid &&
        memDoc.schoolId === schoolId &&
        memDoc.status === 'ACTIVE' &&
        (memDoc.role === 'SCHOOL_ADMIN' || memDoc.role === 'SUPER_ADMIN')
      );
    };

    // 1. /users/{userId}
    if (segments[0] === 'users' && segments.length === 2) {
      const targetUserId = segments[1];
      if (operation === 'read') {
        if (uid === targetUserId || isPlatformAdmin) {
          return { allowed: true, reason: 'OWNER_OR_ADMIN_READ' };
        }
        return { allowed: false, reason: 'CROSS_USER_READ_DENIED' };
      }

      if (operation === 'create') {
        if (!emailVerified || uid !== targetUserId) {
          return { allowed: false, reason: 'UNVERIFIED_OR_NON_OWNER_CREATE' };
        }
        const data = requestData || {};
        const forbiddenKeys = ['isAdmin', 'schoolId', 'tenantId', 'firstLoginBonusGranted', 'welcomeCreditsGranted', 'referredBy', 'referralClaimed'];
        if (forbiddenKeys.some((k) => k in data)) {
          return { allowed: false, reason: 'PRIVILEGED_FIELD_ON_CLIENT_CREATE_DENIED' };
        }
        if ('role' in data && data.role !== 'Teacher') {
          return { allowed: false, reason: 'NON_TEACHER_ROLE_ON_CLIENT_CREATE_DENIED' };
        }
        const allowedKeys = new Set([
          'id', 'name', 'firstName', 'lastName', 'email', 'phoneNumber', 'role', 'status',
          'credits', 'creditLogs', 'avatarColor', 'schoolName', 'county', 'createdAt', 'updatedAt', 'dateJoined'
        ]);
        if (Object.keys(data).some((k) => !allowedKeys.has(k))) {
          return { allowed: false, reason: 'GHOST_FIELD_ON_CLIENT_CREATE_DENIED' };
        }
        const credits = typeof data.credits === 'number' ? data.credits : 0;
        if (credits < 0 || credits > 5) {
          return { allowed: false, reason: 'INITIAL_CREDITS_LIMIT_EXCEEDED' };
        }
        return { allowed: true, reason: 'VALID_SELF_CREATE' };
      }

      if (operation === 'update') {
        if (!emailVerified || uid !== targetUserId) {
          return { allowed: false, reason: 'CROSS_USER_UPDATE_DENIED' };
        }
        const existing = resourceData || (await adapter.getDoc('users', targetUserId)) || {};
        const incoming = { ...existing, ...(requestData || {}) };
        const changedKeys = Object.keys(incoming).filter(
          (k) => JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])
        );
        const immutableKeys = ['role', 'isAdmin', 'schoolId', 'tenantId', 'firstLoginBonusGranted', 'welcomeCreditsGranted', 'referredBy', 'referralClaimed'];
        if (changedKeys.some((k) => immutableKeys.includes(k))) {
          return { allowed: false, reason: 'IMMUTABLE_PRIVILEGED_FIELD_UPDATE_DENIED' };
        }
        if (changedKeys.includes('credits') || changedKeys.includes('creditLogs')) {
          const newCredits = typeof incoming.credits === 'number' ? incoming.credits : 0;
          const oldCredits = typeof existing.credits === 'number' ? existing.credits : 0;
          if (!(newCredits < oldCredits && newCredits >= 0)) {
            return { allowed: false, reason: 'CLIENT_CREDIT_INFLATION_DENIED' };
          }
        }
        return { allowed: true, reason: 'VALID_SELF_UPDATE' };
      }

      return { allowed: false, reason: 'USER_DELETE_DENIED' };
    }

    // 2. /referrals/{referralId}
    if (segments[0] === 'referrals' && segments.length === 2) {
      if (operation === 'read') {
        const existing = resourceData || (await adapter.getDoc('referrals', segments[1]));
        if (
          isPlatformAdmin ||
          (existing && (existing.inviterId === uid || existing.inviteeId === uid))
        ) {
          return { allowed: true, reason: 'REFERRAL_PARTICIPANT_READ' };
        }
        return { allowed: false, reason: 'REFERRAL_READ_DENIED' };
      }
      return { allowed: false, reason: 'CLIENT_REFERRAL_WRITE_DENIED' };
    }

    // 3. /schoolMemberships/{membershipId}
    if (segments[0] === 'schoolMemberships' && segments.length === 2) {
      const existing = resourceData || (await adapter.getDoc('schoolMemberships', segments[1]));
      if (operation === 'read') {
        const targetSchoolId = existing?.schoolId;
        if (
          isPlatformAdmin ||
          existing?.userId === uid ||
          (await isSchoolAdminFor(targetSchoolId))
        ) {
          return { allowed: true, reason: 'AUTHORIZED_MEMBERSHIP_READ' };
        }
        return { allowed: false, reason: 'CROSS_TENANT_MEMBERSHIP_READ_DENIED' };
      }

      if (operation === 'create') {
        const data = requestData || {};
        if (isPlatformAdmin || (await isSchoolAdminFor(data.schoolId))) {
          return { allowed: true, reason: 'ADMIN_MEMBERSHIP_CREATE' };
        }
        // Ordinary user can only request PENDING TEACHER membership for themselves
        if (
          data.userId === uid &&
          data.role === 'TEACHER' &&
          data.status === 'PENDING' &&
          typeof data.schoolId === 'string' &&
          data.schoolId.length > 0
        ) {
          return { allowed: true, reason: 'SELF_PENDING_TEACHER_JOIN_REQUEST' };
        }
        return { allowed: false, reason: 'PRIVILEGED_OR_CROSS_USER_MEMBERSHIP_CREATE_DENIED' };
      }

      if (operation === 'update') {
        if (!existing) {
          return { allowed: false, reason: 'MEMBERSHIP_NOT_FOUND' };
        }
        if (isPlatformAdmin || (await isSchoolAdminFor(existing.schoolId))) {
          return { allowed: true, reason: 'ADMIN_MEMBERSHIP_UPDATE' };
        }
        // Ordinary user can only mark their own membership REMOVED (leave school) without changing role/schoolId/userId
        const incoming = { ...existing, ...(requestData || {}) };
        if (
          existing.userId === uid &&
          incoming.userId === uid &&
          incoming.schoolId === existing.schoolId &&
          incoming.role === existing.role &&
          incoming.status === 'REMOVED'
        ) {
          return { allowed: true, reason: 'SELF_LEAVE_SCHOOL_ALLOWED' };
        }
        return { allowed: false, reason: 'UNAUTHORIZED_MEMBERSHIP_MODIFICATION_DENIED' };
      }

      return { allowed: false, reason: 'MEMBERSHIP_DELETE_DENIED' };
    }

    // 4. /schools/{schoolId}
    if (segments[0] === 'schools' && segments.length === 2) {
      const schoolId = segments[1];
      if (operation === 'read') {
        return { allowed: true, reason: 'AUTHENTICATED_SCHOOL_READ' };
      }
      if (operation === 'create') {
        const data = requestData || {};
        const existing = resourceData || (await adapter.getDoc('schools', schoolId));
        if (existing) {
          return { allowed: false, reason: 'SCHOOL_ALREADY_EXISTS' };
        }
        const forbiddenSchoolKeys = ['subscriptionTier', 'quotaOverride', 'securityConfig', 'elmsSharedSecret', 'verifiedByAdmin'];
        if (!isPlatformAdmin && forbiddenSchoolKeys.some((k) => k in data)) {
          return { allowed: false, reason: 'PRIVILEGED_SCHOOL_CONFIG_ON_CREATE_DENIED' };
        }
        if (isPlatformAdmin || (data.id === schoolId && data.createdBy === uid && data.status === 'active')) {
          return { allowed: true, reason: 'AUTHORIZED_SCHOOL_CLAIM_CREATE' };
        }
        return { allowed: false, reason: 'UNAUTHORIZED_SCHOOL_CREATE_DENIED' };
      }
      if (operation === 'update') {
        const existing = resourceData || (await adapter.getDoc('schools', schoolId));
        if (!existing) {
          return { allowed: false, reason: 'SCHOOL_NOT_FOUND' };
        }
        if (isPlatformAdmin) {
          return { allowed: true, reason: 'PLATFORM_ADMIN_SCHOOL_UPDATE' };
        }
        const isSchoolAdmin = await isSchoolAdminFor(schoolId);
        if (!isSchoolAdmin) {
          return { allowed: false, reason: 'CROSS_SCHOOL_OR_NON_ADMIN_UPDATE_DENIED' };
        }
        const incoming = { ...existing, ...(requestData || {}) };
        const protectedSchoolKeys = ['id', 'createdBy', 'canonicalSchoolId', 'subscriptionTier', 'quotaOverride', 'securityConfig', 'elmsSharedSecret', 'verifiedByAdmin'];
        const changedKeys = Object.keys(incoming).filter(
          (k) => JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])
        );
        if (changedKeys.some((k) => protectedSchoolKeys.includes(k))) {
          return { allowed: false, reason: 'PROTECTED_SCHOOL_FIELD_UPDATE_DENIED' };
        }
        return { allowed: true, reason: 'AUTHORIZED_SCHOOL_ADMIN_UPDATE' };
      }
      return { allowed: false, reason: 'SCHOOL_DELETE_DENIED' };
    }

    // 5. /schools/{schoolId}/elms_connections/{connectionId}
    if (segments[0] === 'schools' && segments[2] === 'elms_connections' && segments.length === 4) {
      const schoolId = segments[1];
      if (operation === 'delete') {
        return { allowed: false, reason: 'ELMS_CONNECTION_DELETE_DENIED' };
      }
      if (isPlatformAdmin || (await isSchoolAdminFor(schoolId))) {
        return { allowed: true, reason: 'AUTHORIZED_SCHOOL_ELMS_CONNECTION_ACCESS' };
      }
      return { allowed: false, reason: 'UNAUTHORIZED_ELMS_CONNECTION_ACCESS_DENIED' };
    }

    // 5b. /schools/{schoolId}/{tenantSubcollection}/{docId}
    const tenantSubcollections = new Set([
      'artifacts',
      'content_artifacts',
      'teacher_actions',
      'follow_up_comparisons',
      'teacher_action_comparisons',
      'assessments',
      'assessment_attempts',
      'assessment_responses',
      'assessment_evaluations',
      'outcome_evidence',
      'elms_evidence',
      'elms_publications',
      'elms_assignments',
      'elms_learner_mappings',
      'elms_class_mappings',
      'elms_mappings',
      'elms_learning_events',
      'elms_events',
      'assessment_overrides',
      'class_groups',
      'learners',
      'class_rosters',
      'teaching_activities',
      'learner_activities',
      'teaching_plans',
      'academic_years',
      'academic_terms',
      'calendar_events',
      'lesson_schedules',
      'teacher_assignments',
      'operational_exceptions',
      'learning_groups',
      'learning_group_memberships',
      'learner_support_needs',
      'learner_support_plans',
      'group_support_assignments',
      'lesson_reviews',
      'teaching_reflections',
      'next_lesson_recommendations',
      'next_lesson_plans',
      'teaching_sequences',
      'lesson_sequence_entries',
      'continuity_issues',
      'follow_through_actions',
      'learner_participations',
    ]);
    if (segments[0] === 'schools' && segments.length === 4 && tenantSubcollections.has(segments[2])) {
      const schoolId = segments[1];
      if (operation === 'delete') {
        return { allowed: false, reason: 'TENANT_RECORD_DELETE_DENIED' };
      }
      if (isPlatformAdmin) {
        return { allowed: true, reason: 'PLATFORM_ADMIN_TENANT_ACCESS' };
      }
      const memDoc = await adapter.getDoc('schoolMemberships', `mem_${uid}_${schoolId}`);
      const isActiveMember = Boolean(
        memDoc &&
        memDoc.userId === uid &&
        memDoc.schoolId === schoolId &&
        memDoc.status === 'ACTIVE'
      );
      if (!isActiveMember) {
        return { allowed: false, reason: 'CROSS_SCHOOL_TENANT_ACCESS_DENIED' };
      }
      if (operation === 'create' || operation === 'update') {
        const data = requestData || {};
        if (data.schoolId && data.schoolId !== schoolId) {
          return { allowed: false, reason: 'CROSS_SCHOOL_PAYLOAD_MISMATCH_DENIED' };
        }
      }
      return { allowed: true, reason: 'AUTHORIZED_SCHOOL_MEMBER_TENANT_ACCESS' };
    }

    // 5c. /teacher_profiles/{userId}
    if (segments[0] === 'teacher_profiles' && segments.length === 2) {
      const targetUserId = segments[1];
      if (operation === 'delete') {
        return { allowed: false, reason: 'TEACHER_PROFILE_DELETE_DENIED' };
      }
      if (operation === 'read') {
        if (uid === targetUserId || isPlatformAdmin) {
          return { allowed: true, reason: 'OWNER_OR_ADMIN_TEACHER_PROFILE_READ' };
        }
        return { allowed: false, reason: 'CROSS_USER_TEACHER_PROFILE_READ_DENIED' };
      }
      const data = requestData || {};
      if ((uid === targetUserId || isPlatformAdmin) && data.userId === targetUserId) {
        return { allowed: true, reason: 'VALID_TEACHER_PROFILE_WRITE' };
      }
      return { allowed: false, reason: 'UNAUTHORIZED_TEACHER_PROFILE_WRITE_DENIED' };
    }

    // 6. /curriculum_overrides/{key}
    if (segments[0] === 'curriculum_overrides' && segments.length === 2) {
      if (operation === 'read') {
        return { allowed: true, reason: 'AUTHENTICATED_CURRICULUM_OVERRIDE_READ' };
      }
      if (isPlatformAdmin) {
        return { allowed: true, reason: 'PLATFORM_ADMIN_CURRICULUM_OVERRIDE_WRITE' };
      }
      return { allowed: false, reason: 'UNAUTHORIZED_CURRICULUM_OVERRIDE_WRITE_DENIED' };
    }

    // 7. /settings/{docId}
    if (segments[0] === 'settings' && segments.length === 2) {
      const settingId = segments[1];
      if (operation === 'read') {
        if (settingId === 'secrets') {
          return { allowed: false, reason: 'SECRETS_CLIENT_READ_DENIED' };
        }
        return { allowed: true, reason: 'PUBLIC_SETTINGS_READ' };
      }
      return { allowed: false, reason: 'CLIENT_SETTINGS_WRITE_DENIED' };
    }

    // 8. /adminAuditLogs/{logId}
    if (segments[0] === 'adminAuditLogs' && segments.length === 2) {
      if (operation === 'read' && isPlatformAdmin) {
        return { allowed: true, reason: 'PLATFORM_ADMIN_AUDIT_READ' };
      }
      return { allowed: false, reason: 'CLIENT_AUDIT_ACCESS_DENIED' };
    }

    return { allowed: false, reason: 'DEFAULT_DENY' };
  },

  // ============================================================================
  // PHASE 32.2 — P1-02: ADMIN PANEL BACKEND AUTHORIZATION & USER MANAGEMENT
  // ============================================================================

  /**
   * Strips any plaintext password or credential fields from a user record before persisting or returning.
   */
  stripSensitiveUserFields<T extends Record<string, any> | null | undefined>(userDoc: T): T {
    if (!userDoc || typeof userDoc !== 'object') return userDoc;
    const copy: Record<string, any> = { ...userDoc };
    delete copy.password;
    delete copy.passwordHash;
    delete copy.rawPassword;
    delete copy.resetToken;
    return copy as T;
  },

  /**
   * Authoritatively verifies that the caller is an authenticated Platform Admin (`role === 'Admin'`).
   * Rejects unauthenticated callers, inactive/suspended admins, ordinary Teachers, Students, and School Admins.
   */
  async verifyAdminAuthority(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ adminUid: string; adminUserDoc: any }> {
    if (!adminAuth || !adminAuth.uid || typeof adminAuth.uid !== 'string' || !adminAuth.uid.trim()) {
      throw new Error('UNAUTHENTICATED: Valid authentication is required for admin operations.');
    }
    const adminUid = adminAuth.uid.trim();
    const adminUserDoc = await adapter.getDoc('users', adminUid);

    if (adminUserDoc?.status === 'Suspended' || adminUserDoc?.status === 'Inactive') {
      AuditService.log('SECURITY_VIOLATION', 'system', {
        action: 'INACTIVE_ADMIN_ACCESS_DENIED',
        callerUid: adminUid,
        status: adminUserDoc.status,
      });
      throw new Error(`ACCOUNT_SUSPENDED: Admin account (${adminUserDoc.status}) cannot execute privileged operations.`);
    }

    const resolvedRole = this.resolveAuthoritativeRole(adminAuth, adminUserDoc);

    if (resolvedRole !== 'Admin') {
      AuditService.log('SECURITY_VIOLATION', 'system', {
        action: 'UNAUTHORIZED_ADMIN_ENDPOINT_ACCESS',
        callerUid: adminUid,
        resolvedRole,
      });
      throw new Error('FORBIDDEN_ADMIN_ONLY: Platform Admin privileges are required for this operation.');
    }

    return { adminUid, adminUserDoc };
  },

  /**
   * Lists all user accounts for the Admin Panel behind verified Platform Admin authorization.
   */
  async adminListUsers(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<any[]> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    const rawUsers = adapter.listDocs ? await adapter.listDocs('users') : [];
    const users = rawUsers.map((u) => this.stripSensitiveUserFields(u));
    AuditService.log('ADMIN_ACTION', 'system', {
      action: 'ADMIN_USERS_LISTED',
      adminUid,
      count: users.length,
    });
    return users;
  },

  /**
   * Creates a new user account via backend Platform Admin authority.
   */
  async adminCreateUser(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    input: {
      id?: string;
      name: string;
      email: string;
      phoneNumber?: string;
      schoolName?: string;
      county?: string;
      role?: 'Admin' | 'School Admin' | 'Teacher' | 'Student';
      status?: 'Active' | 'Inactive' | 'Suspended';
      accountType?: 'Standard' | 'Demo';
      expiryDate?: string;
      credits?: number;
      avatarColor?: string;
      username?: string;
      password?: string;
    },
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ user: any; auditId: string }> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    const cleanEmail = sanitizeString(input?.email, 160).toLowerCase();
    const cleanName = sanitizeString(input?.name, 150);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('INVALID_EMAIL: A valid email address is required.');
    }
    if (!cleanName) {
      throw new Error('INVALID_NAME: Full name is required.');
    }

    const role = input.role || 'Teacher';
    const validRoles = ['Admin', 'School Admin', 'Teacher', 'Student'];
    if (!validRoles.includes(role)) {
      throw new Error(`INVALID_ROLE: Unsupported role "${role}".`);
    }

    const status = input.status || 'Active';
    const validStatuses = ['Active', 'Inactive', 'Suspended'];
    if (!validStatuses.includes(status)) {
      throw new Error(`INVALID_STATUS: Unsupported status "${status}".`);
    }

    const credits = input.credits !== undefined ? Math.floor(Number(input.credits)) : 5;
    if (!Number.isFinite(credits) || credits < 0) {
      throw new Error('INVALID_CREDITS: Initial credits must be a non-negative integer.');
    }

    const userId =
      (input.id && sanitizeString(String(input.id), 100)) ||
      `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return withUserLock(userId, async () => {
      return adapter.runTransaction(async (tx) => {
        const now = new Date().toISOString();
        const username =
          input.username ||
          cleanEmail.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() +
            Math.floor(Math.random() * 100);
        const newUser: Record<string, any> = {
          id: userId,
          name: cleanName,
          email: cleanEmail,
          username,
          phoneNumber: sanitizeString(input.phoneNumber, 30) || '',
          schoolName: sanitizeString(input.schoolName, 160) || '',
          county: sanitizeString(input.county, 80) || '',
          role,
          status,
          accountType: input.accountType === 'Demo' ? 'Demo' : 'Standard',
          ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
          credits,
          creditLogs: [
            {
              id: `log_init_${userId}`,
              date: now,
              action: 'Initial Admin Provisioning',
              creditsUsed: credits,
              balance: credits,
              amount: credits,
              description: 'Initial Admin Provisioning',
              performedBy: adminUid,
            },
          ],
          avatarColor:
            sanitizeString(input.avatarColor, 60) ||
            ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-yellow-600', 'bg-red-600'][
              Math.floor(Math.random() * 5)
            ],
          createdAt: now,
          dateJoined: now,
          updatedAt: now,
          createdByAdmin: adminUid,
        };

        const sanitizedNewUser = this.stripSensitiveUserFields(newUser);
        await tx.setDoc('users', userId, sanitizedNewUser, false);

        const auditId = `audit_user_crt_${userId}_${Date.now()}`;
        await tx.setDoc(
          'adminAuditLogs',
          auditId,
          {
            id: auditId,
            action: 'ADMIN_USER_CREATED',
            actorUid: adminUid,
            targetUserId: userId,
            targetEmail: cleanEmail,
            assignedRole: role,
            initialCredits: credits,
            timestamp: now,
          },
          false
        );

        AuditService.log('ADMIN_ACTION', 'system', {
          action: 'ADMIN_USER_CREATED',
          adminUid,
          targetUserId: userId,
          role,
          credits,
        });

        return { user: newUser, auditId };
      });
    });
  },

  /**
   * Updates a target user's profile, role, status, or credits via an atomic backend transaction.
   * Enforces strict validation, prevents admin self-lockout/self-demotion, and writes an immutable audit log.
   */
  async adminUpdateUser(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    targetUserId: string,
    updates: {
      name?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phoneNumber?: string;
      schoolName?: string;
      county?: string;
      role?: 'Admin' | 'School Admin' | 'Teacher' | 'Student';
      status?: 'Active' | 'Inactive' | 'Suspended';
      accountType?: 'Standard' | 'Demo';
      expiryDate?: string;
      credits?: number;
      creditDelta?: number;
      creditReason?: string;
      avatarColor?: string;
    },
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ user: any; auditId: string }> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    const cleanTargetId = typeof targetUserId === 'string' ? targetUserId.trim() : '';
    if (!cleanTargetId) {
      throw new Error('INVALID_TARGET_USER: Target user ID is required.');
    }

    // Prevent self-demotion or self-suspension of the acting Platform Admin
    if (cleanTargetId === adminUid) {
      if (updates.role !== undefined && updates.role !== 'Admin') {
        throw new Error('ADMIN_SELF_LOCKOUT_PREVENTED: Platform Admin cannot demote their own account.');
      }
      if (updates.status !== undefined && updates.status !== 'Active') {
        throw new Error('ADMIN_SELF_LOCKOUT_PREVENTED: Platform Admin cannot deactivate or suspend their own account.');
      }
    }

    const validRoles = ['Admin', 'School Admin', 'Teacher', 'Student'];
    if (updates.role !== undefined && !validRoles.includes(updates.role)) {
      throw new Error(`INVALID_ROLE: Unsupported role "${updates.role}".`);
    }

    const validStatuses = ['Active', 'Inactive', 'Suspended'];
    if (updates.status !== undefined && !validStatuses.includes(updates.status)) {
      throw new Error(`INVALID_STATUS: Unsupported status "${updates.status}".`);
    }

    if (updates.credits !== undefined) {
      if (typeof updates.credits !== 'number' || !Number.isFinite(updates.credits) || updates.credits < 0) {
        throw new Error('INVALID_CREDITS: Credit balance must be a non-negative number.');
      }
    }
    if (updates.creditDelta !== undefined) {
      if (typeof updates.creditDelta !== 'number' || !Number.isFinite(updates.creditDelta)) {
        throw new Error('INVALID_CREDITS: Credit delta must be a finite number.');
      }
    }

    return withUserLock(cleanTargetId, async () => {
      return adapter.runTransaction(async (tx) => {
        const existing = await tx.getDoc('users', cleanTargetId);
        if (!existing) {
          throw new Error(`USER_NOT_FOUND: User ${cleanTargetId} does not exist.`);
        }

        const now = new Date().toISOString();
        const previousCredits = typeof existing.credits === 'number' ? existing.credits : 0;
        let nextCredits = previousCredits;

        if (updates.credits !== undefined) {
          nextCredits = Math.floor(updates.credits);
        } else if (updates.creditDelta !== undefined) {
          nextCredits = Math.floor(previousCredits + updates.creditDelta);
        }

        if (nextCredits < 0) {
          throw new Error(`INVALID_CREDITS: Resulting credit balance (${nextCredits}) cannot be negative.`);
        }

        const creditDiff = nextCredits - previousCredits;
        const existingLogs = Array.isArray(existing.creditLogs) ? [...existing.creditLogs] : [];
        if (creditDiff !== 0) {
          const actionLabel =
            updates.creditReason?.trim() ||
            (creditDiff > 0 ? 'Admin Credit Grant' : 'Admin Credit Adjustment');
          existingLogs.unshift({
            id: `log_admin_${cleanTargetId}_${Date.now()}`,
            date: now,
            action: actionLabel,
            creditsUsed: creditDiff,
            balance: nextCredits,
            amount: creditDiff,
            description: actionLabel,
            performedBy: adminUid,
          });
        }

        const nextFirstName =
          updates.firstName !== undefined ? sanitizeString(updates.firstName, 80) : existing.firstName;
        const nextLastName =
          updates.lastName !== undefined ? sanitizeString(updates.lastName, 80) : existing.lastName;
        const computedFullName =
          updates.name !== undefined
            ? sanitizeString(updates.name, 150)
            : nextFirstName || nextLastName
            ? `${nextFirstName || ''} ${nextLastName || ''}`.trim()
            : existing.name;

        const updatedUser: Record<string, any> = {
          ...existing,
          id: cleanTargetId,
          ...(computedFullName ? { name: computedFullName } : {}),
          ...(nextFirstName !== undefined ? { firstName: nextFirstName } : {}),
          ...(nextLastName !== undefined ? { lastName: nextLastName } : {}),
          ...(updates.email !== undefined ? { email: sanitizeString(updates.email, 160) } : {}),
          ...(updates.phoneNumber !== undefined ? { phoneNumber: sanitizeString(updates.phoneNumber, 30) } : {}),
          ...(updates.schoolName !== undefined ? { schoolName: sanitizeString(updates.schoolName, 160) } : {}),
          ...(updates.county !== undefined ? { county: sanitizeString(updates.county, 80) } : {}),
          ...(updates.avatarColor !== undefined ? { avatarColor: sanitizeString(updates.avatarColor, 60) } : {}),
          ...(updates.accountType !== undefined ? { accountType: updates.accountType } : {}),
          ...(updates.expiryDate !== undefined ? { expiryDate: updates.expiryDate } : {}),
          role: updates.role !== undefined ? updates.role : existing.role || 'Teacher',
          status: updates.status !== undefined ? updates.status : existing.status || 'Active',
          credits: nextCredits,
          creditLogs: existingLogs,
          updatedAt: now,
          lastModifiedByAdmin: adminUid,
        };

        const sanitizedUpdatedUser = this.stripSensitiveUserFields(updatedUser);
        await tx.setDoc('users', cleanTargetId, sanitizedUpdatedUser, false);

        const auditId = `audit_user_upd_${cleanTargetId}_${Date.now()}`;
        await tx.setDoc(
          'adminAuditLogs',
          auditId,
          {
            id: auditId,
            action: 'ADMIN_USER_UPDATED',
            actorUid: adminUid,
            targetUserId: cleanTargetId,
            previousRole: existing.role,
            newRole: updatedUser.role,
            previousStatus: existing.status,
            newStatus: updatedUser.status,
            previousCredits,
            newCredits: nextCredits,
            creditDiff,
            reason: updates.creditReason || null,
            timestamp: now,
          },
          false
        );

        AuditService.log('ADMIN_ACTION', 'system', {
          action: 'ADMIN_USER_UPDATED',
          adminUid,
          targetUserId: cleanTargetId,
          newRole: updatedUser.role,
          newStatus: updatedUser.status,
          creditDiff,
        });

        return { user: sanitizedUpdatedUser, auditId };
      });
    });
  },

  /**
   * Toggles or sets a user's status ('Active' | 'Inactive' | 'Suspended') via backend admin authority.
   */
  async adminSetUserStatus(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    targetUserId: string,
    status: 'Active' | 'Inactive' | 'Suspended',
    reason?: string,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ user: any; auditId: string }> {
    return this.adminUpdateUser(
      adminAuth,
      targetUserId,
      { status, creditReason: reason },
      adapter
    );
  },

  /**
   * Grants or deducts user credits via backend admin authority with audit logging.
   */
  async adminAdjustUserCredits(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    targetUserId: string,
    params: { creditDelta?: number; absoluteCredits?: number; reason?: string },
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ user: any; auditId: string }> {
    if (params.creditDelta === undefined && params.absoluteCredits === undefined) {
      throw new Error('INVALID_CREDITS: Either creditDelta or absoluteCredits must be provided.');
    }
    return this.adminUpdateUser(
      adminAuth,
      targetUserId,
      {
        credits: params.absoluteCredits,
        creditDelta: params.creditDelta,
        creditReason: params.reason || 'Admin Credit Adjustment',
      },
      adapter
    );
  },

  /**
   * Deletes a user record via backend admin authority.
   * Prevents self-deletion and records an immutable audit log.
   */
  async adminDeleteUser(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    targetUserId: string,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ deletedUserId: string; auditId: string; success: boolean }> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    const cleanTargetId = typeof targetUserId === 'string' ? targetUserId.trim() : '';
    if (!cleanTargetId) {
      throw new Error('INVALID_TARGET_USER: Target user ID is required.');
    }
    if (cleanTargetId === adminUid) {
      throw new Error('ADMIN_SELF_DELETE_PREVENTED: Platform Admin cannot delete their own account.');
    }

    return withUserLock(cleanTargetId, async () => {
      return adapter.runTransaction(async (tx) => {
        const existing = await tx.getDoc('users', cleanTargetId);
        if (!existing) {
          throw new Error(`USER_NOT_FOUND: User ${cleanTargetId} does not exist.`);
        }

        if (tx.deleteDoc) {
          await tx.deleteDoc('users', cleanTargetId);
        } else if (adapter.deleteDoc) {
          await adapter.deleteDoc('users', cleanTargetId);
        }

        const now = new Date().toISOString();
        const auditId = `audit_user_del_${cleanTargetId}_${Date.now()}`;
        await tx.setDoc(
          'adminAuditLogs',
          auditId,
          {
            id: auditId,
            action: 'ADMIN_USER_DELETED',
            actorUid: adminUid,
            targetUserId: cleanTargetId,
            deletedUserEmail: existing.email || null,
            deletedUserRole: existing.role || null,
            timestamp: now,
          },
          false
        );

        AuditService.log('ADMIN_ACTION', 'system', {
          action: 'ADMIN_USER_DELETED',
          adminUid,
          targetUserId: cleanTargetId,
        });

        return { deletedUserId: cleanTargetId, auditId, success: true };
      });
    });
  },

  /**
   * Strips any secret or credential fields from a settings object before returning to clients.
   */
  sanitizePublicSettingsPayload(raw: Record<string, any> | null | undefined): Record<string, any> {
    if (!raw || typeof raw !== 'object') return {};
    const sanitized = { ...raw };
    const forbiddenSecretKeys = [
      'smtpPass',
      'SMTP_PASS',
      'geminiApiKey',
      'GEMINI_API_KEY',
      'FIREBASE_SERVICE_ACCOUNT',
      'firebaseServiceAccount',
      'ELMS_SHARED_SECRET',
      'elmsSharedSecret',
      'paystackSecretKey',
      'PAYSTACK_SECRET_KEY',
      'mpesaConsumerSecret',
      'MPESA_CONSUMER_SECRET',
      'mpesaPasskey',
      'MPESA_PASSKEY',
      'privateKey',
      'clientSecret',
      'password',
      'passwordHash',
    ];
    for (const key of forbiddenSecretKeys) {
      delete sanitized[key];
    }
    return sanitized;
  },

  /**
   * Returns sanitized system settings for the Admin Panel.
   * NEVER exposes `settings/secrets` or any secret keys (`smtpPass`, `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `ELMS_SHARED_SECRET`, payment secrets).
   */
  async adminGetSystemSettings(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{
    global: Record<string, any>;
    emailSettings: Record<string, any>;
    system: Record<string, any>;
    landingPage: Record<string, any>;
    sample_resources: Record<string, any>;
    secretStatus: Record<string, boolean>;
  }> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    const [globalDoc, secretsDoc, systemDoc, landingDoc, sampleDoc] = await Promise.all([
      adapter.getDoc('settings', 'global'),
      adapter.getDoc('settings', 'secrets'),
      adapter.getDoc('settings', 'system'),
      adapter.getDoc('settings', 'landingPage'),
      adapter.getDoc('settings', 'sample_resources'),
    ]);

    const rawSecrets = secretsDoc && typeof secretsDoc === 'object' ? secretsDoc : {};

    const emailSettings = {
      smtpHost: typeof rawSecrets.smtpHost === 'string' ? rawSecrets.smtpHost : '',
      smtpPort: typeof rawSecrets.smtpPort === 'number' ? rawSecrets.smtpPort : 587,
      smtpUser: typeof rawSecrets.smtpUser === 'string' ? rawSecrets.smtpUser : '',
      smtpSecure: Boolean(rawSecrets.smtpSecure),
      smtpFromEmail: typeof rawSecrets.smtpFromEmail === 'string' ? rawSecrets.smtpFromEmail : '',
      smtpFromName: typeof rawSecrets.smtpFromName === 'string' ? rawSecrets.smtpFromName : 'Exameno Support',
      welcomeEmailSubject:
        typeof rawSecrets.welcomeEmailSubject === 'string' ? rawSecrets.welcomeEmailSubject : '',
      welcomeEmailBody:
        typeof rawSecrets.welcomeEmailBody === 'string' ? rawSecrets.welcomeEmailBody : '',
      hasSmtpPass: Boolean(rawSecrets.smtpPass || rawSecrets.SMTP_PASS),
    };

    const secretStatus = {
      hasSmtpPass: Boolean(rawSecrets.smtpPass || rawSecrets.SMTP_PASS),
      hasGeminiApiKey: Boolean(rawSecrets.GEMINI_API_KEY || rawSecrets.geminiApiKey),
      hasFirebaseServiceAccount: Boolean(rawSecrets.FIREBASE_SERVICE_ACCOUNT),
      hasElmsSharedSecret: Boolean(rawSecrets.ELMS_SHARED_SECRET || rawSecrets.elmsSharedSecret),
    };

    AuditService.log('ADMIN_ACTION', 'system', {
      action: 'ADMIN_SETTINGS_READ',
      adminUid,
    });

    return {
      global: this.sanitizePublicSettingsPayload(globalDoc),
      emailSettings,
      system: this.sanitizePublicSettingsPayload(systemDoc),
      landingPage: this.sanitizePublicSettingsPayload(landingDoc),
      sample_resources: this.sanitizePublicSettingsPayload(sampleDoc),
      secretStatus,
    };
  },

  /**
   * Updates public/system settings documents (`settings/global`, `settings/secrets`, `settings/system`, `settings/landingPage`, `settings/sample_resources`)
   * exclusively through backend Platform Admin authority.
   */
  async adminUpdateSystemSettings(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    docId: 'global' | 'secrets' | 'system' | 'landingPage' | 'sample_resources',
    settingsData: Record<string, any>,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ docId: string; settings: Record<string, any>; auditId: string }> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    const allowedDocs = ['global', 'secrets', 'system', 'landingPage', 'sample_resources'];
    if (!allowedDocs.includes(docId)) {
      throw new Error(`INVALID_SETTINGS_DOC: Unsupported settings document "${docId}".`);
    }
    if (!settingsData || typeof settingsData !== 'object') {
      throw new Error('INVALID_SETTINGS_PAYLOAD: Settings payload must be an object.');
    }

    // Never persist raw payment or server secret keys in public settings documents
    const sanitizedPayload =
      docId === 'secrets' ? { ...settingsData } : this.sanitizePublicSettingsPayload(settingsData);

    if (docId === 'secrets') {
      // Do not overwrite existing smtpPass if the client submits an empty or masked value
      if (
        sanitizedPayload.smtpPass !== undefined &&
        (String(sanitizedPayload.smtpPass).trim() === '' ||
          String(sanitizedPayload.smtpPass).trim() === '********')
      ) {
        delete sanitizedPayload.smtpPass;
      }
    }

    return adapter.runTransaction(async (tx) => {
      const existing = (await tx.getDoc('settings', docId)) || {};
      const now = new Date().toISOString();
      const merged = {
        ...existing,
        ...sanitizedPayload,
        updatedAt: now,
        updatedBy: adminUid,
      };
      await tx.setDoc('settings', docId, merged, true);

      const auditId = `audit_settings_${docId}_${Date.now()}`;
      await tx.setDoc(
        'adminAuditLogs',
        auditId,
        {
          id: auditId,
          action: 'ADMIN_SETTINGS_UPDATED',
          actorUid: adminUid,
          docId,
          updatedKeys: Object.keys(sanitizedPayload),
          timestamp: now,
        },
        false
      );

      return {
        docId,
        settings: this.sanitizePublicSettingsPayload(merged),
        auditId,
      };
    });
  },

  /**
   * Updates or deletes user feedback items through backend Platform Admin authority.
   */
  async adminManageFeedback(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    feedbackId: string,
    operation: { action: 'update'; status: string; response?: string } | { action: 'delete' },
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ feedbackId: string; status?: string; response?: string; deleted?: boolean }> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    const cleanId = typeof feedbackId === 'string' ? feedbackId.trim() : '';
    if (!cleanId) {
      throw new Error('INVALID_FEEDBACK_ID: Feedback ID is required.');
    }

    return adapter.runTransaction(async (tx) => {
      const existing = await tx.getDoc('feedback', cleanId);
      if (!existing) {
        throw new Error(`FEEDBACK_NOT_FOUND: Feedback ${cleanId} does not exist.`);
      }
      const now = new Date().toISOString();
      if (operation.action === 'delete') {
        if (tx.deleteDoc) {
          await tx.deleteDoc('feedback', cleanId);
        }
        return { feedbackId: cleanId, deleted: true };
      } else {
        const updated = {
          ...existing,
          status: operation.status,
          ...(operation.response !== undefined ? { response: operation.response } : {}),
          updatedAt: now,
          updatedBy: adminUid,
        };
        await tx.setDoc('feedback', cleanId, updated, true);
        return { feedbackId: cleanId, status: operation.status, response: operation.response };
      }
    });
  },

  /**
   * Safely imports/updates users in bulk from CSV rows through authoritative validation,
   * role/status allowlisting, non-negative credit enforcement, password stripping, and audit logging.
   */
  async adminBulkImportUsers(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    rows: Record<string, any>[],
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ importCount: number; updateCount: number; errorCount: number; auditIds: string[] }> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    if (!Array.isArray(rows)) {
      throw new Error('INVALID_IMPORT_PAYLOAD: Users array is required.');
    }

    const existingUsers = adapter.listDocs ? await adapter.listDocs('users') : [];
    const byEmail = new Map<string, any>();
    for (const u of existingUsers) {
      if (u && typeof u.email === 'string') {
        byEmail.set(u.email.trim().toLowerCase(), u);
      }
    }

    const validRoles = new Set(['Admin', 'School Admin', 'Teacher', 'Student']);
    const validStatuses = new Set(['Active', 'Inactive', 'Suspended']);

    let importCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    const auditIds: string[] = [];

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const emailKey = Object.keys(row).find(
        (k) => k.toLowerCase() === 'email address' || k.toLowerCase() === 'email'
      );
      const rawEmail = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : '';
      if (!rawEmail || !rawEmail.includes('@')) {
        continue;
      }

      try {
        const firstNameKey = Object.keys(row).find((k) => k.toLowerCase() === 'first name');
        const lastNameKey = Object.keys(row).find((k) => k.toLowerCase() === 'last name');
        const nameKey = Object.keys(row).find((k) => k.toLowerCase() === 'name' || k.toLowerCase() === 'full name');
        const phoneKey = Object.keys(row).find(
          (k) => k.toLowerCase() === 'phone number' || k.toLowerCase() === 'phone'
        );
        const schoolKey = Object.keys(row).find(
          (k) => k.toLowerCase() === 'school name' || k.toLowerCase() === 'school'
        );
        const roleKey = Object.keys(row).find((k) => k.toLowerCase() === 'role');
        const statusKey = Object.keys(row).find((k) => k.toLowerCase() === 'status');
        const accountTypeKey = Object.keys(row).find((k) => k.toLowerCase() === 'account type');
        const creditsKey = Object.keys(row).find((k) => k.toLowerCase() === 'credits');

        const firstName = firstNameKey ? String(row[firstNameKey] || '').trim() : '';
        const lastName = lastNameKey ? String(row[lastNameKey] || '').trim() : '';
        const explicitName = nameKey ? String(row[nameKey] || '').trim() : '';
        const fullName = `${firstName} ${lastName}`.trim() || explicitName;

        const rawRole = roleKey ? String(row[roleKey] || '').trim() : '';
        const safeRole = (validRoles.has(rawRole) ? rawRole : undefined) as
          | 'Admin'
          | 'School Admin'
          | 'Teacher'
          | 'Student'
          | undefined;

        const rawStatus = statusKey ? String(row[statusKey] || '').trim() : '';
        const safeStatus = (validStatuses.has(rawStatus) ? rawStatus : undefined) as
          | 'Active'
          | 'Inactive'
          | 'Suspended'
          | undefined;

        const rawAccountType = accountTypeKey ? String(row[accountTypeKey] || '').trim() : '';
        const safeAccountType: 'Standard' | 'Demo' | undefined =
          rawAccountType === 'Demo' ? 'Demo' : rawAccountType === 'Standard' ? 'Standard' : undefined;

        const creditsRaw = creditsKey !== undefined ? row[creditsKey] : undefined;
        const parsedCredits =
          creditsRaw !== undefined && creditsRaw !== ''
            ? Math.max(0, Math.floor(Number(creditsRaw) || 0))
            : undefined;

        const existingUser = byEmail.get(rawEmail);
        if (existingUser && existingUser.id) {
          const isSelf = existingUser.id === adminUid;
          const res = await this.adminUpdateUser(
            adminAuth,
            existingUser.id,
            {
              ...(fullName ? { name: fullName } : {}),
              ...(firstName ? { firstName } : {}),
              ...(lastName ? { lastName } : {}),
              ...(phoneKey && row[phoneKey] ? { phoneNumber: String(row[phoneKey]) } : {}),
              ...(schoolKey && row[schoolKey] ? { schoolName: String(row[schoolKey]) } : {}),
              ...(!isSelf && safeRole ? { role: safeRole } : {}),
              ...(!isSelf && safeStatus ? { status: safeStatus } : {}),
              ...(safeAccountType ? { accountType: safeAccountType } : {}),
              ...(parsedCredits !== undefined ? { credits: parsedCredits, creditReason: 'Admin CSV Bulk Import' } : {}),
            },
            adapter
          );
          byEmail.set(rawEmail, res.user);
          auditIds.push(res.auditId);
          updateCount++;
        } else {
          const res = await this.adminCreateUser(
            adminAuth,
            {
              name: fullName || 'Teacher',
              email: rawEmail,
              phoneNumber: phoneKey && row[phoneKey] ? String(row[phoneKey]) : '',
              schoolName: schoolKey && row[schoolKey] ? String(row[schoolKey]) : 'Exameno School',
              role: safeRole || 'Teacher',
              status: safeStatus || 'Active',
              accountType: safeAccountType || 'Standard',
              credits: parsedCredits !== undefined ? parsedCredits : 5,
            },
            adapter
          );
          byEmail.set(rawEmail, res.user);
          auditIds.push(res.auditId);
          importCount++;
        }
      } catch {
        errorCount++;
      }
    }

    return { importCount, updateCount, errorCount, auditIds };
  },

  /**
   * Exports a sanitized platform backup behind Platform Admin verification.
   * Never exports `settings/secrets` or user plaintext passwords.
   */
  async adminExportBackup(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{
    version: string;
    timestamp: string;
    collections: Record<string, Record<string, any>>;
  }> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    const collections: Record<string, Record<string, any>> = {
      settings: {},
      users: {},
      transactions: {},
      referrals: {},
    };

    const publicSettingsDocs = ['global', 'system', 'landingPage', 'sample_resources'];
    for (const docId of publicSettingsDocs) {
      const d = await adapter.getDoc('settings', docId);
      if (d) {
        collections.settings[docId] = this.sanitizePublicSettingsPayload(d);
      }
    }

    if (adapter.listDocs) {
      const [usersList, txList, refList] = await Promise.all([
        adapter.listDocs('users'),
        adapter.listDocs('transactions'),
        adapter.listDocs('referrals'),
      ]);
      for (const u of usersList) {
        if (u?.id) {
          collections.users[u.id] = this.stripSensitiveUserFields(u);
        }
      }
      for (const t of txList) {
        if (t?.id) {
          collections.transactions[t.id] = t;
        }
      }
      for (const r of refList) {
        if (r?.id) {
          collections.referrals[r.id] = r;
        }
      }
    }

    AuditService.log('ADMIN_ACTION', 'system', {
      action: 'ADMIN_BACKUP_EXPORTED',
      adminUid,
    });

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      collections,
    };
  },

  /**
   * Restores a platform backup safely behind Platform Admin verification.
   * Blocks restoring `settings/secrets`, strips secret/password fields, prevents admin self-lockout,
   * and writes an immutable audit log.
   */
  async adminRestoreBackup(
    adminAuth: AuthenticatedTokenContext | null | undefined,
    collectionsPayload: Record<string, any>,
    adapter: TransactionalStorageAdapter = activeStorageAdapter
  ): Promise<{ restoredCount: number; skippedCount: number; auditId: string }> {
    const { adminUid } = await this.verifyAdminAuthority(adminAuth, adapter);
    if (!collectionsPayload || typeof collectionsPayload !== 'object') {
      throw new Error('INVALID_BACKUP_PAYLOAD: Collections object is required.');
    }

    let restoredCount = 0;
    let skippedCount = 0;
    const allowedSettingsDocs = new Set(['global', 'system', 'landingPage', 'sample_resources']);

    // 1. Restore public settings only (never `secrets`)
    const settingsMap = collectionsPayload.settings;
    if (settingsMap && typeof settingsMap === 'object') {
      for (const [docId, docData] of Object.entries(settingsMap)) {
        if (docId === 'secrets' || !allowedSettingsDocs.has(docId) || !docData || typeof docData !== 'object') {
          skippedCount++;
          continue;
        }
        await this.adminUpdateSystemSettings(
          adminAuth,
          docId as 'global' | 'system' | 'landingPage' | 'sample_resources',
          docData as Record<string, any>,
          adapter
        );
        restoredCount++;
      }
    }

    // 2. Restore users through authoritative create/update (strips passwords, prevents self-lockout)
    const usersMap = collectionsPayload.users;
    if (usersMap && typeof usersMap === 'object') {
      const entries = Array.isArray(usersMap)
        ? usersMap.map((item: any) => [item?.userDoc?.id || item?.id, item?.userDoc || item])
        : Object.entries(usersMap);

      for (const [rawId, rawData] of entries) {
        const docId = String(rawId || '').trim();
        if (!docId || !rawData || typeof rawData !== 'object') {
          skippedCount++;
          continue;
        }
        const cleanUser = this.stripSensitiveUserFields(rawData as Record<string, any>);
        const isSelf = docId === adminUid;
        const existing = await adapter.getDoc('users', docId);
        try {
          if (existing) {
            await this.adminUpdateUser(
              adminAuth,
              docId,
              {
                name: cleanUser.name,
                firstName: cleanUser.firstName,
                lastName: cleanUser.lastName,
                email: cleanUser.email,
                phoneNumber: cleanUser.phoneNumber,
                schoolName: cleanUser.schoolName,
                county: cleanUser.county,
                role: isSelf ? 'Admin' : cleanUser.role,
                status: isSelf ? 'Active' : cleanUser.status,
                accountType: cleanUser.accountType,
                credits:
                  typeof cleanUser.credits === 'number' && cleanUser.credits >= 0
                    ? Math.floor(cleanUser.credits)
                    : undefined,
                creditReason: 'Admin Backup Restore',
              },
              adapter
            );
          } else {
            await this.adminCreateUser(
              adminAuth,
              {
                id: docId,
                name: cleanUser.name || 'Teacher',
                email: cleanUser.email || `${docId}@school.ke`,
                phoneNumber: cleanUser.phoneNumber,
                schoolName: cleanUser.schoolName,
                county: cleanUser.county,
                role: cleanUser.role || 'Teacher',
                status: cleanUser.status || 'Active',
                accountType: cleanUser.accountType || 'Standard',
                credits:
                  typeof cleanUser.credits === 'number' && cleanUser.credits >= 0
                    ? Math.floor(cleanUser.credits)
                    : 5,
              },
              adapter
            );
          }
          restoredCount++;
        } catch {
          skippedCount++;
        }
      }
    }

    const now = new Date().toISOString();
    const auditId = `audit_backup_restore_${Date.now()}`;
    await adapter.runTransaction(async (tx) => {
      await tx.setDoc(
        'adminAuditLogs',
        auditId,
        {
          id: auditId,
          action: 'ADMIN_BACKUP_RESTORED',
          actorUid: adminUid,
          restoredCount,
          skippedCount,
          timestamp: now,
        },
        false
      );
    });

    AuditService.log('ADMIN_ACTION', 'system', {
      action: 'ADMIN_BACKUP_RESTORED',
      adminUid,
      restoredCount,
      skippedCount,
    });

    return { restoredCount, skippedCount, auditId };
  },
};
