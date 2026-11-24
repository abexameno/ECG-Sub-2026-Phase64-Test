import { TeachingActivityService } from './services/teachingActivityService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 12 Teaching Delivery, Learner Progress & Completion', () => {
  beforeEach(() => {
    TeachingActivityService.clearStore();
    AuditService.clearLogs();
  });

  test('EC-01 to EC-05: Should create teaching activity and require explicit delivery/completion', () => {
    const activity = TeachingActivityService.createTeachingActivity({
      schoolId: 'lwps',
      teacherId: 'teacher_1',
      teachingPlanId: 'tp_lwps_term1',
      teachingAllocationId: 'week_1_lesson_1',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_001',
      artifactId: 'art_123',
      artifactVersion: 1,
    });

    expect(activity.status).toBe('NOT_STARTED');

    // Starting activity
    const started = TeachingActivityService.startTeachingActivity(activity.activityId, 'lwps', 'teacher_1');
    expect(started.status).toBe('IN_PROGRESS');

    // Delivering lesson
    const delivered = TeachingActivityService.deliverTeachingActivity(activity.activityId, 'lwps', 'teacher_1');
    expect(delivered.status).toBe('DELIVERED');
    expect(delivered.deliveredAt).toBeDefined();

    // Explicit completion
    const completed = TeachingActivityService.completeTeachingActivity(activity.activityId, 'lwps', 'teacher_1', 'Lesson finished successfully');
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completionEvidence?.source).toBe('TEACHER_CONFIRMATION');
    expect(completed.completionEvidence?.recordedBy).toBe('teacher_1');
    expect(completed.completionEvidence?.isRevoked).toBe(false);
  });

  test('EC-06 & EC-07: Content viewing does NOT equal completion or teaching delivery', () => {
    const activity = TeachingActivityService.createTeachingActivity({
      schoolId: 'lwps',
      teacherId: 'teacher_1',
      teachingPlanId: 'tp_lwps_term1',
      teachingAllocationId: 'week_1_lesson_2',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_002',
    });

    // Merely reading/getting activity does not mutate state to COMPLETED
    const retrieved = TeachingActivityService.getTeachingActivity(activity.activityId, 'lwps');
    expect(retrieved.status).toBe('NOT_STARTED');
  });

  test('EC-11 & EC-12: Deterministic progress calculations and safe zero-denominator handling', () => {
    // 0 planned lessons -> NOT_APPLICABLE
    const emptyProgress = TeachingActivityService.calculateTeachingProgress('tp_empty', 'lwps', 0);
    expect(emptyProgress.status).toBe('NOT_APPLICABLE');
    expect(emptyProgress.progressPercentage).toBe(0);

    // 2 planned lessons, 1 completed -> 50%
    const act1 = TeachingActivityService.createTeachingActivity({
      schoolId: 'lwps',
      teacherId: 'teacher_1',
      teachingPlanId: 'tp_math',
      teachingAllocationId: 'w1_l1',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_m1',
    });
    TeachingActivityService.completeTeachingActivity(act1.activityId, 'lwps', 'teacher_1');

    TeachingActivityService.createTeachingActivity({
      schoolId: 'lwps',
      teacherId: 'teacher_1',
      teachingPlanId: 'tp_math',
      teachingAllocationId: 'w1_l2',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_m2',
    });

    const progress = TeachingActivityService.calculateTeachingProgress('tp_math', 'lwps', 2);
    expect(progress.totalApplicable).toBe(2);
    expect(progress.totalCompleted).toBe(1);
    expect(progress.progressPercentage).toBe(50);
  });

  test('EC-18 & EC-19: Auditable revocation and corrections of completion evidence', () => {
    const act = TeachingActivityService.createTeachingActivity({
      schoolId: 'lwps',
      teacherId: 'teacher_1',
      teachingPlanId: 'tp_math',
      teachingAllocationId: 'w2_l1',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_m3',
    });
    TeachingActivityService.completeTeachingActivity(act.activityId, 'lwps', 'teacher_1');

    // Revoke completion
    const corrected = TeachingActivityService.revokeOrCorrectCompletion(act.activityId, 'lwps', 'teacher_1', 'Accidental mark');
    expect(corrected.status).toBe('IN_PROGRESS');
    expect(corrected.completionEvidence?.isRevoked).toBe(true);

    // Progress calculation should now ignore revoked completion
    const progress = TeachingActivityService.calculateTeachingProgress('tp_math', 'lwps', 1);
    expect(progress.totalCompleted).toBe(0);
    expect(progress.progressPercentage).toBe(0);
  });

  test('EC-20: Idempotent completion handles duplicate requests safely', () => {
    const act = TeachingActivityService.createTeachingActivity({
      schoolId: 'lwps',
      teacherId: 'teacher_1',
      teachingPlanId: 'tp_sci',
      teachingAllocationId: 'w1_l1',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_s1',
    });

    const comp1 = TeachingActivityService.completeTeachingActivity(act.activityId, 'lwps', 'teacher_1', 'First submission');
    const comp2 = TeachingActivityService.completeTeachingActivity(act.activityId, 'lwps', 'teacher_1', 'Network retry submission');

    expect(comp1.activityId).toBe(comp2.activityId);
    expect(comp1.completedAt).toBe(comp2.completedAt);
    expect(comp1.completionEvidence?.evidenceId).toBe(comp2.completionEvidence?.evidenceId);
  });

  test('EC-22 & EC-23: Cross-school access is rejected server-side', () => {
    const act = TeachingActivityService.createTeachingActivity({
      schoolId: 'lwps',
      teacherId: 'teacher_1',
      teachingPlanId: 'tp_lwps',
      teachingAllocationId: 'w1_l1',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_1',
    });

    expect(() => {
      TeachingActivityService.getTeachingActivity(act.activityId, 'school_b');
    }).toThrow('Unauthorized cross-school access to teaching activity');
  });

  test('EC-24 & EC-25: Learner peer isolation (IDOR protection)', () => {
    const lAct = TeachingActivityService.createLearnerActivity({
      schoolId: 'lwps',
      learnerId: 'learner_alice',
      teachingPlanId: 'tp_lwps',
      teachingAllocationId: 'w1_l1',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_1',
    });

    // Bob tries to read Alice's learner activity -> Rejected
    expect(() => {
      TeachingActivityService.getLearnerActivity(lAct.activityId, 'lwps', 'learner_bob', 'learner');
    }).toThrow('Unauthorized access: learners cannot view other learners records');

    // Alice reading her own activity -> Allowed
    const aliceRead = TeachingActivityService.getLearnerActivity(lAct.activityId, 'lwps', 'learner_alice', 'learner');
    expect(aliceRead.activityId).toBe(lAct.activityId);

    // Teacher reading Alice's activity -> Allowed
    const teacherRead = TeachingActivityService.getLearnerActivity(lAct.activityId, 'lwps', 'teacher_1', 'teacher');
    expect(teacherRead.activityId).toBe(lAct.activityId);
  });

  test('EC-30: Multi-school independence test', () => {
    // School LWPS and School B with separate teaching activities on same curriculum
    const lwpsAct = TeachingActivityService.createTeachingActivity({
      schoolId: 'lwps',
      teacherId: 't_lwps',
      teachingPlanId: 'tp_lwps',
      teachingAllocationId: 'slot_1',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_shared_1',
    });
    TeachingActivityService.completeTeachingActivity(lwpsAct.activityId, 'lwps', 't_lwps');

    const schoolBAct = TeachingActivityService.createTeachingActivity({
      schoolId: 'school_b',
      teacherId: 't_b',
      teachingPlanId: 'tp_school_b',
      teachingAllocationId: 'slot_1',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_shared_1',
    });

    const lwpsProg = TeachingActivityService.calculateTeachingProgress('tp_lwps', 'lwps', 1);
    const schoolBProg = TeachingActivityService.calculateTeachingProgress('tp_school_b', 'school_b', 1);

    expect(lwpsProg.progressPercentage).toBe(100);
    expect(schoolBProg.progressPercentage).toBe(0);
  });
});
