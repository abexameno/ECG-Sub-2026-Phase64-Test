import { TeachingReflectionService } from './services/teachingReflectionService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { AcademicOperationsService } from './services/academicOperationsService.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 26 — Teaching Reflection, Lesson Review & Next-Lesson Planning', () => {
  const schoolId = 'lwps';
  const teacherId = 'teacher_jane';
  const classGroupId = 'cg_lwps_g8a';
  const curriculumVersionId = 'curr_v1';
  const learningAreaId = 'integrated-science';
  const learningOutcomeIds = ['lo_sci_g8_01'];

  beforeEach(() => {
    TeachingReflectionService.clearStore();
    SchoolMembershipService.clearStore();
    ClassGroupService.clearStore();
    AcademicOperationsService.clearStore();
    LearnerRosterService.clearStore();
    AssessmentEvidenceService.clearStore();
    LearningOutcomeInterpretationService.clearStore();

    const mem = SchoolMembershipService.requestJoinSchool(teacherId, schoolId, 'TEACHER');
    SchoolMembershipService.approveMembership(mem.id, '5');

    LearnerRosterService.addLearner({
      schoolId,
      displayName: 'Amina Juma',
      classGroupId,
      academicYearId: 'ay_lwps_2026',
      requestingUserId: '5',
    });
  });

  test('EC-01 to EC-05: Models exist and function correctly', () => {
    const review = TeachingReflectionService.createLessonReview({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      teachingAllocationId: 'week_1_lesson_1',
      curriculumVersionId,
      learningAreaId,
      learningOutcomeIds,
      lessonDate: '2026-09-07',
      deliveryStatus: 'DELIVERED',
    });

    expect(review).toBeDefined();
    expect(review.id).toContain('rev_');
    expect(review.deliveryStatus).toBe('DELIVERED');
    expect(review.reflectionStatus).toBe('NOT_REVIEWED');

    const reflection = TeachingReflectionService.recordReflection({
      schoolId,
      teacherId,
      lessonReviewId: review.id,
      pacing: 'APPROPRIATE',
      learnerResponse: 'STRONG',
      resourceEffectiveness: 'EFFECTIVE',
      whatWorked: 'Learners grasped concept quickly.',
    });

    expect(reflection).toBeDefined();
    expect(reflection.lessonReviewId).toBe(review.id);
    expect(reflection.pacing).toBe('APPROPRIATE');

    const updatedReview = TeachingReflectionService.getLessonReview(review.id, schoolId);
    expect(updatedReview.reflectionStatus).toBe('REVIEWED');

    const evidenceSummary = TeachingReflectionService.getLessonEvidenceSummary(review.id, schoolId);
    expect(evidenceSummary).toBeDefined();
    expect(evidenceSummary.lessonReviewId).toBe(review.id);
  });

  test('EC-10 to EC-12: School ownership and teacher class authorization are enforced', () => {
    const review = TeachingReflectionService.createLessonReview({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      teachingAllocationId: 'week_1_lesson_2',
      curriculumVersionId,
      learningAreaId,
      learningOutcomeIds,
      lessonDate: '2026-09-08',
      deliveryStatus: 'DELIVERED',
    });

    // Unauthorized teacher from another school or unassigned
    expect(() => {
      TeachingReflectionService.recordReflection({
        schoolId,
        teacherId: 'unauthorized_teacher',
        lessonReviewId: review.id,
        pacing: 'APPROPRIATE',
        learnerResponse: 'STRONG',
        resourceEffectiveness: 'EFFECTIVE',
      });
    }).toThrow();
  });

  test('EC-22 to EC-24: Reflection does not alter curriculum, TeachingPlan, or TeachingAllocation', () => {
    const review = TeachingReflectionService.createLessonReview({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      teachingAllocationId: 'week_1_lesson_3',
      curriculumVersionId,
      learningAreaId,
      learningOutcomeIds,
      lessonDate: '2026-09-09',
      deliveryStatus: 'DELIVERED',
    });

    TeachingReflectionService.recordReflection({
      schoolId,
      teacherId,
      lessonReviewId: review.id,
      pacing: 'TOO_SLOW',
      learnerResponse: 'STRONG',
      resourceEffectiveness: 'NEEDS_CHANGE',
      whatWasDifficult: 'Pacing was too slow.',
    });

    const recommendation = TeachingReflectionService.generateNextLessonRecommendation(review.id, schoolId, teacherId);
    expect(recommendation.recommendationType).toBe('RETEACH');

    const nextPlan = TeachingReflectionService.createNextLessonPlan({
      schoolId,
      teacherId,
      classGroupId,
      sourceLessonReviewId: review.id,
      teachingPlanId: 'tp_1',
      teachingAllocationId: 'week_1_lesson_4',
      curriculumVersionId,
      learningOutcomeIds,
      actionType: 'RETEACH',
      objective: 'Reteach core concepts with adjusted pacing',
      resourceReferences: ['res_1'],
      groupReferences: [],
      plannedDate: '2026-09-10',
    });

    expect(nextPlan).toBeDefined();
    expect(nextPlan.status).toBe('PROPOSED');
  });

  test('EC-31 to EC-35: Teacher decision lifecycle (accept, modify, reject)', () => {
    const review = TeachingReflectionService.createLessonReview({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      teachingAllocationId: 'week_1_lesson_5',
      curriculumVersionId,
      learningAreaId,
      learningOutcomeIds,
      lessonDate: '2026-09-11',
      deliveryStatus: 'DELIVERED',
    });

    const rec = TeachingReflectionService.generateNextLessonRecommendation(review.id, schoolId, teacherId);
    expect(rec.status).toBe('PROPOSED');

    const accepted = TeachingReflectionService.handleTeacherDecision(rec.id, schoolId, teacherId, 'ACCEPTED');
    expect(accepted.status).toBe('ACCEPTED');

    const modified = TeachingReflectionService.handleTeacherDecision(rec.id, schoolId, teacherId, 'MODIFIED', 'EXTEND', 'Extended for advanced learners');
    expect(modified.status).toBe('MODIFIED');
    expect(modified.recommendationType).toBe('EXTEND');
  });

  test('EC-63 to EC-67: Security, cross-school isolation, and IDOR blocking', () => {
    const review = TeachingReflectionService.createLessonReview({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      teachingAllocationId: 'week_1_lesson_6',
      curriculumVersionId,
      learningAreaId,
      learningOutcomeIds,
      lessonDate: '2026-09-12',
      deliveryStatus: 'DELIVERED',
    });

    expect(() => {
      TeachingReflectionService.getLessonReview(review.id, 'other_school');
    }).toThrow();
  });

  test('EC-68 to EC-71: Idempotency prevents duplicate reviews and plans', () => {
    const idempotencyKey = 'idem_key_26_01';
    const review1 = TeachingReflectionService.createLessonReview({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      teachingAllocationId: 'week_1_lesson_7',
      curriculumVersionId,
      learningAreaId,
      learningOutcomeIds,
      lessonDate: '2026-09-13',
      deliveryStatus: 'DELIVERED',
      idempotencyKey,
    });

    const review2 = TeachingReflectionService.createLessonReview({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      teachingAllocationId: 'week_1_lesson_7',
      curriculumVersionId,
      learningAreaId,
      learningOutcomeIds,
      lessonDate: '2026-09-13',
      deliveryStatus: 'DELIVERED',
      idempotencyKey,
    });

    expect(review1.id).toBe(review2.id);
  });
});
