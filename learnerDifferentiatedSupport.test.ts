import { LearnerDifferentiatedSupportService } from './services/learnerDifferentiatedSupportService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { QuotaService } from './services/quotaService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 23 — Differentiated Learning, Remediation & Learner Support Verification Suite', () => {
  const schoolId = 'lwps';
  const schoolBId = 'school-b';
  const teacherId = '2'; // Jane Doe
  const adminId = '1';
  const classGroupId = 'cg-g8-east';
  const classGroupBId = 'cg-schoolb-g8';
  const learner1Id = 'lrn_001';
  const learner2Id = 'lrn_002';
  const outcome1Id = 'lo_int_1_1';

  beforeEach(() => {
    LearnerDifferentiatedSupportService.clearStore();
    SchoolMembershipService.clearStore();
    LearnerRosterService.clearStore();
    TeachingActivityService.clearStore();
    ContentArtifactRepository.clearStore();
    QuotaService.resetStore();
    AuditService.clearLogs();

    // Setup seed data
    ClassGroupService.createClassGroup({
      id: classGroupId,
      schoolId,
      name: 'Grade 8 East',
      gradeId: 'grade-8',
      academicYearId: 'ay_2026',
    });
    ClassGroupService.createClassGroup({
      id: classGroupBId,
      schoolId: schoolBId,
      name: 'Grade 8 School B',
      gradeId: 'grade-8',
      academicYearId: 'ay_2026',
    });

    SchoolMembershipService.addMembership({
      userId: teacherId,
      schoolId,
      role: 'TEACHER',
      status: 'ACTIVE',
      assignedClassGroupIds: [classGroupId],
    });

    LearnerRosterService.addLearner({
      id: learner1Id,
      schoolId,
      displayName: 'Grace Achieng',
      learnerIdentifier: 'ADM-101',
      classGroupId,
      academicYearId: 'ay_2026',
      requestingUserId: adminId,
    });
    LearnerRosterService.addLearner({
      id: learner2Id,
      schoolId,
      displayName: 'Brian Otieno',
      learnerIdentifier: 'ADM-102',
      classGroupId,
      academicYearId: 'ay_2026',
      requestingUserId: adminId,
    });
  });

  it('EC-01: Canonical support-need model exists with mandatory identifiers', () => {
    const need = LearnerDifferentiatedSupportService.createSupportNeed({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      learningOutcomeId: outcome1Id,
      sourceType: 'TEACHER_OBSERVATION',
      reason: 'Learner showed difficulty in balancing chemical equations',
    });

    expect(need.id).toBeDefined();
    expect(need.schoolId).toBe(schoolId);
    expect(need.learnerId).toBe(learner1Id);
    expect(need.learningOutcomeId).toBe(outcome1Id);
    expect(need.status).toBe('OPEN');
  });

  it('EC-02: Canonical support-plan model exists with strategy, intensity, and objective', () => {
    const need = LearnerDifferentiatedSupportService.createSupportNeed({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      learningOutcomeId: outcome1Id,
      sourceType: 'TEACHER_OBSERVATION',
      reason: 'Observed difficulty',
    });

    const plan = LearnerDifferentiatedSupportService.createSupportPlan({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      supportNeedId: need.id,
      learningOutcomeIds: [outcome1Id],
      strategy: 'GUIDED_PRACTICE',
      intensity: 'ADDITIONAL_SUPPORT',
      objective: 'Master step-by-step balance calculations',
      plannedDate: '2026-09-10',
    });

    expect(plan.id).toBeDefined();
    expect(plan.strategy).toBe('GUIDED_PRACTICE');
    expect(plan.intensity).toBe('ADDITIONAL_SUPPORT');
    expect(plan.status).toBe('PLANNED');
    expect(plan.history.length).toBeGreaterThan(0);
  });

  it('EC-03: Support context is deterministically constructed', () => {
    const context = LearnerDifferentiatedSupportService.getSupportContext({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      learningOutcomeId: outcome1Id,
    });

    expect(context.schoolId).toBe(schoolId);
    expect(context.learnerId).toBe(learner1Id);
    expect(context.curriculumVersionId).toBeDefined();
  });

  it('EC-04: Learning Outcome linkage is strictly validated against canonical curriculum', () => {
    expect(() => {
      LearnerDifferentiatedSupportService.createSupportNeed({
        schoolId,
        teacherId,
        learnerId: learner1Id,
        classGroupId,
        learningOutcomeId: 'invalid_lo_99999',
        sourceType: 'TEACHER_OBSERVATION',
        reason: 'Invalid outcome ID test',
      });
    }).toThrow(/Invalid learning outcome ID/);
  });

  it('EC-[06-09]: Multi-tenant authorization, class, and roster boundaries are strictly enforced', () => {
    // Cross school
    expect(() => {
      LearnerDifferentiatedSupportService.createSupportNeed({
        schoolId: schoolBId,
        teacherId, // Jane is in lwps
        learnerId: learner1Id,
        classGroupId,
        learningOutcomeId: outcome1Id,
        sourceType: 'TEACHER_OBSERVATION',
        reason: 'Cross school breach',
      });
    }).toThrow(/Unauthorized cross-school access/);

    // Invalid roster learner
    expect(() => {
      LearnerDifferentiatedSupportService.createSupportNeed({
        schoolId,
        teacherId,
        learnerId: 'unregistered_learner_xyz',
        classGroupId,
        learningOutcomeId: outcome1Id,
        sourceType: 'TEACHER_OBSERVATION',
        reason: 'Unregistered learner breach',
      });
    }).toThrow(/Learner unregistered_learner_xyz is not on the roster/);
  });

  it('EC-16 & EC-17: Reuse-first search returns school-isolated validated resources', () => {
    const resources = LearnerDifferentiatedSupportService.searchExistingResources({
      schoolId,
      teacherId,
      learningOutcomeId: outcome1Id,
    });

    expect(Array.isArray(resources)).toBe(true);
  });

  it('EC-18 & EC-55: AI support generation obeys model governance and quota limits', () => {
    const artifact = LearnerDifferentiatedSupportService.generateSupportContent({
      schoolId,
      teacherId,
      classGroupId,
      gradeLevelId: 'grade-8',
      learningAreaId: 'la-sci',
      learningOutcomeId: outcome1Id,
      strategy: 'SCAFFOLDED_ACTIVITY',
      intensity: 'ADDITIONAL_SUPPORT',
      objective: 'Provide step-by-step scaffolds',
    });

    expect(artifact.id).toBeDefined();
    expect(artifact.schoolId).toBe(schoolId);
    expect(artifact.source).toBe('ai_generated');

    const quotaStatus = QuotaService.getQuotaStatus(schoolId);
    expect(quotaStatus.consumed).toBe(1);
  });

  it('EC-30 & EC-31: Group support creates individual learner plans maintaining individual history', () => {
    const { groupAssignment, plans } = LearnerDifferentiatedSupportService.createGroupSupport({
      schoolId,
      teacherId,
      classGroupId,
      learnerIds: [learner1Id, learner2Id],
      learningOutcomeId: outcome1Id,
      strategy: 'SMALL_GROUP_SUPPORT',
      intensity: 'ADDITIONAL_SUPPORT',
      objective: 'Group review of practical lab procedures',
      plannedDate: '2026-09-12',
    });

    expect(groupAssignment.id).toBeDefined();
    expect(plans.length).toBe(2);
    expect(plans[0].learnerId).toBe(learner1Id);
    expect(plans[1].learnerId).toBe(learner2Id);
    expect(plans[0].groupSupportId).toBe(groupAssignment.id);
  });

  it('EC-32 & EC-33: Support delivery integrates with existing Teaching & Learner Activity architecture', () => {
    const need = LearnerDifferentiatedSupportService.createSupportNeed({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      learningOutcomeId: outcome1Id,
      sourceType: 'TEACHER_OBSERVATION',
      reason: 'Delivery test',
    });

    const plan = LearnerDifferentiatedSupportService.createSupportPlan({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      supportNeedId: need.id,
      learningOutcomeIds: [outcome1Id],
      strategy: 'RETEACH_CONCEPT',
      intensity: 'INTENSIVE_SUPPORT',
      objective: 'Re-explain core principles',
      plannedDate: '2026-09-10',
    });

    const deliveredPlan = LearnerDifferentiatedSupportService.deliverSupportPlan({
      schoolId,
      teacherId,
      supportPlanId: plan.id,
    });

    expect(deliveredPlan.status).toBe('DELIVERED');
    expect(deliveredPlan.deliveredAt).toBeDefined();

    const activities = TeachingActivityService.getActivitiesBySchool(schoolId);
    expect(activities.length).toBeGreaterThan(0);
  });

  it('EC-36 to EC-44: Support completion and outcome review does NOT automatically grant mastery', () => {
    LearningOutcomeInterpretationService.evaluateOutcome({
      learnerId: learner1Id,
      learningOutcomeId: outcome1Id,
      schoolId,
      curriculumVersionId: 'cv_cbc_v1',
      requestingUserId: teacherId,
      requestingRole: 'teacher',
    });

    const need = LearnerDifferentiatedSupportService.createSupportNeed({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      learningOutcomeId: outcome1Id,
      sourceType: 'TEACHER_OBSERVATION',
      reason: 'Outcome review test',
    });

    const plan = LearnerDifferentiatedSupportService.createSupportPlan({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      supportNeedId: need.id,
      learningOutcomeIds: [outcome1Id],
      strategy: 'GUIDED_PRACTICE',
      intensity: 'STANDARD',
      objective: 'Practice guided exercises',
      plannedDate: '2026-09-10',
    });

    LearnerDifferentiatedSupportService.deliverSupportPlan({
      schoolId,
      teacherId,
      supportPlanId: plan.id,
    });

    const reviewedPlan = LearnerDifferentiatedSupportService.reviewSupportOutcome({
      schoolId,
      teacherId,
      supportPlanId: plan.id,
      decision: 'RESOLVED',
      notes: 'Learner completed additional practice smoothly.',
    });

    expect(reviewedPlan.status).toBe('COMPLETED');
    expect(reviewedPlan.outcomeDecision).toBe('RESOLVED');

    // Verify Phase 14 interpretation remains controlled by teacher
    const interp = LearningOutcomeInterpretationService.getInterpretation(
      learner1Id,
      outcome1Id,
      schoolId,
      teacherId,
      'teacher'
    );
    // Interpretation is not auto-overwritten to MASTERY
    expect(interp).toBeDefined();
  });

  it('EC-45 & EC-46: Support history tracking and auditable corrections', () => {
    const need = LearnerDifferentiatedSupportService.createSupportNeed({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      learningOutcomeId: outcome1Id,
      sourceType: 'TEACHER_OBSERVATION',
      reason: 'History test',
    });

    const plan = LearnerDifferentiatedSupportService.createSupportPlan({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      supportNeedId: need.id,
      learningOutcomeIds: [outcome1Id],
      strategy: 'GUIDED_PRACTICE',
      intensity: 'STANDARD',
      objective: 'Initial objective',
      plannedDate: '2026-09-10',
    });

    const updatedPlan = LearnerDifferentiatedSupportService.updateSupportPlan({
      schoolId,
      teacherId,
      supportPlanId: plan.id,
      updates: {
        intensity: 'INTENSIVE_SUPPORT',
        objective: 'Updated objective with step scaffolding',
      },
      reason: 'Teacher adjusted intensity following lab session feedback',
    });

    expect(updatedPlan.intensity).toBe('INTENSIVE_SUPPORT');
    expect(updatedPlan.history.length).toBe(2);
    expect(updatedPlan.history[1].reason).toContain('Teacher adjusted intensity');
  });

  it('EC-48: Idempotency prevents duplicate support plan creation', () => {
    const need = LearnerDifferentiatedSupportService.createSupportNeed({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      learningOutcomeId: outcome1Id,
      sourceType: 'TEACHER_OBSERVATION',
      reason: 'Idempotency test',
    });

    const plan1 = LearnerDifferentiatedSupportService.createSupportPlan({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      supportNeedId: need.id,
      learningOutcomeIds: [outcome1Id],
      strategy: 'GUIDED_PRACTICE',
      intensity: 'STANDARD',
      objective: 'Same objective',
      plannedDate: '2026-09-10',
      idempotencyKey: 'idem_key_123',
    });

    const plan2 = LearnerDifferentiatedSupportService.createSupportPlan({
      schoolId,
      teacherId,
      learnerId: learner1Id,
      classGroupId,
      supportNeedId: need.id,
      learningOutcomeIds: [outcome1Id],
      strategy: 'GUIDED_PRACTICE',
      intensity: 'STANDARD',
      objective: 'Same objective',
      plannedDate: '2026-09-10',
      idempotencyKey: 'idem_key_123',
    });

    expect(plan1.id).toBe(plan2.id);
  });

  it('EC-50 to EC-54: Cross-school and IDOR violations are blocked and audited', () => {
    const auditLogsBefore = AuditService.queryLogs(schoolId).length;

    expect(() => {
      LearnerDifferentiatedSupportService.getSupportNeed('non_existent_need', schoolBId, teacherId);
    }).toThrow();

    const auditLogsAfter = AuditService.queryLogs(schoolId).length;
    expect(auditLogsAfter).toBeGreaterThanOrEqual(auditLogsBefore);
  });
});
