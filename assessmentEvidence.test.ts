import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 13 Assessment, Evaluation & Learning Outcome Evidence', () => {
  beforeEach(() => {
    AssessmentEvidenceService.clearStore();
    AuditService.clearLogs();
  });

  test('EC-01 to EC-05: Create structured assessment linked to curriculum and learning outcome', () => {
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_matter_01',
      title: 'States of Matter Formative Assessment',
      type: 'FORMATIVE',
      items: [
        {
          sequence: 1,
          type: 'MULTIPLE_CHOICE',
          prompt: 'Which state of matter has a definite volume but no definite shape?',
          options: [
            { key: 'A', text: 'Solid' },
            { key: 'B', text: 'Liquid' },
            { key: 'C', text: 'Gas' },
            { key: 'D', text: 'Plasma' },
          ],
          correctAnswer: 'B',
          marks: 2,
          learningOutcomeId: 'lo_matter_01',
        },
        {
          sequence: 2,
          type: 'TRUE_FALSE',
          prompt: 'Gases expand to fill the entire container.',
          options: [
            { key: 'A', text: 'True' },
            { key: 'B', text: 'False' },
          ],
          correctAnswer: 'A',
          marks: 1,
          learningOutcomeId: 'lo_matter_01',
        }
      ]
    });

    expect(assessment.assessmentId).toBeDefined();
    expect(assessment.schoolId).toBe('lwps');
    expect(assessment.curriculumVersionId).toBe('2026.1');
    expect(assessment.learningOutcomeId).toBe('lo_matter_01');
    expect(assessment.version).toBe(1);
    expect(assessment.items.length).toBe(2);
    expect(assessment.items[0].marks).toBe(2);
  });

  test('EC-06 to EC-09: Learner attempt submission and deterministic scoring', () => {
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_photosynthesis_01',
      title: 'Photosynthesis Quick Quiz',
      items: [
        {
          sequence: 1,
          type: 'MULTIPLE_CHOICE',
          prompt: 'What gas is released during photosynthesis?',
          options: [
            { key: 'A', text: 'Carbon Dioxide' },
            { key: 'B', text: 'Oxygen' },
            { key: 'C', text: 'Nitrogen' },
            { key: 'D', text: 'Hydrogen' },
          ],
          correctAnswer: 'B',
          marks: 2,
          learningOutcomeId: 'lo_photosynthesis_01',
        }
      ]
    });

    // Start attempt
    const attempt = AssessmentEvidenceService.startAttempt({
      assessmentId: assessment.assessmentId,
      schoolId: 'lwps',
      learnerId: 'learner_101',
    });
    expect(attempt.status).toBe('IN_PROGRESS');
    expect(attempt.assessmentVersion).toBe(1);

    // Submit attempt with correct answer
    const result = AssessmentEvidenceService.submitAttempt(
      attempt.attemptId,
      'lwps',
      'learner_101',
      [{ itemId: assessment.items[0].itemId, response: 'B' }]
    );

    expect(result.attempt.status).toBe('EVALUATED');
    expect(result.evaluation).toBeDefined();
    expect(result.evaluation?.evaluatorType).toBe('SYSTEM');
    expect(result.evaluation?.marksAwarded).toBe(2);
    expect(result.evaluation?.totalMarks).toBe(2);
    expect(result.evaluation?.percentage).toBe(100);

    // Learning Outcome Evidence generated
    expect(result.evidence).toBeDefined();
    expect(result.evidence?.learningOutcomeId).toBe('lo_photosynthesis_01');
    expect(result.evidence?.percentage).toBe(100);
  });

  test('EC-10 & EC-12: Teacher marking for structured questions with feedback', () => {
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_essay_01',
      title: 'Structured Plant Biology Test',
      items: [
        {
          sequence: 1,
          type: 'STRUCTURED',
          prompt: 'Explain the role of chlorophyll in green plants.',
          marks: 5,
          learningOutcomeId: 'lo_essay_01',
        }
      ]
    });

    const attempt = AssessmentEvidenceService.startAttempt({
      assessmentId: assessment.assessmentId,
      schoolId: 'lwps',
      learnerId: 'learner_102',
    });

    AssessmentEvidenceService.submitAttempt(
      attempt.attemptId,
      'lwps',
      'learner_102',
      [{ itemId: assessment.items[0].itemId, response: 'Chlorophyll traps sunlight for photosynthesis.' }]
    );

    // Teacher records evaluation
    const evaluation = AssessmentEvidenceService.teacherEvaluateAttempt(
      attempt.attemptId,
      'lwps',
      'teacher_sarah',
      [{ itemId: assessment.items[0].itemId, marksAwarded: 4, maxMarks: 5, feedback: 'Good explanation, mention chloroplast.' }],
      'Well done overall.'
    );

    expect(evaluation.evaluatorType).toBe('TEACHER');
    expect(evaluation.evaluatorId).toBe('teacher_sarah');
    expect(evaluation.marksAwarded).toBe(4);
    expect(evaluation.totalMarks).toBe(5);
    expect(evaluation.percentage).toBe(80);
    expect(evaluation.feedback).toBe('Well done overall.');
  });

  test('EC-13 to EC-15: Assessment versioning preserves historical attempt linkage', () => {
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_math_01',
      title: 'Fractions V1',
      items: [
        { sequence: 1, type: 'MULTIPLE_CHOICE', prompt: 'Simplify 2/4', correctAnswer: '1/2', marks: 1, learningOutcomeId: 'lo_math_01' }
      ]
    });

    // Learner takes V1
    const attemptV1 = AssessmentEvidenceService.startAttempt({
      assessmentId: assessment.assessmentId,
      schoolId: 'lwps',
      learnerId: 'learner_v1',
    });
    expect(attemptV1.assessmentVersion).toBe(1);

    // Assessment is updated to V2
    const updated = AssessmentEvidenceService.updateAssessment(assessment.assessmentId, 'lwps', {
      title: 'Fractions V2 - Revised Edition'
    });
    expect(updated.version).toBe(2);

    // Historical attempt still references V1
    const retrievedAttempt = AssessmentEvidenceService.getLearnerAttempt(attemptV1.attemptId, 'lwps', 'learner_v1', 'learner');
    expect(retrievedAttempt.assessmentVersion).toBe(1);
  });

  test('EC-19 to EC-21: Evidence does NOT equal mastery or curriculum completion', () => {
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_photosynthesis_01',
      title: 'Photosynthesis Quiz',
      items: [{ sequence: 1, type: 'TRUE_FALSE', prompt: 'Plants make food?', correctAnswer: 'True', marks: 1, learningOutcomeId: 'lo_photosynthesis_01' }]
    });
    const attempt = AssessmentEvidenceService.startAttempt({
      assessmentId: assessment.assessmentId,
      schoolId: 'lwps',
      learnerId: 'learner_101',
    });
    AssessmentEvidenceService.submitAttempt(attempt.attemptId, 'lwps', 'learner_101', [{ itemId: assessment.items[0].itemId, response: 'True' }]);

    const summary = AssessmentEvidenceService.getLearnerOutcomeEvidence(
      'learner_101',
      'lo_photosynthesis_01',
      'lwps',
      'teacher_1',
      'teacher'
    );

    // Contains evidence count and percentage without declaring mastery
    expect(summary.totalEvidenceRecords).toBeGreaterThan(0);
    expect(summary.latestScorePercentage).toBe(100);
    expect((summary as any).isMastered).toBeUndefined();
    expect((summary as any).curriculumCompleted).toBeUndefined();
  });

  test('EC-22 & EC-23: Cross-school and peer-learner access are rejected', () => {
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_sec_01',
      title: 'Security Test',
      items: [{ sequence: 1, type: 'TRUE_FALSE', prompt: 'Is this secure?', marks: 1, learningOutcomeId: 'lo_sec_01' }]
    });

    // School B attempts to get LWPS assessment -> Rejected
    expect(() => {
      AssessmentEvidenceService.getAssessment(assessment.assessmentId, 'school_b');
    }).toThrow('Unauthorized cross-school access to assessment');

    // Attempt peer access
    const attempt = AssessmentEvidenceService.startAttempt({
      assessmentId: assessment.assessmentId,
      schoolId: 'lwps',
      learnerId: 'learner_alice',
    });

    // Bob attempts to read Alice's attempt -> Rejected
    expect(() => {
      AssessmentEvidenceService.getLearnerAttempt(attempt.attemptId, 'lwps', 'learner_bob', 'learner');
    }).toThrow('Unauthorized access: learners cannot view other learners assessment attempts');
  });

  test('EC-26: Idempotent submissions handle duplicate calls safely', () => {
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_dup_01',
      title: 'Idempotency Quiz',
      items: [{ sequence: 1, type: 'MULTIPLE_CHOICE', prompt: '1+1', correctAnswer: '2', marks: 1, learningOutcomeId: 'lo_dup_01' }]
    });

    const attempt = AssessmentEvidenceService.startAttempt({
      assessmentId: assessment.assessmentId,
      schoolId: 'lwps',
      learnerId: 'learner_dup',
    });

    const res1 = AssessmentEvidenceService.submitAttempt(attempt.attemptId, 'lwps', 'learner_dup', [{ itemId: assessment.items[0].itemId, response: '2' }]);
    const res2 = AssessmentEvidenceService.submitAttempt(attempt.attemptId, 'lwps', 'learner_dup', [{ itemId: assessment.items[0].itemId, response: '2' }]);

    expect(res1.attempt.attemptId).toBe(res2.attempt.attemptId);
    expect(res1.evaluation?.evaluationId).toBe(res2.evaluation?.evaluationId);
  });
});
