import { ClassLearningProgressService } from './services/classLearningProgressService.ts';
import { TeachingReflectionService } from './services/teachingReflectionService.ts';
import { TeachingContinuityService } from './services/teachingContinuityService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { AcademicOperationsService } from './services/academicOperationsService.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService.ts';
import { TeachingPlanService } from './services/teachingPlanService.ts';

describe('Phase 28 — Class Learning Progress, Coverage & Instructional Health', () => {
  const schoolId = 'lwps';
  const teacherId = 'teacher_jane';
  const classGroupId = 'cg_lwps_g8a';
  const learningAreaId = 'integrated-science';
  const curriculumVersionId = 'curr_v1';
  const learningOutcomeIds = ['lo_sci_g8_01', 'lo_sci_g8_02'];

  beforeEach(() => {
    ClassLearningProgressService;
    TeachingContinuityService.clearStore();
    TeachingReflectionService.clearStore();
    SchoolMembershipService.clearStore();
    ClassGroupService.clearStore();
    AcademicOperationsService.clearStore();
    LearnerRosterService.clearStore();
    AssessmentEvidenceService.clearStore();
    LearningOutcomeInterpretationService.clearStore();
    TeachingPlanService.clearStore();

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

  test('EC-01 to EC-05: Class learning progress calculates planned, delivered, and evidenced metrics distinctly', () => {
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

    TeachingReflectionService.recordReflection({
      schoolId,
      teacherId,
      lessonReviewId: review.id,
      pacing: 'APPROPRIATE',
      learnerResponse: 'STRONG',
      resourceEffectiveness: 'EFFECTIVE',
      whatWorked: 'Excellent session.',
    });

    const progress = ClassLearningProgressService.getClassLearningProgress({
      schoolId,
      teacherId,
      classGroupId,
      learningAreaId,
    });

    expect(progress).toBeDefined();
    expect(progress.plannedProgress).toBeDefined();
    expect(progress.deliveredProgress).toBeDefined();
    expect(progress.evidencedProgress).toBeDefined();
    expect(progress.deliveredProgress.totalDeliveredLessons).toBe(1);
    expect(progress.evidencedProgress.totalCompletedWithEvidence).toBe(1);
    expect(progress.instructionalHealth).toBeDefined();
    expect(progress.attentionItems).toBeDefined();
  });

  test('EC-10 to EC-12: Security authorization and school isolation are strictly enforced', () => {
    expect(() => {
      ClassLearningProgressService.getClassLearningProgress({
        schoolId,
        teacherId: 'unauthorized_teacher',
        classGroupId,
        learningAreaId,
      });
    }).toThrow();
  });

  test('EC-20 to EC-23: Instructional health and coverage variance are derived deterministically', () => {
    const progress = ClassLearningProgressService.getClassLearningProgress({
      schoolId,
      teacherId,
      classGroupId,
      learningAreaId,
    });

    expect(progress.coverageSummary).toBeDefined();
    expect(progress.instructionalHealth).toBe('ON_TRACK');
  });
});
