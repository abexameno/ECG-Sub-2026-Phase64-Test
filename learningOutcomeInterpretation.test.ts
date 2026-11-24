import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService.ts';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 14 Mastery, Competency & Learning Outcome Interpretation', () => {
  beforeEach(() => {
    AssessmentEvidenceService.clearStore();
    LearningOutcomeInterpretationService.clearStore();
    AuditService.clearLogs();
  });

  test('EC-01 to EC-07: Zero evidence produces INSUFFICIENT_EVIDENCE (not failure)', () => {
    const interpretation = LearningOutcomeInterpretationService.evaluateOutcome({
      learnerId: 'learner_zero',
      learningOutcomeId: 'lo_solar_01',
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      requestingUserId: 'teacher_1',
      requestingRole: 'teacher',
    });

    expect(interpretation.interpretationStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(interpretation.evidenceCount).toBe(0);
    expect(interpretation.explanation).toContain('Insufficient evidence');
    expect(interpretation.interpretationPolicyVersion).toBe('LO-MASTERY-V1');
  });

  test('EC-08 to EC-11: Single high assessment score does not yield instant mastery', () => {
    const assessment = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_photosynthesis_01',
      title: 'Photosynthesis Quiz',
      items: [
        {
          sequence: 1,
          type: 'MULTIPLE_CHOICE',
          prompt: 'Where does photosynthesis occur?',
          options: [
            { key: 'A', text: 'Chloroplast' },
            { key: 'B', text: 'Mitochondria' },
          ],
          correctAnswer: 'A',
          marks: 5,
          learningOutcomeId: 'lo_photosynthesis_01',
        }
      ]
    });

    const attempt = AssessmentEvidenceService.startAttempt({
      assessmentId: assessment.assessmentId,
      schoolId: 'lwps',
      learnerId: 'learner_high_score',
    });

    AssessmentEvidenceService.submitAttempt(
      attempt.attemptId,
      'lwps',
      'learner_high_score',
      [{ itemId: assessment.items[0].itemId, response: 'A' }]
    );

    const interpretation = LearningOutcomeInterpretationService.evaluateOutcome({
      learnerId: 'learner_high_score',
      learningOutcomeId: 'lo_photosynthesis_01',
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      requestingUserId: 'teacher_1',
      requestingRole: 'teacher',
    });

    // Single score yields DEVELOPING, not instant STRONG_DEMONSTRATION
    expect(interpretation.evidenceCount).toBe(1);
    expect(interpretation.interpretationStatus).toBe('DEVELOPING');
    expect(interpretation.explanation).toContain('Single high score');
  });

  test('EC-12 & EC-13: Multiple consistent high scores yield STRONG_DEMONSTRATION with transparent explanation', () => {
    // 1st Assessment
    const ass1 = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_cells_01',
      title: 'Cell Structure Quiz',
      items: [{ sequence: 1, type: 'TRUE_FALSE', prompt: 'Plant cells have cell walls.', correctAnswer: 'True', marks: 5, learningOutcomeId: 'lo_cells_01' }]
    });
    const att1 = AssessmentEvidenceService.startAttempt({ assessmentId: ass1.assessmentId, schoolId: 'lwps', learnerId: 'learner_star' });
    AssessmentEvidenceService.submitAttempt(att1.attemptId, 'lwps', 'learner_star', [{ itemId: ass1.items[0].itemId, response: 'True' }]);

    // 2nd Assessment
    const ass2 = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_cells_01',
      title: 'Cell Organelles Practical',
      items: [{ sequence: 1, type: 'STRUCTURED', prompt: 'Identify the nucleus.', marks: 10, learningOutcomeId: 'lo_cells_01' }]
    });
    const att2 = AssessmentEvidenceService.startAttempt({ assessmentId: ass2.assessmentId, schoolId: 'lwps', learnerId: 'learner_star' });
    AssessmentEvidenceService.submitAttempt(att2.attemptId, 'lwps', 'learner_star', [{ itemId: ass2.items[0].itemId, response: 'Nucleus regulates activities.' }]);
    AssessmentEvidenceService.teacherEvaluateAttempt(att2.attemptId, 'lwps', 'teacher_1', [{ itemId: ass2.items[0].itemId, marksAwarded: 9, maxMarks: 10 }]);

    const interpretation = LearningOutcomeInterpretationService.evaluateOutcome({
      learnerId: 'learner_star',
      learningOutcomeId: 'lo_cells_01',
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      requestingUserId: 'teacher_1',
      requestingRole: 'teacher',
    });

    expect(interpretation.evidenceCount).toBe(2);
    expect(interpretation.interpretationStatus).toBe('STRONG_DEMONSTRATION');
    expect(interpretation.conflictStatus).toBe('CONSISTENT');
    expect(interpretation.metrics.averagePercentage).toBe(95);
  });

  test('EC-13: Conflicting evidence is handled transparently', () => {
    // 1st Assessment: 100%
    const ass1 = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_chem_01',
      title: 'Chem Test 1',
      items: [{ sequence: 1, type: 'TRUE_FALSE', prompt: 'Acids have pH < 7', correctAnswer: 'True', marks: 10, learningOutcomeId: 'lo_chem_01' }]
    });
    const att1 = AssessmentEvidenceService.startAttempt({ assessmentId: ass1.assessmentId, schoolId: 'lwps', learnerId: 'learner_mixed' });
    AssessmentEvidenceService.submitAttempt(att1.attemptId, 'lwps', 'learner_mixed', [{ itemId: ass1.items[0].itemId, response: 'True' }]);

    // 2nd Assessment: 30%
    const ass2 = AssessmentEvidenceService.createAssessment({
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'lo_chem_01',
      title: 'Chem Test 2',
      items: [{ sequence: 1, type: 'STRUCTURED', prompt: 'Explain titration.', marks: 10, learningOutcomeId: 'lo_chem_01' }]
    });
    const att2 = AssessmentEvidenceService.startAttempt({ assessmentId: ass2.assessmentId, schoolId: 'lwps', learnerId: 'learner_mixed' });
    AssessmentEvidenceService.submitAttempt(att2.attemptId, 'lwps', 'learner_mixed', [{ itemId: ass2.items[0].itemId, response: 'Incomplete answer' }]);
    AssessmentEvidenceService.teacherEvaluateAttempt(att2.attemptId, 'lwps', 'teacher_1', [{ itemId: ass2.items[0].itemId, marksAwarded: 3, maxMarks: 10 }]);

    const interpretation = LearningOutcomeInterpretationService.evaluateOutcome({
      learnerId: 'learner_mixed',
      learningOutcomeId: 'lo_chem_01',
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      requestingUserId: 'teacher_1',
      requestingRole: 'teacher',
    });

    expect(interpretation.conflictStatus).toBe('HIGH_CONFLICT');
    expect(interpretation.interpretationStatus).toBe('DEVELOPING');
    expect(interpretation.explanation).toContain('High variance');
  });

  test('EC-26 & EC-27: Teacher override is authorized and auditable', () => {
    const interpretation = LearningOutcomeInterpretationService.evaluateOutcome({
      learnerId: 'learner_override',
      learningOutcomeId: 'lo_speech_01',
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      requestingUserId: 'teacher_1',
      requestingRole: 'teacher',
    });

    const overridden = LearningOutcomeInterpretationService.overrideInterpretation(
      interpretation.interpretationId,
      'lwps',
      'teacher_mrs_smith',
      'DEMONSTRATED',
      'Learner demonstrated outcome in classroom presentation.'
    );

    expect(overridden.interpretationStatus).toBe('DEMONSTRATED');
    expect(overridden.teacherOverride).toBeDefined();
    expect(overridden.teacherOverride?.teacherId).toBe('teacher_mrs_smith');
    expect(overridden.teacherOverride?.previousStatus).toBe('INSUFFICIENT_EVIDENCE');
  });

  test('EC-28 & EC-29: Cross-school and peer learner access are rejected', () => {
    const interpretation = LearningOutcomeInterpretationService.evaluateOutcome({
      learnerId: 'learner_sec',
      learningOutcomeId: 'lo_history_01',
      schoolId: 'lwps',
      curriculumVersionId: '2026.1',
      requestingUserId: 'teacher_1',
      requestingRole: 'teacher',
    });

    // Cross school access attempt
    expect(() => {
      LearningOutcomeInterpretationService.getInterpretation('learner_sec', 'lo_history_01', 'school_b', 'teacher_b', 'teacher');
    }).toThrow('Unauthorized cross-school access to interpretation');

    // Peer learner access attempt
    expect(() => {
      LearningOutcomeInterpretationService.getInterpretation('learner_sec', 'lo_history_01', 'lwps', 'peer_learner_dave', 'learner');
    }).toThrow('Unauthorized access: learners cannot view other learners interpretations');
  });
});
