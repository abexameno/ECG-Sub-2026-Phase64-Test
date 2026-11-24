import { ElmsIntegrationService } from './services/elmsIntegrationService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 29: ECG ↔ ELMS Integration & Learning Evidence Synchronization', () => {
  const schoolA = 'lwps';
  const schoolB = 'school-b';
  const teacherA = '2'; // Seeded active teacher in lwps
  const teacherB = '4'; // Seeded active teacher in school-b

  beforeEach(() => {
    ElmsIntegrationService.clearStore();
    TeachingActivityService.clearStore();
    AssessmentEvidenceService.clearStore();

    // Configure school A profile if needed
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

    // Seed Artifact in repository for School A
    ContentArtifactRepository.save({
      id: 'art_math_g3_wk1',
      schoolId: schoolA,
      version: 1,
      artifactType: 'SCHEME_OF_WORK',
      gradeLevelId: 'grade-3',
      learningAreaId: 'la-math',
      title: 'Grade 3 Numbers Scheme of Work',
      status: 'APPROVED',
      source: 'TEACHER_GENERATED',
      curriculumReferences: [
        {
          curriculumId: 'kicd-cbc-2026',
          gradeLevelId: 'grade-3',
          learningAreaId: 'la-math',
          strandId: 'strand-math-numbers',
          subStrandId: 'substrand-whole-numbers',
          learningOutcomeId: 'outcome-wn-1',
        },
      ],
      generationMetadata: {
        modelName: 'gemini-2.5-flash',
        promptTemplateId: 'sow_template',
        generationParameters: {},
        contentHash: 'hash_sow_1',
        generatedByUserId: teacherA,
        generatedAt: new Date().toISOString(),
      },
      content: { summary: 'Whole numbers up to 1000' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  describe('1. Resource Publication (ECG → ELMS)', () => {
    it('should successfully publish an approved ContentArtifact to ELMS with stable publication metadata', () => {
      const pub = ElmsIntegrationService.publishResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: 'art_math_g3_wk1',
        learningAreaId: 'mathematics',
        curriculumVersionId: 'kicd_cbe_2026',
        teachingPlanId: 'tp_lwps_term1_2026',
        teachingAllocationId: 'week_1_lesson_1',
        learningOutcomeIds: ['slo_math_g3_01'],
      });

      expect(pub).toBeDefined();
      expect(pub.status).toBe('PUBLISHED');
      expect(pub.ecgArtifactId).toBe('art_math_g3_wk1');
      expect(pub.artifactVersion).toBe(1);
      expect(pub.schoolId).toBe(schoolA);
      expect(pub.elmsResourceId).toContain('elms_res_art_math_g3_wk1_v1');

      // Verify retrieval
      const retrieved = ElmsIntegrationService.getPublication(schoolA, pub.publicationId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.ecgArtifactId).toBe('art_math_g3_wk1');
    });

    it('should support updating resource versions without breaking stable identity', () => {
      ElmsIntegrationService.publishResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: 'art_math_g3_wk1',
        artifactVersion: 1,
      });

      const updated = ElmsIntegrationService.updatePublishedResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: 'art_math_g3_wk1',
        newVersion: 2,
      });

      expect(updated.status).toBe('UPDATED');
      expect(updated.artifactVersion).toBe(2);
    });

    it('should support resource withdrawal from ELMS', () => {
      ElmsIntegrationService.publishResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: 'art_math_g3_wk1',
      });

      const withdrawn = ElmsIntegrationService.withdrawPublishedResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: 'art_math_g3_wk1',
      });

      expect(withdrawn.status).toBe('WITHDRAWN');
    });

    it('should reject publication if teacher does not belong to the school (IDOR Protection)', () => {
      expect(() => {
        ElmsIntegrationService.publishResource({
          schoolId: schoolA,
          teacherId: 'unauthorized_stranger',
          ecgArtifactId: 'art_math_g3_wk1',
        });
      }).toThrow(/not an active member/i);
    });
  });

  describe('2. Identity Mapping (Learners & Classes)', () => {
    it('should establish and query 1-to-1 cross-system learner mappings within school boundary', () => {
      const learners = LearnerRosterService.getLearnersBySchool(schoolA);
      const ecgLearnerId = learners[0].id;

      const mapping = ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId,
        elmsLearnerId: 'elms_usr_9901',
        requestingUserId: teacherA,
      });

      expect(mapping.ecgLearnerId).toBe(ecgLearnerId);
      expect(mapping.elmsLearnerId).toBe('elms_usr_9901');

      // Forward and reverse lookup
      expect(ElmsIntegrationService.getEcgLearnerId(schoolA, 'elms_usr_9901')).toBe(ecgLearnerId);
      expect(ElmsIntegrationService.getElmsLearnerId(schoolA, ecgLearnerId)).toBe('elms_usr_9901');
    });

    it('should enforce school-scoping and prevent cross-school identity collision', () => {
      const learners = LearnerRosterService.getLearnersBySchool(schoolA);
      const ecgLearnerId = learners[0].id;

      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId,
        elmsLearnerId: 'elms_usr_shared',
        requestingUserId: teacherA,
      });

      // School B query for same ELMS ID must return undefined
      expect(ElmsIntegrationService.getEcgLearnerId(schoolB, 'elms_usr_shared')).toBeUndefined();
    });
  });

  describe('3. Learning Event Contract & Processing (ELMS → ECG)', () => {
    it('should process LEARNING_ACTIVITY_STARTED and LEARNING_ACTIVITY_COMPLETED events', () => {
      const learners = LearnerRosterService.getLearnersBySchool(schoolA);
      const ecgLearnerId = learners[0].id;

      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId,
        elmsLearnerId: 'elms_usr_jane',
        requestingUserId: teacherA,
      });

      // 1. Ingest started event
      const startResult = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_start_001',
        sourceSystem: 'ELMS',
        eventType: 'LEARNING_ACTIVITY_STARTED',
        schoolId: schoolA,
        learnerId: 'elms_usr_jane',
        resourceId: 'art_math_g3_wk1',
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_start_001',
        payload: { progress: 0 },
      });

      expect(startResult.event.status).toBe('PROCESSED');
      expect(startResult.actionTaken).toContain('LEARNER_ACTIVITY_STARTED');

      // 2. Ingest completed event
      const completeResult = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_comp_001',
        sourceSystem: 'ELMS',
        eventType: 'LEARNING_ACTIVITY_COMPLETED',
        schoolId: schoolA,
        learnerId: 'elms_usr_jane',
        resourceId: 'art_math_g3_wk1',
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_comp_001',
        payload: { score: 90, completionPercentage: 100 },
      });

      expect(completeResult.event.status).toBe('PROCESSED');
      expect(completeResult.actionTaken).toContain('LEARNER_ACTIVITY_COMPLETED');
    });

    it('should process ASSESSMENT_SUBMITTED events and yield evaluated evidence in AssessmentEvidenceService', () => {
      const learners = LearnerRosterService.getLearnersBySchool(schoolA);
      const ecgLearnerId = learners[0].id;

      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId,
        elmsLearnerId: 'elms_usr_jane',
        requestingUserId: teacherA,
      });

      const submitResult = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_asmt_sub_001',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_usr_jane',
        resourceId: 'asmt_online_math_01',
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_asmt_sub_001',
        payload: {
          assessmentId: 'asmt_online_math_01',
          attemptId: 'att_001',
          learnerId: 'elms_usr_jane',
          responses: [{ itemId: 'item_1', response: 'A' }],
        },
      });

      expect(submitResult.event.status).toBe('PROCESSED');
      expect(submitResult.actionTaken).toContain('ASSESSMENT_SUBMITTED_AND_EVIDENCED');
    });

    it('should safely fail without corrupting state when an unmapped learner event is received', () => {
      const result = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_unmapped_001',
        sourceSystem: 'ELMS',
        eventType: 'LEARNING_ACTIVITY_STARTED',
        schoolId: schoolA,
        learnerId: 'elms_unknown_ghost_learner',
        resourceId: 'art_math_g3_wk1',
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_unmapped_001',
        payload: {},
      });

      expect(result.event.status).toBe('FAILED');
      expect(result.event.processingError).toContain('Unmapped');
    });
  });

  describe('4. Idempotency, Deduplication & Out-of-Order Handling', () => {
    it('should safely deduplicate repeated event deliveries with same idempotencyKey', () => {
      const learners = LearnerRosterService.getLearnersBySchool(schoolA);
      const ecgLearnerId = learners[0].id;

      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId,
        elmsLearnerId: 'elms_usr_jane',
        requestingUserId: teacherA,
      });

      const eventPayload = {
        eventId: 'evt_idemp_100',
        sourceSystem: 'ELMS' as const,
        eventType: 'LEARNING_ACTIVITY_STARTED' as const,
        schoolId: schoolA,
        learnerId: 'elms_usr_jane',
        resourceId: 'art_math_g3_wk1',
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_unique_key_100',
        payload: { progress: 10 },
      };

      // First delivery
      const res1 = ElmsIntegrationService.ingestLearningEvent(eventPayload);
      expect(res1.event.status).toBe('PROCESSED');

      // Duplicate redelivery
      const res2 = ElmsIntegrationService.ingestLearningEvent(eventPayload);
      expect(res2.event.status).toBe('IGNORED_DUPLICATE');
      expect(res2.actionTaken).toBe('IDEMPOTENT_DUPLICATE_IGNORED');
    });
  });

  describe('5. Reconciliation & Observability', () => {
    it('should reconcile sync status and attempt retry for unblocked events', () => {
      // 1. Ingest failed unmapped event
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_recon_001',
        sourceSystem: 'ELMS',
        eventType: 'LEARNING_ACTIVITY_STARTED',
        schoolId: schoolA,
        learnerId: 'elms_late_learner_99',
        resourceId: 'art_math_g3_wk1',
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_recon_001',
        payload: {},
      });

      let status = ElmsIntegrationService.getSyncStatus(schoolA);
      expect(status.totalFailed).toBe(1);

      // 2. Map learner now
      const learners = LearnerRosterService.getLearnersBySchool(schoolA);
      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId: learners[0].id,
        elmsLearnerId: 'elms_late_learner_99',
        requestingUserId: teacherA,
      });

      // 3. Trigger reconciliation
      const report = ElmsIntegrationService.reconcile(schoolA);
      expect(report.processedEventsCount).toBeGreaterThanOrEqual(1);

      status = ElmsIntegrationService.getSyncStatus(schoolA);
      expect(status.totalProcessed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Security & Multi-School Isolation', () => {
    it('should reject access to events belonging to another school', () => {
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_school_a_secret',
        sourceSystem: 'ELMS',
        eventType: 'LEARNING_EVIDENCE_RECORDED',
        schoolId: schoolA,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_sec_01',
        payload: {},
      });

      expect(() => {
        ElmsIntegrationService.getEvent(schoolB, 'evt_school_a_secret');
      }).toThrow(/Security Violation/i);
    });

    it('should validate service credentials correctly', () => {
      ElmsIntegrationService.setServiceCredentials(schoolA, {
        apiKey: 'secure_elms_api_key_lwps',
        sharedSecret: 'top_secret_hmac_lwps',
      });

      expect(ElmsIntegrationService.validateServiceAuth(schoolA, 'secure_elms_api_key_lwps')).toBe(true);
      expect(ElmsIntegrationService.validateServiceAuth(schoolA, 'wrong_key')).toBe(false);
      expect(ElmsIntegrationService.validateServiceAuth(schoolA, undefined, 'top_secret_hmac_lwps')).toBe(true);
    });
  });
});
