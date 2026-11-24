import { ElmsIntegrationService } from './services/elmsIntegrationService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { TeacherAssignmentService } from './services/teacherAssignmentService.ts';
import { AcademicOperationsService } from './services/academicOperationsService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { TeachingReflectionService } from './services/teachingReflectionService.ts';
import { TeachingContinuityService } from './services/teachingContinuityService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 30: Production Launch, Deployment & MVP Stabilisation', () => {
  const schoolA = 'lwps';
  const schoolB = 'safari-academy';
  const teacherA = '2'; // Active teacher in schoolA (LWPS)
  const teacherB = '4'; // Active teacher in schoolB (Safari Academy)

  beforeEach(() => {
    ElmsIntegrationService.clearStore();
    TeachingActivityService.clearStore();
    AssessmentEvidenceService.clearStore();
    TeachingReflectionService.clearStore();
    TeachingContinuityService.clearStore();

    // Ensure School A (LWPS) Profile
    try {
      SchoolConfigService.getSchoolProfile(schoolA);
    } catch {
      SchoolConfigService.saveSchoolProfile({
        id: schoolA,
        name: 'Lightweight Primary School',
        county: 'Nairobi',
        subCounty: 'Westlands',
        curriculumType: 'CBC_CBE',
        gradesSupported: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-8'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Ensure School B Profile (Multi-School Tenant Isolation)
    try {
      SchoolConfigService.getSchoolProfile(schoolB);
    } catch {
      SchoolConfigService.saveSchoolProfile({
        id: schoolB,
        name: 'Safari Academy',
        county: 'Mombasa',
        subCounty: 'Nyali',
        curriculumType: 'CBC_CBE',
        gradesSupported: ['grade-3', 'grade-4', 'grade-5', 'grade-7'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Seed Artifact in School A
    ContentArtifactRepository.save({
      id: 'art_p30_lesson_01',
      schoolId: schoolA,
      version: 1,
      artifactType: 'LESSON_PLAN',
      gradeLevelId: 'grade-3',
      learningAreaId: 'la-math',
      title: 'Grade 3 Addition with Regrouping',
      status: 'APPROVED',
      source: 'TEACHER_GENERATED',
      curriculumReferences: [
        {
          curriculumId: 'kicd-cbc-2026',
          gradeLevelId: 'grade-3',
          learningAreaId: 'la-math',
          strandId: 'strand-math-numbers',
          subStrandId: 'substrand-addition',
          learningOutcomeId: 'outcome-math-add-1',
        },
      ],
      contentPayload: {
        strand: 'Numbers',
        subStrand: 'Addition',
        durationMinutes: 35,
        learningOutcomes: ['Add 3-digit numbers with regrouping'],
        keyInquiryQuestions: ['How does regrouping help when adding large numbers?'],
        learningResources: ['Base ten blocks', 'Place value charts'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: teacherA,
    });
  });

  // ============================================================================
  // 1. END-TO-END PRIMARY SUCCESS CRITERION (TEACHER & STUDENT MVP WORKFLOW)
  // ============================================================================
  describe('Primary Success Criterion: End-to-End Real-World Workflow', () => {
    it('executes full Teacher -> ECG -> ELMS -> Student -> Evidence -> Teacher Decision flow', () => {
      // Step 1: Teacher login and school membership verification
      const teacherMembership = SchoolMembershipService.getMembership(teacherA, schoolA);
      expect(teacherMembership).toBeDefined();
      expect(teacherMembership?.status).toBe('ACTIVE');

      // Step 2: Select School/Class and verify teaching context
      const classes = ClassGroupService.getClassGroupsBySchool(schoolA);
      const targetClass = classes.find((c) => c.gradeId === 'grade-3') || classes[0];
      expect(targetClass).toBeDefined();

      // Ensure teacher has active assignment to this class & learning area
      TeacherAssignmentService.assignTeacher({
        schoolId: schoolA,
        teacherId: teacherA,
        gradeId: targetClass.gradeId,
        classGroupId: targetClass.id,
        learningAreaId: 'la-math',
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1', // Admin
      });

      AcademicOperationsService.assignTeacher({
        schoolId: schoolA,
        teacherId: teacherA,
        gradeId: targetClass.gradeId,
        learningAreaId: 'la-math',
        academicYearId: 'ay_lwps_2026',
        requestingRole: 'admin',
      });

      // Step 3: Select content artifact from repository
      const artifact = ContentArtifactRepository.getById('art_p30_lesson_01', schoolA, 1);
      expect(artifact).toBeDefined();
      expect(artifact?.title).toBe('Grade 3 Addition with Regrouping');

      // Step 4: Publish lesson to ELMS
      const pub = ElmsIntegrationService.publishResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: artifact!.id,
        artifactVersion: artifact!.version,
        classGroupId: targetClass.id,
        learningAreaId: 'la-math',
        learningOutcomeIds: ['outcome-math-add-1'],
        customElmsResourceId: 'elms_res_add_001',
      });

      expect(pub.status).toBe('PUBLISHED');
      expect(pub.elmsResourceId).toBe('elms_res_add_001');

      // Step 5: Map learner roster between ECG and ELMS
      const learners = LearnerRosterService.getLearnersBySchool(schoolA);
      const student1 = learners[0];
      expect(student1).toBeDefined();

      const learnerMapping = ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId: student1.id,
        elmsLearnerId: 'elms_usr_baraka',
        requestingUserId: teacherA,
      });
      expect(learnerMapping.elmsLearnerId).toBe('elms_usr_baraka');

      // Step 6: Student accesses lesson on ELMS and completes interactive activity
      const activityEvent = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_p30_act_01',
        sourceSystem: 'ELMS',
        eventType: 'LEARNING_ACTIVITY_COMPLETED',
        schoolId: schoolA,
        learnerId: learnerMapping.elmsLearnerId,
        resourceId: pub.elmsResourceId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idem_p30_act_01',
        payload: {
          completionStatus: 'COMPLETED',
          score: 85,
          timeSpentSeconds: 1200,
        },
      });

      expect(activityEvent.event.status).toBe('PROCESSED');
      expect(activityEvent.actionTaken).toContain('LEARNER_ACTIVITY_COMPLETED');

      // Step 7: Student submits assessment on ELMS with performance evidence
      const submissionEvent = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_p30_sub_01',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: learnerMapping.elmsLearnerId,
        resourceId: pub.elmsResourceId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idem_p30_sub_01',
        payload: {
          assessmentId: 'asmt_online_add_01',
          attemptId: 'att_p30_01',
          learnerId: learnerMapping.elmsLearnerId,
          responses: [{ itemId: 'item_add_1', response: 'A' }],
        },
      });

      expect(submissionEvent.event.status).toBe('PROCESSED');
      expect(submissionEvent.actionTaken).toContain('ASSESSMENT_SUBMITTED_AND_EVIDENCED');

      // Step 8: Teacher creates lesson review & completes reflection
      const review = TeachingReflectionService.createLessonReview({
        schoolId: schoolA,
        teacherId: teacherA,
        classGroupId: targetClass.id,
        teachingPlanId: 'tp_p30_1',
        teachingAllocationId: 'week_1_lesson_1',
        curriculumVersionId: 'kicd-cbc-2026',
        learningAreaId: 'la-math',
        learningOutcomeIds: ['outcome-math-add-1'],
        lessonDate: '2026-09-07',
        deliveryStatus: 'DELIVERED',
      });

      expect(review).toBeDefined();
      expect(review.deliveryStatus).toBe('DELIVERED');

      const reflection = TeachingReflectionService.recordReflection({
        schoolId: schoolA,
        teacherId: teacherA,
        lessonReviewId: review.id,
        pacing: 'APPROPRIATE',
        learnerResponse: 'STRONG',
        resourceEffectiveness: 'EFFECTIVE',
        whatWorked: 'Learners understood place value regrouping using concrete blocks and ELMS exercises.',
      });

      expect(reflection).toBeDefined();
      expect(reflection.pacing).toBe('APPROPRIATE');

      // Step 9: Teacher generates recommendation and makes decision (Teaching Continuity)
      const rec = TeachingReflectionService.generateNextLessonRecommendation(review.id, schoolA, teacherA);
      expect(rec).toBeDefined();
      expect(rec.recommendationType).toBeDefined();

      const decision = TeachingReflectionService.handleTeacherDecision(rec.id, schoolA, teacherA, 'ACCEPTED');
      expect(decision.status).toBe('ACCEPTED');

      const continuity = TeachingContinuityService.getInstructionalContinuity({
        schoolId: schoolA,
        teacherId: teacherA,
        classGroupId: targetClass.id,
        currentTeachingAllocationId: 'week_1_lesson_2',
        learningAreaId: 'la-math',
      });

      expect(continuity).toBeDefined();
      expect(continuity.previousLesson?.reviewId).toBe(review.id);
    });
  });

  // ============================================================================
  // 2. INTEGRATION SECURITY, IDEMPOTENCY & REPLAY PROTECTION
  // ============================================================================
  describe('Integration Security & Reliability', () => {
    it('safely deduplicates and ignores replayed ELMS webhook events', () => {
      const learners = LearnerRosterService.getLearnersBySchool(schoolA);
      const ecgLearnerId = learners[0].id;

      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId,
        elmsLearnerId: 'elms_usr_dedup',
        requestingUserId: teacherA,
      });

      const eventPayload = {
        eventId: 'evt_replay_test_001',
        sourceSystem: 'ELMS' as const,
        eventType: 'LEARNING_ACTIVITY_COMPLETED' as const,
        schoolId: schoolA,
        learnerId: 'elms_usr_dedup',
        resourceId: 'art_p30_lesson_01',
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idem_replay_key_001',
        payload: {
          completionStatus: 'COMPLETED',
          score: 90,
          timeSpentSeconds: 600,
        },
      };

      // First ingestion -> processed
      const firstRun = ElmsIntegrationService.ingestLearningEvent(eventPayload);
      expect(firstRun.event.status).toBe('PROCESSED');

      // Second ingestion (replayed event) -> deduplicated and ignored safely
      const replayRun = ElmsIntegrationService.ingestLearningEvent(eventPayload);
      expect(replayRun.event.status).toBe('IGNORED_DUPLICATE');
      expect(replayRun.actionTaken).toBe('IDEMPOTENT_DUPLICATE_IGNORED');
    });

    it('rejects unauthorized ELMS requests with invalid signatures/keys', () => {
      // Configure credentials for School A
      ElmsIntegrationService.setServiceCredentials(schoolA, {
        apiKey: 'prod_api_key_school_a',
        sharedSecret: 'prod_secret_school_a_secure_123',
        active: true,
      });

      // Valid auth check
      const validAuth = ElmsIntegrationService.validateServiceAuth(schoolA, 'prod_api_key_school_a');
      expect(validAuth).toBe(true);

      const validBearer = ElmsIntegrationService.validateServiceAuth(schoolA, undefined, 'prod_secret_school_a_secure_123');
      expect(validBearer).toBe(true);

      // Invalid auth checks
      const invalidKey = ElmsIntegrationService.validateServiceAuth(schoolA, 'forged_fake_key');
      expect(invalidKey).toBe(false);

      const invalidBearer = ElmsIntegrationService.validateServiceAuth(schoolA, undefined, 'forged_bearer_token');
      expect(invalidBearer).toBe(false);
    });

    it('safely handles unmapped learner events with FAILED status and non-corrupting error message', () => {
      const result = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_unmapped_p30',
        sourceSystem: 'ELMS',
        eventType: 'LEARNING_ACTIVITY_STARTED',
        schoolId: schoolA,
        learnerId: 'elms_unknown_ghost_learner',
        resourceId: 'art_p30_lesson_01',
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idem_unmapped_p30',
        payload: {},
      });

      expect(result.event.status).toBe('FAILED');
      expect(result.event.processingError).toContain('Unmapped');
    });
  });

  // ============================================================================
  // 3. MULTI-SCHOOL TENANT ISOLATION & IDOR DEFENSE
  // ============================================================================
  describe('Multi-School Tenant Isolation & IDOR Protection', () => {
    it('prevents Teacher from School A from publishing artifacts in School B', () => {
      expect(() => {
        ElmsIntegrationService.publishResource({
          schoolId: schoolB,
          teacherId: teacherA, // Teacher A does not belong to School B
          ecgArtifactId: 'art_p30_lesson_01',
        });
      }).toThrow(/not an active member/);
    });

    it('strictly isolates learner roster mappings between different schools', () => {
      const learners = LearnerRosterService.getLearnersBySchool(schoolA);
      const ecgLearnerId = learners[0].id;

      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId,
        elmsLearnerId: 'elms_shared_id_100',
        requestingUserId: teacherA,
      });

      // Querying School A resolves the mapping
      const mappingA = ElmsIntegrationService.getEcgLearnerId(schoolA, 'elms_shared_id_100');
      expect(mappingA).toBe(ecgLearnerId);

      // Querying School B with the same ELMS ID must NOT return School A learner
      const mappingB = ElmsIntegrationService.getEcgLearnerId(schoolB, 'elms_shared_id_100');
      expect(mappingB).toBeUndefined();
    });
  });

  // ============================================================================
  // 4. OBSERVABILITY, AUDIT & RECONCILIATION
  // ============================================================================
  describe('Observability, Audit & Synchronization Status', () => {
    it('accurately reports sync status and runs reconciliation', () => {
      const syncStatus = ElmsIntegrationService.getSyncStatus(schoolA);
      expect(syncStatus).toBeDefined();
      expect(typeof syncStatus.totalReceived).toBe('number');
      expect(typeof syncStatus.totalProcessed).toBe('number');
      expect(typeof syncStatus.totalFailed).toBe('number');
      expect(typeof syncStatus.totalPending).toBe('number');

      const reconciliation = ElmsIntegrationService.reconcile(schoolA);
      expect(reconciliation.schoolId).toBe(schoolA);
      expect(typeof reconciliation.publishedResourcesCount).toBe('number');
      expect(typeof reconciliation.learnerMappingsCount).toBe('number');
      expect(typeof reconciliation.processedEventsCount).toBe('number');
      expect(Array.isArray(reconciliation.unresolvedEvents)).toBe(true);
    });
  });
});
