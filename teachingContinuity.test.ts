import { TeachingContinuityService } from './services/teachingContinuityService.ts';
import { TeachingReflectionService } from './services/teachingReflectionService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { AcademicOperationsService } from './services/academicOperationsService.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService.ts';

describe('Phase 27 — Teaching Continuity, Lesson Sequence Tracking & Instructional Follow-Through', () => {
  const schoolId = 'lwps';
  const teacherId = 'teacher_jane';
  const classGroupId = 'cg_lwps_g8a';
  const curriculumVersionId = 'curr_v1';
  const learningAreaId = 'integrated-science';
  const learningOutcomeIds = ['lo_sci_g8_01'];

  beforeEach(() => {
    TeachingContinuityService.clearStore();
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

  test('EC-01 to EC-05: Teaching sequence and lesson sequence entry models function correctly', () => {
    const sequence = TeachingContinuityService.createTeachingSequence({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      learningAreaId,
      curriculumVersionId,
      title: 'Science Term 3 Sequence',
    });

    expect(sequence).toBeDefined();
    expect(sequence.id).toContain('seq_');
    expect(sequence.status).toBe('ACTIVE');

    const entry = TeachingContinuityService.addLessonSequenceEntry({
      schoolId,
      teacherId,
      teachingSequenceId: sequence.id,
      classGroupId,
      teachingAllocationId: 'week_1_lesson_1',
      sequenceNumber: 1,
      plannedFocus: 'Introduction to Scientific Investigations',
      plannedDate: '2026-09-07',
    });

    expect(entry).toBeDefined();
    expect(entry.entryStatus).toBe('PLANNED');
    expect(entry.sequenceNumber).toBe(1);

    const entries = TeachingContinuityService.getEntriesForSequence(sequence.id, schoolId);
    expect(entries.length).toBe(1);
  });

  test('EC-10 to EC-12: School ownership and teacher class authorization are enforced in continuity', () => {
    const sequence = TeachingContinuityService.createTeachingSequence({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      learningAreaId,
      curriculumVersionId,
      title: 'Sequence Auth Test',
    });

    expect(() => {
      TeachingContinuityService.addLessonSequenceEntry({
        schoolId,
        teacherId: 'unauthorized_teacher',
        teachingSequenceId: sequence.id,
        classGroupId,
        teachingAllocationId: 'week_1_lesson_2',
        sequenceNumber: 1,
        plannedFocus: 'Unauthorized Entry',
        plannedDate: '2026-09-08',
      });
    }).toThrow();
  });

  test('EC-22 to EC-24: Instructional continuity layer connects completed review to next actions', () => {
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
      pacing: 'APPROPRIATE',
      learnerResponse: 'STRONG',
      resourceEffectiveness: 'EFFECTIVE',
      whatWorked: 'Great engagement.',
    });

    const continuity = TeachingContinuityService.getInstructionalContinuity({
      schoolId,
      teacherId,
      classGroupId,
      currentTeachingAllocationId: 'week_1_lesson_4',
      learningAreaId,
    });

    expect(continuity).toBeDefined();
    expect(continuity.previousLesson).toBeDefined();
    expect(continuity.previousLesson?.reviewId).toBe(review.id);
    expect(continuity.currentLesson.teachingAllocationId).toBe('week_1_lesson_4');
    expect(continuity.continuityStatus).toBeDefined();
  });

  test('EC-31 to EC-35: Follow-through action tracking and teacher decision lifecycle', () => {
    const review = TeachingReflectionService.createLessonReview({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      teachingAllocationId: 'week_1_lesson_5',
      curriculumVersionId,
      learningAreaId,
      learningOutcomeIds,
      lessonDate: '2026-09-10',
      deliveryStatus: 'DELIVERED',
    });

    const rec = TeachingReflectionService.generateNextLessonRecommendation(review.id, schoolId, teacherId);
    TeachingReflectionService.handleTeacherDecision(rec.id, schoolId, teacherId, 'ACCEPTED');

    const followThrough = TeachingContinuityService.createFollowThroughAction({
      schoolId,
      teacherId,
      classGroupId,
      sourceLessonReviewId: review.id,
      recommendationId: rec.id,
      teacherNotes: 'Accepted core recommendation.',
    });

    expect(followThrough).toBeDefined();
    expect(followThrough.recommendationId).toBe(rec.id);
    expect(followThrough.status).toBe('PENDING');

    const actions = TeachingContinuityService.getFollowThroughActions(schoolId, classGroupId);
    expect(actions.length).toBe(1);
  });

  test('EC-68 to EC-71: Idempotency prevents duplicate sequences', () => {
    const idempotencyKey = 'seq_idem_01';
    const seq1 = TeachingContinuityService.createTeachingSequence({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      learningAreaId,
      curriculumVersionId,
      title: 'Idempotent Sequence',
      idempotencyKey,
    });

    const seq2 = TeachingContinuityService.createTeachingSequence({
      schoolId,
      teacherId,
      classGroupId,
      teachingPlanId: 'tp_1',
      learningAreaId,
      curriculumVersionId,
      title: 'Idempotent Sequence',
      idempotencyKey,
    });

    expect(seq1.id).toBe(seq2.id);
  });
});
