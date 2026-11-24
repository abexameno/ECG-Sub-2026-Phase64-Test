import { DailyTeachingService } from './services/dailyTeachingService.ts';
import { TeacherWorkspaceService } from './services/teacherWorkspaceService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService.ts';
import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { AuditService } from './services/auditService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';

describe('Phase 16 Teacher Classroom Delivery & Daily Teaching Workflow', () => {
  beforeEach(() => {
    TeacherWorkspaceService.clearStore();
    TeachingActivityService.clearStore();
    AssessmentEvidenceService.clearStore();
    LearningOutcomeInterpretationService.clearStore();
    ContentArtifactRepository.clear();
    AuditService.clearLogs();
  });

  test('EC-01 to EC-08: Today\'s lesson resolves deterministically from Teaching Plan & maintains curriculum linkages', () => {
    const today = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps');

    expect(today).not.toBeNull();
    expect(today?.schoolId).toBe('lwps');
    expect(today?.grade).toBe('Grade 8');
    expect(today?.learningArea).toBe('Integrated Science');
    expect(today?.weekNumber).toBe(1);
    expect(today?.lessonNumber).toBe(1);
    expect(today?.teachingAllocationId).toBe('week_1_lesson_1');
    expect(today?.curriculumVersionId).toBe(CanonicalCurriculumService.getCurriculum().version);
    expect(today?.learningOutcomeId).toBeDefined();
    expect(today?.status).toBe('NOT_STARTED');
  });

  test('EC-02: No fabricated lesson when school profile is invalid', () => {
    expect(() => {
      DailyTeachingService.resolveTodayLesson('teacher_jane', 'invalid_school_xyz');
    }).toThrow('Unauthorized or invalid school: invalid_school_xyz');
  });

  test('EC-09 & EC-10: Existing resources are reused and exact resource versions are preserved', async () => {
    const context = TeacherWorkspaceService.getTeacherContext('teacher_jane', 'lwps');
    const pkg = await TeacherWorkspaceService.generateTeachingPackage('teacher_jane', context, {
      schemeOfWork: true,
      lessonPlans: true,
      lessonNotes: true,
      assessments: false,
    });

    const lp = pkg.resources.find(r => r.type === 'LESSON_PLAN')!;
    expect(lp.artifactId).toBeDefined();
    expect(lp.artifactVersion).toBe(1);

    const today = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps');
    const todayLp = today?.resources.find(r => r.type === 'LESSON_PLAN');

    expect(todayLp?.isAvailable).toBe(true);
    expect(todayLp?.artifactId).toBe(lp.artifactId);
    expect(todayLp?.artifactVersion).toBe(1);

    // Start lesson preserving exact resource version
    const activity = DailyTeachingService.startLesson(
      'teacher_jane',
      'lwps',
      today!.teachingPlanId,
      today!.teachingAllocationId,
      today!.learningOutcomeId,
      todayLp?.artifactId,
      todayLp?.artifactVersion
    );

    expect(activity.artifactId).toBe(lp.artifactId);
    expect(activity.artifactVersion).toBe(1);
    expect(activity.status).toBe('IN_PROGRESS');
  });

  test('EC-11 & EC-12: Start Lesson creates TeachingActivity and is strictly idempotent', () => {
    const today = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps')!;

    const act1 = DailyTeachingService.startLesson(
      'teacher_jane',
      'lwps',
      today.teachingPlanId,
      today.teachingAllocationId,
      today.learningOutcomeId
    );

    expect(act1.status).toBe('IN_PROGRESS');
    expect(act1.startedAt).toBeDefined();

    // Idempotent second call
    const act2 = DailyTeachingService.startLesson(
      'teacher_jane',
      'lwps',
      today.teachingPlanId,
      today.teachingAllocationId,
      today.learningOutcomeId
    );

    expect(act2.activityId).toBe(act1.activityId);
    expect(act2.startedAt).toBe(act1.startedAt);
  });

  test('EC-13 & EC-14: Mark Delivered is an explicit event (not inferred from merely opening resources)', () => {
    const today = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps')!;
    const act = DailyTeachingService.startLesson(
      'teacher_jane',
      'lwps',
      today.teachingPlanId,
      today.teachingAllocationId,
      today.learningOutcomeId
    );

    // Merely viewing/resolving does not mark delivered
    const afterView = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps')!;
    expect(afterView.status).toBe('IN_PROGRESS');

    // Explicit delivery
    const delivered = DailyTeachingService.markDelivered('teacher_jane', 'lwps', act.activityId);
    expect(delivered.status).toBe('DELIVERED');
    expect(delivered.deliveredAt).toBeDefined();
  });

  test('EC-15 & EC-16: Learner activity uses Phase 12 architecture with explicit status tracking', () => {
    const today = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps')!;

    const learnerAct = DailyTeachingService.recordLearnerActivity({
      teacherId: 'teacher_jane',
      schoolId: 'lwps',
      learnerId: 'learner_101',
      teachingPlanId: today.teachingPlanId,
      teachingAllocationId: today.teachingAllocationId,
      learningOutcomeId: today.learningOutcomeId,
      activityType: 'PRACTICE_EXERCISE',
      evidenceReference: 'doc_submission_101',
    });

    expect(learnerAct.activityId).toBeDefined();
    expect(learnerAct.learnerId).toBe('learner_101');
    expect(learnerAct.status).toBe('COMPLETED');
    expect(learnerAct.evidenceReference).toBe('doc_submission_101');
  });

  test('EC-17 & EC-18: Assessment uses Phase 13 architecture and preserves version integrity', () => {
    const curriculum = CanonicalCurriculumService.getCurriculum();
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: curriculum.version,
      learningOutcomeId: 'lo_sci_g8_01',
      title: 'Topical Test: Properties of Materials',
      items: [
        {
          sequence: 1,
          type: 'MULTIPLE_CHOICE',
          prompt: 'Which property is physical?',
          options: [
            { key: 'A', text: 'Melting point' },
            { key: 'B', text: 'Flammability' }
          ],
          correctAnswer: 'A',
          marks: 1,
        }
      ]
    });

    const attempt = DailyTeachingService.recordLearnerAssessmentAttempt({
      teacherId: 'teacher_jane',
      schoolId: 'lwps',
      assessmentId: assessment.assessmentId,
      learnerId: 'learner_101',
      responses: [
        { itemId: assessment.items[0].itemId, selectedOption: 'A' }
      ]
    });

    expect(attempt.attemptId).toBeDefined();
    expect(attempt.status).toBe('EVALUATED');

    const evidence = AssessmentEvidenceService.getLearnerOutcomeEvidence(
      'learner_101',
      'lo_sci_g8_01',
      'lwps',
      'teacher_jane',
      'teacher'
    );
    expect(evidence.totalEvidenceRecords).toBe(1);
    expect(evidence.latestScorePercentage).toBe(100);
  });

  test('EC-19 to EC-21: Lesson completion requires explicit confirmation, is auditable and correctable', () => {
    const today = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps')!;
    const act = DailyTeachingService.startLesson(
      'teacher_jane',
      'lwps',
      today.teachingPlanId,
      today.teachingAllocationId,
      today.learningOutcomeId
    );

    const completed = DailyTeachingService.completeLesson(
      'teacher_jane',
      'lwps',
      act.activityId,
      'Delivered lab experiment with all learners present.'
    );

    expect(completed.status).toBe('COMPLETED');
    expect(completed.completionEvidence).toBeDefined();
    expect(completed.completionEvidence?.source).toBe('TEACHER_CONFIRMATION');
    expect(completed.completionEvidence?.recordedBy).toBe('teacher_jane');

    // Correct completion
    const corrected = DailyTeachingService.correctLessonCompletion(
      'teacher_jane',
      'lwps',
      act.activityId,
      'Lesson interrupted by fire drill.'
    );

    expect(corrected.status).toBe('IN_PROGRESS');
    expect(corrected.completionEvidence?.isRevoked).toBe(true);
  });

  test('EC-22 & EC-23: Performance review displays Phase 14 interpretation without inventing mastery', () => {
    const curriculum = CanonicalCurriculumService.getCurriculum();
    const outcomeId = 'lo_sci_g8_01';

    // Seed assessment evidence for learner_A
    const asmt1 = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: curriculum.version,
      learningOutcomeId: outcomeId,
      title: 'Quick Check 1',
      items: [{ sequence: 1, type: 'MULTIPLE_CHOICE', prompt: 'Q1', correctAnswer: 'A', marks: 5 }]
    });
    const asmt2 = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: curriculum.version,
      learningOutcomeId: outcomeId,
      title: 'Quick Check 2',
      items: [{ sequence: 1, type: 'MULTIPLE_CHOICE', prompt: 'Q1', correctAnswer: 'A', marks: 5 }]
    });
    DailyTeachingService.recordLearnerAssessmentAttempt({
      teacherId: 'teacher_jane',
      schoolId: 'lwps',
      assessmentId: asmt1.assessmentId,
      learnerId: 'learner_A',
      responses: [{ itemId: asmt1.items[0].itemId, selectedOption: 'A' }]
    });
    DailyTeachingService.recordLearnerAssessmentAttempt({
      teacherId: 'teacher_jane',
      schoolId: 'lwps',
      assessmentId: asmt2.assessmentId,
      learnerId: 'learner_A',
      responses: [{ itemId: asmt2.items[0].itemId, selectedOption: 'A' }]
    });

    const summary = DailyTeachingService.getLessonReviewSummary(
      'teacher_jane',
      'lwps',
      outcomeId,
      ['learner_A', 'learner_B_no_evidence']
    );

    expect(summary.totalLearnersEvaluated).toBe(2);
    expect(summary.strongDemonstrationCount).toBe(1); // learner_A
    expect(summary.insufficientEvidenceCount).toBe(1); // learner_B
  });

  test('EC-24: Next Lesson is deterministically resolved from Teaching Plan sequence', () => {
    const today = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps')!;
    const next = today.nextLesson;

    expect(next).toBeDefined();
    expect(next?.teachingAllocationId).toBe('week_1_lesson_2');
    expect(next?.weekNumber).toBe(1);
    expect(next?.lessonNumber).toBe(2);
  });

  test('EC-25 to EC-29: School isolation and IDOR protection strictly enforced', () => {
    const todayA = DailyTeachingService.resolveTodayLesson('teacher_a', 'lwps')!;
    const actA = DailyTeachingService.startLesson(
      'teacher_a',
      'lwps',
      todayA.teachingPlanId,
      todayA.teachingAllocationId,
      todayA.learningOutcomeId
    );

    // School B teacher attempts to deliver or complete School A lesson
    expect(() => {
      DailyTeachingService.markDelivered('teacher_b', 'school_b', actA.activityId);
    }).toThrow('Unauthorized cross-school access to teaching activity');

    expect(() => {
      DailyTeachingService.completeLesson('teacher_b', 'school_b', actA.activityId);
    }).toThrow('Unauthorized cross-school access to teaching activity');
  });

  test('EC-31 & EC-32: Partial resources or missing optional resources do not block teaching delivery', () => {
    // No notes or SOW generated yet
    const today = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps')!;
    
    // Teacher can still start and complete the lesson
    const act = DailyTeachingService.startLesson(
      'teacher_jane',
      'lwps',
      today.teachingPlanId,
      today.teachingAllocationId,
      today.learningOutcomeId
    );

    expect(act.status).toBe('IN_PROGRESS');
    const delivered = DailyTeachingService.markDelivered('teacher_jane', 'lwps', act.activityId);
    expect(delivered.status).toBe('DELIVERED');
  });
});
