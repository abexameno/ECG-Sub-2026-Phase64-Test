import { DailyTeachingService } from './services/dailyTeachingService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { ElmsIntegrationService } from './services/elmsIntegrationService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { LearnerParticipationService } from './services/learnerParticipationService.ts';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService.ts';
import { AuditService } from './services/auditService.ts';

describe('PHASE 39 — LESSON EVIDENCE, LEARNER ACTIVITY & COMPLETION INTEGRITY', () => {
  const schoolId = 'sch_phase39_test';
  const teacherId = 'tch_phase39_lead';
  const learner1Id = 'lrn_phase39_001';
  const learner2Id = 'lrn_phase39_002';
  const teachingPlanId = 'tp_phase39_g8_sci';
  const teachingAllocationId = 'week_1_lesson_1';
  const learningOutcomeId = 'lo_sci_g8_01';

  beforeEach(() => {
    // Reset state stores
    TeachingActivityService.clearStore();
    ElmsIntegrationService.clearStore();
    AssessmentEvidenceService.clearStore();
    LearnerRosterService.clearStore();
    AuditService.clearLogs();

    // Register test school with teachingConfig
    SchoolConfigService.registerSchool({
      id: schoolId,
      name: 'Phase 39 Integrity Academy',
      code: 'P39IA',
      type: 'PRIMARY_JUNIOR',
      county: 'Nairobi',
      subCounty: 'Westlands',
      status: 'ACTIVE',
      teachingConfig: {
        lessonsPerWeek: 5,
        lessonDurationMinutes: 45,
        teachingWeeksPerTerm: 12,
        revisionWeeks: 1,
        assessmentWeeks: 1,
      },
    });

    // Add teacher membership
    SchoolMembershipService.addTeacherMembership({
      userId: teacherId,
      schoolId,
      role: 'ACADEMIC_ADMIN',
      status: 'ACTIVE',
      assignedClassGroupIds: ['cls_g8_a'],
    });

    // Add class group
    ClassGroupService.createClassGroup({
      id: 'cls_g8_a',
      schoolId,
      name: 'Grade 8A',
      gradeId: 'grade-8',
      academicYearId: 'ay_2026',
      requestingUserId: teacherId,
    });

    // Seed learners
    LearnerRosterService.addLearner({
      id: learner1Id,
      schoolId,
      displayName: 'Alice Integrity',
      classGroupId: 'cls_g8_a',
      academicYearId: 'ay_2026',
      requestingUserId: teacherId,
    });

    LearnerRosterService.addLearner({
      id: learner2Id,
      schoolId,
      displayName: 'Bob Integrity',
      classGroupId: 'cls_g8_a',
      academicYearId: 'ay_2026',
      requestingUserId: teacherId,
    });
  });

  // 1. STATE SEPARATION MATRIX
  describe('State Separation Matrix', () => {
    it('preserves distinct states: PLANNED -> STARTED -> DELIVERED -> COMPLETED', () => {
      // 1. Resolve lesson (PLANNED / NOT_STARTED)
      const today = DailyTeachingService.resolveTodayLesson(teacherId, schoolId);
      expect(today).not.toBeNull();
      expect(today?.status).toBe('NOT_STARTED');

      // 2. Start lesson (STARTED / IN_PROGRESS)
      const started = DailyTeachingService.startLesson(
        teacherId,
        schoolId,
        teachingPlanId,
        teachingAllocationId,
        learningOutcomeId
      );
      expect(started.status).toBe('IN_PROGRESS');
      expect(started.startedAt).toBeDefined();

      // Ensure STARTED is NOT COMPLETED
      expect(started.status).not.toBe('COMPLETED');
      expect(started.completionEvidence).toBeUndefined();

      // 3. Mark Delivered (DELIVERED)
      const delivered = DailyTeachingService.markDelivered(teacherId, schoolId, started.activityId);
      expect(delivered.status).toBe('DELIVERED');
      expect(delivered.deliveredAt).toBeDefined();

      // Ensure DELIVERED is NOT COMPLETED
      expect(delivered.status).not.toBe('COMPLETED');
      expect(delivered.completionEvidence).toBeUndefined();

      // 4. Complete Lesson (COMPLETED)
      const completed = DailyTeachingService.completeLesson(
        teacherId,
        schoolId,
        started.activityId,
        'Lesson executed cleanly with practical demonstration.'
      );
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBeDefined();
      expect(completed.completionEvidence).toBeDefined();
      expect(completed.completionEvidence?.source).toBe('TEACHER_CONFIRMATION');
      expect(completed.completionEvidence?.isRevoked).toBe(false);
    });
  });

  // 2. IDEMPOTENCY & DUPLICATE PROTECTION
  describe('Idempotency & Duplicate Protection', () => {
    it('prevents duplicate completion evidence on repeated completeLesson calls', () => {
      const act = DailyTeachingService.startLesson(
        teacherId,
        schoolId,
        teachingPlanId,
        teachingAllocationId,
        learningOutcomeId
      );

      const firstCompleted = DailyTeachingService.completeLesson(
        teacherId,
        schoolId,
        act.activityId,
        'First completion confirmation'
      );
      const evidenceId = firstCompleted.completionEvidence?.evidenceId;

      const secondCompleted = DailyTeachingService.completeLesson(
        teacherId,
        schoolId,
        act.activityId,
        'Second accidental completion click'
      );

      expect(secondCompleted.status).toBe('COMPLETED');
      expect(secondCompleted.completionEvidence?.evidenceId).toBe(evidenceId);
    });

    it('safely deduplicates incoming ELMS events with identical idempotency keys', () => {
      ElmsIntegrationService.setServiceCredentials(schoolId, {
        apiKey: `elms_key_${schoolId}`,
        sharedSecret: `elms_secret_${schoolId}`,
      });

      const eventInput = {
        eventId: 'evt_elms_001',
        idempotencyKey: 'idem_elms_unique_001',
        sourceSystem: 'ELMS_PLATFORM',
        eventType: 'LEARNING_ACTIVITY_COMPLETED' as const,
        schoolId,
        learnerId: learner1Id,
        ecgArtifactId: 'art_sci_notes',
        teachingPlanId,
        teachingAllocationId,
        learningOutcomeId,
        timestamp: new Date().toISOString(),
      };

      const result1 = ElmsIntegrationService.ingestLearningEvent(eventInput);
      expect(result1.event.status).toBe('PROCESSED');

      // Re-send exact same event
      const result2 = ElmsIntegrationService.ingestLearningEvent(eventInput);
      expect(result2.event.status).toBe('IGNORED_DUPLICATE');
      expect(result2.actionTaken).toBe('IDEMPOTENT_DUPLICATE_IGNORED');
    });
  });

  // 3. COMPLETION EVIDENCE REVOCATION & PROGRESS RECALCULATION
  describe('Completion Evidence Revocation & Progress Recalculation', () => {
    it('excludes revoked completion evidence from progress calculations', () => {
      // Create and complete two lesson slots
      const act1 = DailyTeachingService.startLesson(teacherId, schoolId, teachingPlanId, 'week_1_lesson_1', learningOutcomeId);
      DailyTeachingService.completeLesson(teacherId, schoolId, act1.activityId, 'Lesson 1 Done');

      const act2 = DailyTeachingService.startLesson(teacherId, schoolId, teachingPlanId, 'week_1_lesson_2', learningOutcomeId);
      DailyTeachingService.completeLesson(teacherId, schoolId, act2.activityId, 'Lesson 2 Done');

      // Check progress before revocation (2 out of 10)
      const progBefore = TeachingActivityService.calculateTeachingProgress(teachingPlanId, schoolId, 10);
      expect(progBefore.totalCompleted).toBe(2);
      expect(progBefore.progressPercentage).toBe(20);

      // Revoke Lesson 2 completion
      DailyTeachingService.correctLessonCompletion(teacherId, schoolId, act2.activityId, 'Taught wrong sub-strand by mistake');

      // Check progress after revocation (1 out of 10)
      const progAfter = TeachingActivityService.calculateTeachingProgress(teachingPlanId, schoolId, 10);
      expect(progAfter.totalCompleted).toBe(1);
      expect(progAfter.progressPercentage).toBe(10);

      const act2Updated = TeachingActivityService.getTeachingActivity(act2.activityId, schoolId);
      expect(act2Updated.status).toBe('IN_PROGRESS');
      expect(act2Updated.completionEvidence?.isRevoked).toBe(true);
    });
  });

  // 4. SECURITY & TENANT ISOLATION
  describe('Security & Tenant Isolation', () => {
    it('strictly enforces school tenant boundary for teaching activities', () => {
      const otherSchoolId = 'sch_other_tenant';
      SchoolConfigService.registerSchool({
        id: otherSchoolId,
        name: 'Foreign Academy',
        code: 'FORAC',
        type: 'PRIMARY_JUNIOR',
        county: 'Mombasa',
        subCounty: 'Nyali',
        status: 'ACTIVE',
      });

      const act = DailyTeachingService.startLesson(teacherId, schoolId, teachingPlanId, teachingAllocationId, learningOutcomeId);

      // Attempt access from foreign school
      expect(() => {
        TeachingActivityService.getTeachingActivity(act.activityId, otherSchoolId);
      }).toThrow('Unauthorized cross-school access to teaching activity');
    });

    it('strictly enforces learner privacy boundary for learner activity inspection', () => {
      const lact = DailyTeachingService.recordLearnerActivity({
        teacherId,
        schoolId,
        learnerId: learner1Id,
        teachingPlanId,
        teachingAllocationId,
        learningOutcomeId,
        activityType: 'PRACTICE_EXERCISE',
      });

      // Learner 2 inspecting Learner 1's activity
      expect(() => {
        TeachingActivityService.getLearnerActivity(lact.activityId, schoolId, learner2Id, 'learner');
      }).toThrow('Unauthorized access: learners cannot view other learners records');
    });
  });

  // 5. ATTENDANCE & ASSESSMENT VS LESSON COMPLETION BOUNDARY
  describe('Attendance & Assessment Boundaries', () => {
    it('ensures student attendance does not automatically mark a planned lesson as completed', () => {
      // Check-in learner attendance
      LearnerParticipationService.recordAttendanceBatch({
        schoolId,
        teacherId,
        classGroupId: 'cls_g8_a',
        lessonDate: '2026-09-09',
        records: [{ learnerId: learner1Id, status: 'PRESENT' }],
      });

      // Check today's lesson status
      const today = DailyTeachingService.resolveTodayLesson(teacherId, schoolId);
      expect(today?.status).toBe('NOT_STARTED');
    });

    it('ensures submitting an assessment creates assessment evidence without marking planned teaching activity complete', () => {
      // Create assessment
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId,
        curriculumVersionId: 'kicd_cbe_2026',
        learningOutcomeId,
        title: 'Topical Science Assessment',
        teachingPlanId,
        teachingAllocationId,
        items: [
          {
            sequence: 1,
            type: 'MULTIPLE_CHOICE',
            prompt: 'Which property is physical?',
            marks: 10,
            correctAnswer: 'A',
            learningOutcomeId,
          },
        ],
      });

      // Assessment attempt
      const attempt = DailyTeachingService.recordLearnerAssessmentAttempt({
        teacherId,
        schoolId,
        assessmentId: assessment.assessmentId,
        learnerId: learner1Id,
        responses: [{ itemId: assessment.items[0].itemId, selectedOption: 'A' }],
      });

      expect(attempt.status).toBe('EVALUATED');

      // Teaching activity should remain uncompleted until explicitly completed
      const today = DailyTeachingService.resolveTodayLesson(teacherId, schoolId);
      expect(today?.status).toBe('NOT_STARTED');
    });
  });

  // 6. NO AUTOMATIC MASTERY INFERENCE
  describe('No Automatic Mastery Inference', () => {
    it('ensures completing a lesson does not automatically invent or override SLO mastery', () => {
      const act = DailyTeachingService.startLesson(teacherId, schoolId, teachingPlanId, teachingAllocationId, learningOutcomeId);
      DailyTeachingService.completeLesson(teacherId, schoolId, act.activityId, 'Lesson 1 Completed');

      // Evaluate learner mastery via interpretation service
      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1Id,
        learningOutcomeId,
        schoolId,
        curriculumVersionId: 'kicd_cbe_2026',
        requestingUserId: teacherId,
        requestingRole: 'teacher',
      });

      // Status should remain based on assessment evidence, not automatically MASTERED
      expect(interp.interpretationStatus).not.toBe('STRONG_DEMONSTRATION');
      expect(interp.interpretationStatus).toBe('INSUFFICIENT_EVIDENCE');
    });
  });
});
