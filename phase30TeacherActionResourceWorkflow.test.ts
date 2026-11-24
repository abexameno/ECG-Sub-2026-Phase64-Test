import { TeacherActionService } from './services/teacherActionService';
import { LearningOutcomeInterpretationService } from './services/learningOutcomeInterpretationService';
import { AssessmentEvidenceService } from './services/assessmentEvidenceService';
import { SchoolMembershipService } from './services/schoolMembershipService';
import { SchoolConfigService } from './services/schoolConfigService';
import { LearnerRosterService } from './services/learnerRosterService';
import { ClassGroupService } from './services/classGroupService';
import { ContentArtifactRepository } from './services/contentArtifactRepository';
import { ElmsIntegrationService } from './services/elmsIntegrationService';
import { ContentType, GeneratedContent, QuestionDifficulty, QuestionType } from './types';

describe('Phase 30: Teacher Action -> Learning Resource & Follow-Up Workflow', () => {
  const schoolA = 'lwps';
  const schoolB = 'other_school';
  const teacherA = 't_lwps_1';
  const teacherB = 't_other_1';
  const unauthorizedLearner = 'std_lwps_g8_1';

  const masterSowId = 'sow_master_g8_sci_t1';
  const parentLessonPlanId = 'lp_g8_sci_w3_l2';
  const curriculumLessonId = 'kicd_g8_sci_t1_str1_ss2_l2';
  const scheduledLessonId = 'sched_lwps_g8_sci_w3_l2';
  const ecgArtifactId = 'ecg_assess_phase30_1';
  const elmsAssessmentId = 'elms_assess_phase30_1';
  let classGroupId = 'cg_lwps_g3a';
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

    ClassGroupService.createClassGroup({
      id: classGroupId,
      name: 'Grade 8A',
      schoolId: schoolA,
      academicYearId: 'ay_lwps_2026',
    });

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
      content: {
        id: ecgArtifactId,
        title: 'Osmosis Assessment',
        metadata: {
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

    AssessmentEvidenceService.createAssessment({
      schoolId: schoolA,
      curriculumVersionId: '2026.1',
      learningOutcomeId: 'KICD-G8-SCI-2.1',
      title: 'Osmosis Assessment',
      contentArtifactId: ecgArtifactId,
      items: [
        { prompt: 'Explain how osmosis occurs across a semi-permeable membrane in plant cells.', marks: 5, correctAnswer: 'Water moves from high to low water potential.' },
        { prompt: 'Identify the role of root hair cells in water absorption.', marks: 5, correctAnswer: 'Absorb water and mineral salts.' },
      ],
    });

    ElmsIntegrationService.publishResource({
      schoolId: schoolA,
      teacherId: teacherA,
      ecgArtifactId,
      classGroupId,
    });

    const reviewed = LearningOutcomeInterpretationService.confirmAssessmentReview({
      ecgArtifactId,
      schoolId: schoolA,
      teacherId: teacherA,
      classGroupId,
    });
    sourceInterpretationId = reviewed.interpretationId;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createSampleActionPlan = (
    overrides: Partial<Parameters<typeof TeacherActionService.createActionPlan>[0]> = {}
  ) => {
    return TeacherActionService.createActionPlan({
      schoolId: schoolA,
      teacherId: teacherA,
      ecgArtifactId,
      assessmentId: elmsAssessmentId,
      actionType: 'REMEDIAL_SUPPORT',
      scope: 'WHOLE_CLASS',
      focusArea: 'Osmosis in plant cells and water movement across semi-permeable membranes',
      teacherNotes: 'Use visual diagrams of hypotonic and hypertonic solutions with step-by-step worked examples.',
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
        week: '3',
        lesson: '2',
        strand: 'Living Things and Their Environment',
        subStrand: 'Movement of Materials In and Out of the Cell',
        learningOutcomeId: 'KICD-G8-SCI-2.1',
        learningOutcomes: 'Demonstrate osmosis in living tissues and explain its role in plants.',
      },
      ...overrides,
    });
  };

  // 1. Teacher action to resource context mapping
  test('1. Maps teacher action types to existing ECG ContentTypes and rejects NO_ACTION_REQUIRED', () => {
    expect(TeacherActionService.getDefaultContentTypeForAction('REMEDIAL_SUPPORT')).toBe(ContentType.LessonNotes);
    expect(TeacherActionService.getDefaultContentTypeForAction('SMALL_GROUP_SUPPORT')).toBe(ContentType.LessonNotes);
    expect(TeacherActionService.getDefaultContentTypeForAction('DIFFERENTIATED_PRACTICE')).toBe(ContentType.LessonNotes);
    expect(TeacherActionService.getDefaultContentTypeForAction('GUIDED_PRACTICE')).toBe(ContentType.LessonNotes);
    expect(TeacherActionService.getDefaultContentTypeForAction('PEER_SUPPORTED_PRACTICE')).toBe(ContentType.LessonNotes);
    expect(TeacherActionService.getDefaultContentTypeForAction('INDIVIDUAL_FOLLOW_UP')).toBe(ContentType.StudyGuide);
    expect(TeacherActionService.getDefaultContentTypeForAction('EXTENSION_CHALLENGE')).toBe(ContentType.Assessment);
    expect(TeacherActionService.getDefaultContentTypeForAction('RETEACHING')).toBe(ContentType.LessonPlan);
    expect(TeacherActionService.getDefaultContentTypeForAction('FURTHER_ASSESSMENT')).toBe(ContentType.Quiz);
    expect(TeacherActionService.getDefaultContentTypeForAction('OTHER')).toBe(ContentType.LessonNotes);
    expect(TeacherActionService.getDefaultContentTypeForAction('NO_ACTION_REQUIRED')).toBeNull();

    const noActionPlan = createSampleActionPlan({ actionType: 'NO_ACTION_REQUIRED' });
    expect(() =>
      TeacherActionService.buildResourceCreationContext({
        actionId: noActionPlan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
      })
    ).toThrow(/NO_ACTION_REQUIRED/);
  });

  // 2. Curriculum lock enforcement
  test('2. Enforces authoritative curriculum lock while permitting pedagogical parameter customization', () => {
    const plan = createSampleActionPlan({ actionType: 'REMEDIAL_SUPPORT' });
    const formState = TeacherActionService.buildResourceCreationContext({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
    });

    // Allowed edits: difficulty, totalQuestions, additionalInformation, contentType
    const customizedForm = {
      ...formState,
      contentType: ContentType.Quiz,
      difficulty: QuestionDifficulty.Easy,
      totalQuestions: 12,
      additionalInformation: `${formState.additionalInformation}\nInclude 3 real-world farming examples.`,
    };
    expect(() => TeacherActionService.validateCurriculumLock(plan, customizedForm)).not.toThrow();

    // Forbidden edits: grade, subject, term, week, lessonNumber
    expect(() =>
      TeacherActionService.validateCurriculumLock(plan, { ...formState, grade: 'Grade 9' })
    ).toThrow(/Curriculum lock violation: grade/);

    expect(() =>
      TeacherActionService.validateCurriculumLock(plan, { ...formState, subject: 'Mathematics' })
    ).toThrow(/Curriculum lock violation: subject/);

    expect(() =>
      TeacherActionService.validateCurriculumLock(plan, { ...formState, term: 'Term 3' })
    ).toThrow(/Curriculum lock violation: term/);

    expect(() =>
      TeacherActionService.validateCurriculumLock(plan, { ...formState, week: '9' })
    ).toThrow(/Curriculum lock violation: week/);

    expect(() =>
      TeacherActionService.validateCurriculumLock(plan, { ...formState, lessonNumber: '5' })
    ).toThrow(/Curriculum lock violation: lesson/);
  });

  // 3. No curriculum invention
  test('3. Preserves canonical KICD curriculum context without inventing strands or outcomes', () => {
    const plan = createSampleActionPlan();
    const formState = TeacherActionService.buildResourceCreationContext({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
    });

    expect(formState.grade).toBe('Grade 8');
    expect(formState.subject).toBe('Integrated Science');
    expect(formState.term).toBe('Term 1');
    expect(formState.week).toBe('3');
    expect(formState.lessonNumber).toBe('2');
    expect(formState.teacherActionContext?.strand).toBe('Living Things and Their Environment');
    expect(formState.teacherActionContext?.subStrand).toBe('Movement of Materials In and Out of the Cell');
    expect(formState.teacherActionContext?.learningOutcomes).toContain('Demonstrate osmosis');
    expect(formState.strictCurriculumAdherence).toBe(true);
  });

  // 4. No learner PII in generation prompt
  test('4. Strips and blocks learner PII (names, admission numbers, IDs, emails) from generation prompts', () => {
    const roster = LearnerRosterService.getLearnersBySchool(schoolA);
    const sampleLearner = roster[0];

    const planWithIndividualScope = createSampleActionPlan({
      actionType: 'INDIVIDUAL_FOLLOW_UP',
      scope: 'INDIVIDUAL_LEARNER',
      learnerId: sampleLearner?.id || 'lrn_lwps_301',
      selectedLearnerIds: [sampleLearner?.id || 'lrn_lwps_301'],
      teacherNotes: 'Follow up on osmosis concepts. Contact parent at parent@example.com or +254712345678.',
    });

    const formState = TeacherActionService.buildResourceCreationContext({
      actionId: planWithIndividualScope.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
    });

    const combinedPromptText = `${formState.topic}\n${formState.additionalInformation}`;
    expect(combinedPromptText).not.toContain('parent@example.com');
    expect(combinedPromptText).not.toContain('+254712345678');
    if (sampleLearner) {
      expect(combinedPromptText).not.toContain(sampleLearner.displayName);
      expect(combinedPromptText).not.toContain(sampleLearner.id);
      if (sampleLearner.learnerIdentifier) {
        expect(combinedPromptText).not.toContain(sampleLearner.learnerIdentifier);
      }
    }

    // Also verify assertNoLearnerPii rejects direct injection of roster learner name/ID
    if (sampleLearner) {
      expect(() =>
        TeacherActionService.assertNoLearnerPii(schoolA, `Remedial worksheet for ${sampleLearner.displayName}`)
      ).toThrow(/Privacy violation/);
    }
  });

  // 5. Resource generation from remedial action
  test('5. Generates supporting LessonNotes from REMEDIAL_SUPPORT action only upon explicit teacher request', async () => {
    const plan = createSampleActionPlan({ actionType: 'REMEDIAL_SUPPORT' });

    // Before explicit generation, zero resources exist
    expect(plan.linkedResources).toHaveLength(0);

    const { content, artifact, updatedAction } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'gen_remedial_1',
        title: `Remedial Notes: ${fs.teacherActionContext?.subStrand}`,
        body: '# Osmosis Remedial Notes\nStep-by-step explanation of water movement.',
        metadata: {
          grade: fs.grade,
          subject: fs.subject,
          topic: fs.topic,
          contentType: fs.contentType,
          teacherActionId: fs.teacherActionId,
          sourceTeacherActionId: fs.sourceTeacherActionId,
          sourceInterpretationId: fs.sourceInterpretationId,
          ecgArtifactId: fs.ecgArtifactId,
          masterSowId: fs.masterSowId,
          curriculumLessonId: fs.curriculumLessonId,
          scheduledLessonId: fs.scheduledLessonId,
        },
      }),
    });

    expect(content.metadata.contentType).toBe(ContentType.LessonNotes);
    expect(artifact.contentType).toBe('learner_content');
    expect(updatedAction.linkedResources).toHaveLength(1);
    expect(updatedAction.linkedResources?.[0].artifactId).toBe(content.id);
  });

  // 6. Resource generation from re-teaching action
  test('6. Generates LessonPlan from RETEACHING action with full SOW and lesson lineage preserved', async () => {
    const plan = createSampleActionPlan({ actionType: 'RETEACHING' });

    const { content, artifact } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'gen_reteach_lp_1',
        title: 'Re-teaching Lesson Plan: Osmosis',
        body: '## Strand: Living Things\n## Sub-strand: Osmosis',
        metadata: {
          grade: fs.grade,
          subject: fs.subject,
          topic: fs.topic,
          contentType: fs.contentType,
        },
      }),
    });

    expect(content.metadata.contentType).toBe(ContentType.LessonPlan);
    expect(artifact.contentType).toBe('lesson_plan');
    expect(content.metadata.masterSowId).toBe(masterSowId);
    expect(content.metadata.curriculumLessonId).toBe(curriculumLessonId);
    expect(content.metadata.scheduledLessonId).toBe(scheduledLessonId);
    expect(artifact.masterSowId).toBe(masterSowId);
    expect(artifact.curriculumLessonId).toBe(curriculumLessonId);
    expect(artifact.scheduledLessonId).toBe(scheduledLessonId);
  });

  // 7. Resource generation from extension action
  test('7. Generates challenging resource from EXTENSION_CHALLENGE action with Hard default difficulty', async () => {
    const plan = createSampleActionPlan({
      actionType: 'EXTENSION_CHALLENGE',
      scope: 'SELECTED_LEARNERS',
      focusArea: 'Quantitative analysis of osmotic potential in plant tissues',
    });

    const formState = TeacherActionService.buildResourceCreationContext({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
    });
    expect(formState.difficulty).toBe(QuestionDifficulty.Hard);

    const { content } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'gen_ext_1',
        title: 'Extension Challenge: Osmotic Potential',
        questions: [
          {
            question: 'Analyze the turgor pressure changes in cells placed in 0.8M sucrose solution.',
            questionType: QuestionType.ShortAnswer,
            answer: 'Cells lose water by osmosis and become plasmolysed.',
            marks: 4,
          },
        ],
        metadata: {
          grade: fs.grade,
          subject: fs.subject,
          topic: fs.topic,
          contentType: fs.contentType,
          difficulty: fs.difficulty,
        },
      }),
    });

    expect(content.metadata.difficulty).toBe(QuestionDifficulty.Hard);
    expect(content.metadata.teacherActionId).toBe(plan.actionId);
  });

  // 8. Resource generation from further assessment action
  test('8. Generates follow-up Quiz from FURTHER_ASSESSMENT action', async () => {
    const plan = createSampleActionPlan({ actionType: 'FURTHER_ASSESSMENT' });

    const { content, artifact } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'gen_followup_quiz_1',
        title: 'Follow-Up Quiz: Osmosis',
        questions: [
          {
            question: 'Which membrane is selectively permeable in a plant cell?',
            questionType: QuestionType.MultipleChoice,
            options: ['Cell wall', 'Cell membrane', 'Cytoplasm', 'Vacuole'],
            answer: 'Cell membrane',
            marks: 1,
          },
        ],
        metadata: {
          grade: fs.grade,
          subject: fs.subject,
          topic: fs.topic,
          contentType: fs.contentType,
        },
      }),
    });

    expect(content.metadata.contentType).toBe(ContentType.Quiz);
    expect(artifact.contentType).toBe('assessment');
  });

  // 9. Resource linkage to teacherActionId
  test('9. Bi-directionally links generated resource to TeacherActionPlan and preserves full lineage', async () => {
    const plan = createSampleActionPlan();

    const { content, artifact, updatedAction } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'gen_linked_res_9',
        title: 'Osmosis Guided Practice Notes',
        body: 'Guided practice content.',
        metadata: {
          grade: fs.grade,
          subject: fs.subject,
          topic: fs.topic,
          contentType: fs.contentType,
        },
      }),
    });

    expect(content.metadata.teacherActionId).toBe(plan.actionId);
    expect(content.metadata.sourceTeacherActionId).toBe(plan.actionId);
    expect(content.metadata.sourceInterpretationId).toBe(sourceInterpretationId);
    expect(content.metadata.ecgArtifactId).toBe(ecgArtifactId);

    expect(artifact.teacherActionId).toBe(plan.actionId);
    expect(artifact.sourceInterpretationId).toBe(sourceInterpretationId);
    expect(artifact.ecgArtifactId).toBe(ecgArtifactId);

    expect(updatedAction.resultArtifactId).toBe('gen_linked_res_9');
    expect(updatedAction.linkedResources).toHaveLength(1);
    expect(updatedAction.linkedResources?.[0]).toMatchObject({
      artifactId: 'gen_linked_res_9',
      contentType: ContentType.LessonNotes,
      title: 'Osmosis Guided Practice Notes',
      createdBy: teacherA,
      sourceInterpretationId,
      ecgArtifactId,
    });
  });

  // 10. Multiple resources per action
  test('10. Supports multiple linked resources per TeacherActionPlan without overwriting prior links', async () => {
    const plan = createSampleActionPlan();

    await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      preferredContentType: ContentType.LessonNotes,
      generatorFn: async (fs) => ({
        id: 'res_multi_1',
        title: 'Part 1: Remedial Notes',
        body: 'Notes content',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: fs.contentType },
      }),
    });

    const second = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      preferredContentType: ContentType.Quiz,
      generatorFn: async (fs) => ({
        id: 'res_multi_2',
        title: 'Part 2: Follow-up Practice Quiz',
        questions: [],
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: fs.contentType },
      }),
    });

    expect(second.updatedAction.linkedResources).toHaveLength(2);
    expect(second.updatedAction.linkedResources?.map((r) => r.artifactId)).toEqual(['res_multi_1', 'res_multi_2']);

    const resources = TeacherActionService.getResourcesForAction(plan.actionId, schoolA, teacherA);
    expect(resources.links).toHaveLength(2);
    expect(resources.artifacts).toHaveLength(2);
    expect(resources.libraryItems).toHaveLength(2);
  });

  // 11. Action status preserved (PLANNED -> IN_PROGRESS, never auto-COMPLETED)
  test('11. Transitions action status to IN_PROGRESS upon resource creation and never auto-completes', async () => {
    const plan = createSampleActionPlan();
    TeacherActionService.updateActionStatus({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      newStatus: 'PLANNED',
    });

    const { updatedAction } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'res_status_check',
        title: 'Supporting Notes',
        body: 'Content',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: fs.contentType },
      }),
    });

    expect(updatedAction.status).toBe('IN_PROGRESS');
    expect(updatedAction.status).not.toBe('COMPLETED');
    expect(updatedAction.completedAt).toBeUndefined();

    // Teacher explicitly marks completed later
    const completed = TeacherActionService.updateActionStatus({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      newStatus: 'COMPLETED',
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).toBeDefined();
  });

  // 12. Generation failure safety
  test('12. Preserves action plan state and records no partial links when generation fails', async () => {
    const plan = createSampleActionPlan();
    TeacherActionService.updateActionStatus({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      newStatus: 'PLANNED',
    });

    await expect(
      TeacherActionService.generateSupportingResourceFromAction({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        generatorFn: async () => {
          throw new Error('Simulated upstream Gemini API timeout');
        },
      })
    ).rejects.toThrow('Simulated upstream Gemini API timeout');

    const afterFailure = TeacherActionService.getActionById(plan.actionId, schoolA, teacherA);
    expect(afterFailure?.status).toBe('PLANNED');
    expect(afterFailure?.linkedResources).toHaveLength(0);
    expect(afterFailure?.resultArtifactId).toBeUndefined();
    expect(TeacherActionService.isGenerationInFlight(plan.actionId)).toBe(false);
  });

  // 13. Duplicate-click protection
  test('13. Blocks concurrent duplicate resource generation requests for the same TeacherActionPlan', async () => {
    const plan = createSampleActionPlan();

    let resolveFirst!: (val: GeneratedContent) => void;
    const slowGenerator = jest.fn(
      (fs) =>
        new Promise<GeneratedContent>((resolve) => {
          resolveFirst = () =>
            resolve({
              id: 'res_dedup_1',
              title: 'First Generation',
              body: 'Body',
              metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: fs.contentType },
            });
        })
    );

    const firstPromise = TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: slowGenerator,
    });

    expect(TeacherActionService.isGenerationInFlight(plan.actionId)).toBe(true);

    await expect(
      TeacherActionService.generateSupportingResourceFromAction({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
        generatorFn: slowGenerator,
      })
    ).rejects.toThrow(/Duplicate generation request blocked/);

    resolveFirst({} as any);
    const firstResult = await firstPromise;
    expect(firstResult.content.id).toBe('res_dedup_1');
    expect(TeacherActionService.isGenerationInFlight(plan.actionId)).toBe(false);
  });

  // 14. Cross-school isolation
  test('14. Enforces strict school isolation for action context, generation, and resource queries', async () => {
    const planA = createSampleActionPlan();

    expect(() =>
      TeacherActionService.buildResourceCreationContext({
        actionId: planA.actionId,
        schoolId: schoolB,
        teacherId: teacherB,
      })
    ).toThrow(/cross-school/i);

    await expect(
      TeacherActionService.generateSupportingResourceFromAction({
        actionId: planA.actionId,
        schoolId: schoolB,
        teacherId: teacherB,
      })
    ).rejects.toThrow(/cross-school/i);

    expect(() =>
      TeacherActionService.getResourcesForAction(planA.actionId, schoolB, teacherB)
    ).toThrow(/cross-school/i);
  });

  // 15. Unauthorized user rejection
  test('15. Rejects learner or unauthorized accounts from initiating or reading action resources', async () => {
    const plan = createSampleActionPlan();

    expect(() =>
      TeacherActionService.buildResourceCreationContext({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: unauthorizedLearner,
      })
    ).toThrow(/Unauthorized teacher/);

    await expect(
      TeacherActionService.generateSupportingResourceFromAction({
        actionId: plan.actionId,
        schoolId: schoolA,
        teacherId: unauthorizedLearner,
      })
    ).rejects.toThrow(/Unauthorized teacher/);

    expect(() =>
      TeacherActionService.getResourcesForAction(plan.actionId, schoolA, unauthorizedLearner)
    ).toThrow(/Unauthorized teacher/);
  });

  // 16. Cancelled / Completed action restriction
  test('16. Blocks resource creation from CANCELLED, REJECTED, or COMPLETED teacher actions', async () => {
    const cancelledPlan = createSampleActionPlan();
    TeacherActionService.updateActionStatus({
      actionId: cancelledPlan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      newStatus: 'CANCELLED',
    });

    expect(() =>
      TeacherActionService.buildResourceCreationContext({
        actionId: cancelledPlan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
      })
    ).toThrow(/Cannot create a supporting resource for a CANCELLED teacher action plan/);

    const completedPlan = createSampleActionPlan();
    TeacherActionService.updateActionStatus({
      actionId: completedPlan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      newStatus: 'COMPLETED',
    });

    await expect(
      TeacherActionService.generateSupportingResourceFromAction({
        actionId: completedPlan.actionId,
        schoolId: schoolA,
        teacherId: teacherA,
      })
    ).rejects.toThrow(/Cannot create a supporting resource for a COMPLETED teacher action plan/);
  });

  // 17. Original evidence / interpretation immutability
  test('17. Does not mutate original AssessmentEvidence or LO-MASTERY-V1 interpretation when generating resources', async () => {
    const normalizeInterp = (interp: any) => {
      const { evaluatedAt, updatedAt, ...rest } = interp;
      return JSON.stringify(rest);
    };

    const beforeEvidence = JSON.stringify(
      AssessmentEvidenceService.getEvidenceByArtifactId(ecgArtifactId, schoolA)
    );
    const beforeInterp = normalizeInterp(
      LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId,
      })
    );

    const plan = createSampleActionPlan();
    await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'res_immutability_1',
        title: 'Remedial Support Resource',
        body: 'Remedial content.',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: fs.contentType },
      }),
    });

    const afterEvidence = JSON.stringify(
      AssessmentEvidenceService.getEvidenceByArtifactId(ecgArtifactId, schoolA)
    );
    const afterInterp = normalizeInterp(
      LearningOutcomeInterpretationService.interpretAssessmentEvidence({
        ecgArtifactId,
        schoolId: schoolA,
        requestingTeacherId: teacherA,
        classGroupId,
      })
    );

    expect(afterEvidence).toBe(beforeEvidence);
    expect(afterInterp).toBe(beforeInterp);
  });

  // 18. No automatic ELMS publication or assignment
  test('18. Does not automatically publish generated Quiz/Assessment to ELMS or assign to learners', async () => {
    const plan = createSampleActionPlan({ actionType: 'FURTHER_ASSESSMENT' });

    const { content } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      preferredContentType: ContentType.Quiz,
      generatorFn: async (fs) => ({
        id: 'res_no_autopub_1',
        title: 'Follow-Up Quiz',
        questions: [],
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: fs.contentType },
      }),
    });

    expect(content.metadata.elmsPublicationStatus).toBeUndefined();
    expect(content.metadata.elmsAssessmentId).toBeUndefined();
    expect(content.metadata.publishedAt).toBeUndefined();
  });

  // 19. Teacher Library persistence
  test('19. Saves generated supporting resources to Teacher Library and ContentArtifactRepository with lineage', async () => {
    const plan = createSampleActionPlan();

    const { content } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'res_lib_19',
        title: 'Saved Remedial Notes',
        body: 'Saved body',
        metadata: { grade: fs.grade, subject: fs.subject, topic: fs.topic, contentType: fs.contentType },
      }),
    });

    const libraryItems = TeacherActionService.getTeacherLibraryResources(schoolA, teacherA, {
      teacherActionId: plan.actionId,
    });
    expect(libraryItems).toHaveLength(1);
    expect(libraryItems[0].id).toBe(content.id);
    expect(libraryItems[0].metadata.teacherActionId).toBe(plan.actionId);

    const repoArtifacts = ContentArtifactRepository.getByActionId(plan.actionId, schoolA);
    expect(repoArtifacts).toHaveLength(1);
    expect(repoArtifacts[0].id).toBe(content.id);
    expect(repoArtifacts[0].teacherActionId).toBe(plan.actionId);
    expect(repoArtifacts[0].ecgArtifactId).toBe(ecgArtifactId);
  });

  // 20. Full Phase 25A-30 end-to-end lineage compatibility
  test('20. Preserves complete end-to-end lineage from Master SOW & Scheduled Lesson -> Assessment -> Evidence -> Interpretation -> Action Plan -> Supporting Resource', async () => {
    const plan = createSampleActionPlan({
      actionType: 'REMEDIAL_SUPPORT',
      scope: 'SELECTED_LEARNERS',
    });

    const { content, artifact, updatedAction } = await TeacherActionService.generateSupportingResourceFromAction({
      actionId: plan.actionId,
      schoolId: schoolA,
      teacherId: teacherA,
      generatorFn: async (fs) => ({
        id: 'res_e2e_phase30',
        title: 'End-to-End Linked Remedial Resource',
        body: 'Comprehensive remedial content aligned to KICD Grade 8 Integrated Science.',
        metadata: {
          grade: fs.grade,
          subject: fs.subject,
          topic: fs.topic,
          contentType: fs.contentType,
        },
      }),
    });

    // Verify complete chain of IDs on both GeneratedContent and ContentArtifact
    expect(content.metadata.masterSowId).toBe(masterSowId);
    expect(content.metadata.parentArtifactId).toBe(parentLessonPlanId);
    expect(content.metadata.curriculumLessonId).toBe(curriculumLessonId);
    expect(content.metadata.scheduledLessonId).toBe(scheduledLessonId);
    expect(content.metadata.ecgArtifactId).toBe(ecgArtifactId);
    expect(content.metadata.sourceInterpretationId).toBe(sourceInterpretationId);
    expect(content.metadata.teacherActionId).toBe(plan.actionId);

    expect(artifact.masterSowId).toBe(masterSowId);
    expect(artifact.parentArtifactId).toBe(parentLessonPlanId);
    expect(artifact.curriculumLessonId).toBe(curriculumLessonId);
    expect(artifact.scheduledLessonId).toBe(scheduledLessonId);
    expect(artifact.ecgArtifactId).toBe(ecgArtifactId);
    expect(artifact.sourceInterpretationId).toBe(sourceInterpretationId);
    expect(artifact.teacherActionId).toBe(plan.actionId);

    expect(updatedAction.linkedResources?.[0].artifactId).toBe('res_e2e_phase30');
  });
});
