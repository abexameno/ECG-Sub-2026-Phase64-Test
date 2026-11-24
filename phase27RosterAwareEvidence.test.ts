
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService';
import { ElmsIntegrationService } from './services/elmsIntegrationService';
import { LearnerRosterService } from './services/learnerRosterService';
import { ClassGroupService } from './services/classGroupService';
import { LO_MASTERY_V1_CONFIG } from './types/interpretation';

describe('Phase 27 - LO-MASTERY-V1 Policy Formalization & Roster-Aware Evidence', () => {
  const schoolId = 'lwps';
  const teacherId = 't_lwps_1';
  const adminId = '5'; // David Kimani (SCHOOL_ADMIN)
  const classGroupId = 'cg_lwps_g3a';
  const learningOutcomeId = 'lo_math_1.1';
  const curriculumVersionId = 'v1';

  beforeEach(() => {
    AssessmentEvidenceService.clearStore();
    ClassGroupService.clearStore();
    LearnerRosterService.clearStore();
    
    // Explicitly add 5 learners in the class
    for (let i = 1; i <= 5; i++) {
      LearnerRosterService.addLearner({
        id: `learner_${i}`,
        displayName: `Learner ${i}`,
        schoolId,
        classGroupId,
        academicYearId: 'ay_lwps_2026',
        requestingUserId: adminId,
      });
    }
  });

  test('Policy Formalization: Thresholds should match LO_MASTERY_V1_CONFIG', () => {
    // 10 items of 10 marks each = 100 total
    const items = Array.from({ length: 10 }).map((_, i) => ({
      type: 'MULTIPLE_CHOICE' as const,
      prompt: `Q${i+1}`,
      marks: 10,
      correctAnswer: 'A'
    }));

    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId,
      curriculumVersionId,
      learningOutcomeId,
      title: 'Formalized Policy Test',
      items
    });

    const ecgArtifactId = assessment.assessmentId;

    // Simulate 2 attempts at 70% score (7 items correct)
    for (let attemptIdx = 1; attemptIdx <= 2; attemptIdx++) {
      ElmsIntegrationService.ingestLearningEvent({
        eventId: `evt_1_${attemptIdx}`,
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId,
        learnerId: 'learner_1',
        resourceId: ecgArtifactId,
        ecgArtifactId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: `idemp_1_${attemptIdx}`,
        payload: {
          assessmentId: ecgArtifactId,
          attemptId: `att_1_${attemptIdx}`,
          learnerId: 'learner_1',
          responses: assessment.items.map((it, idx) => ({
            itemId: it.itemId,
            response: idx < 7 ? 'A' : 'WRONG' // 7 correct = 70%
          }))
        }
      });
    }

    const interpretation = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
      ecgArtifactId,
      schoolId,
      requestingTeacherId: teacherId,
    });

    const l1 = interpretation.learnerInterpretations.find(l => l.learnerId === 'learner_1');
    expect(l1?.status).toBe('DEMONSTRATED');
    expect(l1?.percentage).toBe(70);
    expect(LO_MASTERY_V1_CONFIG.demonstratedMinAvg).toBe(70);
  });

  test('Roster-Aware Evidence: Should mark non-submitting learners as INSUFFICIENT_EVIDENCE', () => {
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId,
      curriculumVersionId,
      learningOutcomeId,
      title: 'Roster Awareness Test',
      classGroupId, // Link to class group
      items: [
        { type: 'MULTIPLE_CHOICE', prompt: 'Q1', marks: 10, correctAnswer: 'A' }
      ]
    });

    const ecgArtifactId = assessment.assessmentId;

    // Only Learner 1 and 2 submit
    ['learner_1', 'learner_2'].forEach(lid => {
      ElmsIntegrationService.ingestLearningEvent({
        eventId: `evt_${lid}`,
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId,
        learnerId: lid,
        resourceId: ecgArtifactId,
        ecgArtifactId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: `idemp_${lid}`,
        payload: {
          assessmentId: ecgArtifactId,
          attemptId: `att_${lid}`,
          learnerId: lid,
          responses: [{ itemId: assessment.items[0].itemId, response: 'A' }] // 100%
        }
      });
    });

    const interpretation = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
      ecgArtifactId,
      schoolId,
      requestingTeacherId: teacherId,
      classGroupId, // Explicitly pass it too
    });

    // We expect at least 6 learners in the list (Alice seed + our 5)
    // Wait, LearnerRosterService.getLearnersForClassGroup should return them all.
    const learners = interpretation.learnerInterpretations;
    expect(learners.length).toBeGreaterThanOrEqual(6);
    
    // Check individual records
    const l3 = learners.find(l => l.learnerId === 'learner_3');
    expect(l3?.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(l3?.percentage).toBeUndefined();
  });

  test('Equal-Weight Attempt Policy: Should use simple average of all attempts', () => {
    const items = Array.from({ length: 10 }).map((_, i) => ({
      type: 'MULTIPLE_CHOICE' as const,
      prompt: `Q${i+1}`,
      marks: 1,
      correctAnswer: 'A'
    }));

    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId,
      curriculumVersionId,
      learningOutcomeId,
      title: 'Equal Weight Policy Test',
      items
    });

    const ecgArtifactId = assessment.assessmentId;

    // Learner 1: Two attempts
    // Attempt 1: 70% (7/10)
    // Attempt 2: 50% (5/10)
    // Simple Average should be 60% -> DEVELOPING
    
    ElmsIntegrationService.ingestLearningEvent({
      eventId: 'evt_1_old',
      sourceSystem: 'ELMS',
      eventType: 'ASSESSMENT_SUBMITTED',
      schoolId,
      learnerId: 'learner_1',
      resourceId: ecgArtifactId,
      ecgArtifactId,
      timestamp: '2026-10-01T10:00:00Z',
      eventVersion: '1.0',
      payloadVersion: '1.0',
      idempotencyKey: 'idemp_1_old',
      payload: {
        assessmentId: ecgArtifactId,
        attemptId: 'att_1_old',
        learnerId: 'learner_1',
        responses: assessment.items.map((it, idx) => ({
          itemId: it.itemId,
          response: idx < 7 ? 'A' : 'WRONG' // 70%
        }))
      }
    });

    ElmsIntegrationService.ingestLearningEvent({
      eventId: 'evt_1_new',
      sourceSystem: 'ELMS',
      eventType: 'ASSESSMENT_SUBMITTED',
      schoolId,
      learnerId: 'learner_1',
      resourceId: ecgArtifactId,
      ecgArtifactId,
      timestamp: '2026-10-01T11:00:00Z',
      eventVersion: '1.0',
      payloadVersion: '1.0',
      idempotencyKey: 'idemp_1_new',
      payload: {
        assessmentId: ecgArtifactId,
        attemptId: 'att_1_new',
        learnerId: 'learner_1',
        responses: assessment.items.map((it, idx) => ({
          itemId: it.itemId,
          response: idx < 5 ? 'A' : 'WRONG' // 50%
        }))
      }
    });

    const interpretation = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
      ecgArtifactId,
      schoolId,
      requestingTeacherId: teacherId,
    });

    const l1 = interpretation.learnerInterpretations.find(l => l.learnerId === 'learner_1');
    expect(l1?.percentage).toBe(60); 
    expect(l1?.status).toBe('DEVELOPING');
    expect(l1?.explanation).toContain('across 2 attempts');
    expect(l1?.explanation).toContain('average 60%');
  });
});
