import { ElmsIntegrationService } from './services/elmsIntegrationService';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService';
import { ContentArtifactRepository } from './services/contentArtifactRepository';
import { SchoolConfigService } from './services/schoolConfigService';
import { LearnerRosterService } from './services/learnerRosterService';
import { ClassGroupService } from './services/classGroupService';
import { AuditService } from './services/auditService';
import { ContentType, QuestionType, GeneratedContent } from './types';

describe('Phase 26: ELMS Assessment Evidence → ECG Interpretation Layer', () => {
  const schoolA = 'lwps';
  const schoolB = 'school-b';
  const teacherA = '2'; // Active teacher in lwps
  const teacherB = '4'; // Active teacher in school-b
  const learner1 = 'lrn_001';
  const learner2 = 'lrn_002';
  const learner3 = 'lrn_003';

  const testAssessment: GeneratedContent = {
    id: 'art_g8_science_quiz_1',
    ownerId: teacherA,
    title: 'Grade 8 Science: Separation of Mixtures Assessment',
    questions: [
      {
        id: 'item_sep_1',
        questionType: QuestionType.MultipleChoice,
        questionText: 'Which method separates a mixture of salt and water?',
        options: ['Evaporation', 'Filtration', 'Magnetic separation', 'Decantation'],
        correctOption: 'A',
        correctAnswer: 'Evaporation',
        marks: 5,
      },
      {
        id: 'item_sep_2',
        questionType: QuestionType.MultipleChoice,
        questionText: 'Which technique is best for separating immiscible liquids such as oil and water?',
        options: ['Separating funnel', 'Chromatography', 'Centrifugation', 'Simple distillation'],
        correctOption: 'A',
        correctAnswer: 'Separating funnel',
        marks: 5,
      },
    ],
    metadata: {
      schoolId: schoolA,
      grade: 'Grade 8',
      subject: 'Integrated Science',
      topic: 'Mixtures and Pure Substances',
      contentType: ContentType.Assessment,
      term: 'Term 1',
      terms: ['Term 1'],
      week: '4',
      lessonNumber: '2',
      strand: '1.0 Matter',
      subStrand: '1.2 Separation Techniques',
      specificLearningOutcome: 'Learner can select and apply appropriate methods to separate homogeneous and heterogeneous mixtures.',
      parentArtifactId: 'art_g8_science_quiz_1',
      masterSowId: 'master_sow_grade8_science',
      curriculumLessonId: 'curr_lesson_sep_mixtures_4_2',
    },
    savedAt: new Date().toISOString(),
  };

  function seedSchoolAndLearners() {
    try {
      SchoolConfigService.getSchoolProfile(schoolA);
    } catch {
      SchoolConfigService.saveSchoolProfile({
        id: schoolA,
        name: 'Lightweight Primary School',
        county: 'Nairobi',
        subCounty: 'Westlands',
        curriculumType: 'CBC_CBE',
        gradesSupported: ['Grade 8'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    try {
      SchoolConfigService.getSchoolProfile(schoolB);
    } catch {
      SchoolConfigService.saveSchoolProfile({
        id: schoolB,
        name: 'School B',
        county: 'Kiambu',
        subCounty: 'Thika',
        curriculumType: 'CBC_CBE',
        gradesSupported: ['Grade 8'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const classesA = ClassGroupService.getClassGroupsBySchool(schoolA);
    const classIdA = classesA[0]?.id || 'cg_lwps_g8a';

    const classesB = ClassGroupService.getClassGroupsBySchool(schoolB);
    const classIdB = classesB[0]?.id || 'cg_school-b_g7';

    // Add learners to school A
    LearnerRosterService.addLearner({
      id: learner1,
      schoolId: schoolA,
      displayName: 'Faith Mwende',
      learnerIdentifier: 'ADM-101',
      classGroupId: classIdA,
      requestingUserId: '1',
    });
    LearnerRosterService.addLearner({
      id: learner2,
      schoolId: schoolA,
      displayName: 'Daniel Kiprono',
      learnerIdentifier: 'ADM-102',
      classGroupId: classIdA,
      requestingUserId: '1',
    });

    // Add learner to school B
    LearnerRosterService.addLearner({
      id: learner3,
      schoolId: schoolB,
      displayName: 'Grace Wanjiku',
      learnerIdentifier: 'ADM-201',
      classGroupId: classIdB,
      requestingUserId: '1',
    });

    // Map learners to ELMS
    ElmsIntegrationService.mapLearner({
      schoolId: schoolA,
      ecgLearnerId: learner1,
      elmsLearnerId: 'elms_faith_101',
      requestingUserId: teacherA,
    });
    ElmsIntegrationService.mapLearner({
      schoolId: schoolA,
      ecgLearnerId: learner2,
      elmsLearnerId: 'elms_daniel_102',
      requestingUserId: teacherA,
    });
    ElmsIntegrationService.mapLearner({
      schoolId: schoolB,
      ecgLearnerId: learner3,
      elmsLearnerId: 'elms_grace_201',
      requestingUserId: teacherB,
    });
  }

  function seedAndPublishAssessment() {
    ContentArtifactRepository.save({
      id: testAssessment.id!,
      schoolId: schoolA,
      version: 1,
      artifactType: 'assessment',
      curriculumId: 'canonical-cbc',
      curriculumVersion: '2024.1',
      gradeLevelId: testAssessment.metadata!.grade,
      learningAreaId: testAssessment.metadata!.subject,
      status: 'validated',
      source: 'ai_generated',
      curriculumReferences: [
        {
          gradeLevelId: testAssessment.metadata!.grade,
          learningAreaId: testAssessment.metadata!.subject,
          strandId: testAssessment.metadata!.strand,
          subStrandId: testAssessment.metadata!.subStrand,
          learningOutcomeIds: [testAssessment.metadata!.specificLearningOutcome!],
        },
      ],
      content: testAssessment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return ElmsIntegrationService.publishResource({
      schoolId: schoolA,
      teacherId: teacherA,
      ecgArtifactId: testAssessment.id!,
      learningAreaId: testAssessment.metadata!.subject,
      curriculumVersionId: '2024.1',
      learningOutcomeIds: [testAssessment.metadata!.specificLearningOutcome!],
      metadata: { title: testAssessment.title },
    });
  }

  beforeEach(() => {
    ElmsIntegrationService.clearStore();
    AssessmentEvidenceService.clearStore();
    LearningOutcomeInterpretationService.clearStore();
    AuditService.clearLogs();
    seedSchoolAndLearners();
  });

  describe('1. ELMS Assessment Evidence Ingestion & Lineage Linkage', () => {
    it('should ingest ELMS assessment submission event and produce a linked ElmsAssessmentEvidenceRecord', () => {
      const pub = seedAndPublishAssessment();

      const result = ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_elms_sub_101',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_faith_101',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_sub_faith_01',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_faith_01',
          learnerId: 'elms_faith_101',
          responses: [
            { itemId: 'item_sep_1', response: 'A' }, // Correct (5 marks)
            { itemId: 'item_sep_2', response: 'A' }, // Correct (5 marks)
          ],
        },
      });

      expect(result.event.status).toBe('PROCESSED');

      // Verify ElmsAssessmentEvidenceRecord in AssessmentEvidenceService
      const evidenceRecords = AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, testAssessment.id!);
      expect(evidenceRecords.length).toBe(1);

      const record = evidenceRecords[0];
      expect(record.learnerId).toBe(learner1);
      expect(record.ecgArtifactId).toBe(testAssessment.id!);
      expect(record.score).toBe(10);
      expect(record.maxScore).toBe(10);
      expect(record.percentage).toBe(100);
      expect(record.responses.length).toBe(2);
      expect(record.responses[0].isCorrect).toBe(true);
      expect(record.provenance.sourceSystem).toBe('ELMS');
    });

    it('should preserve curriculum and SOW lineage on the generated evidence record', () => {
      const pub = seedAndPublishAssessment();

      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_elms_sub_102',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_daniel_102',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_sub_daniel_01',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_daniel_01',
          learnerId: 'elms_daniel_102',
          responses: [
            { itemId: 'item_sep_1', response: 'A' }, // Correct (5 marks)
            { itemId: 'item_sep_2', response: 'WRONG' }, // Wrong (0 marks)
          ],
        },
      });

      const evidenceRecords = AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, testAssessment.id!);
      expect(evidenceRecords.length).toBe(1);
      const record = evidenceRecords[0];
      expect(record.curriculumVersionId).toBe('2024.1');
      expect(record.learningOutcomeId).toBe(testAssessment.metadata!.specificLearningOutcome);
      expect(record.percentage).toBe(50);
    });
  });

  describe('2. Evidence vs Interpretation Separation & Immutability', () => {
    it('should maintain raw factual assessment evidence strictly immutable during interpretation', () => {
      const pub = seedAndPublishAssessment();

      // Submit attempt for Learner 1 (100%)
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_raw_01',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_faith_101',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_raw_01',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_raw_01',
          learnerId: 'elms_faith_101',
          responses: [
            { itemId: 'item_sep_1', response: 'A' },
            { itemId: 'item_sep_2', response: 'A' },
          ],
        },
      });

      const rawRecordsBefore = AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, testAssessment.id!);
      expect(rawRecordsBefore[0].score).toBe(10);
      expect(rawRecordsBefore[0].percentage).toBe(100);

      // Run interpretation layer
      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
      });

      expect(interp).toBeDefined();
      expect(interp.factualSummary.totalLearnersAssessed).toBe(1);
      expect(interp.factualSummary.averageScorePercentage).toBe(100);

      // Verify raw records remained completely unmodified
      const rawRecordsAfter = AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, testAssessment.id!);
      expect(rawRecordsAfter[0].score).toBe(rawRecordsBefore[0].score);
      expect(rawRecordsAfter[0].percentage).toBe(rawRecordsBefore[0].percentage);
      expect(rawRecordsAfter[0].responses).toEqual(rawRecordsBefore[0].responses);
    });

    it('should not alter underlying factual scores even when teacher applies an override', () => {
      const pub = seedAndPublishAssessment();

      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_raw_02',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_daniel_102',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_raw_02',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_raw_02',
          learnerId: 'elms_daniel_102',
          responses: [
            { itemId: 'item_sep_1', response: 'A' },
            { itemId: 'item_sep_2', response: 'WRONG' },
          ],
        },
      });

      // Teacher overrides status from DEVELOPING to DEMONSTRATED with rationale
      const updatedInterp = LearningOutcomeInterpretationService.overrideAssessmentLearnerStatus({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        learnerId: learner2,
        teacherId: teacherA,
        newStatus: 'DEMONSTRATED',
        reason: 'Learner demonstrated oral mastery of separating funnels during laboratory practical session.',
      });

      const learnerResult = updatedInterp.learnerInterpretations.find(l => l.learnerId === learner2);
      expect(learnerResult?.status).toBe('DEMONSTRATED');
      expect(learnerResult?.teacherOverride?.previousStatus).toBe('DEVELOPING');

      // Crucial: Raw factual score must still remain exactly 5 / 10 (50%)
      const rawRecord = AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, testAssessment.id!)[0];
      expect(rawRecord.score).toBe(5);
      expect(rawRecord.maxScore).toBe(10);
      expect(rawRecord.percentage).toBe(50);
      expect(learnerResult?.score).toBe(5);
      expect(learnerResult?.percentage).toBe(50);
    });
  });

  describe('3. Deterministic Outcome Interpretation Rules (LO-MASTERY-V1)', () => {
    it('should assign DEVELOPING status to single 100% score requiring corroboration', () => {
      const pub = seedAndPublishAssessment();

      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_det_01',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_faith_101',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_det_01',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_det_01',
          learnerId: 'elms_faith_101',
          responses: [
            { itemId: 'item_sep_1', response: 'A' },
            { itemId: 'item_sep_2', response: 'A' },
          ],
        },
      });

      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
      });

      const faith = interp.learnerInterpretations.find(l => l.learnerId === learner1);
      // Under LO-MASTERY-V1 policy, a single high score yields DEVELOPING pending corroboration
      expect(faith?.status).toBe('DEVELOPING');
      expect(faith?.explanation).toContain('requires corroborating evidence');
    });

    it('should assign STRONG_DEMONSTRATION when multiple consistent high attempts exist', () => {
      const pub = seedAndPublishAssessment();

      // Attempt 1: 100%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_det_02a',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_faith_101',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_det_02a',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_det_02a',
          learnerId: 'elms_faith_101',
          responses: [
            { itemId: 'item_sep_1', response: 'A' },
            { itemId: 'item_sep_2', response: 'A' },
          ],
        },
      });

      // Attempt 2: 90% (e.g. repeated attempt or corroboration)
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_det_02b',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_faith_101',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_det_02b',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_det_02b',
          learnerId: 'elms_faith_101',
          responses: [
            { itemId: 'item_sep_1', response: 'A' },
            { itemId: 'item_sep_2', response: 'A' },
          ],
        },
      });

      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
      });

      const faith = interp.learnerInterpretations.find(l => l.learnerId === learner1);
      expect(faith?.status).toBe('STRONG_DEMONSTRATION');
      expect(faith?.conflictStatus).toBe('CONSISTENT');
    });

    it('should detect HIGH_CONFLICT when attempt scores diverge by over 40%', () => {
      const pub = seedAndPublishAssessment();

      // Attempt 1: 100%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_conf_1',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_faith_101',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_conf_1',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_conf_1',
          learnerId: 'elms_faith_101',
          responses: [
            { itemId: 'item_sep_1', response: 'A' },
            { itemId: 'item_sep_2', response: 'A' },
          ],
        },
      });

      // Attempt 2: 0% (massive conflict)
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_conf_2',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_faith_101',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_conf_2',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_conf_2',
          learnerId: 'elms_faith_101',
          responses: [
            { itemId: 'item_sep_1', response: 'WRONG' },
            { itemId: 'item_sep_2', response: 'WRONG' },
          ],
        },
      });

      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
      });

      const faith = interp.learnerInterpretations.find(l => l.learnerId === learner1);
      expect(faith?.conflictStatus).toBe('HIGH_CONFLICT');
      expect(faith?.status).toBe('DEVELOPING');
      expect(faith?.explanation).toContain('High variance in attempt scores');
    });
  });

  describe('4. Question Analytics & Teacher Pedagogical Support Insights', () => {
    it('should compute item-level success rates and flag curriculum gaps for questions with low accuracy', () => {
      const pub = seedAndPublishAssessment();

      // Learner 1 gets Q1 right, Q2 right
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_item_1',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_faith_101',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_item_1',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_item_1',
          learnerId: 'elms_faith_101',
          responses: [
            { itemId: 'item_sep_1', response: 'A' },
            { itemId: 'item_sep_2', response: 'A' },
          ],
        },
      });

      // Learner 2 gets Q1 right, Q2 wrong
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_item_2',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_daniel_102',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_item_2',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_item_2',
          learnerId: 'elms_daniel_102',
          responses: [
            { itemId: 'item_sep_1', response: 'A' },
            { itemId: 'item_sep_2', response: 'WRONG' },
          ],
        },
      });

      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
      });

      const itemAnalytics = interp.factualSummary.itemAnalytics;
      expect(itemAnalytics.length).toBe(2);

      // Q1: 2/2 = 100%
      expect(itemAnalytics[0].successRatePercentage).toBe(100);

      // Q2: 1/2 = 50%
      expect(itemAnalytics[1].successRatePercentage).toBe(50);
      expect(itemAnalytics[1].strugglingLearnerCount).toBe(1);

      // Identified curriculum gaps should flag Q2 because success rate < 60%
      expect(interp.teacherSupportInsights.identifiedCurriculumGaps.length).toBeGreaterThan(0);
      expect(interp.teacherSupportInsights.identifiedCurriculumGaps[0]).toContain('Question 2');
    });

    it('should include explicit non-diagnostic safeguard notice in teacher support insights', () => {
      seedAndPublishAssessment();

      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
      });

      expect(interp.teacherSupportInsights.nonDiagnosticNotice).toBeDefined();
      expect(interp.teacherSupportInsights.nonDiagnosticNotice).toContain('clinical');
    });
  });

  describe('5. Multi-School Tenant Isolation & Security Boundaries', () => {
    it('should strictly isolate evidence and interpretations between School A and School B', () => {
      seedAndPublishAssessment();

      // Submit attempt in School A
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_sec_a',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_faith_101',
        resourceId: `elms_res_${testAssessment.id!}_v1`,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_sec_a',
        payload: {
          assessmentId: `elms_res_${testAssessment.id!}_v1`,
          attemptId: 'att_sec_a',
          learnerId: 'elms_faith_101',
          responses: [{ itemId: 'item_sep_1', response: 'A' }],
        },
      });

      // School B teacher cannot interpret School A assessment
      expect(() => {
        LearningOutcomeInterpretationService.interpretAssessmentEvidence({
          ecgArtifactId: testAssessment.id!,
          schoolId: schoolA,
          requestingTeacherId: teacherB, // Teacher from School B
        });
      }).toThrow(/not an authorized teacher/i);

      // School B queries its own store and sees 0 records for this artifact
      const schoolBEvidence = AssessmentEvidenceService.getElmsEvidenceRecords(schoolB, testAssessment.id!);
      expect(schoolBEvidence.length).toBe(0);
    });

    it('should reject teacher override attempts with empty rationale or by unauthorized assessors', () => {
      seedAndPublishAssessment();

      expect(() => {
        LearningOutcomeInterpretationService.overrideAssessmentLearnerStatus({
          ecgArtifactId: testAssessment.id!,
          schoolId: schoolA,
          learnerId: learner1,
          teacherId: teacherA,
          newStatus: 'DEMONSTRATED',
          reason: '   ', // Empty rationale
        });
      }).toThrow(/mandatory professional rationale/i);

      expect(() => {
        LearningOutcomeInterpretationService.overrideAssessmentLearnerStatus({
          ecgArtifactId: testAssessment.id!,
          schoolId: schoolA,
          learnerId: learner1,
          teacherId: 'unauthorized_intruder',
          newStatus: 'DEMONSTRATED',
          reason: 'Valid reason but unauthorized actor',
        });
      }).toThrow(/not an authorized teacher/i);
    });
  });
});
