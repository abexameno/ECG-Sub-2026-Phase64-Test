import { TeacherActionService } from './services/teacherActionService';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService';
import { SchoolMembershipService } from './services/schoolMembershipService';
import { SchoolConfigService } from './services/schoolConfigService';
import { LearnerRosterService } from './services/learnerRosterService';
import { ClassGroupService } from './services/classGroupService';
import { ContentArtifactRepository } from './services/contentArtifactRepository';
import { ElmsIntegrationService } from './services/elmsIntegrationService';
import { AuditService } from './services/auditService';
import { ContentType, GeneratedContent, QuestionDifficulty, QuestionType } from './types';

describe('Phase 31: Teacher Action Follow-Up & Evidence Reassessment Workflow', () => {
  const schoolA = 'lwps';
  const schoolB = 'other_school';
  const teacherA = 't_lwps_1';
  const teacherB = 't_other_1';
  const unauthorizedLearner = 'lrn_lwps_301';

  const masterSowId = 'sow_master_g8_sci_t1';
  const parentLessonPlanId = 'lp_g8_sci_w3_l2';
  const curriculumLessonId = 'kicd_g8_sci_t1_str1_ss2_l2';
  const scheduledLessonId = 'sched_lwps_g8_sci_w3_l2';
  const ecgArtifactId = 'ecg_assess_phase31_orig';
  const classGroupId = 'cg_lwps_g8a';
  let originalAssessmentId = '';
  let sourceInterpretationId = '';

  beforeEach(() => {
    TeacherActionService.clearStore();
    LearningOutcomeInterpretationService.clearStore();
    AssessmentEvidenceService.clearStore();
    LearnerRosterService.clearStore();
    ClassGroupService.clearStore();
    SchoolMembershipService.clearStore();
    SchoolConfigService.clearStore();
    ContentArtifactRepository.clearStore();
    ElmsIntegrationService.clearStore();

    // Register School A & Teacher A
    SchoolConfigService.registerSchool({
      id: schoolA,
      name: 'LWPS',
      county: 'Nairobi',
      schoolType: 'Junior School',
      gradesOffered: ['Grade 8'],
      learningAreasOffered: ['la-sci'],
      curriculumSystem: 'Kenya CBC',
      status: 'active',
    } as any);

    SchoolMembershipService.addMembership({
      userId: teacherA,
      schoolId: schoolA,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    SchoolMembershipService.addMembership({
      userId: 'admin_lwps_1',
      schoolId: schoolA,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    });

    // Register School B & Teacher B
    SchoolConfigService.registerSchool({
      id: schoolB,
      name: 'Other School',
      county: 'Mombasa',
      schoolType: 'Junior School',
      gradesOffered: ['Grade 8'],
      learningAreasOffered: ['la-sci'],
      curriculumSystem: 'Kenya CBC',
      status: 'active',
    } as any);

    SchoolMembershipService.addMembership({
      userId: teacherB,
      schoolId: schoolB,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    // Create Class Group & Roster in School A
    ClassGroupService.createClassGroup({
      id: classGroupId,
      name: 'Grade 8A',
      schoolId: schoolA,
      academicYearId: 'ay_lwps_2026',
    });

    const roster = [
      { id: 'lrn_lwps_301', name: 'Amani Kimani', adm: 'ADM-301' },
      { id: 'lrn_lwps_302', name: 'Baraka Omondi', adm: 'ADM-302' },
      { id: 'lrn_lwps_303', name: 'Chausiku Mutua', adm: 'ADM-303' },
      { id: 'lrn_lwps_304', name: 'Dan Wanjala', adm: 'ADM-304' },
    ];

    for (const r of roster) {
      LearnerRosterService.addLearner({
        id: r.id,
        schoolId: schoolA,
        displayName: r.name,
        learnerIdentifier: r.adm,
        classGroupId,
        academicYearId: 'ay_lwps_2026',
        requestingUserId: 'admin_lwps_1',
      });
    }

    // Save Original Assessment Artifact in Repository
    ContentArtifactRepository.save({
      id: ecgArtifactId,
      schoolId: schoolA,
      artifactType: 'assessment',
      curriculumId: 'kicd-cbc-2026',
      curriculumVersion: '2026.1',
      gradeLevelId: 'grade-8',
      gradeLevelName: 'Grade 8',
      learningAreaId: 'la-sci',
      learningAreaName: 'Integrated Science',
      term: 'Term 1',
      weekNumber: 3,
      lessonNumber: 2,
      curriculumReferences: [
        {
          gradeLevelId: 'grade-8',
          learningAreaId: 'la-sci',
          strandId: 'Living Things and Their Environment',
          subStrandId: 'Movement of Materials In and Out of the Cell',
          learningOutcomeIds: ['KICD-G8-SCI-2.1'],
        },
      ],
      version: 1,
      status: 'validated',
      source: 'ai_generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      masterSowId,
      parentArtifactId: parentLessonPlanId,
      curriculumLessonId,
      scheduledLessonId,
      content: {
        id: ecgArtifactId,
        title: 'Osmosis Baseline Assessment',
        metadata: {
          schoolId: schoolA,
          grade: 'Grade 8',
          subject: 'Integrated Science',
          topic: 'Living Things and Their Environment - Movement of Materials In and Out of the Cell',
          contentType: ContentType.Assessment,
          term: 'Term 1',
          week: '3',
          lessonNumber: '2',
          strand: 'Living Things and Their Environment',
          subStrand: 'Movement of Materials In and Out of the Cell',
          specificLearningOutcome: 'Demonstrate osmosis in living tissues and explain its role in plants.',
          masterSowId,
          parentArtifactId: parentLessonPlanId,
          curriculumLessonId,
          scheduledLessonId,
        },
      },
    } as any);

    const origAsmt = AssessmentEvidenceService.createAssessment({
      schoolId: schoolA,
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'KICD-G8-SCI-2.1',
      title: 'Osmosis Baseline Assessment',
      contentArtifactId: ecgArtifactId,
      classGroupId,
      items: [
        {
          type: 'STRUCTURED',
          prompt: 'Explain how osmosis occurs across a semi-permeable membrane in plant cells.',
          marks: 5,
          correctAnswer: 'Water moves from high to low water potential.',
          learningOutcomeId: 'KICD-G8-SCI-2.1',
          sequence: 1,
        },
        {
          type: 'STRUCTURED',
          prompt: 'Identify the role of root hair cells in water absorption.',
          marks: 5,
          correctAnswer: 'Provide large surface area for water uptake by osmosis.',
          learningOutcomeId: 'KICD-G8-SCI-2.1',
          sequence: 2,
        },
      ],
    });
    originalAssessmentId = origAsmt.assessmentId;

    // Publish & assign original assessment to classGroupId
    ElmsIntegrationService.publishResource({
      schoolId: schoolA,
      teacherId: teacherA,
      ecgArtifactId,
      classGroupId,
    });

    // Record baseline ELMS evidence for 3 of 4 learners (lrn_lwps_304 has NO submission -> INSUFFICIENT_EVIDENCE)
    // lrn_lwps_301: 3/10 (30% -> EMERGING)
    // lrn_lwps_302: 4/10 (40% -> EMERGING)
    // lrn_lwps_303: 6/10 (60% -> DEVELOPING)
    const baselineScores = [
      { learnerId: 'lrn_lwps_301', score: 3, maxScore: 10 },
      { learnerId: 'lrn_lwps_302', score: 4, maxScore: 10 },
      { learnerId: 'lrn_lwps_303', score: 6, maxScore: 10 },
    ];

    for (const b of baselineScores) {
      AssessmentEvidenceService.recordElmsEvidenceRecord({
        evidenceRecordId: `elms_evd_orig_${b.learnerId}`,
        schoolId: schoolA,
        ecgArtifactId,
        elmsResourceId: `elms_res_${ecgArtifactId}_v1`,
        assessmentId: originalAssessmentId,
        attemptId: `att_orig_${b.learnerId}`,
        learnerId: b.learnerId,
        classGroupId,
        curriculumVersionId: '2026.1',
        learningOutcomeId: 'KICD-G8-SCI-2.1',
        score: b.score,
        maxScore: b.maxScore,
        percentage: (b.score / b.maxScore) * 100,
        status: 'SYNCHRONIZED',
        responses: [],
        submittedAt: '2026-10-01T10:00:00.000Z',
        evaluatedAt: '2026-10-01T10:05:00.000Z',
        provenance: {
          sourceSystem: 'ELMS',
          evaluatorType: 'SYSTEM',
        },
      });
    }

    const interp = LearningOutcomeInterpretationService.confirmAssessmentReview({
      ecgArtifactId,
      schoolId: schoolA,
      teacherId: teacherA,
      classGroupId,
    });
    sourceInterpretationId = interp.interpretationId;
  });

  function createSampleActionPlan(
    overrides?: Partial<Parameters<typeof TeacherActionService.createActionPlan>[0]>
  ) {
    return TeacherActionService.createActionPlan({
      schoolId: schoolA,
      teacherId: teacherA,
      ecgArtifactId,
      assessmentId: originalAssessmentId,
      actionType: 'REMEDIAL_SUPPORT',
      scope: 'WHOLE_CLASS',
      focusArea: 'Movement of Materials In and Out of the Cell (Osmosis)',
      teacherNotes: 'Use potato cylinder demonstration before follow-up check.',
      classGroupId,
      sourceInterpretationId,
      masterSowId,
      parentArtifactId: parentLessonPlanId,
      curriculumLessonId,
      scheduledLessonId,
      curriculumContext: {
        grade: 'Grade 8',
        subject: 'Integrated Science',
        term: 'Term 1',
        week: 3,
        lesson: 2,
        strand: 'Living Things and Their Environment',
        subStrand: 'Movement of Materials In and Out of the Cell',
        learningOutcomeId: 'KICD-G8-SCI-2.1',
        specificLearningOutcome: 'Demonstrate osmosis in living tissues and explain its role in plants.',
        learningOutcomes: 'Demonstrate osmosis in living tissues and explain its role in plants.',
      },
      ...overrides,
    });
  }

  // 1. Pre-populated Follow-Up Assessment FormState & Lineage
  test('1. buildFollowUpAssessmentContext pre-populates FormState with locked curriculum and Phase 31 follow-up lineage', () => {
    const plan = createSampleActionPlan();

    const formState = TeacherActionService.buildFollowUpAssessmentContext({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      preferredContentType: ContentType.Quiz,
      totalQuestions: 5,
    });

    expect(formState.contentType).toBe(ContentType.Quiz);
    expect(formState.isFollowUpAssessment).toBe(true);
    expect(formState.teacherActionId).toBe(plan.actionId);
    expect(formState.sourceTeacherActionId).toBe(plan.actionId);
    expect(formState.sourceInterpretationId).toBe(sourceInterpretationId);
    expect(formState.originalEcgArtifactId).toBe(ecgArtifactId);
    expect(formState.originalAssessmentId).toBe(originalAssessmentId);
    expect(formState.masterSowId).toBe(masterSowId);
    expect(formState.parentArtifactId).toBe(parentLessonPlanId);
    expect(formState.curriculumLessonId).toBe(curriculumLessonId);
    expect(formState.scheduledLessonId).toBe(scheduledLessonId);
    expect(formState.grade).toBe('Grade 8');
    expect(formState.subject).toBe('Integrated Science');
    expect(formState.term).toBe('Term 1');
    expect(formState.week).toBe('3');
    expect(formState.lessonNumber).toBe('2');
    expect(formState.teacherActionContext?.isFollowUpAssessment).toBe(true);
    expect(formState.teacherActionContext?.originalEcgArtifactId).toBe(ecgArtifactId);
  });

  // 2. ContentType validation for follow-up assessments
  test('2. buildFollowUpAssessmentContext allows Quiz/Assessment and rejects non-assessment content types', () => {
    const plan = createSampleActionPlan();

    expect(() =>
      TeacherActionService.buildFollowUpAssessmentContext({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        preferredContentType: ContentType.LessonNotes,
      })
    ).toThrow(/Follow-up reassessment must use Quiz or Assessment/i);

    expect(() =>
      TeacherActionService.buildFollowUpAssessmentContext({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        preferredContentType: ContentType.SchemeOfWork,
      })
    ).toThrow(/Follow-up reassessment must use Quiz or Assessment/i);
  });

  // 3. Rejects follow-up creation on NO_ACTION_REQUIRED or CANCELLED/REJECTED actions
  test('3. Rejects follow-up assessment creation for NO_ACTION_REQUIRED, CANCELLED, or REJECTED actions', () => {
    const noActionPlan = createSampleActionPlan({ actionType: 'NO_ACTION_REQUIRED' });
    expect(() =>
      TeacherActionService.buildFollowUpAssessmentContext({
        actionId: noActionPlan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
      })
    ).toThrow(/does not require a follow-up assessment/i);

    const cancelledPlan = createSampleActionPlan();
    TeacherActionService.updateActionStatus({
      actionId: cancelledPlan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      newStatus: 'CANCELLED',
    });

    expect(() =>
      TeacherActionService.buildFollowUpAssessmentContext({
        actionId: cancelledPlan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
      })
    ).toThrow(/Cannot create a follow-up assessment for a CANCELLED teacher action plan/i);
  });

  // 4. Explicit Follow-Up Assessment generation & linkage
  test('4. generateFollowUpAssessmentFromAction creates a distinct assessment artifact, registers Assessment contract, and links to action plan', async () => {
    const plan = createSampleActionPlan();

    const result = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      preferredContentType: ContentType.Quiz,
      generatorFn: async (fs): Promise<GeneratedContent> => ({
        id: 'fup_artifact_osmosis_1',
        title: 'Osmosis Follow-Up Quiz',
        questions: [
          {
            questionType: QuestionType.MultipleChoice,
            questionText: 'What happens to a plant cell placed in a hypotonic solution?',
            options: ['A) Becomes turgid', 'B) Becomes plasmolysed', 'C) Bursts immediately', 'D) No change'],
            correctOption: 'A',
            correctAnswer: 'A) Becomes turgid',
            marks: 5,
          },
          {
            questionType: QuestionType.ShortAnswer,
            questionText: 'Define semi-permeable membrane.',
            correctAnswer: 'Allows selective passage of water molecules.',
            marks: 5,
          },
        ],
        metadata: {
          grade: fs.grade,
          subject: fs.subject,
          topic: fs.topic,
          contentType: ContentType.Quiz,
        },
      }),
    });

    expect(result.artifact.id).toBe('fup_artifact_osmosis_1');
    expect(result.artifact.id).not.toBe(ecgArtifactId);
    expect(result.artifact.isFollowUpAssessment).toBe(true);
    expect(result.artifact.teacherActionId).toBe(plan.actionId);
    expect(result.artifact.originalEcgArtifactId).toBe(ecgArtifactId);
    expect(result.followUpAssessment.contentArtifactId).toBe('fup_artifact_osmosis_1');
    expect(result.followUpAssessment.assessmentId).not.toBe(originalAssessmentId);
    expect(result.updatedAction.status).toBe('IN_PROGRESS');
    expect(result.updatedAction.followUpReviewStatus).toBe('AWAITING_EVIDENCE');
    expect(result.updatedAction.linkedFollowUpAssessments).toHaveLength(1);
    expect(result.followUpLink.elmsPublicationStatus).toBe('NOT_PUBLISHED');
  });

  // 5. Supporting Resource -> Follow-Up Assessment lineage preservation
  test('5. Preserves supportingResourceId lineage when a follow-up assessment is created after a supporting resource', async () => {
    const plan = createSampleActionPlan();

    const { artifact: supportingResource } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      preferredContentType: ContentType.LessonNotes,
      generatorFn: async (fs) => ({
        id: 'res_notes_osmosis_1',
        title: 'Remedial Notes on Osmosis',
        body: 'Detailed notes on water potential and semi-permeable membranes.',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: fs.contentType },
      }),
    });

    const { followUpLink, artifact: followUpArtifact } =
      await TeacherActionService.generateFollowUpAssessmentFromAction({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        preferredContentType: ContentType.Quiz,
        generatorFn: async (fs) => ({
          id: 'fup_quiz_after_notes_1',
          title: 'Post-Remedial Osmosis Check',
          questions: [
            {
              questionType: QuestionType.MultipleChoice,
              questionText: 'Which direction does water move during osmosis?',
              options: ['A) High to low water potential', 'B) Low to high water potential', 'C) Random', 'D) None'],
              correctOption: 'A',
              correctAnswer: 'A',
              marks: 10,
            },
          ],
          metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
        }),
      });

    expect(followUpLink.supportingResourceId).toBe(supportingResource.id);
    expect(followUpArtifact.supportingResourceId).toBe(supportingResource.id);
    expect(followUpArtifact.originalEcgArtifactId).toBe(ecgArtifactId);
  });

  // 6. Linking an existing assessment & preventing linking original assessment as follow-up
  test('6. linkFollowUpAssessmentToAction links a valid distinct assessment and rejects linking the original assessment as its own follow-up', () => {
    const plan = createSampleActionPlan();

    // Attempt to link original assessment as follow-up must fail
    expect(() =>
      TeacherActionService.linkFollowUpAssessmentToAction({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        followUpArtifactId: ecgArtifactId,
      })
    ).toThrow(/Cannot link the original assessment as its own follow-up assessment/i);

    // Save a distinct curriculum-aligned assessment artifact
    ContentArtifactRepository.save({
      id: 'existing_fup_asmt_1',
      schoolId: schoolA,
      artifactType: 'assessment',
      curriculumId: 'kicd-cbc-2026',
      curriculumVersion: '2026.1',
      gradeLevelId: 'grade-8',
      gradeLevelName: 'Grade 8',
      learningAreaId: 'la-sci',
      learningAreaName: 'Integrated Science',
      term: 'Term 1',
      weekNumber: 3,
      lessonNumber: 2,
      curriculumReferences: [
        {
          gradeLevelId: 'grade-8',
          learningAreaId: 'la-sci',
          strandId: 'Living Things and Their Environment',
          subStrandId: 'Movement of Materials In and Out of the Cell',
          learningOutcomeIds: ['KICD-G8-SCI-2.1'],
        },
      ],
      version: 1,
      status: 'validated',
      source: 'human_created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content: {
        id: 'existing_fup_asmt_1',
        title: 'Teacher-Authored Follow-Up Quiz',
        metadata: {
          grade: 'Grade 8',
          subject: 'Integrated Science',
          topic: 'Living Things and Their Environment - Movement of Materials In and Out of the Cell',
          contentType: ContentType.Quiz,
          strand: 'Living Things and Their Environment',
          subStrand: 'Movement of Materials In and Out of the Cell',
        },
      },
    } as any);

    const linked = TeacherActionService.linkFollowUpAssessmentToAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: 'existing_fup_asmt_1',
    });

    expect(linked.followUpLink.followUpArtifactId).toBe('existing_fup_asmt_1');
    expect(linked.followUpAssessment.contentArtifactId).toBe('existing_fup_asmt_1');
  });

  // 7. Curriculum alignment validation when linking or generating follow-up assessments
  test('7. Rejects curriculum lock tampering or linking a follow-up assessment with mismatched grade/subject/strand', async () => {
    const plan = createSampleActionPlan();
    const tamperedFormState = TeacherActionService.buildFollowUpAssessmentContext({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
    });
    tamperedFormState.grade = 'Grade 4';

    await expect(
      TeacherActionService.generateFollowUpAssessmentFromAction({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        customFormState: tamperedFormState,
      })
    ).rejects.toThrow(/Curriculum lock violation/i);

    // Save an artifact with mismatched subject
    ContentArtifactRepository.save({
      id: 'mismatched_fup_1',
      schoolId: schoolA,
      artifactType: 'assessment',
      curriculumId: 'kicd-cbc-2026',
      curriculumVersion: '2026.1',
      gradeLevelId: 'grade-8',
      gradeLevelName: 'Grade 8',
      learningAreaId: 'la-math',
      learningAreaName: 'Mathematics',
      curriculumReferences: [],
      version: 1,
      status: 'validated',
      source: 'human_created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content: {
        id: 'mismatched_fup_1',
        title: 'Algebra Quiz',
        metadata: {
          grade: 'Grade 8',
          subject: 'Mathematics',
          topic: 'Algebra',
          contentType: ContentType.Quiz,
        },
      },
    } as any);

    expect(() =>
      TeacherActionService.linkFollowUpAssessmentToAction({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        followUpArtifactId: 'mismatched_fup_1',
      })
    ).toThrow(/Curriculum mismatch/i);
  });

  // 8. No automatic ELMS publication vs explicit publication
  test('8. Follow-up assessment is NOT auto-published to ELMS until teacher explicitly calls publishFollowUpAssessmentToElms', async () => {
    const plan = createSampleActionPlan();

    const { followUpLink, content } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_elms_test_1',
        title: 'Osmosis Follow-Up Quiz',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    expect(content.metadata?.elmsPublication).toBeUndefined();
    expect(followUpLink.elmsPublicationStatus).toBe('NOT_PUBLISHED');
    expect(ElmsIntegrationService.getPublication(schoolA, 'fup_elms_test_1')).toBeUndefined();

    // Now teacher explicitly publishes to ELMS
    const pubResult = TeacherActionService.publishFollowUpAssessmentToElms({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: 'fup_elms_test_1',
      classGroupId,
    });

    expect(pubResult.followUpLink.elmsPublicationStatus).toBe('ASSIGNED');
    expect(pubResult.publication.status).toBe('PUBLISHED');
    expect(ElmsIntegrationService.getPublication(schoolA, 'fup_elms_test_1')?.elmsResourceId).toBe(
      pubResult.publication.elmsResourceId
    );
  });

  // 9. Original evidence immutability when recording follow-up evidence
  test('9. Recording follow-up evidence creates NEW evidence records and NEVER mutates original ElmsAssessmentEvidenceRecord or interpretation', async () => {
    const normalizeInterp = (interp: any) => {
      const { evaluatedAt, updatedAt, ...rest } = interp;
      return JSON.stringify(rest);
    };

    const originalRecordsBefore = JSON.stringify(
      AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, ecgArtifactId)
    );
    const originalInterpBefore = normalizeInterp(
      LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId,
      })
    );

    const plan = createSampleActionPlan();
    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_immutability_1',
        title: 'Follow-Up Assessment',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    // Reject recording follow-up evidence against the original artifact ID
    expect(() =>
      TeacherActionService.recordFollowUpAssessmentEvidence({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        followUpArtifactId: ecgArtifactId,
        learnerId: 'lrn_lwps_301',
        score: 9,
        maxScore: 10,
      })
    ).toThrow(/Immutability violation/i);

    // Record valid follow-up evidence against followUpArtifactId
    const fupRecord = TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_301',
      score: 8,
      maxScore: 10,
    });

    expect(fupRecord.ecgArtifactId).toBe('fup_immutability_1');
    expect(fupRecord.percentage).toBe(80);

    const originalRecordsAfter = JSON.stringify(
      AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, ecgArtifactId)
    );
    const originalInterpAfter = normalizeInterp(
      LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId,
      })
    );

    expect(originalRecordsAfter).toBe(originalRecordsBefore);
    expect(originalInterpAfter).toBe(originalInterpBefore);
  });

  // 10. Deterministic Before/After Comparison — WHOLE_CLASS scope + Roster-Aware Missing Follow-Up
  test('10. compareActionBeforeAfterEvidence computes accurate WHOLE_CLASS before/after metrics and preserves INSUFFICIENT_EVIDENCE without fabricating 0% for unsubmitted learners', async () => {
    const plan = createSampleActionPlan({ scope: 'WHOLE_CLASS' });

    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_whole_class_1',
        title: 'Whole Class Follow-Up Quiz',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    TeacherActionService.publishFollowUpAssessmentToElms({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      classGroupId,
    });

    // Record follow-up evidence for:
    // - lrn_lwps_301: was 30% (EMERGING), now 70% (DEVELOPING on single attempt) -> IMPROVED (+40%)
    // - lrn_lwps_302: was 40% (EMERGING), does NOT submit follow-up -> AWAITING_FOLLOW_UP (no 0% score fabricated!)
    // - lrn_lwps_303: was 60% (DEVELOPING), submits two corroborating attempts of 80% and 80% -> DEMONSTRATED -> IMPROVED (+20%)
    // - lrn_lwps_304: was INSUFFICIENT_EVIDENCE, now submits 60% (DEVELOPING) -> NEW_EVIDENCE_RECORDED
    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_301',
      score: 7,
      maxScore: 10,
      attemptId: 'att_fup_301_1',
    });

    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_303',
      score: 8,
      maxScore: 10,
      attemptId: 'att_fup_303_1',
    });
    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_303',
      score: 8,
      maxScore: 10,
      attemptId: 'att_fup_303_2',
    });

    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_304',
      score: 6,
      maxScore: 10,
      attemptId: 'att_fup_304_1',
    });

    const comparison = TeacherActionService.compareActionBeforeAfterEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      classGroupId,
    });

    expect(comparison.cohortSummary.totalTargetedLearners).toBe(4);
    expect(comparison.cohortSummary.originalSubmittedCount).toBe(3);
    expect(comparison.cohortSummary.followUpSubmittedCount).toBe(3);
    expect(comparison.cohortSummary.awaitingFollowUpCount).toBe(1);
    expect(comparison.cohortSummary.improvedCount).toBe(2); // 301 and 303
    expect(comparison.cohortSummary.newEvidenceRecordedCount).toBe(1); // 304

    // Check lrn_lwps_301 (EMERGING 30% -> DEVELOPING 70%)
    const c301 = comparison.learnerComparisons.find(l => l.learnerId === 'lrn_lwps_301')!;
    expect(c301.originalPercentage).toBe(30);
    expect(c301.followUpPercentage).toBe(70);
    expect(c301.scoreDeltaPercentage).toBe(40);
    expect(c301.movement).toBe('IMPROVED');

    // Check lrn_lwps_302 (Awaiting follow-up — NO fabricated 0% score!)
    const c302 = comparison.learnerComparisons.find(l => l.learnerId === 'lrn_lwps_302')!;
    expect(c302.originalPercentage).toBe(40);
    expect(c302.followUpStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(c302.followUpPercentage).toBeUndefined();
    expect(c302.followUpScore).toBeUndefined();
    expect(c302.scoreDeltaPercentage).toBeUndefined();
    expect(c302.movement).toBe('AWAITING_FOLLOW_UP');

    // Check lrn_lwps_303 (DEVELOPING 60% -> DEMONSTRATED 80%)
    const c303 = comparison.learnerComparisons.find(l => l.learnerId === 'lrn_lwps_303')!;
    expect(c303.originalStatus).toBe('DEVELOPING');
    expect(c303.followUpStatus).toBe('DEMONSTRATED');
    expect(c303.scoreDeltaPercentage).toBe(20);
    expect(c303.movement).toBe('IMPROVED');

    // Check lrn_lwps_304 (INSUFFICIENT_EVIDENCE -> DEVELOPING 60%)
    const c304 = comparison.learnerComparisons.find(l => l.learnerId === 'lrn_lwps_304')!;
    expect(c304.originalStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(c304.originalPercentage).toBeUndefined();
    expect(c304.followUpStatus).toBe('DEVELOPING');
    expect(c304.followUpPercentage).toBe(60);
    expect(c304.movement).toBe('NEW_EVIDENCE_RECORDED');
  });

  // 11. Scope-Aware Comparison — SELECTED_LEARNERS
  test('11. compareActionBeforeAfterEvidence scopes comparison strictly to selectedLearnerIds when scope is SELECTED_LEARNERS', async () => {
    const plan = createSampleActionPlan({
      actionType: 'SMALL_GROUP_SUPPORT',
      scope: 'SELECTED_LEARNERS',
      selectedLearnerIds: ['lrn_lwps_301', 'lrn_lwps_302'],
    });

    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_small_group_1',
        title: 'Small Group Follow-Up Check',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_301',
      score: 7,
      maxScore: 10,
    });
    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_302',
      score: 6,
      maxScore: 10,
    });

    const comparison = TeacherActionService.compareActionBeforeAfterEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      classGroupId,
    });

    expect(comparison.scope).toBe('SELECTED_LEARNERS');
    expect(comparison.cohortSummary.totalTargetedLearners).toBe(2);
    expect(comparison.learnerComparisons.map(l => l.learnerId)).toEqual(['lrn_lwps_301', 'lrn_lwps_302']);
    expect(comparison.cohortSummary.originalAveragePercentage).toBe(35); // (30 + 40) / 2
    expect(comparison.cohortSummary.followUpAveragePercentage).toBe(65); // (70 + 60) / 2
    expect(comparison.cohortSummary.averageDeltaPercentage).toBe(30);
    expect(comparison.cohortSummary.improvedCount).toBe(2);
  });

  // 12. Scope-Aware Comparison — INDIVIDUAL_LEARNER
  test('12. compareActionBeforeAfterEvidence scopes comparison strictly to learnerId when scope is INDIVIDUAL_LEARNER', async () => {
    const plan = createSampleActionPlan({
      actionType: 'INDIVIDUAL_FOLLOW_UP',
      scope: 'INDIVIDUAL_LEARNER',
      learnerId: 'lrn_lwps_304',
    });

    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_indiv_304',
        title: 'Individual Participation Make-Up Quiz',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_304',
      score: 7,
      maxScore: 10,
    });

    const comparison = TeacherActionService.compareActionBeforeAfterEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      classGroupId,
    });

    expect(comparison.scope).toBe('INDIVIDUAL_LEARNER');
    expect(comparison.cohortSummary.totalTargetedLearners).toBe(1);
    expect(comparison.learnerComparisons).toHaveLength(1);
    expect(comparison.learnerComparisons[0].learnerId).toBe('lrn_lwps_304');
    expect(comparison.learnerComparisons[0].movement).toBe('NEW_EVIDENCE_RECORDED');
  });

  // 13. Regression and No-Change detection
  test('13. Detects REGRESSED and NO_CHANGE movements deterministically based on status rank and score delta', async () => {
    const plan = createSampleActionPlan({
      scope: 'SELECTED_LEARNERS',
      selectedLearnerIds: ['lrn_lwps_302', 'lrn_lwps_303'],
    });

    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_reg_test_1',
        title: 'Follow-Up Check',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    // lrn_lwps_302 was 40% (EMERGING), now scores 40% (EMERGING) -> NO_CHANGE
    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_302',
      score: 4,
      maxScore: 10,
    });

    // lrn_lwps_303 was 60% (DEVELOPING), now scores 30% (EMERGING) -> REGRESSED
    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_303',
      score: 3,
      maxScore: 10,
    });

    const comparison = TeacherActionService.compareActionBeforeAfterEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      classGroupId,
    });

    const c302 = comparison.learnerComparisons.find(l => l.learnerId === 'lrn_lwps_302')!;
    const c303 = comparison.learnerComparisons.find(l => l.learnerId === 'lrn_lwps_303')!;

    expect(c302.movement).toBe('NO_CHANGE');
    expect(c303.movement).toBe('REGRESSED');
    expect(comparison.cohortSummary.noChangeCount).toBe(1);
    expect(comparison.cohortSummary.regressedCount).toBe(1);
  });

  // 14. Teacher Override on Follow-Up Evidence
  test('14. overrideFollowUpLearnerStatus applies teacher judgment with mandatory rationale while preserving raw follow-up scores', async () => {
    const plan = createSampleActionPlan({
      scope: 'INDIVIDUAL_LEARNER',
      learnerId: 'lrn_lwps_301',
    });

    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_override_test_1',
        title: 'Follow-Up Check',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_301',
      score: 8,
      maxScore: 10,
    });

    // Empty rationale must be rejected
    expect(() =>
      TeacherActionService.overrideFollowUpLearnerStatus({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        learnerId: 'lrn_lwps_301',
        newStatus: 'DEMONSTRATED',
        reason: '   ',
      })
    ).toThrow(/mandatory professional rationale/i);

    const updatedComparison = TeacherActionService.overrideFollowUpLearnerStatus({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      learnerId: 'lrn_lwps_301',
      newStatus: 'DEMONSTRATED',
      reason: 'Learner demonstrated accurate practical lab setup alongside the written follow-up quiz.',
    });

    expect(updatedComparison.teacherReviewStatus).toBe('OVERRIDDEN');
    expect(updatedComparison.learnerComparisons[0].followUpStatus).toBe('DEMONSTRATED');
    // Raw follow-up score remains 8/10 (80%)
    expect(updatedComparison.learnerComparisons[0].followUpScore).toBe(8);
    expect(updatedComparison.learnerComparisons[0].followUpPercentage).toBe(80);
  });

  // 15. Explicit Teacher Review Confirmation vs Action Completion
  test('15. Recording evidence or comparing never auto-completes action; teacher explicitly confirms review and optionally completes action', async () => {
    const plan = createSampleActionPlan({
      scope: 'INDIVIDUAL_LEARNER',
      learnerId: 'lrn_lwps_301',
    });

    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_review_confirm_1',
        title: 'Follow-Up Check',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_301',
      score: 8,
      maxScore: 10,
    });

    const compBeforeReview = TeacherActionService.compareActionBeforeAfterEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
    });

    const actionAfterCompare = TeacherActionService.getActionById(plan.actionId, schoolA, teacherA)!;
    expect(actionAfterCompare.status).toBe('IN_PROGRESS');
    expect(actionAfterCompare.followUpReviewStatus).toBe('PENDING_REVIEW');
    expect(compBeforeReview.teacherReviewStatus).toBe('PENDING_REVIEW');

    // Step A: Confirm review without completing action
    const { comparison: reviewedComp, updatedAction: actionAfterReview } =
      TeacherActionService.confirmFollowUpReview({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        teacherReviewNotes: 'Reviewed progress; will monitor next lesson.',
        completeAction: false,
      });

    expect(reviewedComp.teacherReviewStatus).toBe('REVIEWED');
    expect(reviewedComp.reviewedBy).toBe(teacherA);
    expect(actionAfterReview.followUpReviewStatus).toBe('REVIEWED');
    expect(actionAfterReview.status).toBe('IN_PROGRESS');

    // Step B: Explicitly complete action after follow-up review
    const { updatedAction: completedAction } = TeacherActionService.completeActionAfterFollowUpReview({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      teacherReviewNotes: 'Competency demonstrated; closing intervention cycle.',
    });

    expect(completedAction.status).toBe('COMPLETED');
    expect(completedAction.completedBy).toBe(teacherA);
    expect(completedAction.completedAt).toBeDefined();
  });

  // 16. Cross-School Isolation & Unauthorized Access Protection
  test('16. Enforces strict multi-tenant school isolation and teacher role authorization across all Phase 31 operations', async () => {
    const plan = createSampleActionPlan();

    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_sec_test_1',
        title: 'Security Test Follow-Up',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    // Teacher B from School B cannot access School A's action follow-up workflow
    expect(() =>
      TeacherActionService.buildFollowUpAssessmentContext({
        actionId: plan.actionId,
        schoolId: schoolB,
        teacherId: teacherB,
      })
    ).toThrow(/Unauthorized cross-school access/i);

    expect(() =>
      TeacherActionService.compareActionBeforeAfterEvidence({
        actionId: plan.actionId,
        schoolId: schoolB,
        teacherId: teacherB,
      })
    ).toThrow(/Unauthorized cross-school access/i);

    expect(() =>
      TeacherActionService.recordFollowUpAssessmentEvidence({
        actionId: plan.actionId,
        schoolId: schoolB,
        teacherId: teacherB,
        followUpArtifactId: followUpLink.followUpArtifactId,
        learnerId: 'lrn_lwps_301',
        score: 8,
        maxScore: 10,
      })
    ).toThrow(/Unauthorized cross-school access/i);

    // Unauthorized learner in School A cannot invoke teacher follow-up methods
    expect(() =>
      TeacherActionService.compareActionBeforeAfterEvidence({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: unauthorizedLearner,
      })
    ).toThrow(/Unauthorized teacher/i);

    expect(() =>
      TeacherActionService.confirmFollowUpReview({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: unauthorizedLearner,
      })
    ).toThrow(/Unauthorized teacher/i);
  });

  // 17. Learner Privacy & Non-Diagnostic Safeguards in Follow-Up Generation & Comparison
  test('17. Strips learner PII from generated follow-up questions/body and enforces non-diagnostic language in comparison insights', async () => {
    const plan = createSampleActionPlan({
      teacherNotes: 'Contact parent at parent@example.com or 0712345678 regarding remedial check.',
    });

    const { content, followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_privacy_1',
        title: 'Osmosis Follow-Up Quiz',
        body: 'Remedial quiz for Amani Kimani (ADM-301) and lrn_lwps_301.',
        questions: [
          {
            questionType: QuestionType.MultipleChoice,
            questionText: 'How did Amani Kimani (ADM-301) observe osmosis?',
            options: ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'],
            correctOption: 'A',
            correctAnswer: 'A',
            marks: 5,
          },
        ],
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    expect(content.body).not.toContain('Amani Kimani');
    expect(content.body).not.toContain('ADM-301');
    expect(content.body).not.toContain('lrn_lwps_301');
    expect(content.questions?.[0].questionText).not.toContain('Amani Kimani');
    expect(content.questions?.[0].questionText).not.toContain('ADM-301');

    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_301',
      score: 4,
      maxScore: 10,
    });

    const comparison = TeacherActionService.compareActionBeforeAfterEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
    });

    expect(comparison.advisoryInsights.nonDiagnosticNotice).toContain('does not make clinical, cognitive, or diagnostic determinations');
    const combinedText = [
      ...comparison.advisoryInsights.factualObservations,
      ...comparison.advisoryInsights.suggestedNextSteps,
      ...comparison.learnerComparisons.map(l => l.factualObservation),
    ].join(' ');
    expect(combinedText).not.toMatch(/dyslexia|adhd|low iq|incapable|learning disability|clinical deficit/i);
  });

  // 18. Duplicate / Concurrent Follow-Up Generation Lock Protection
  test('18. Blocks duplicate concurrent follow-up generation requests and releases lock on failure', async () => {
    const plan = createSampleActionPlan();

    let resolveFirst!: (value: GeneratedContent) => void;
    const slowGenerator = () =>
      new Promise<GeneratedContent>((resolve) => {
        resolveFirst = resolve;
      });

    const firstCall = TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: slowGenerator,
    });

    await expect(
      TeacherActionService.generateFollowUpAssessmentFromAction({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        generatorFn: async (fs) => ({
          id: 'dup_fup',
          title: 'Dup',
          metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
        }),
      })
    ).rejects.toThrow(/Duplicate generation request blocked/i);

    resolveFirst({
      id: 'first_fup_resolved',
      title: 'Resolved Follow-Up',
      metadata: {
        grade: 'Grade 8',
        subject: 'Integrated Science',
        topic: 'Osmosis',
        contentType: ContentType.Quiz,
      },
    });

    const res = await firstCall;
    expect(res.artifact.id).toBe('first_fup_resolved');
    expect(TeacherActionService.isGenerationInFlight(plan.actionId)).toBe(false);
  });

  // 19. Phase 31.2: Mandatory Authenticated Teacher Identity on Follow-Up Evidence
  test('19. Phase 31.2: recordFollowUpAssessmentEvidence requires mandatory authenticated teacherId and never falls back to SYSTEM evaluator', async () => {
    const plan = createSampleActionPlan();
    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_teacher_id_req_1',
        title: 'Follow-Up Check',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    // Missing / undefined teacherId must be rejected
    expect(() =>
      TeacherActionService.recordFollowUpAssessmentEvidence({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: undefined as any,
        followUpArtifactId: followUpLink.followUpArtifactId,
        learnerId: 'lrn_lwps_301',
        score: 8,
        maxScore: 10,
      })
    ).toThrow(/Mandatory teacher identity required/i);

    // Empty / whitespace teacherId must be rejected
    expect(() =>
      TeacherActionService.recordFollowUpAssessmentEvidence({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: '   ',
        followUpArtifactId: followUpLink.followUpArtifactId,
        learnerId: 'lrn_lwps_301',
        score: 8,
        maxScore: 10,
      })
    ).toThrow(/Mandatory teacher identity required/i);

    // 'system' fallback identity must be rejected for teacher-triggered operation
    expect(() =>
      TeacherActionService.recordFollowUpAssessmentEvidence({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: 'system',
        followUpArtifactId: followUpLink.followUpArtifactId,
        learnerId: 'lrn_lwps_301',
        score: 8,
        maxScore: 10,
      })
    ).toThrow(/Mandatory teacher identity required/i);

    // Valid authenticated teacher records evaluatorType: 'TEACHER' with evaluatorId
    const recorded = TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_301',
      score: 8,
      maxScore: 10,
    });

    expect(recorded.provenance.evaluatorType).toBe('TEACHER');
    expect(recorded.provenance.evaluatorId).toBe(teacherA);
  });

  // 20. Phase 31.2: Provenance Correction & No Synthetic Response Fabrication
  test('20. Phase 31.2: Demo/simulated evidence is stamped with DEMO/SIMULATED provenance (never ELMS/SYNCHRONIZED) and does not fabricate responses', async () => {
    const plan = createSampleActionPlan();
    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_provenance_test_1',
        title: 'Follow-Up Check',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    const fupRecord = TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_301',
      score: 8,
      maxScore: 10,
    });

    expect(fupRecord.provenance.sourceSystem).toBe('DEMO');
    expect(fupRecord.provenance.sourceSystem).not.toBe('ELMS');
    expect(fupRecord.provenance.evidenceOrigin).toBe('SIMULATED');
    expect(fupRecord.status).toBe('RECORDED');
    expect(fupRecord.status).not.toBe('SYNCHRONIZED');
    expect(fupRecord.responses).toEqual([]);

    // Simulated sample ELMS event also stamps DEMO/SIMULATED provenance
    ElmsIntegrationService.mapLearner({
      schoolId: schoolA,
      ecgLearnerId: 'lrn_lwps_301',
      elmsLearnerId: 'elms_u_lrn_lwps_301',
      requestingUserId: teacherA,
    });

    ElmsIntegrationService.ingestLearningEvent({
      eventId: 'evt_sim_test_20',
      sourceSystem: 'DEMO',
      eventType: 'ASSESSMENT_SUBMITTED',
      schoolId: schoolA,
      learnerId: 'elms_u_lrn_lwps_301',
      resourceId: followUpLink.followUpArtifactId,
      ecgArtifactId: followUpLink.followUpArtifactId,
      timestamp: new Date().toISOString(),
      eventVersion: '1.0',
      payloadVersion: '1.0',
      idempotencyKey: 'idemp_sim_test_20',
      payload: {
        assessmentId: followUpLink.followUpArtifactId,
        attemptId: 'att_sim_test_20',
        learnerId: 'elms_u_lrn_lwps_301',
        isSimulated: true,
        evidenceOrigin: 'SIMULATED',
        responses: [{ itemId: 'item_1', response: 'A' }],
      },
    });

    const simRec = AssessmentEvidenceService.getElmsEvidenceRecords(
      schoolA,
      followUpLink.followUpArtifactId
    ).find(r => r.attemptId === 'att_sim_test_20')!;

    expect(simRec).toBeDefined();
    expect(simRec.provenance.sourceSystem).toBe('DEMO');
    expect(simRec.provenance.evidenceOrigin).toBe('SIMULATED');
    expect(simRec.status).toBe('RECORDED');
  });

  // 21. Phase 31.2: Service-Level Production Guard Blocks All Simulation Controls
  test('21. Phase 31.2: Service-level production guard rejects synthetic follow-up evidence, Quick Follow-Up generatorFn, and simulated ELMS events in production', async () => {
    const plan = createSampleActionPlan();
    const { followUpLink } = await TeacherActionService.generateFollowUpAssessmentFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'fup_prod_guard_1',
        title: 'Follow-Up Check',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
      }),
    });

    // Enable Production Mode
    TeacherActionService.setProductionMode(true);
    expect(TeacherActionService.isProductionMode()).toBe(true);
    expect(TeacherActionService.isDemoSimulationAllowed()).toBe(false);

    // 1. Record Demo Follow-Up Evidence is blocked in production
    expect(() =>
      TeacherActionService.recordFollowUpAssessmentEvidence({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        followUpArtifactId: followUpLink.followUpArtifactId,
        learnerId: 'lrn_lwps_301',
        score: 8,
        maxScore: 10,
      })
    ).toThrow(/Production security guard/i);

    // 2. Quick Follow-Up Check (synthetic generatorFn injection) is blocked in production
    await expect(
      TeacherActionService.generateFollowUpAssessmentFromAction({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        generatorFn: async (fs) => ({
          id: 'fup_prod_blocked_gen',
          title: 'Synthetic Follow-Up',
          metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: ContentType.Quiz },
        }),
      })
    ).rejects.toThrow(/Production security guard/i);

    // 3. Simulate Sample ELMS Submissions is blocked in production
    expect(() =>
      ElmsIntegrationService.ingestLearningEvent({
        eventId: 'evt_sim_prod_blocked_1',
        sourceSystem: 'DEMO',
        eventType: 'ASSESSMENT_SUBMITTED',
        schoolId: schoolA,
        learnerId: 'lrn_lwps_301',
        resourceId: followUpLink.followUpArtifactId,
        ecgArtifactId: followUpLink.followUpArtifactId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
        payloadVersion: '1.0',
        idempotencyKey: 'idemp_sim_prod_blocked_1',
        payload: {
          assessmentId: followUpLink.followUpArtifactId,
          attemptId: 'att_sim_prod_blocked_1',
          learnerId: 'lrn_lwps_301',
          isSimulated: true,
          responses: [{ itemId: 'item_1', response: 'A' }],
        },
      })
    ).toThrow(/Production security guard/i);

    // 4. Direct AssessmentEvidenceService.recordElmsEvidenceRecord with DEMO/SIMULATED provenance is blocked in production
    expect(() =>
      AssessmentEvidenceService.recordElmsEvidenceRecord({
        evidenceRecordId: 'elms_evd_sim_direct_1',
        schoolId: schoolA,
        ecgArtifactId: followUpLink.followUpArtifactId,
        elmsResourceId: 'elms_res_1',
        assessmentId: followUpLink.followUpAssessmentId!,
        attemptId: 'att_sim_direct_1',
        learnerId: 'lrn_lwps_301',
        curriculumVersionId: '2026.1',
        learningOutcomeId: 'KICD-G8-SCI-2.1',
        score: 8,
        maxScore: 10,
        percentage: 80,
        status: 'RECORDED',
        responses: [],
        submittedAt: new Date().toISOString(),
        evaluatedAt: new Date().toISOString(),
        provenance: {
          sourceSystem: 'DEMO',
          evidenceOrigin: 'SIMULATED',
          evaluatorType: 'TEACHER',
          evaluatorId: teacherA,
        },
      })
    ).toThrow(/Production security guard/i);

    // Confirm zero follow-up evidence records entered the store
    expect(
      AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, followUpLink.followUpArtifactId)
    ).toHaveLength(0);
  });

  // 22. Phase 31.2: Legitimate Real ELMS Follow-Up Workflow Preserved in Production & Demo Evidence Isolated
  test('22. Phase 31.2: Preserves real ELMS follow-up ingestion and Before/After comparison in production while isolating demo evidence', async () => {
    const plan = createSampleActionPlan({
      scope: 'SELECTED_LEARNERS',
      selectedLearnerIds: ['lrn_lwps_301', 'lrn_lwps_302'],
    });

    // Save a curriculum-aligned follow-up assessment artifact and link it
    ContentArtifactRepository.save({
      id: 'real_prod_fup_quiz_1',
      schoolId: schoolA,
      artifactType: 'assessment',
      curriculumId: 'kicd-cbc-2026',
      curriculumVersion: '2026.1',
      gradeLevelId: 'grade-8',
      gradeLevelName: 'Grade 8',
      learningAreaId: 'la-sci',
      learningAreaName: 'Integrated Science',
      term: 'Term 1',
      weekNumber: 3,
      lessonNumber: 2,
      curriculumReferences: [
        {
          gradeLevelId: 'grade-8',
          learningAreaId: 'la-sci',
          strandId: 'Living Things and Their Environment',
          subStrandId: 'Movement of Materials In and Out of the Cell',
          learningOutcomeIds: ['KICD-G8-SCI-2.1'],
        },
      ],
      version: 1,
      status: 'validated',
      source: 'ai_generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content: {
        id: 'real_prod_fup_quiz_1',
        title: 'Osmosis Authoritative Follow-Up Quiz',
        questions: [
          {
            questionType: QuestionType.MultipleChoice,
            questionText: 'What is osmosis?',
            options: ['A) Movement of water across semi-permeable membrane', 'B) Diffusion of gas', 'C) Active transport', 'D) Transpiration'],
            correctOption: 'A',
            correctAnswer: 'A',
            marks: 5,
          },
          {
            questionType: QuestionType.MultipleChoice,
            questionText: 'Which cell structure is semi-permeable?',
            options: ['A) Cell wall', 'B) Cell membrane', 'C) Vacuole', 'D) Nucleus'],
            correctOption: 'B',
            correctAnswer: 'B',
            marks: 5,
          },
        ],
        metadata: {
          grade: 'Grade 8',
          subject: 'Integrated Science',
          topic: 'Living Things and Their Environment - Movement of Materials In and Out of the Cell',
          contentType: ContentType.Quiz,
          strand: 'Living Things and Their Environment',
          subStrand: 'Movement of Materials In and Out of the Cell',
        },
      },
    } as any);

    // Record a demo/simulated record while in dev/test mode for lrn_lwps_302
    const linked = TeacherActionService.linkFollowUpAssessmentToAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: 'real_prod_fup_quiz_1',
    });

    TeacherActionService.recordFollowUpAssessmentEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: linked.followUpLink.followUpArtifactId,
      learnerId: 'lrn_lwps_302',
      score: 9,
      maxScore: 10,
    });

    // Now switch to Production Mode
    TeacherActionService.setProductionMode(true);

    // Publish follow-up assessment to ELMS in production
    TeacherActionService.publishFollowUpAssessmentToElms({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: 'real_prod_fup_quiz_1',
      classGroupId,
    });

    // Ingest real ELMS submission for lrn_lwps_301 (100% score) in production
    const realItems = linked.followUpAssessment.items;
    const ingestRes = ElmsIntegrationService.ingestLearningEvent({
      eventId: 'evt_real_elms_prod_301',
      sourceSystem: 'ELMS',
      eventType: 'ASSESSMENT_SUBMITTED',
      schoolId: schoolA,
      learnerId: 'lrn_lwps_301',
      classGroupId,
      resourceId: 'real_prod_fup_quiz_1',
      ecgArtifactId: 'real_prod_fup_quiz_1',
      timestamp: new Date().toISOString(),
      eventVersion: '1.0',
      payloadVersion: '1.0',
      idempotencyKey: 'idemp_real_elms_prod_301',
      payload: {
        assessmentId: linked.followUpAssessment.assessmentId,
        attemptId: 'att_real_elms_prod_301',
        learnerId: 'lrn_lwps_301',
        responses: [
          { itemId: realItems[0].itemId, response: 'A' },
          { itemId: realItems[1].itemId, response: 'B' },
        ],
      },
    });

    expect(ingestRes.event.status).toBe('PROCESSED');

    // Verify authoritative ELMS evidence record in production
    const prodRecords = AssessmentEvidenceService.getElmsEvidenceRecords(schoolA, 'real_prod_fup_quiz_1');
    expect(prodRecords).toHaveLength(1);
    expect(prodRecords[0].learnerId).toBe('lrn_lwps_301');
    expect(prodRecords[0].provenance.sourceSystem).toBe('ELMS');
    expect(prodRecords[0].provenance.evidenceOrigin).toBe('AUTHORITATIVE_ELMS');
    expect(prodRecords[0].status).toBe('SYNCHRONIZED');
    expect(prodRecords[0].percentage).toBe(100);

    // Compare Before/After in production: lrn_lwps_301 has real evidence (100%), while lrn_lwps_302's demo evidence is isolated/excluded
    const comparison = TeacherActionService.compareActionBeforeAfterEvidence({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      followUpArtifactId: 'real_prod_fup_quiz_1',
      classGroupId,
    });

    const c301 = comparison.learnerComparisons.find(l => l.learnerId === 'lrn_lwps_301')!;
    const c302 = comparison.learnerComparisons.find(l => l.learnerId === 'lrn_lwps_302')!;

    expect(c301.followUpPercentage).toBe(100);
    expect(c301.movement).toBe('IMPROVED');

    // lrn_lwps_302's pre-existing DEMO evidence is NOT counted as authoritative in production
    expect(c302.followUpPercentage).toBeUndefined();
    expect(c302.followUpStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(c302.movement).toBe('AWAITING_FOLLOW_UP');
  });
});
