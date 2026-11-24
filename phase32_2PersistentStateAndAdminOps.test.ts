import * as fs from 'fs';
import * as path from 'path';
import { terminate } from 'firebase/firestore';
import { db } from './firebase.ts';
import {
  PersistentStateService,
  DurableTenantStorageAdapter,
  createFirestoreAdminTenantAdapter,
} from './services/persistentStateService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { ElmsConnectionService } from './services/elmsConnectionService.ts';
import { ElmsIntegrationService } from './services/elmsIntegrationService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { TeacherActionService } from './services/teacherActionService.ts';
import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { ArtifactService } from './services/artifactService.ts';
import {
  AuthoritativeAccountService,
  AuthenticatedTokenContext,
} from './services/authoritativeAccountService.ts';

describe('Phase 32.2 — Persistent Multi-Tenant State (P1-01) & Admin Backend Authorization (P1-02)', () => {
  afterAll(async () => {
    // Close the Firebase client if this suite exercised a real Firestore fallback.
    await terminate(db);
  });
  // Durable mock Firestore backing store that survives service-level clearStore() calls (simulating process restart)
  let durableCloudDb: Map<string, Map<string, any>>;

  const createDurableAdapter = (): DurableTenantStorageAdapter => ({
    getDoc: async (collectionPath: string, docId: string) => {
      const col = durableCloudDb.get(collectionPath);
      if (!col || !col.has(docId)) return null;
      return JSON.parse(JSON.stringify(col.get(docId)));
    },
    setDoc: async (collectionPath: string, docId: string, data: any, merge = true) => {
      if (!durableCloudDb.has(collectionPath)) {
        durableCloudDb.set(collectionPath, new Map());
      }
      const col = durableCloudDb.get(collectionPath)!;
      const clean = JSON.parse(JSON.stringify(data));
      if (merge && col.has(docId)) {
        col.set(docId, { ...col.get(docId), ...clean });
      } else {
        col.set(docId, clean);
      }
    },
    deleteDoc: async (collectionPath: string, docId: string) => {
      durableCloudDb.get(collectionPath)?.delete(docId);
    },
    listDocs: async (collectionPath: string, filters?: Record<string, any>) => {
      const col = durableCloudDb.get(collectionPath);
      if (!col) return [];
      let docs = Array.from(col.values()).map((d) => JSON.parse(JSON.stringify(d)));
      if (filters) {
        for (const [field, value] of Object.entries(filters)) {
          if (value !== undefined) {
            docs = docs.filter((d) => d[field] === value);
          }
        }
      }
      return docs;
    },
  });

  beforeEach(() => {
    durableCloudDb = new Map();
    PersistentStateService.setStorageAdapter(createDurableAdapter());
    AuthoritativeAccountService.resetInMemoryStore();
  });

  afterEach(() => {
    PersistentStateService.resetAllDurableState();
  });

  describe('P1-01 — Durable Multi-Tenant Persistence Across Simulated Process Restart', () => {
    it('persists SchoolConfig and SchoolMembership to Firestore and rehydrates after in-memory wipe', async () => {
      const schoolId = 'nacbe_school_1';
      SchoolConfigService.registerSchool({
        id: schoolId,
        name: 'Nairobi Academy CBE',
        schoolType: 'Junior Secondary',
        country: 'Kenya',
        county: 'Nairobi City',
        schoolCode: 'NACBE-01',
        gradesOffered: ['Grade 7', 'Grade 8', 'Grade 9'],
        learningAreasOffered: ['la-sci', 'la-math'],
        curriculumSystem: 'Kenya Competency-Based Curriculum (CBC)',
        academicYear: '2026',
        status: 'active',
        isAuthoritative: true,
        teachingConfig: {
          lessonsPerWeek: 5,
          lessonDurationMinutes: 40,
          teachingWeeksPerTerm: 13,
          revisionWeeks: 1,
          assessmentWeeks: 1,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      SchoolMembershipService.addTeacherMembership({
        userId: 'teacher_1',
        schoolId,
        role: 'SCHOOL_ADMIN',
        status: 'ACTIVE',
      });
      SchoolMembershipService.setActiveSchool('teacher_1', schoolId);

      await PersistentStateService.flushPendingWrites();

      // Verify durable Firestore collections contain the records
      const storedSchool = await createDurableAdapter().getDoc('schools', schoolId);
      expect(storedSchool).toBeTruthy();
      expect(storedSchool.name).toBe('Nairobi Academy CBE');

      const storedMembership = await createDurableAdapter().getDoc(
        'schoolMemberships',
        `mem_teacher_1_${schoolId}`
      );
      expect(storedMembership).toBeTruthy();
      expect(storedMembership.role).toBe('SCHOOL_ADMIN');

      // Simulate server restart / browser reload by wiping all in-memory stores
      SchoolConfigService.clearStore();
      SchoolMembershipService.clearStore();
      expect(SchoolConfigService.isRegisteredSchool(schoolId)).toBe(false);
      expect(SchoolMembershipService.getMembership('teacher_1', schoolId)).toBeUndefined();

      // Hydrate from Firestore
      await PersistentStateService.simulateProcessRestart([schoolId], ['teacher_1']);

      expect(SchoolConfigService.isRegisteredSchool(schoolId)).toBe(true);
      const rehydratedSchool = SchoolConfigService.getSchoolProfile(schoolId);
      expect(rehydratedSchool).toBeDefined();
      expect(rehydratedSchool?.name).toBe('Nairobi Academy CBE');

      const rehydratedMembership = SchoolMembershipService.getMembership('teacher_1', schoolId);
      expect(rehydratedMembership).toBeDefined();
      expect(rehydratedMembership?.role).toBe('SCHOOL_ADMIN');
      expect(SchoolMembershipService.getActiveSchoolMembership('teacher_1')?.school.id).toBe(schoolId);
    });

    it('persists ClassGroups, Learners, and ClassRosters per tenant and survives process restart', async () => {
      const schoolId = 'school_tenant_alpha';
      SchoolConfigService.registerSchool({
        id: schoolId,
        name: 'Alpha Junior School',
        schoolType: 'Junior Secondary',
        country: 'Kenya',
        county: 'Kiambu',
        gradesOffered: ['Grade 7', 'Grade 8'],
        learningAreasOffered: ['la-sci'],
        curriculumSystem: 'Kenya Competency-Based Curriculum (CBC)',
        academicYear: '2026',
        status: 'active',
        teachingConfig: {
          lessonsPerWeek: 5,
          lessonDurationMinutes: 40,
          teachingWeeksPerTerm: 13,
          revisionWeeks: 1,
          assessmentWeeks: 1,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      SchoolMembershipService.addTeacherMembership({
        userId: 'admin_alpha',
        schoolId,
        role: 'SCHOOL_ADMIN',
        status: 'ACTIVE',
      });

      const classGroup = ClassGroupService.createClassGroup({
        schoolId,
        name: 'Grade 7 East',
        gradeId: 'grade-7',
        academicYearId: 'ay_2026',
        requestingUserId: 'admin_alpha',
      });

      const { learner } = LearnerRosterService.addLearner({
        schoolId,
        classGroupId: classGroup.id,
        displayName: 'Amani Wanjiku',
        learnerIdentifier: 'ADM-2026-001',
        academicYearId: 'ay_2026',
        requestingUserId: 'admin_alpha',
      });

      await PersistentStateService.flushPendingWrites();

      // Wipe in-memory stores to simulate server restart
      ClassGroupService.clearStore();
      LearnerRosterService.clearStore();
      expect(ClassGroupService.getClassGroupsBySchool(schoolId)).toHaveLength(0);
      expect(LearnerRosterService.getLearnersBySchool(schoolId)).toHaveLength(0);

      // Rehydrate from Firestore
      await PersistentStateService.hydrateSchoolClassesAndLearners(schoolId);

      const classesAfterRestart = ClassGroupService.getClassGroupsBySchool(schoolId);
      expect(classesAfterRestart).toHaveLength(1);
      expect(classesAfterRestart[0].name).toBe('Grade 7 East');

      const learnersAfterRestart = LearnerRosterService.getLearnersBySchool(schoolId);
      expect(learnersAfterRestart).toHaveLength(1);
      expect(learnersAfterRestart[0].displayName).toBe('Amani Wanjiku');

      const rosterAfterRestart = LearnerRosterService.getLearnersForClassGroup(classGroup.id, schoolId);
      expect(rosterAfterRestart).toHaveLength(1);
      expect(rosterAfterRestart[0].id).toBe(learner.id);
      expect(rosterAfterRestart[0].learnerIdentifier).toBe('ADM-2026-001');
    });

    it('persists ELMS connection, published artifacts, ELMS events, assessment evidence, and teacher actions across restart', async () => {
      const schoolId = 'school_elms_persist';
      const teacherId = 'teacher_elms_1';

      SchoolConfigService.registerSchool({
        id: schoolId,
        name: 'Mombasa Coastal Junior School',
        schoolType: 'Junior Secondary',
        country: 'Kenya',
        county: 'Mombasa',
        gradesOffered: ['Grade 8'],
        learningAreasOffered: ['la-sci'],
        curriculumSystem: 'Kenya Competency-Based Curriculum (CBC)',
        academicYear: '2026',
        status: 'active',
        teachingConfig: {
          lessonsPerWeek: 5,
          lessonDurationMinutes: 40,
          teachingWeeksPerTerm: 13,
          revisionWeeks: 1,
          assessmentWeeks: 1,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      SchoolMembershipService.addTeacherMembership({
        userId: teacherId,
        schoolId,
        role: 'SCHOOL_ADMIN',
        status: 'ACTIVE',
      });

      const classGroup = ClassGroupService.createClassGroup({
        schoolId,
        name: 'Grade 8 North',
        gradeId: 'grade-8',
        academicYearId: 'ay_2026',
        requestingUserId: teacherId,
      });

      const { learner } = LearnerRosterService.addLearner({
        schoolId,
        classGroupId: classGroup.id,
        displayName: 'Baraka Hassan',
        learnerIdentifier: 'MSA-001',
        academicYearId: 'ay_2026',
        requestingUserId: teacherId,
      });

      // 1. Save ELMS connection
      ElmsConnectionService.connectSchool({
        schoolId,
        teacherId,
        elmsSchoolId: 'elms_msa_001',
        portalUrl: 'https://elms.exameno.co.ke',
      });

      // 2. Create content artifact & publish to ELMS
      const rawArtifact = ArtifactService.createArtifact(
        'assessment',
        schoolId,
        'grade-8',
        'la-sci',
        [
          {
            curriculumId: 'kicd-cbc-2024',
            curriculumVersion: '2024.1',
            gradeLevelId: 'grade-8',
            learningAreaId: 'la-sci',
            strandId: 'str-sci-8-1',
            subStrandId: 'substr-sci-8-1-1',
            learningOutcomeIds: ['lo-sci-8-1-1-a'],
          },
        ],
        {
          title: 'Cell Organelles Formative Quiz',
          body: '1. Identify the powerhouse of the cell.',
        }
      );
      const artifact = ContentArtifactRepository.save(rawArtifact);

      const publication = ElmsIntegrationService.publishResource({
        schoolId,
        teacherId,
        ecgArtifactId: artifact.id,
        classGroupId: classGroup.id,
        learningAreaId: 'la-sci',
        learningOutcomeIds: ['lo-sci-8-1-1-a'],
      });

      // 3. Record assessment evidence record
      const evidenceRecord = AssessmentEvidenceService.recordElmsEvidenceRecord({
        evidenceRecordId: 'evrec_msa_001',
        evidenceId: 'ev_msa_001',
        schoolId,
        ecgArtifactId: artifact.id,
        elmsResourceId: publication.elmsResourceId,
        assessmentId: artifact.id,
        attemptId: 'att_real_msa_001',
        learnerId: learner.id,
        curriculumVersionId: '2024.1',
        learningOutcomeId: 'lo-sci-8-1-1-a',
        score: 4,
        maxScore: 10,
        percentage: 40,
        status: 'SYNCHRONIZED',
        responses: [
          {
            itemId: 'q1',
            questionText: 'Identify the powerhouse of the cell.',
            response: 'Nucleus',
            correctAnswer: 'Mitochondria',
            marksAwarded: 0,
            maxMarks: 2,
            isCorrect: false,
          },
        ],
        submittedAt: new Date().toISOString(),
        evaluatedAt: new Date().toISOString(),
        provenance: {
          sourceSystem: 'ELMS',
          evidenceOrigin: 'AUTHORITATIVE_ELMS',
          eventId: 'evt_live_msa_001',
        },
      });

      // 4. Create Teacher Action Plan
      const teacherAction = TeacherActionService.createActionPlan({
        schoolId,
        teacherId,
        ecgArtifactId: artifact.id,
        classGroupId: classGroup.id,
        actionType: 'RETEACH_CLEAN_EXPLANATION',
        scope: 'WHOLE_CLASS',
        focusArea: 'Cell Organelles and Microscope Magnification',
        teacherNotes: 'Use interactive diagrams to reinforce organelle functions.',
      });

      await PersistentStateService.flushPendingWrites();

      // Simulate full server restart by clearing all in-memory stores
      ContentArtifactRepository.clearStore();
      ElmsIntegrationService.clearStore();
      AssessmentEvidenceService.clearStore();
      TeacherActionService.clearStore();

      expect(ContentArtifactRepository.getById(artifact.id, schoolId)).toBeUndefined();
      expect(ElmsIntegrationService.getPublication(schoolId, artifact.id)).toBeUndefined();
      expect(AssessmentEvidenceService.getElmsEvidenceRecords(schoolId, artifact.id)).toHaveLength(0);
      expect(TeacherActionService.getActionById(teacherAction.actionId, schoolId, teacherId)).toBeUndefined();

      // Rehydrate school state from Firestore
      await PersistentStateService.hydrateSchoolTenantState(schoolId);

      const rehydratedConnection = ElmsConnectionService.getConnection(schoolId);
      expect(rehydratedConnection.status).toBe('CONNECTED');
      expect(rehydratedConnection.elmsSchoolId).toBe('elms_msa_001');

      expect(ContentArtifactRepository.getById(artifact.id, schoolId)?.content).toEqual({
        title: 'Cell Organelles Formative Quiz',
        body: '1. Identify the powerhouse of the cell.',
      });
      expect(ElmsIntegrationService.getPublication(schoolId, artifact.id)?.publicationId).toBe(
        publication.publicationId
      );

      const rehydratedEvidence = AssessmentEvidenceService.getElmsEvidenceRecords(schoolId, artifact.id);
      expect(rehydratedEvidence).toHaveLength(1);
      expect(rehydratedEvidence[0].evidenceRecordId).toBe(evidenceRecord.evidenceRecordId);
      expect(rehydratedEvidence[0].score).toBe(4);

      const rehydratedAction = TeacherActionService.getActionById(
        teacherAction.actionId,
        schoolId,
        teacherId
      );
      expect(rehydratedAction).toBeDefined();
      expect(rehydratedAction?.focusArea).toBe('Cell Organelles and Microscope Magnification');
    });

    it('enforces strict tenant isolation between School A and School B across hydrated stores and Firestore rules', async () => {
      SchoolConfigService.registerSchool({
        id: 'school_a',
        name: 'School A',
        schoolType: 'Junior Secondary',
        country: 'Kenya',
        county: 'Nairobi',
        gradesOffered: ['Grade 7'],
        learningAreasOffered: ['la-sci'],
        curriculumSystem: 'CBC',
        academicYear: '2026',
        status: 'active',
        teachingConfig: {
          lessonsPerWeek: 5,
          lessonDurationMinutes: 40,
          teachingWeeksPerTerm: 13,
          revisionWeeks: 1,
          assessmentWeeks: 1,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      SchoolMembershipService.addTeacherMembership({
        userId: 'teacher_a',
        schoolId: 'school_a',
        role: 'TEACHER',
        status: 'ACTIVE',
      });

      SchoolConfigService.registerSchool({
        id: 'school_b',
        name: 'School B',
        schoolType: 'Junior Secondary',
        country: 'Kenya',
        county: 'Nakuru',
        gradesOffered: ['Grade 9'],
        learningAreasOffered: ['la-sci'],
        curriculumSystem: 'CBC',
        academicYear: '2026',
        status: 'active',
        teachingConfig: {
          lessonsPerWeek: 5,
          lessonDurationMinutes: 40,
          teachingWeeksPerTerm: 13,
          revisionWeeks: 1,
          assessmentWeeks: 1,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      SchoolMembershipService.addTeacherMembership({
        userId: 'teacher_b',
        schoolId: 'school_b',
        role: 'SCHOOL_ADMIN',
        status: 'ACTIVE',
      });

      const classB = ClassGroupService.createClassGroup({
        schoolId: 'school_b',
        name: 'School B Secret Class',
        gradeId: 'grade-9',
        academicYearId: 'ay_2026',
        requestingUserId: 'teacher_b',
      });

      await PersistentStateService.flushPendingWrites();

      // Service-layer tenant isolation: Teacher A cannot modify School B classes or add learners to School B
      expect(() =>
        ClassGroupService.updateClassGroup(classB.id, { name: 'Hijacked' }, 'teacher_a')
      ).toThrow(/Unauthorized/i);
      expect(() =>
        LearnerRosterService.addLearner({
          schoolId: 'school_b',
          classGroupId: classB.id,
          displayName: 'Unauthorized Learner',
          academicYearId: 'ay_2026',
          requestingUserId: 'teacher_a',
        })
      ).toThrow(/Unauthorized/i);

      // Firestore rule evaluation: Teacher A (active in school_a) is denied access to school_b tenant subcollections
      await AuthoritativeAccountService.getStorageAdapter().runTransaction(async (tx) => {
        await tx.setDoc('schoolMemberships', 'mem_teacher_a_school_a', {
          id: 'mem_teacher_a_school_a',
          userId: 'teacher_a',
          schoolId: 'school_a',
          role: 'TEACHER',
          status: 'ACTIVE',
        });
      });

      const crossTenantRead = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: `schools/school_b/class_groups/${classB.id}`,
        operation: 'read',
        auth: { uid: 'teacher_a', email: 'ta@schoola.ke', emailVerified: true },
      });
      expect(crossTenantRead.allowed).toBe(false);
      expect(crossTenantRead.reason).toBe('CROSS_SCHOOL_TENANT_ACCESS_DENIED');

      const sameTenantRead = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'schools/school_a/class_groups/cls_a_1',
        operation: 'read',
        auth: { uid: 'teacher_a', email: 'ta@schoola.ke', emailVerified: true },
      });
      expect(sameTenantRead.allowed).toBe(true);

      // Cross-tenant write spoofing schoolId in payload must be rejected
      const crossTenantSpoofWrite = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'schools/school_a/teacher_actions/act_1',
        operation: 'create',
        auth: { uid: 'teacher_a', email: 'ta@schoola.ke', emailVerified: true },
        requestData: {
          actionId: 'act_1',
          schoolId: 'school_b', // mismatched schoolId!
          title: 'Spoofed Action',
        },
      });
      expect(crossTenantSpoofWrite.allowed).toBe(false);
      expect(crossTenantSpoofWrite.reason).toBe('CROSS_SCHOOL_PAYLOAD_MISMATCH_DENIED');
    });
  });

  describe('P1-02 — Admin Panel Backend Authorization & Audit Logging', () => {
    const adminCaller = {
      uid: 'platform_admin_1',
      email: 'admin@exameno.co.ke',
      claims: { role: 'Admin', admin: true },
    };

    const teacherCaller = {
      uid: 'regular_teacher_1',
      email: 'teacher@school.ke',
      claims: { role: 'Teacher' },
    };

    const schoolAdminCaller = {
      uid: 'school_admin_1',
      email: 'principal@school.ke',
      claims: { role: 'School Admin' },
    };

    beforeEach(async () => {
      const adapter = AuthoritativeAccountService.getStorageAdapter();
      await adapter.runTransaction(async (tx) => {
        await tx.setDoc('users', adminCaller.uid, {
          id: adminCaller.uid,
          name: 'Platform Admin',
          email: adminCaller.email,
          role: 'Admin',
          isAdmin: true,
          status: 'Active',
          credits: 500,
        });
        await tx.setDoc('users', teacherCaller.uid, {
          id: teacherCaller.uid,
          name: 'Regular Teacher',
          email: teacherCaller.email,
          role: 'Teacher',
          isAdmin: false,
          status: 'Active',
          credits: 10,
        });
        await tx.setDoc('users', schoolAdminCaller.uid, {
          id: schoolAdminCaller.uid,
          name: 'School Principal',
          email: schoolAdminCaller.email,
          role: 'School Admin',
          isAdmin: false,
          status: 'Active',
          credits: 25,
        });
      });
    });

    it('rejects non-admin and School Admin callers on all platform admin operations', async () => {
      for (const unauthorizedCaller of [teacherCaller, schoolAdminCaller]) {
        await expect(
          AuthoritativeAccountService.adminCreateUser(unauthorizedCaller, {
            name: 'New Teacher',
            email: 'new@school.ke',
            role: 'Teacher',
          })
        ).rejects.toThrow('FORBIDDEN_ADMIN_ONLY');

        await expect(
          AuthoritativeAccountService.adminUpdateUser(unauthorizedCaller, teacherCaller.uid, {
            role: 'Admin',
          })
        ).rejects.toThrow('FORBIDDEN_ADMIN_ONLY');

        await expect(
          AuthoritativeAccountService.adminAdjustUserCredits(unauthorizedCaller, teacherCaller.uid, {
            creditDelta: 1000,
            reason: 'Unauthorized boost',
          })
        ).rejects.toThrow('FORBIDDEN_ADMIN_ONLY');

        await expect(
          AuthoritativeAccountService.adminSetUserStatus(
            unauthorizedCaller,
            teacherCaller.uid,
            'Suspended'
          )
        ).rejects.toThrow('FORBIDDEN_ADMIN_ONLY');

        await expect(
          AuthoritativeAccountService.adminDeleteUser(unauthorizedCaller, teacherCaller.uid)
        ).rejects.toThrow('FORBIDDEN_ADMIN_ONLY');

        await expect(
          AuthoritativeAccountService.adminUpdateSystemSettings(unauthorizedCaller, 'global', {
            maintenanceMode: true,
          })
        ).rejects.toThrow('FORBIDDEN_ADMIN_ONLY');
      }
    });

    it('allows Platform Admin to create, update, adjust credits, suspend/reactivate, and delete users with full audit logs', async () => {
      // 1. Admin creates a user
      const { user: created } = await AuthoritativeAccountService.adminCreateUser(adminCaller, {
        id: 'teacher_created_by_admin',
        name: 'Grace Mutua',
        email: 'grace.mutua@school.ke',
        role: 'Teacher',
        credits: 15,
        schoolName: 'Machakos Junior School',
        county: 'Machakos',
      });

      expect(created.id).toBe('teacher_created_by_admin');
      expect(created.credits).toBe(15);
      expect(created.role).toBe('Teacher');

      // 2. Admin updates user role & school
      const { user: updated } = await AuthoritativeAccountService.adminUpdateUser(
        adminCaller,
        created.id,
        {
          role: 'School Admin',
          schoolName: 'Machakos Senior School',
        }
      );
      expect(updated.role).toBe('School Admin');
      expect(updated.schoolName).toBe('Machakos Senior School');

      // 3. Admin adjusts credits (+25) and rejects negative resulting balance (-1000)
      const { user: creditAdjusted } = await AuthoritativeAccountService.adminAdjustUserCredits(
        adminCaller,
        created.id,
        {
          creditDelta: 25,
          reason: 'Bonus pack purchase verified',
        }
      );
      expect(creditAdjusted.credits).toBe(40);
      expect(creditAdjusted.creditLogs[0].creditsUsed).toBe(25);
      expect(creditAdjusted.creditLogs[0].balance).toBe(40);

      await expect(
        AuthoritativeAccountService.adminAdjustUserCredits(adminCaller, created.id, {
          creditDelta: -100,
          reason: 'Should fail negative balance',
        })
      ).rejects.toThrow('INVALID_CREDITS');

      // 4. Admin suspends and reactivates user
      const { user: suspended } = await AuthoritativeAccountService.adminSetUserStatus(
        adminCaller,
        created.id,
        'Suspended',
        'Policy review'
      );
      expect(suspended.status).toBe('Suspended');

      const { user: reactivated } = await AuthoritativeAccountService.adminSetUserStatus(
        adminCaller,
        created.id,
        'Active',
        'Review cleared'
      );
      expect(reactivated.status).toBe('Active');

      // 5. Admin deletes user
      const deleted = await AuthoritativeAccountService.adminDeleteUser(adminCaller, created.id);
      expect(deleted.success).toBe(true);
      expect(deleted.deletedUserId).toBe(created.id);

      // 6. Verify Admin Audit Logs were recorded for every privileged mutation
      const adapter = AuthoritativeAccountService.getStorageAdapter();
      const auditLogs = adapter.listDocs ? await adapter.listDocs('adminAuditLogs') : [];
      const actionsLogged = auditLogs.map((l) => l.action);
      expect(actionsLogged).toEqual(
        expect.arrayContaining([
          'ADMIN_USER_CREATED',
          'ADMIN_USER_UPDATED',
          'ADMIN_USER_DELETED',
        ])
      );
      for (const log of auditLogs) {
        expect(log.actorUid).toBe(adminCaller.uid);
        expect(log.targetUserId).toBe(created.id);
        expect(log.timestamp).toBeTruthy();
      }
    });

    it('prevents Admin self-demotion and self-deletion', async () => {
      await expect(
        AuthoritativeAccountService.adminUpdateUser(adminCaller, adminCaller.uid, {
          role: 'Teacher',
        })
      ).rejects.toThrow('ADMIN_SELF_LOCKOUT_PREVENTED');

      await expect(
        AuthoritativeAccountService.adminDeleteUser(adminCaller, adminCaller.uid)
      ).rejects.toThrow('ADMIN_SELF_DELETE_PREVENTED');
    });

    it('verifies AdminPanel.tsx contains zero direct browser Firestore writes and routes mutations via /api/admin/*', () => {
      const adminPanelSource = fs.readFileSync(
        path.resolve(__dirname, 'components/AdminPanel.tsx'),
        'utf8'
      );

      expect(adminPanelSource).not.toMatch(/\b(setDoc|updateDoc|deleteDoc|writeBatch)\s*\(/);
      expect(adminPanelSource).toContain("fetch('/api/admin/users'");
      expect(adminPanelSource).toContain('/api/admin/users/${encodeURIComponent(');
      expect(adminPanelSource).toContain("fetch('/api/admin/settings'");
      expect(adminPanelSource).toContain('/api/admin/feedback/${encodeURIComponent(');
      expect(adminPanelSource).toContain('!import.meta.env.PROD');
    });

    it('protects /settings/secrets and /adminAuditLogs in firestore.rules and rule evaluator', async () => {
      const rulesSource = fs.readFileSync(path.resolve(__dirname, 'firestore.rules'), 'utf8');
      expect(rulesSource).toContain("allow read: if settingId != 'secrets';");
      expect(rulesSource).toContain('match /adminAuditLogs/{logId}');

      const secretRead = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'settings/secrets',
        operation: 'read',
        auth: { uid: adminCaller.uid, email: adminCaller.email, claims: { role: 'Admin', admin: true } },
      });
      expect(secretRead.allowed).toBe(false);
      expect(secretRead.reason).toBe('SECRETS_CLIENT_READ_DENIED');

      const globalSettingsRead = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'settings/global',
        operation: 'read',
        auth: { uid: teacherCaller.uid, email: teacherCaller.email },
      });
      expect(globalSettingsRead.allowed).toBe(true);

      const nonAdminAuditRead = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'adminAuditLogs/audit_1',
        operation: 'read',
        auth: { uid: teacherCaller.uid, email: teacherCaller.email },
      });
      expect(nonAdminAuditRead.allowed).toBe(false);

      const adminAuditRead = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'adminAuditLogs/audit_1',
        operation: 'read',
        auth: { uid: adminCaller.uid, email: adminCaller.email, claims: { role: 'Admin', admin: true } },
      });
      expect(adminAuditRead.allowed).toBe(true);
    });

    it('Group 1 — prevents secret exposure in adminGetSystemSettings and GET /api/admin/settings', async () => {
      // Seed sensitive secrets and public settings
      await AuthoritativeAccountService.adminUpdateSystemSettings(adminCaller, 'secrets', {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: 'support@exameno.co.ke',
        smtpPass: 'super-secret-smtp-password',
        GEMINI_API_KEY: 'AIzaSySecretKey123',
        FIREBASE_SERVICE_ACCOUNT: '{"private_key":"-----BEGIN PRIVATE KEY-----"}',
        ELMS_SHARED_SECRET: 'elms-hmac-secret-999',
        paystackSecretKey: 'sk_live_secret',
      });

      const updateResp = await AuthoritativeAccountService.adminUpdateSystemSettings(
        adminCaller,
        'global',
        {
          welcomeCredits: 5,
          paystackSecretKey: 'should-be-stripped',
          smtpPass: 'should-also-be-stripped',
        }
      );
      expect(updateResp.settings.paystackSecretKey).toBeUndefined();
      expect(updateResp.settings.smtpPass).toBeUndefined();

      // Fetch settings as Admin
      const fetched = await AuthoritativeAccountService.adminGetSystemSettings(adminCaller);
      expect((fetched as any).secrets).toBeUndefined();
      expect(fetched.emailSettings.smtpHost).toBe('smtp.gmail.com');
      expect(fetched.emailSettings.smtpUser).toBe('support@exameno.co.ke');
      expect(fetched.emailSettings.hasSmtpPass).toBe(true);
      expect((fetched.emailSettings as any).smtpPass).toBeUndefined();
      expect((fetched.emailSettings as any).GEMINI_API_KEY).toBeUndefined();
      expect((fetched.emailSettings as any).FIREBASE_SERVICE_ACCOUNT).toBeUndefined();
      expect((fetched.emailSettings as any).ELMS_SHARED_SECRET).toBeUndefined();
      expect(fetched.secretStatus.hasSmtpPass).toBe(true);
      expect(fetched.secretStatus.hasGeminiApiKey).toBe(true);

      // Verify blank or masked smtpPass does not overwrite stored smtpPass
      await AuthoritativeAccountService.adminUpdateSystemSettings(adminCaller, 'secrets', {
        smtpHost: 'smtp.mailgun.org',
        smtpPass: '',
      });
      const rawSecretsAfterEmpty = await AuthoritativeAccountService.getStorageAdapter().getDoc(
        'settings',
        'secrets'
      );
      expect(rawSecretsAfterEmpty.smtpHost).toBe('smtp.mailgun.org');
      expect(rawSecretsAfterEmpty.smtpPass).toBe('super-secret-smtp-password');

      // Verify server.ts GET /api/admin/settings delegates to adminGetSystemSettings and never serializes secretsSnap.data()
      const serverSource = fs.readFileSync(path.resolve(__dirname, 'server.ts'), 'utf8');
      expect(serverSource).toContain('AuthoritativeAccountService.adminGetSystemSettings');
      expect(serverSource).not.toContain('secrets: secretsSnap.exists ? secretsSnap.data()');
    });

    it('Group 2 — eliminates plaintext password storage and blocks Inactive/Suspended administrators across backend and Firestore rules', async () => {
      // 1. Plaintext password supplied to adminCreateUser is stripped and never stored or returned
      const { user: createdUser } = await AuthoritativeAccountService.adminCreateUser(adminCaller, {
        id: 'usr_no_plaintext_pwd',
        name: 'Peter Njoroge',
        email: 'peter.njoroge@school.ke',
        role: 'Teacher',
        password: 'PlaintextPassword123!',
      });
      expect(createdUser.password).toBeUndefined();

      const storedDoc = await AuthoritativeAccountService.getStorageAdapter().getDoc(
        'users',
        'usr_no_plaintext_pwd'
      );
      expect(storedDoc.password).toBeUndefined();

      // Even if a legacy user document had a password field, adminListUsers and adminUpdateUser strip it
      await AuthoritativeAccountService.getStorageAdapter().runTransaction(async (tx) => {
        await tx.setDoc(
          'users',
          'usr_legacy_pwd',
          {
            id: 'usr_legacy_pwd',
            name: 'Legacy Teacher',
            email: 'legacy@school.ke',
            role: 'Teacher',
            status: 'Active',
            credits: 5,
            password: 'LegacyPlainPassword',
          },
          false
        );
      });

      const listedUsers = await AuthoritativeAccountService.adminListUsers(adminCaller);
      const legacyInList = listedUsers.find((u) => u.id === 'usr_legacy_pwd');
      expect(legacyInList).toBeDefined();
      expect(legacyInList.password).toBeUndefined();

      const { user: updatedLegacy } = await AuthoritativeAccountService.adminUpdateUser(
        adminCaller,
        'usr_legacy_pwd',
        { schoolName: 'Updated School' }
      );
      expect(updatedLegacy.password).toBeUndefined();
      const storedLegacyAfterUpdate = await AuthoritativeAccountService.getStorageAdapter().getDoc(
        'users',
        'usr_legacy_pwd'
      );
      expect(storedLegacyAfterUpdate.password).toBeUndefined();

      // 2. Inactive or Suspended Administrator is blocked even when carrying admin custom claims
      const inactiveAdminCaller = {
        uid: 'inactive_admin_1',
        email: 'inactive.admin@exameno.co.ke',
        claims: { role: 'Admin', admin: true },
      };
      await AuthoritativeAccountService.getStorageAdapter().runTransaction(async (tx) => {
        await tx.setDoc(
          'users',
          inactiveAdminCaller.uid,
          {
            id: inactiveAdminCaller.uid,
            name: 'Inactive Admin',
            email: inactiveAdminCaller.email,
            role: 'Admin',
            isAdmin: true,
            status: 'Inactive',
            credits: 100,
          },
          false
        );
      });

      expect(
        AuthoritativeAccountService.resolveAuthoritativeRole(inactiveAdminCaller, {
          role: 'Admin',
          status: 'Inactive',
        })
      ).toBe('Teacher');

      await expect(
        AuthoritativeAccountService.verifyAdminAuthority(inactiveAdminCaller)
      ).rejects.toThrow('ACCOUNT_SUSPENDED');

      await expect(
        AuthoritativeAccountService.adminListUsers(inactiveAdminCaller)
      ).rejects.toThrow('ACCOUNT_SUSPENDED');

      const inactiveRuleEval = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'adminAuditLogs/audit_1',
        operation: 'read',
        auth: inactiveAdminCaller,
      });
      expect(inactiveRuleEval.allowed).toBe(false);
    });

    it('Group 3 — wires Admin user edit/delete to backend API and secures bulk CSV import & backup/restore operations', async () => {
      // 1. Static check: AdminPanel.tsx calls PUT /api/admin/users/:id and DELETE /api/admin/users/:id
      const adminPanelSource = fs.readFileSync(
        path.resolve(__dirname, 'components/AdminPanel.tsx'),
        'utf8'
      );
      expect(adminPanelSource).toMatch(/fetch\(`\/api\/admin\/users\/\$\{encodeURIComponent\(user\.id\)\}`[\s\S]*?method:\s*'PUT'/);
      expect(adminPanelSource).toMatch(/fetch\(`\/api\/admin\/users\/\$\{encodeURIComponent\(userId\)\}`[\s\S]*?method:\s*'DELETE'/);

      // 2. Bulk CSV import validates roles, clamps negative credits, strips passwords, and protects acting admin from self-demotion
      const bulkResult = await AuthoritativeAccountService.adminBulkImportUsers(adminCaller, [
        {
          'First Name': 'Alice',
          'Last Name': 'Achieng',
          'Email Address': 'alice.achieng@school.ke',
          Role: 'SuperHackerRole', // invalid role -> defaults to Teacher
          Status: 'Active',
          Credits: '-50', // negative -> clamped to 0
        },
        {
          'First Name': 'Demoted',
          'Last Name': 'Admin',
          'Email Address': adminCaller.email, // acting admin's own email
          Role: 'Student', // attempt to self-demote via CSV
          Status: 'Suspended', // attempt to self-suspend via CSV
          Credits: '200',
        },
      ]);

      expect(bulkResult.importCount).toBe(1);
      expect(bulkResult.updateCount).toBe(1);
      expect(bulkResult.auditIds.length).toBe(2);

      const allAfterImport = await AuthoritativeAccountService.adminListUsers(adminCaller);
      const importedAlice = allAfterImport.find((u) => u.email === 'alice.achieng@school.ke');
      expect(importedAlice).toBeDefined();
      expect(importedAlice.role).toBe('Teacher');
      expect(importedAlice.credits).toBe(0);
      expect(importedAlice.password).toBeUndefined();

      const adminAfterImport = allAfterImport.find((u) => u.id === adminCaller.uid);
      expect(adminAfterImport.role).toBe('Admin');
      expect(adminAfterImport.status).toBe('Active');

      // 3. Backup export excludes settings/secrets and user passwords; restore blocks secrets and protects acting admin
      await AuthoritativeAccountService.adminUpdateSystemSettings(adminCaller, 'secrets', {
        smtpPass: 'do-not-export-me',
        GEMINI_API_KEY: 'do-not-export-key',
      });
      await AuthoritativeAccountService.adminUpdateSystemSettings(adminCaller, 'global', {
        welcomeCredits: 5,
      });

      const exported = await AuthoritativeAccountService.adminExportBackup(adminCaller);
      expect(exported.collections.settings.secrets).toBeUndefined();
      expect(exported.collections.settings.global.welcomeCredits).toBe(5);
      for (const u of Object.values(exported.collections.users)) {
        expect((u as any).password).toBeUndefined();
      }

      const restoreResult = await AuthoritativeAccountService.adminRestoreBackup(adminCaller, {
        settings: {
          secrets: { smtpPass: 'hijacked-smtp-pass' },
          global: { welcomeCredits: 10, paystackSecretKey: 'strip-me' },
        },
        users: {
          [adminCaller.uid]: {
            id: adminCaller.uid,
            name: 'Platform Admin',
            email: adminCaller.email,
            role: 'Teacher', // attempt self-demotion via restore
            status: 'Inactive', // attempt self-deactivation via restore
            password: 'PlaintextInBackup',
          },
          restored_teacher_1: {
            id: 'restored_teacher_1',
            name: 'Restored Teacher',
            email: 'restored@school.ke',
            role: 'Teacher',
            status: 'Active',
            credits: 12,
            password: 'PlaintextInBackup2',
          },
        },
      });

      expect(restoreResult.restoredCount).toBe(3); // global + 2 users; secrets skipped
      expect(restoreResult.skippedCount).toBe(1);

      const rawSecrets = await AuthoritativeAccountService.getStorageAdapter().getDoc('settings', 'secrets');
      expect(rawSecrets.smtpPass).toBe('do-not-export-me'); // unchanged!

      const restoredTeacher = await AuthoritativeAccountService.getStorageAdapter().getDoc(
        'users',
        'restored_teacher_1'
      );
      expect(restoredTeacher.credits).toBe(12);
      expect(restoredTeacher.password).toBeUndefined();

      const adminAfterRestore = await AuthoritativeAccountService.getStorageAdapter().getDoc(
        'users',
        adminCaller.uid
      );
      expect(adminAfterRestore.role).toBe('Admin');
      expect(adminAfterRestore.status).toBe('Active');
      expect(adminAfterRestore.password).toBeUndefined();
    });

    it('Group 4 — aligns all PersistentStateService Firestore paths with firestore.rules and surfaces production persistence failures', async () => {
      const rulesSource = fs.readFileSync(path.resolve(__dirname, 'firestore.rules'), 'utf8');
      const blueprintSource = fs.readFileSync(path.resolve(__dirname, 'firebase-blueprint.json'), 'utf8');

      const requiredRuleBlocks = [
        'match /teacher_profiles/{userId}',
        'match /content_artifacts/{artifactId}',
        'match /teacher_action_comparisons/{comparisonId}',
        'match /outcome_evidence/{evidenceId}',
        'match /elms_evidence/{evidenceRecordId}',
        'match /elms_publications/{publicationId}',
        'match /elms_learner_mappings/{mappingId}',
        'match /elms_class_mappings/{mappingId}',
        'match /elms_learning_events/{eventId}',
        'match /assessment_overrides/{overrideId}',
      ];

      for (const block of requiredRuleBlocks) {
        expect(rulesSource).toContain(block);
      }
      expect(blueprintSource).toContain('"/teacher_profiles/{userId}"');
      expect(blueprintSource).toContain('"/schools/{schoolId}/content_artifacts/{artifactId}"');
      expect(blueprintSource).toContain('"/schools/{schoolId}/elms_publications/{publicationId}"');

      // Verify evaluateFirestoreRuleAccess allows owner access to teacher_profiles/{uid} and blocks cross-user reads/writes
      const teacherAuth: AuthenticatedTokenContext = {
        uid: 'teacher_p4',
        email: 'teacher_p4@school.ke',
        claims: { role: 'Teacher', email_verified: true },
      };
      const ownProfileWrite = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'teacher_profiles/teacher_p4',
        operation: 'create',
        auth: teacherAuth,
        requestData: { userId: 'teacher_p4', activeSchoolId: 'sch_1' },
      });
      expect(ownProfileWrite.allowed).toBe(true);

      const crossUserProfileRead = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'teacher_profiles/other_teacher',
        operation: 'read',
        auth: teacherAuth,
      });
      expect(crossUserProfileRead.allowed).toBe(false);

      // Verify strict durable mode surfaces Admin adapter failures rather than silently succeeding
      PersistentStateService.setStrictDurableMode(true);
      const failingAdminAdapter = createFirestoreAdminTenantAdapter({
        collection: () => ({
          doc: () => ({
            set: async () => {
              throw new Error('Quota Exceeded on Firestore');
            },
            get: async () => {
              throw new Error('Unavailable on Firestore');
            },
          }),
        }),
      });

      await expect(
        failingAdminAdapter.setDoc('schools', 'sch_fail', { id: 'sch_fail', schoolName: 'Fail' })
      ).rejects.toThrow('FIRESTORE_PERSISTENCE_FAILED');

      await expect(
        failingAdminAdapter.getDoc('schools', 'sch_fail')
      ).rejects.toThrow('FIRESTORE_PERSISTENCE_FAILED');

      // Verify flushPendingWrites surfaces background write errors in strict mode
      PersistentStateService.setStorageAdapter(failingAdminAdapter);
      PersistentStateService.persistSchoolProfile({
        id: 'sch_bg_fail',
        schoolName: 'Background Fail School',
      } as any);

      await expect(PersistentStateService.flushPendingWrites()).rejects.toThrow(
        'FIRESTORE_PERSISTENCE_FAILED'
      );

      PersistentStateService.setStrictDurableMode(false);
    });
  });
});
