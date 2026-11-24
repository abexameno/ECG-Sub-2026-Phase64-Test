import { ElmsIntegrationService } from './services/elmsIntegrationService';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService';
import { ContentArtifactRepository } from './services/contentArtifactRepository';
import { SchoolConfigService } from './services/schoolConfigService';
import { LearnerRosterService } from './services/learnerRosterService';
import { ClassGroupService } from './classGroupService';
import { AuditService } from './services/auditService';
import { LO_MASTERY_V1_CONFIG } from './types/interpretation';
import { ContentType, QuestionType, GeneratedContent } from './types';

describe('Phase 27: LO-MASTERY-V1 Policy Formalization & Roster-Aware Evidence', () => {
  const schoolA = 'lwps';
  const schoolB = 'school-b';
  const teacherA = '2'; // Active teacher in lwps
  const teacherB = '4'; // Active teacher in school-b
  const classGroupA = 'cg_lwps_g8a';
  const classGroupB = 'cg_school-b_g7';

  const testAssessment: GeneratedContent = {
    id: 'art_g8_chem_quiz_phase27',
    ownerId: teacherA,
    title: 'Grade 8 Chemistry: Acids and Bases Assessment',
    questions: [
      {
        id: 'item_acid_1',
        questionType: QuestionType.MultipleChoice,
        questionText: 'What is the pH of a neutral solution at 25 degrees Celsius?',
        options: ['pH 7', 'pH 1', 'pH 14', 'pH 4'],
        correctOption: 'A',
        correctAnswer: 'pH 7',
        marks: 5,
      },
      {
        id: 'item_acid_2',
        questionType: QuestionType.MultipleChoice,
        questionText: 'Which indicator turns pink in an alkaline solution?',
        options: ['Phenolphthalein', 'Methyl orange', 'Litmus', 'Universal indicator'],
        correctOption: 'A',
        correctAnswer: 'Phenolphthalein',
        marks: 5,
      },
    ],
    metadata: {
      schoolId: schoolA,
      classGroupId: classGroupA,
      grade: 'Grade 8',
      subject: 'Integrated Science',
      topic: 'Acids, Bases and Indicators',
      contentType: ContentType.Assessment,
      term: 'Term 1',
      terms: ['Term 1'],
      week: '5',
      lessonNumber: '1',
      strand: '1.0 Matter',
      subStrand: '1.3 Acids and Bases',
      specificLearningOutcome: 'Learner can classify common substances as acidic, basic, or neutral using indicators.',
      parentArtifactId: 'art_g8_chem_quiz_phase27',
      masterSowId: 'master_sow_grade8_science',
      curriculumLessonId: 'curr_lesson_acids_bases_5_1',
    },
    savedAt: new Date().toISOString(),
  };

  function seedSchoolAndClassRoster() {
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

    // Seed 4 learners in Class Group A (lwps Grade 8A)
    const learners = [
      { id: 'lrn_p27_01', name: 'Alvin Kipruto', identifier: 'ADM-801' },
      { id: 'lrn_p27_02', name: 'Brenda Cherotich', identifier: 'ADM-802' },
      { id: 'lrn_p27_03', name: 'Collins Otieno', identifier: 'ADM-803' },
      { id: 'lrn_p27_04', name: 'Diana Wambui', identifier: 'ADM-804' },
    ];

    for (const l of learners) {
      LearnerRosterService.addLearner({
        id: l.id,
        schoolId: schoolA,
        displayName: l.name,
        learnerIdentifier: l.identifier,
        classGroupId: classGroupA,
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1',
      });

      ElmsIntegrationService.mapLearner({
        schoolId: schoolA,
        ecgLearnerId: l.id,
        elmsLearnerId: `elms_u_${l.id}`,
        requestingUserId: teacherA,
      });
    }
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
      classGroupId: classGroupA,
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
    LearnerRosterService.clearStore();
    AuditService.clearLogs();
    seedSchoolAndClassRoster();
  });

  describe('1. Scope Item 1: LO-MASTERY-V1 Policy Formalization', () => {
    it('should export LO_MASTERY_V1_CONFIG with exact audited thresholds', () => {
      expect(LO_MASTERY_V1_CONFIG).toBeDefined();
      expect(LO_MASTERY_V1_CONFIG.version).toBe('LO-MASTERY-V1');
      expect(LO_MASTERY_V1_CONFIG.strongMinAvg).toBe(85);
      expect(LO_MASTERY_V1_CONFIG.strongMinFloor).toBe(70);
      expect(LO_MASTERY_V1_CONFIG.demonstratedMinAvg).toBe(70);
      expect(LO_MASTERY_V1_CONFIG.demonstratedMinFloor).toBe(50);
      expect(LO_MASTERY_V1_CONFIG.developingMinAvg).toBe(50);
      expect(LO_MASTERY_V1_CONFIG.highConflictDelta).toBe(40);
      expect(LO_MASTERY_V1_CONFIG.moderateVarianceDelta).toBe(20);
      expect(LO_MASTERY_V1_CONFIG.itemDeficitThreshold).toBe(60);
      expect(LO_MASTERY_V1_CONFIG.minCorroboratingAttempts).toBe(2);
      expect(LO_MASTERY_V1_CONFIG.attemptWeighting).toBe('EQUAL');
    });

    it('should expose the centralized policy configuration on LearningOutcomeInterpretationService', () => {
      expect(LearningOutcomeInterpretationService.CURRENT_POLICY_VERSION).toBe('LO-MASTERY-V1');
      expect(LearningOutcomeInterpretationService.POLICY_CONFIG).toEqual(LO_MASTERY_V1_CONFIG);
    });

    it('should preserve Strong Demonstration condition (avg >= 85 and min >= 70 across >= 2 attempts)', () => {
      const pub = seedAndPublishAssessment();

      // Submit attempt 1: 100%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_p27_sd_1',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_p27_sd_1',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_p27_sd_1',
          learnerId: 'elms_u_lrn_p27_01',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'A' },
          ],
        },
      });

      // Submit attempt 2: 80% (avg = 90%, min = 80% >= 70%)
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_p27_sd_2',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_p27_sd_2',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_p27_sd_2',
          learnerId: 'elms_u_lrn_p27_01',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'A' },
          ],
        },
      });

      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId: classGroupA,
      });

      const alvin = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_01');
      expect(alvin?.status).toBe('STRONG_DEMONSTRATION');
    });

    it('should preserve Demonstrated condition (avg >= 70 and min >= 50 across >= 2 attempts)', () => {
      const pub = seedAndPublishAssessment();

      // Submit attempt 1: 100%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_p27_dem_1',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_02',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_p27_dem_1',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_p27_dem_1',
          learnerId: 'elms_u_lrn_p27_02',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'A' },
          ],
        },
      });

      // Submit attempt 2: 50% (avg = 75%, min = 50% >= 50%)
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_p27_dem_2',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_02',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_p27_dem_2',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_p27_dem_2',
          learnerId: 'elms_u_lrn_p27_02',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'WRONG' },
          ],
        },
      });

      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId: classGroupA,
      });

      const brenda = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_02');
      expect(brenda?.status).toBe('DEMONSTRATED');
    });

    it('should preserve HIGH_CONFLICT detection when attempt score divergence exceeds highConflictDelta (40%)', () => {
      const pub = seedAndPublishAssessment();

      // Attempt 1 = 100%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_p27_hc_1',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_p27_hc_1',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_p27_hc_1',
          learnerId: 'elms_u_lrn_p27_01',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'A' },
          ],
        },
      });

      // Attempt 2 = 0% (Delta = 100% > 40%)
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_p27_hc_2',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_p27_hc_2',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_p27_hc_2',
          learnerId: 'elms_u_lrn_p27_01',
          responses: [
            { itemId: 'item_acid_1', response: 'WRONG' },
            { itemId: 'item_acid_2', response: 'WRONG' },
          ],
        },
      });

      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId: classGroupA,
      });

      const alvin = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_01');
      expect(alvin?.conflictStatus).toBe('HIGH_CONFLICT');
      expect(alvin?.status).toBe('DEVELOPING');
      expect(alvin?.explanation).toContain('High variance');
    });

    it('should preserve MODERATE_VARIANCE detection when divergence is between 20% and 40%', () => {
      const pub = seedAndPublishAssessment();

      // Attempt 1 = 100%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_p27_mv_1',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_p27_mv_1',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_p27_mv_1',
          learnerId: 'elms_u_lrn_p27_01',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'A' },
          ],
        },
      });

      // Attempt 2 = 70% (Delta = 30% > 20% and <= 40%)
      // Let's create an assessment with 10 marks total (7 marks = 70%)
      // With 2 items of 5 marks each, 5/10 = 50% (delta 50% -> high conflict).
      // Let's add an assessment with 10 questions of 1 mark each to test exact 30% delta.
      const assessment10Q: GeneratedContent = {
        id: 'art_10q_test',
        ownerId: teacherA,
        title: '10 Questions Variance Test',
        questions: Array.from({ length: 10 }, (_, i) => ({
          id: `item_10q_${i + 1}`,
          questionType: QuestionType.MultipleChoice,
          questionText: `Question ${i + 1}`,
          options: ['A', 'B', 'C', 'D'],
          correctOption: 'A',
          marks: 1,
        })),
        metadata: {
          schoolId: schoolA,
          grade: 'Grade 8',
          subject: 'Integrated Science',
          contentType: ContentType.Assessment,
        },
      };

      ContentArtifactRepository.save({
        id: assessment10Q.id!,
        schoolId: schoolA,
        version: 1,
        artifactType: 'assessment',
        curriculumId: 'canonical-cbc',
        curriculumVersion: '2024.1',
        gradeLevelId: 'Grade 8',
        learningAreaId: 'Integrated Science',
        status: 'validated',
        source: 'ai_generated',
        content: assessment10Q,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const pub10Q = ElmsIntegrationService.publishResource({
        schoolId: schoolA,
        teacherId: teacherA,
        ecgArtifactId: assessment10Q.id!,
        learningAreaId: 'Integrated Science',
        curriculumVersionId: '2024.1',
      });

      // Attempt 1: 10/10 = 100%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_10q_1',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub10Q.elmsResourceId,
        ecgArtifactId: assessment10Q.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_10q_1',
        payload: {
          assessmentId: pub10Q.elmsResourceId,
          attemptId: 'att_10q_1',
          learnerId: 'elms_u_lrn_p27_01',
          responses: Array.from({ length: 10 }, (_, i) => ({ itemId: `item_10q_${i + 1}`, response: 'A' })),
        },
      });

      // Attempt 2: 7/10 = 70% (Delta = 30%)
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_10q_2',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub10Q.elmsResourceId,
        ecgArtifactId: assessment10Q.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_10q_2',
        payload: {
          assessmentId: pub10Q.elmsResourceId,
          attemptId: 'att_10q_2',
          learnerId: 'elms_u_lrn_p27_01',
          responses: Array.from({ length: 10 }, (_, i) => ({ itemId: `item_10q_${i + 1}`, response: i < 7 ? 'A' : 'B' })),
        },
      });

      const interp10Q = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: assessment10Q.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
      });

      const alvin10Q = interp10Q.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_01');
      expect(alvin10Q?.conflictStatus).toBe('MODERATE_VARIANCE');
    });
  });

  describe('2. Scope Item 2: Roster-Aware Insufficient Evidence', () => {
    it('should identify assigned learners with 0 submissions as INSUFFICIENT_EVIDENCE without assigning 0%', () => {
      seedAndPublishAssessment();

      // Zero submissions recorded yet
      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId: classGroupA,
      });

      expect(interp.factualSummary.totalLearnersAssigned).toBe(4);
      expect(interp.factualSummary.totalLearnersSubmitted).toBe(0);
      expect(interp.factualSummary.totalLearnersAwaitingSubmission).toBe(4);
      expect(interp.factualSummary.evidenceStatus).toBe('AWAITING_LEARNER_SUBMISSIONS');

      // Crucial: 4 learners on roster are displayed with INSUFFICIENT_EVIDENCE and undefined score/percentage
      expect(interp.learnerInterpretations.length).toBe(4);
      for (const learner of interp.learnerInterpretations) {
        expect(learner.status).toBe('INSUFFICIENT_EVIDENCE');
        expect(learner.conflictStatus).toBe('NOT_APPLICABLE');
        expect(learner.score).toBeUndefined();
        expect(learner.percentage).toBeUndefined();
        expect(learner.attemptId).toBeUndefined();
        expect(learner.explanation).toContain('No assessment submission recorded');
      }

      // Competency distribution must NOT assign learners to emerging/0%
      expect(interp.competencyDistribution.strongDemonstrationCount).toBe(0);
      expect(interp.competencyDistribution.demonstratedCount).toBe(0);
      expect(interp.competencyDistribution.developingCount).toBe(0);
      expect(interp.competencyDistribution.emergingCount).toBe(0);
      expect(interp.competencyDistribution.insufficientEvidenceCount).toBe(4);
    });

    it('should properly distinguish submitters from non-submitters in a partial submission assessment', () => {
      const pub = seedAndPublishAssessment();

      // Learner 1 (Alvin) submits and scores 100%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_part_01',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_part_01',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_part_01',
          learnerId: 'elms_u_lrn_p27_01',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'A' },
          ],
        },
      });

      // Learner 2 (Brenda) submits and scores 50%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_part_02',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_02',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_part_02',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_part_02',
          learnerId: 'elms_u_lrn_p27_02',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'WRONG' },
          ],
        },
      });

      // Learners 3 and 4 have NOT submitted
      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId: classGroupA,
      });

      expect(interp.factualSummary.totalLearnersAssigned).toBe(4);
      expect(interp.factualSummary.totalLearnersSubmitted).toBe(2);
      expect(interp.factualSummary.totalLearnersAwaitingSubmission).toBe(2);
      expect(interp.factualSummary.evidenceStatus).toBe('PARTIAL_SUBMISSIONS');

      // Class average must be calculated over the 2 submitters only ( (100 + 50) / 2 = 75% )
      expect(interp.factualSummary.averageScorePercentage).toBe(75);

      // Verify submitters have real evidence
      const alvin = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_01');
      expect(alvin?.percentage).toBe(100);
      expect(alvin?.score).toBe(10);
      expect(alvin?.status).toBe('DEVELOPING'); // Single 100% requires corroboration

      const brenda = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_02');
      expect(brenda?.percentage).toBe(50);
      expect(brenda?.score).toBe(5);

      // Verify non-submitters
      const collins = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_03');
      expect(collins?.status).toBe('INSUFFICIENT_EVIDENCE');
      expect(collins?.percentage).toBeUndefined();
      expect(collins?.score).toBeUndefined();

      const diana = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_04');
      expect(diana?.status).toBe('INSUFFICIENT_EVIDENCE');
      expect(diana?.percentage).toBeUndefined();
      expect(diana?.score).toBeUndefined();

      expect(interp.competencyDistribution.insufficientEvidenceCount).toBe(2);
      expect(interp.teacherSupportInsights.recommendedPedagogicalActions.some(a => a.includes('2 assigned learner(s) awaiting completion'))).toBe(true);
    });

    it('should distinguish an actual 0% submission from no submission', () => {
      const pub = seedAndPublishAssessment();

      // Collins submits with 0%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_zero_01',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_03',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_zero_01',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_zero_01',
          learnerId: 'elms_u_lrn_p27_03',
          responses: [
            { itemId: 'item_acid_1', response: 'WRONG' },
            { itemId: 'item_acid_2', response: 'WRONG' },
          ],
        },
      });

      // Diana has NO submission
      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId: classGroupA,
      });

      const collins = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_03');
      expect(collins?.status).toBe('EMERGING'); // Actual submitted 0% is emerging
      expect(collins?.score).toBe(0);
      expect(collins?.percentage).toBe(0);
      expect(collins?.attemptId).toBe('att_zero_01');

      const diana = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_04');
      expect(diana?.status).toBe('INSUFFICIENT_EVIDENCE'); // Unsubmitted is Insufficient Evidence
      expect(diana?.score).toBeUndefined();
      expect(diana?.percentage).toBeUndefined();
    });
  });

  describe('3. Scope Item 3: Equal-Weighted Attempt Averaging & Policy Preservation', () => {
    it('should preserve equal-weighted arithmetic mean across multiple attempts without time-decay', () => {
      const pub = seedAndPublishAssessment();

      // Attempt 1: 60%
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_eq_1',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: '2026-02-01T10:00:00.000Z',
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_eq_1',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_eq_1',
          learnerId: 'elms_u_lrn_p27_01',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'WRONG' },
          ],
        },
      });

      // Attempt 2: 100% (submitted much later)
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_eq_2',
        sourceSystem: 'ELMS',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'elms_u_lrn_p27_01',
        resourceId: pub.elmsResourceId,
        ecgArtifactId: testAssessment.id!,
        timestamp: '2026-03-01T10:00:00.000Z',
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_eq_2',
        payload: {
          assessmentId: pub.elmsResourceId,
          attemptId: 'att_eq_2',
          learnerId: 'elms_u_lrn_p27_01',
          responses: [
            { itemId: 'item_acid_1', response: 'A' },
            { itemId: 'item_acid_2', response: 'A' },
          ],
        },
      });

      const interp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId: classGroupA,
      });

      const alvin = interp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_01');
      // Strictly equal weighted: (50 + 100) / 2 = 75%
      expect(alvin?.percentage).toBe(75);
      expect(interp.attemptWeighting).toBe('EQUAL');
      expect(interp.policyVersion).toBe('LO-MASTERY-V1');
    });
  });

  describe('4. Security Boundaries, Tenant Isolation & Teacher Overrides', () => {
    it('should reject access to class groups belonging to another school', () => {
      seedAndPublishAssessment();

      expect(() => {
        LearningOutcomeInterpretationService.interpretAssessmentEvidence({
          ecgArtifactId: testAssessment.id!,
          schoolId: schoolA,
          requestingTeacherId: teacherA,
          classGroupId: classGroupB, // Class group belongs to School B
        });
      }).toThrow(/Unauthorized cross-school access/i);
    });

    it('should allow teacher override on an unsubmitted learner with mandatory rationale without mutating evidence', () => {
      seedAndPublishAssessment();

      // Collins has no submission. Teacher applies an override based on laboratory viva.
      const updatedInterp = LearningOutcomeInterpretationService.overrideAssessmentLearnerStatus({
        ecgArtifactId: testAssessment.id!,
        schoolId: schoolA,
        learnerId: 'lrn_p27_03',
        teacherId: teacherA,
        newStatus: 'DEMONSTRATED',
        reason: 'Learner was absent for digital assessment but demonstrated practical indicator titration in lab.',
        classGroupId: classGroupA,
      });

      const collins = updatedInterp.learnerInterpretations.find(l => l.learnerId === 'lrn_p27_03');
      expect(collins?.status).toBe('DEMONSTRATED');
      expect(collins?.teacherOverride?.previousStatus).toBe('INSUFFICIENT_EVIDENCE');
      expect(collins?.teacherOverride?.reason).toContain('indicator titration');
      // Factual raw records remain completely absent/immutable
      expect(collins?.score).toBeUndefined();
      expect(collins?.percentage).toBeUndefined();

      const rawRecords = AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, testAssessment.id!);
      expect(rawRecords.length).toBe(0);
    });
  });
});
