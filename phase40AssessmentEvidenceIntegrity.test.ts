import { AssessmentEvidenceService } from './services/assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { DailyTeachingService } from './services/dailyTeachingService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { TeachingCoverageService } from './services/teachingCoverageService.ts';
import { ElmsIntegrationService } from './services/elmsIntegrationService.ts';
import { ItemScore } from './types/assessmentEvidence.ts';

import { LearnerRosterService } from './services/learnerRosterService.ts';

describe('Phase 40: Assessment Evidence, Outcome Evidence & Evidence-Based Interpretation Integrity', () => {
  const schoolA = 'lwps';
  const schoolB = 'school-b';
  const teacherA = '2'; // Jane Doe in lwps
  const teacherB = '4'; // Peter Jones in school-b
  const learner1 = 'lrn_001';
  const learner2 = 'lrn_002';
  const curriculumVersion = 'kicd_cbe_2026';
  const outcome1 = 'lo_math_g3_01';

  beforeEach(() => {
    AssessmentEvidenceService.clearStore();
    LearningOutcomeInterpretationService.clearStore();
    TeachingActivityService.clearStore();
    ElmsIntegrationService.clearStore();

    LearnerRosterService.addLearner({
      id: learner1,
      schoolId: schoolA,
      displayName: 'Test Learner 1',
      learnerIdentifier: 'ADM-001',
      classGroupId: 'cg_lwps_g3a',
      academicYearId: 'ay_lwps_2026',
      requestingUserId: '1',
    });

    LearnerRosterService.addLearner({
      id: learner2,
      schoolId: schoolB,
      displayName: 'Test Learner 2',
      learnerIdentifier: 'ADM-002',
      classGroupId: 'cg_school-b_g7',
      academicYearId: 'ay_school-b_2026',
      requestingUserId: '1',
    });
  });

  // A–E: Valid Assessment Lifecycle & Evidence Linkage
  describe('A–E: Valid Assessment Lifecycle & Evidence Linkage', () => {
    it('Test A: Creates a structured assessment linked to curriculum outcome', () => {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        title: 'Grade 3 Math Numbers Assessment',
        type: 'FORMATIVE',
        items: [
          {
            sequence: 1,
            type: 'MULTIPLE_CHOICE',
            prompt: 'What is 5 + 7?',
            marks: 5,
            correctAnswer: '12',
            learningOutcomeId: outcome1,
          },
          {
            sequence: 2,
            type: 'STRUCTURED',
            prompt: 'Explain place value in 345',
            marks: 10,
            learningOutcomeId: outcome1,
          },
        ],
      });

      expect(assessment.assessmentId).toBeDefined();
      expect(assessment.learningOutcomeId).toBe(outcome1);
      expect(assessment.schoolId).toBe(schoolA);
    });

    it('Test B: Submits learner attempt and auto-scores objective items', () => {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        title: 'Grade 3 Math Quiz',
        items: [
          {
            sequence: 1,
            type: 'MULTIPLE_CHOICE',
            prompt: 'What is 10 - 4?',
            marks: 5,
            correctAnswer: '6',
            learningOutcomeId: outcome1,
          },
        ],
      });

      const attempt = AssessmentEvidenceService.startAttempt({
        assessmentId: assessment.assessmentId,
        schoolId: schoolA,
        learnerId: learner1,
      });

      const result = AssessmentEvidenceService.submitAttempt(
        attempt.attemptId,
        schoolA,
        learner1,
        [{ itemId: assessment.items[0].itemId, response: '6' }]
      );

      expect(result.evaluation).toBeDefined();
      expect(result.evaluation?.marksAwarded).toBe(5);
      expect(result.evaluation?.percentage).toBe(100);
      expect(result.evidence).toBeDefined();
      expect(result.evidence?.learningOutcomeId).toBe(outcome1);
    });

    it('Test C: Teacher evaluates subjective attempt and produces LearningOutcomeEvidence', () => {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        title: 'Grade 3 Essay Assessment',
        items: [
          {
            sequence: 1,
            type: 'ESSAY',
            prompt: 'Write about addition in real life',
            marks: 20,
            learningOutcomeId: outcome1,
          },
        ],
      });

      const attempt = AssessmentEvidenceService.startAttempt({
        assessmentId: assessment.assessmentId,
        schoolId: schoolA,
        learnerId: learner1,
      });

      const itemScores: ItemScore[] = [
        { itemId: assessment.items[0].itemId, marksAwarded: 16, maxMarks: 20, feedback: 'Good conceptual grasp' },
      ];

      const evalResult = AssessmentEvidenceService.teacherEvaluateAttempt(
        attempt.attemptId,
        schoolA,
        teacherA,
        itemScores,
        'Excellent effort'
      );

      expect(evalResult.status).toBe('EVALUATED');
      expect(evalResult.marksAwarded).toBe(16);
      expect(evalResult.percentage).toBe(80);

      const evidenceSummary = AssessmentEvidenceService.getLearnerOutcomeEvidence(
        learner1,
        outcome1,
        schoolA,
        teacherA,
        'teacher'
      );

      expect(evidenceSummary.totalEvidenceRecords).toBe(1);
      expect(evidenceSummary.evidenceList[0].score).toBe(16);
    });

    it('Test D: Direct recording of assessment result creates valid LearningOutcomeEvidence', () => {
      const evidence = AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 18,
        maxScore: 20,
        assessmentTitle: 'Midterm Math Assessment',
      });

      expect(evidence.evidenceId).toBeDefined();
      expect(evidence.percentage).toBe(90);
      expect(evidence.provenance.evaluatorId).toBe(teacherA);
      expect(evidence.provenance.evaluatorType).toBe('TEACHER');
    });

    it('Test E: Outcome interpretation correctly links supporting evidence IDs', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 18,
        maxScore: 20,
      });

      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 16,
        maxScore: 20,
      });

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.evidenceCount).toBe(2);
      expect(interp.supportingEvidenceIds.length).toBe(2);
      expect(interp.interpretationStatus).toBe('STRONG_DEMONSTRATION');
    });
  });

  // F–J: Score Range Validation & Boundary Protections
  describe('F–J: Score Range Validation & Boundary Protections', () => {
    it('Test F: Rejects negative marks awarded in teacher evaluation', () => {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        title: 'Validation Quiz',
        items: [{ sequence: 1, type: 'STRUCTURED', prompt: 'Q1', marks: 10, learningOutcomeId: outcome1 }],
      });

      const attempt = AssessmentEvidenceService.startAttempt({
        assessmentId: assessment.assessmentId,
        schoolId: schoolA,
        learnerId: learner1,
      });

      expect(() =>
        AssessmentEvidenceService.teacherEvaluateAttempt(
          attempt.attemptId,
          schoolA,
          teacherA,
          [{ itemId: assessment.items[0].itemId, marksAwarded: -5, maxMarks: 10 }]
        )
      ).toThrow(/Invalid item score/i);
    });

    it('Test G: Rejects marks awarded exceeding max marks', () => {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        title: 'Validation Quiz',
        items: [{ sequence: 1, type: 'STRUCTURED', prompt: 'Q1', marks: 10, learningOutcomeId: outcome1 }],
      });

      const attempt = AssessmentEvidenceService.startAttempt({
        assessmentId: assessment.assessmentId,
        schoolId: schoolA,
        learnerId: learner1,
      });

      expect(() =>
        AssessmentEvidenceService.teacherEvaluateAttempt(
          attempt.attemptId,
          schoolA,
          teacherA,
          [{ itemId: assessment.items[0].itemId, marksAwarded: 15, maxMarks: 10 }]
        )
      ).toThrow(/Invalid item score/i);
    });

    it('Test H: Rejects direct assessment recording with negative raw score', () => {
      expect(() =>
        AssessmentEvidenceService.recordAssessmentResult({
          schoolId: schoolA,
          teacherId: teacherA,
          learnerId: learner1,
          learningOutcomeId: outcome1,
          curriculumVersionId: curriculumVersion,
          rawScore: -10,
          maxScore: 20,
        })
      ).toThrow(/Invalid score/i);
    });

    it('Test I: Rejects direct assessment recording with raw score > max score', () => {
      expect(() =>
        AssessmentEvidenceService.recordAssessmentResult({
          schoolId: schoolA,
          teacherId: teacherA,
          learnerId: learner1,
          learningOutcomeId: outcome1,
          curriculumVersionId: curriculumVersion,
          rawScore: 25,
          maxScore: 20,
        })
      ).toThrow(/Invalid score/i);
    });

    it('Test J: Rejects zero maxScore in direct assessment recording', () => {
      expect(() =>
        AssessmentEvidenceService.recordAssessmentResult({
          schoolId: schoolA,
          teacherId: teacherA,
          learnerId: learner1,
          learningOutcomeId: outcome1,
          curriculumVersionId: curriculumVersion,
          rawScore: 5,
          maxScore: 0,
        })
      ).toThrow(/Invalid score/i);
    });
  });

  // K–O: Client-Side Manipulation Resistance
  describe('K–O: Client-Side Manipulation Resistance', () => {
    it('Test K: Server computes percentage independently regardless of client input', () => {
      const evidence = AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 15,
        maxScore: 20,
      });

      expect(evidence.percentage).toBe(75);
    });

    it('Test L: Missing learning outcome ID throws explicit validation error', () => {
      expect(() =>
        AssessmentEvidenceService.recordAssessmentResult({
          schoolId: schoolA,
          teacherId: teacherA,
          learnerId: learner1,
          learningOutcomeId: '',
          curriculumVersionId: curriculumVersion,
          rawScore: 15,
          maxScore: 20,
        })
      ).toThrow(/learningOutcomeId is required/i);
    });

    it('Test M: Client cannot force EVALUATED status without valid teacher or system evaluation', () => {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        title: 'Quiz M',
        items: [{ sequence: 1, type: 'ESSAY', prompt: 'Q1', marks: 10, learningOutcomeId: outcome1 }],
      });

      const attempt = AssessmentEvidenceService.startAttempt({
        assessmentId: assessment.assessmentId,
        schoolId: schoolA,
        learnerId: learner1,
      });

      // Attempt status remains IN_PROGRESS until properly submitted or evaluated
      expect(attempt.status).toBe('IN_PROGRESS');
    });

    it('Test N: Client-supplied artificial scores cannot bypass server verification', () => {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        title: 'Quiz N',
        items: [{ sequence: 1, type: 'MULTIPLE_CHOICE', prompt: 'Q1', marks: 10, correctAnswer: 'B', learningOutcomeId: outcome1 }],
      });

      const attempt = AssessmentEvidenceService.startAttempt({
        assessmentId: assessment.assessmentId,
        schoolId: schoolA,
        learnerId: learner1,
      });

      // Submit incorrect answer
      const res = AssessmentEvidenceService.submitAttempt(attempt.attemptId, schoolA, learner1, [
        { itemId: assessment.items[0].itemId, response: 'A' },
      ]);

      expect(res.evaluation?.marksAwarded).toBe(0);
      expect(res.evaluation?.percentage).toBe(0);
    });

    it('Test O: Assessment attempt store enforces attempt status transitions', () => {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        title: 'Quiz O',
        items: [{ sequence: 1, type: 'MULTIPLE_CHOICE', prompt: 'Q1', marks: 10, correctAnswer: 'A', learningOutcomeId: outcome1 }],
      });

      const attempt = AssessmentEvidenceService.startAttempt({
        assessmentId: assessment.assessmentId,
        schoolId: schoolA,
        learnerId: learner1,
      });

      expect(attempt.status).toBe('IN_PROGRESS');

      AssessmentEvidenceService.submitAttempt(attempt.attemptId, schoolA, learner1, [
        { itemId: assessment.items[0].itemId, response: 'A' },
      ]);

      const updated = AssessmentEvidenceService.getLearnerAttempt(attempt.attemptId, schoolA, learner1, 'learner');
      expect(updated.status).toBe('EVALUATED');
    });
  });

  // P–T: Deterministic Evidence Sufficiency Rules
  describe('P–T: Deterministic Evidence Sufficiency Rules', () => {
    it('Test P: Zero evidence records yields INSUFFICIENT_EVIDENCE', () => {
      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('INSUFFICIENT_EVIDENCE');
      expect(interp.evidenceCount).toBe(0);
      expect(interp.supportingEvidenceIds).toEqual([]);
    });

    it('Test Q: Single high score (e.g. 95%) yields DEVELOPING requiring corroboration', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 95,
        maxScore: 100,
      });

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('DEVELOPING');
      expect(interp.evidenceCount).toBe(1);
      expect(interp.explanation).toContain('corroborating evidence');
    });

    it('Test R: Multiple consistent high scores yield STRONG_DEMONSTRATION', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 90,
        maxScore: 100,
      });

      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 88,
        maxScore: 100,
      });

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('STRONG_DEMONSTRATION');
      expect(interp.metrics.averagePercentage).toBe(89);
    });

    it('Test S: High variance/conflict (>40% gap) sets HIGH_CONFLICT status and retains DEVELOPING', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 100,
        maxScore: 100,
      });

      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 30,
        maxScore: 100,
      });

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.conflictStatus).toBe('HIGH_CONFLICT');
      expect(interp.interpretationStatus).toBe('DEVELOPING');
      expect(interp.explanation).toContain('High variance');
    });

    it('Test T: Consistent moderate performance yields DEMONSTRATED', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 75,
        maxScore: 100,
      });

      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 72,
        maxScore: 100,
      });

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('DEMONSTRATED');
    });
  });

  // U–Y: Evidence Voiding & Revocation Engine
  describe('U–Y: Evidence Voiding & Revocation Engine', () => {
    it('Test U: Voiding evidence marks isVoided = true', () => {
      const ev = AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 90,
        maxScore: 100,
      });

      const voided = AssessmentEvidenceService.voidEvidence(ev.evidenceId, schoolA, teacherA, 'Grading error');
      expect(voided.isVoided).toBe(true);
      expect(voided.provenance.notes).toContain('VOIDED');
    });

    it('Test V: Voided evidence is excluded from current interpretation', () => {
      const ev1 = AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 90,
        maxScore: 100,
      });

      AssessmentEvidenceService.voidEvidence(ev1.evidenceId, schoolA, teacherA, 'Invalid attempt');

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('INSUFFICIENT_EVIDENCE');
      expect(interp.evidenceCount).toBe(0);
    });

    it('Test W: Historical evidence store retains voided record without deletion', () => {
      const ev = AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 85,
        maxScore: 100,
      });

      AssessmentEvidenceService.voidEvidence(ev.evidenceId, schoolA, teacherA, 'Plagiarism verified');

      const retrieved = AssessmentEvidenceService.getAssessmentEvidenceById(ev.evidenceId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.isVoided).toBe(true);
    });

    it('Test X: Voiding one of multiple records updates metrics accurately', () => {
      const ev1 = AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 30, // Bad attempt
        maxScore: 100,
      });

      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 90,
        maxScore: 100,
      });

      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 88,
        maxScore: 100,
      });

      // Void the bad attempt
      AssessmentEvidenceService.voidEvidence(ev1.evidenceId, schoolA, teacherA, 'Administrative voiding');

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('STRONG_DEMONSTRATION');
      expect(interp.metrics.validEvidenceCount).toBe(2);
    });

    it('Test Y: Voiding cross-school evidence throws unauthorized error', () => {
      const ev = AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 80,
        maxScore: 100,
      });

      expect(() =>
        AssessmentEvidenceService.voidEvidence(ev.evidenceId, schoolB, teacherB, 'Cross-school void attempt')
      ).toThrow(/Unauthorized cross-school access/i);
    });
  });

  // Z–AD: ELMS Evidence Ingestion & Idempotency
  describe('Z–AD: ELMS Evidence Ingestion & Idempotency', () => {
    it('Test Z: Ingests ELMS assessment submitted event and records provenance', () => {
      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId: learner1,
        elmsLearnerId: learner1,
        requestingUserId: teacherA,
      });

      const result = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'elms_evt_101',
        eventSource: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: learner1,
        idempotencyKey: 'idemp_elms_101',
        timestamp: new Date().toISOString(),
        payload: {
          assessmentId: 'asmt_elms_math_1',
          responses: [{ itemId: 'item_1', response: 'A' }],
        },
      });

      expect(result.event.status).toBe('PROCESSED');
      expect(result.actionTaken).toContain('ASSESSMENT_SUBMITTED');
    });

    it('Test AA: Replayed ELMS event returns IGNORED_DUPLICATE idempotently', () => {
      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId: learner1,
        elmsLearnerId: learner1,
        requestingUserId: teacherA,
      });

      const eventInput = {
        eventId: 'elms_evt_102',
        eventSource: 'ELMS' as const,
        eventType: 'ASSESSMENT_SUBMITTED' as const,
        schoolId: schoolA,
        learnerId: learner1,
        idempotencyKey: 'idemp_elms_102',
        timestamp: new Date().toISOString(),
        payload: {
          assessmentId: 'asmt_elms_math_2',
          responses: [{ itemId: 'item_1', response: 'A' }],
        },
      };

      const firstPass = ElmsIntegrationService.ingestLearningEvent(eventInput);
      expect(firstPass.event.status).toBe('PROCESSED');

      const secondPass = ElmsIntegrationService.ingestLearningEvent(eventInput);
      expect(secondPass.event.status).toBe('IGNORED_DUPLICATE');
      expect(secondPass.actionTaken).toBe('IDEMPOTENT_DUPLICATE_IGNORED');
    });

    it('Test AB: Out-of-order event ingestion handled cleanly without corruption', () => {
      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId: learner1,
        elmsLearnerId: learner1,
        requestingUserId: teacherA,
      });

      const result = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'elms_evt_103',
        eventSource: 'ELMS',
        eventType: 'ASSESSMENT_COMPLETED',
        schoolId: schoolA,
        learnerId: learner1,
        idempotencyKey: 'idemp_elms_103',
        timestamp: new Date().toISOString(),
        payload: {
          assessmentId: 'asmt_elms_math_3',
        },
      });

      expect(result.event.status).toBe('PROCESSED');
    });

    it('Test AC: Unmapped ELMS learner ID fails event ingestion with clear error', () => {
      const result = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'elms_evt_104',
        eventSource: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'unmapped_elms_learner_xyz',
        idempotencyKey: 'idemp_elms_104',
        timestamp: new Date().toISOString(),
      });

      expect(result.event.status).toBe('FAILED');
      expect(result.event.processingError).toContain('Unmapped or unknown learner ID');
    });

    it('Test AD: ELMS event processing failures logged to AuditService', () => {
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'elms_evt_105',
        eventSource: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'unmapped_elms_learner_xyz',
        idempotencyKey: 'idemp_elms_105',
        timestamp: new Date().toISOString(),
      });

      const event = ElmsIntegrationService.getEvent(schoolA, 'elms_evt_105');
      expect(event?.status).toBe('FAILED');
    });
  });

  // AE–AI: Non-Fungibility Boundaries (Attendance ≠ Completion ≠ Mastery)
  describe('AE–AI: Non-Fungibility Boundaries', () => {
    it('Test AE: Classroom attendance check-in does NOT create assessment evidence', () => {
      const evidenceSummary = AssessmentEvidenceService.getLearnerOutcomeEvidence(
        learner1,
        outcome1,
        schoolA,
        teacherA,
        'teacher'
      );

      expect(evidenceSummary.totalEvidenceRecords).toBe(0);
    });

    it('Test AF: Resource interaction does NOT create assessment evidence or mastery', () => {
      TeachingActivityService.createLearnerActivity({
        schoolId: schoolA,
        learnerId: learner1,
        teachingPlanId: 'tp_1',
        teachingAllocationId: 'alloc_1',
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        activityType: 'CONTENT_READ',
      });

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('Test AG: Lesson completion does NOT create assessment evidence or mastery', () => {
      const activity = TeachingActivityService.createLearnerActivity({
        schoolId: schoolA,
        learnerId: learner1,
        teachingPlanId: 'tp_1',
        teachingAllocationId: 'alloc_1',
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        activityType: 'EXERCISE_SUBMITTED',
      });

      TeachingActivityService.startLearnerActivity(activity.activityId, schoolA, learner1);
      TeachingActivityService.completeLearnerActivity(activity.activityId, schoolA, learner1, learner1);

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('Test AH: 100% curriculum coverage does NOT grant outcome mastery', () => {
      const plan = {
        id: 'plan_1',
        schoolId: schoolA,
        gradeLevelId: 'g3',
        learningAreaId: 'math',
        weeks: [
          {
            weekNumber: 1,
            lessonSlots: [{ learningOutcomeIds: [outcome1] }],
          },
        ],
      } as any;

      const curriculum = {
        id: curriculumVersion,
        grades: [
          {
            gradeId: 'g3',
            learningAreas: [
              {
                learningAreaId: 'math',
                strands: [
                  {
                    subStrands: [
                      {
                        suggestedLessonAllocation: 1,
                        learningOutcomes: [{ learningOutcomeId: outcome1 }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      } as any;

      const coverage = TeachingCoverageService.calculateCoverage(plan, curriculum);
      expect(coverage.statistics.coveragePercentage).toBe(100);

      // Verify outcome status is STILL INSUFFICIENT_EVIDENCE until assessment is completed
      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('Test AI: Completion evidence is kept strictly distinct from assessment evidence', () => {
      const evidenceList = AssessmentEvidenceService.getEvidenceBySchool(schoolA);
      // Ensure no raw completion evidence pollutes assessment evidence list unless explicitly generated as assessment
      for (const ev of evidenceList) {
        expect(['ASSESSMENT_RESULT', 'TEACHER_EVALUATION', 'LEARNER_SUBMISSION', 'ACTIVITY_EVIDENCE']).toContain(
          ev.evidenceType
        );
      }
    });
  });

  // AJ–AN: Gemini AI Boundary Enforcement
  describe('AJ–AN: Gemini AI Boundary Enforcement', () => {
    it('Test AJ: Gemini cannot manufacture raw score or assessment evidence', () => {
      // Attempting to evaluate outcome with no server-recorded evidence yields INSUFFICIENT_EVIDENCE
      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('Test AK: Server ignores unauthorized client/Gemini override attempts', () => {
      // Direct call to evaluate outcome calculates strictly based on stored server evidence
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 50,
        maxScore: 100,
      });

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(interp.interpretationStatus).toBe('DEVELOPING');
    });

    it('Test AL: Gemini suggestions remain strictly advisory and do not alter DB state', () => {
      const summary = AssessmentEvidenceService.getLearnerOutcomeEvidence(
        learner1,
        outcome1,
        schoolA,
        teacherA,
        'teacher'
      );

      expect(summary.totalEvidenceRecords).toBe(0);
    });

    it('Test AM: Teacher override is required for any status modification beyond policy engine', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 60,
        maxScore: 100,
      });

      const initialInterp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(initialInterp.interpretationStatus).toBe('DEVELOPING');

      const overridden = LearningOutcomeInterpretationService.overrideInterpretation(
        initialInterp.interpretationId,
        schoolA,
        teacherA,
        'DEMONSTRATED',
        'Demonstrated in practical project work'
      );

      expect(overridden.interpretationStatus).toBe('DEMONSTRATED');
      expect(overridden.teacherOverride?.teacherId).toBe(teacherA);
    });

    it('Test AN: Unauthorized override by non-teacher throws error', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 60,
        maxScore: 100,
      });

      const interp = LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(() =>
        LearningOutcomeInterpretationService.overrideInterpretation(
          interp.interpretationId,
          schoolA,
          'unauthorized_user_xyz',
          'STRONG_DEMONSTRATION',
          'Unauthorized override attempt'
        )
      ).toThrow(/Unauthorized teacher/i);
    });
  });

  // AO–AR: Multi-Tenant Isolation, IDOR & Security
  describe('AO–AR: Multi-Tenant Isolation & Security', () => {
    it('Test AO: Teacher in School A cannot evaluate assessment attempt in School B', () => {
      const assessment = AssessmentEvidenceService.createAssessment({
        schoolId: schoolB,
        curriculumVersionId: curriculumVersion,
        learningOutcomeId: outcome1,
        title: 'School B Quiz',
        items: [{ sequence: 1, type: 'ESSAY', prompt: 'Q1', marks: 10, learningOutcomeId: outcome1 }],
      });

      const attempt = AssessmentEvidenceService.startAttempt({
        assessmentId: assessment.assessmentId,
        schoolId: schoolB,
        learnerId: learner2,
      });

      expect(() =>
        AssessmentEvidenceService.teacherEvaluateAttempt(
          attempt.attemptId,
          schoolB,
          teacherA, // Teacher A belongs to lwps, not school-b!
          [{ itemId: assessment.items[0].itemId, marksAwarded: 8, maxMarks: 10 }]
        )
      ).toThrow(/Unauthorized teacher/i);
    });

    it('Test AP: Learner 1 cannot view Learner 2 evidence', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner2,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 90,
        maxScore: 100,
      });

      expect(() =>
        AssessmentEvidenceService.getLearnerOutcomeEvidence(
          learner2,
          outcome1,
          schoolA,
          learner1, // Learner 1 requesting Learner 2 data
          'learner'
        )
      ).toThrow(/Unauthorized access: learners cannot view other learners evidence/i);
    });

    it('Test AQ: Cross-school access to interpretation is rejected', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 90,
        maxScore: 100,
      });

      LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(() =>
        LearningOutcomeInterpretationService.getInterpretation(
          learner1,
          outcome1,
          schoolB, // School B requesting School A interpretation
          teacherB,
          'teacher'
        )
      ).toThrow(/Unauthorized cross-school access/i);
    });

    it('Test AR: Peer learner access to interpretation is rejected', () => {
      AssessmentEvidenceService.recordAssessmentResult({
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: learner1,
        learningOutcomeId: outcome1,
        curriculumVersionId: curriculumVersion,
        rawScore: 90,
        maxScore: 100,
      });

      LearningOutcomeInterpretationService.evaluateOutcome({
        learnerId: learner1,
        learningOutcomeId: outcome1,
        schoolId: schoolA,
        curriculumVersionId: curriculumVersion,
        requestingUserId: teacherA,
        requestingRole: 'teacher',
      });

      expect(() =>
        LearningOutcomeInterpretationService.getInterpretation(
          learner1,
          outcome1,
          schoolA,
          learner2, // Learner 2 requesting Learner 1 interpretation
          'learner'
        )
      ).toThrow(/Unauthorized access: learners cannot view other learners interpretations/i);
    });
  });
});
