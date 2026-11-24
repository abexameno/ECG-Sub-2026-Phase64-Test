
import { 
  TeacherActionPlan, 
  TeacherActionType, 
  TeacherActionScope, 
  TeacherActionStatus,
  SuggestedTeacherAction,
  TeacherActionResourceLink,
  TeacherActionFollowUpLink,
  TeacherActionFollowUpComparison,
  LearnerBeforeAfterComparison,
  LearnerFollowUpMovementStatus
} from '../types/teacherAction';
import { AssessmentEvidenceInterpretation, InterpretationStatus, LO_MASTERY_V1_CONFIG } from '../types/interpretation';
import {
  Assessment,
  ElmsAssessmentEvidenceRecord,
  ElmsAssessmentEvidenceResponse
} from '../types/assessmentEvidence';
import {
  ContentType,
  FormState,
  GeneratedContent,
  QuestionDifficulty,
  QuestionType,
  ContentArtifact,
  ArtifactType
} from '../types';
import { AuditService } from './auditService';
import { AssessmentEvidenceService } from './assessmentEvidenceService';
import { LearningOutcomeInterpretationService } from './learningOutcomeInterpretationService';
import { ElmsIntegrationService } from './elmsIntegrationService';
import { ContentArtifactRepository } from './contentArtifactRepository';
import { CanonicalCurriculumService } from './canonicalCurriculumService';
import { LearnerRosterService } from './learnerRosterService';
import { generateContent } from './geminiService';
import { PersistentStateService } from './persistentStateService';

const actionStore = new Map<string, TeacherActionPlan>();
const teacherLibraryStore = new Map<string, GeneratedContent>(); // key: `${schoolId}:${contentId}`
const inFlightGenerations = new Set<string>(); // key: actionId
const followUpComparisonStore = new Map<string, TeacherActionFollowUpComparison>(); // key: `${schoolId}:${actionId}:${followUpArtifactId}`

const STATUS_RANK: Record<InterpretationStatus, number> = {
  INSUFFICIENT_EVIDENCE: 0,
  EMERGING: 1,
  DEVELOPING: 2,
  DEMONSTRATED: 3,
  STRONG_DEMONSTRATION: 4,
};

function resolveCanonicalGradeId(gradeNameOrId?: string): string {
  if (!gradeNameOrId) return 'grade-8';
  const existing = CanonicalCurriculumService.getGradeById(gradeNameOrId);
  if (existing) return existing.id;
  const normalized = gradeNameOrId.trim().toLowerCase();
  const byName = CanonicalCurriculumService.getGrades().find(
    g => g.name.toLowerCase() === normalized || g.code.toLowerCase() === normalized
  );
  if (byName) return byName.id;
  const numMatch = normalized.match(/\d+/);
  if (numMatch) {
    const candidate = `grade-${numMatch[0]}`;
    if (CanonicalCurriculumService.getGradeById(candidate)) return candidate;
  }
  return 'grade-8';
}

function resolveCanonicalLearningAreaId(subjectNameOrId?: string): string {
  if (!subjectNameOrId) return 'la-sci';
  const existing = CanonicalCurriculumService.getLearningAreaById(subjectNameOrId);
  if (existing) return existing.id;
  const normalized = subjectNameOrId.trim().toLowerCase();
  const areas = CanonicalCurriculumService.getLearningAreas();
  const exact = areas.find(
    a => a.name.toLowerCase() === normalized || a.code.toLowerCase() === normalized
  );
  if (exact) return exact.id;
  if (normalized.includes('math')) return 'la-math';
  if (normalized.includes('sci')) return 'la-sci';
  if (normalized.includes('eng')) return 'la-eng';
  if (normalized.includes('kisw')) return 'la-kisw';
  if (normalized.includes('agric')) return 'la-agric';
  if (normalized.includes('soc')) return 'la-soc';
  if (normalized.includes('cre') || normalized.includes('relig')) return 'la-cre';
  if (normalized.includes('art') || normalized.includes('sport')) return 'la-cas';
  return 'la-sci';
}

function mapContentTypeToArtifactType(contentType: ContentType): ArtifactType {
  switch (contentType) {
    case ContentType.SchemeOfWork:
      return 'scheme_of_work';
    case ContentType.LessonPlan:
      return 'lesson_plan';
    case ContentType.LessonNotes:
      return 'learner_content';
    case ContentType.StudyGuide:
      return 'revision_content';
    case ContentType.Assessment:
    case ContentType.Quiz:
    case ContentType.TopicExam:
    case ContentType.TermExam:
      return 'assessment';
    default:
      return 'teacher_resource';
  }
}

function sanitizeTeacherNotesForPrompt(notes: string): string {
  if (!notes) return '';
  // Strip any email addresses, phone numbers, or instructions attempting to override canonical curriculum fields
  return notes
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/\b(?:\+?254|0)\d{9}\b/g, '[REDACTED_PHONE]')
    .trim();
}

export const TeacherActionService = {
  clearStore(): void {
    actionStore.clear();
    teacherLibraryStore.clear();
    inFlightGenerations.clear();
    followUpComparisonStore.clear();
  },

  isProductionMode(): boolean {
    return AssessmentEvidenceService.isProductionMode();
  },

  isDemoSimulationAllowed(): boolean {
    return AssessmentEvidenceService.isDemoSimulationAllowed();
  },

  setProductionMode(isProd: boolean | null): void {
    AssessmentEvidenceService.setProductionMode(isProd);
  },

  createActionPlan(params: {
    schoolId: string;
    teacherId: string;
    ecgArtifactId: string;
    assessmentId?: string;
    actionType: TeacherActionType;
    scope: TeacherActionScope;
    focusArea: string;
    teacherNotes: string;
    classGroupId?: string;
    learnerId?: string;
    selectedLearnerIds?: string[];
    sourceInterpretationId?: string;
    masterSowId?: string;
    parentArtifactId?: string;
    curriculumLessonId?: string;
    scheduledLessonId?: string;
    curriculumContext?: TeacherActionPlan['curriculumContext'];
  }): TeacherActionPlan {
    // 1. Authorization
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }

    const actionId = `action_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    const actionPlan: TeacherActionPlan = {
      actionId,
      ecgArtifactId: params.ecgArtifactId,
      assessmentId: params.assessmentId,
      schoolId: params.schoolId,
      classGroupId: params.classGroupId,
      learnerId: params.learnerId,
      selectedLearnerIds: params.selectedLearnerIds,
      curriculumLessonId: params.curriculumLessonId,
      scheduledLessonId: params.scheduledLessonId,
      masterSowId: params.masterSowId,
      parentArtifactId: params.parentArtifactId,
      actionType: params.actionType,
      scope: params.scope,
      focusArea: params.focusArea,
      teacherNotes: params.teacherNotes,
      status: 'PROPOSED',
      createdBy: params.teacherId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceInterpretationId: params.sourceInterpretationId,
      linkedResources: [],
      linkedFollowUpAssessments: [],
      followUpReviewStatus: 'NOT_STARTED',
      curriculumContext: params.curriculumContext ? { ...params.curriculumContext } : undefined,
    };

    actionStore.set(actionId, actionPlan);
    PersistentStateService.persistTeacherActionPlan(actionPlan);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'TEACHER_ACTION_CREATED',
      actionId,
      actionType: params.actionType,
      scope: params.scope,
      teacherId: params.teacherId,
      ecgArtifactId: params.ecgArtifactId,
    });

    return actionPlan;
  },

  getActionById(actionId: string, schoolId: string, teacherId?: string): TeacherActionPlan | undefined {
    if (teacherId && !AssessmentEvidenceService.isAuthorizedTeacher(teacherId, schoolId)) {
      throw new Error(`Unauthorized teacher: User ${teacherId} in school ${schoolId}`);
    }
    const action = actionStore.get(actionId);
    if (!action) return undefined;
    if (action.schoolId !== schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }
    return action;
  },

  updateActionStatus(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    newStatus: TeacherActionStatus;
  }): TeacherActionPlan {
    const action = actionStore.get(params.actionId);
    if (!action) throw new Error(`Action not found: ${params.actionId}`);
    
    // School isolation
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }

    // Authorization
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId}`);
    }

    const oldStatus = action.status;
    action.status = params.newStatus;
    action.updatedAt = new Date().toISOString();

    if (params.newStatus === 'COMPLETED') {
      action.completedAt = new Date().toISOString();
      action.completedBy = params.teacherId;
    }
    PersistentStateService.persistTeacherActionPlan(action);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'TEACHER_ACTION_STATUS_UPDATED',
      actionId: params.actionId,
      oldStatus,
      newStatus: params.newStatus,
      teacherId: params.teacherId,
    });

    return action;
  },

  getActionPlans(schoolId: string, filters?: { 
    ecgArtifactId?: string; 
    classGroupId?: string; 
    learnerId?: string;
    teacherId?: string;
  }): TeacherActionPlan[] {
    if (filters?.teacherId && !AssessmentEvidenceService.isAuthorizedTeacher(filters.teacherId, schoolId)) {
      throw new Error(`Unauthorized teacher: User ${filters.teacherId} in school ${schoolId}`);
    }
    return Array.from(actionStore.values()).filter(a => {
      if (a.schoolId !== schoolId) return false;
      if (filters?.ecgArtifactId && a.ecgArtifactId !== filters.ecgArtifactId) return false;
      if (filters?.classGroupId && a.classGroupId !== filters.classGroupId) return false;
      if (filters?.learnerId && a.learnerId !== filters.learnerId && !a.selectedLearnerIds?.includes(filters.learnerId)) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  linkArtifactToActionPlan(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    artifactId: string;
    contentType?: string;
    title?: string;
  }): TeacherActionPlan {
    const action = actionStore.get(params.actionId);
    if (!action) throw new Error(`Action not found: ${params.actionId}`);
    
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access');
    }

    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId}`);
    }

    action.resultArtifactId = params.artifactId;
    if (!action.linkedResources) {
      action.linkedResources = [];
    }
    if (!action.linkedResources.some(r => r.artifactId === params.artifactId)) {
      action.linkedResources.push({
        artifactId: params.artifactId,
        contentType: params.contentType || ContentType.StudyGuide,
        title: params.title || `Supporting Resource (${params.artifactId})`,
        createdAt: new Date().toISOString(),
        createdBy: params.teacherId,
        sourceInterpretationId: action.sourceInterpretationId,
        ecgArtifactId: action.ecgArtifactId,
      });
    }
    action.updatedAt = new Date().toISOString();
    PersistentStateService.persistTeacherActionPlan(action);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'TEACHER_ACTION_LINKED_ARTIFACT',
      actionId: params.actionId,
      artifactId: params.artifactId,
      teacherId: params.teacherId,
    });

    return action;
  },

  /**
   * Phase 30: Deterministic resource type suggestions based on Teacher Action & Evidence Context.
   * Makes ZERO Gemini calls. Teacher always chooses the actual resource type.
   */
  getSuggestedResourceTypes(
    action: TeacherActionPlan,
    interpretation?: AssessmentEvidenceInterpretation
  ): {
    recommendedTypes: ContentType[];
    defaultType: ContentType;
    rationale: string;
  } {
    const targetIds = action.learnerId
      ? [action.learnerId]
      : action.selectedLearnerIds || [];

    const hasHighConflict =
      action.actionType === 'FURTHER_ASSESSMENT' ||
      action.focusArea.toLowerCase().includes('consistency') ||
      (interpretation?.learnerInterpretations || []).some(
        l =>
          (targetIds.length === 0 || targetIds.includes(l.learnerId)) &&
          l.conflictStatus === 'HIGH_CONFLICT'
      );

    if (hasHighConflict) {
      return {
        recommendedTypes: [ContentType.Assessment, ContentType.Quiz],
        defaultType: ContentType.Assessment,
        rationale:
          'High variance in attempt scores detected; further assessment or evidence gathering is suggested rather than automatic remediation.',
      };
    }

    const hasInsufficientEvidence =
      action.focusArea.toLowerCase().includes('participation') ||
      (targetIds.length > 0 &&
        (interpretation?.learnerInterpretations || []).some(
          l => targetIds.includes(l.learnerId) && l.status === 'INSUFFICIENT_EVIDENCE'
        ));

    if (hasInsufficientEvidence) {
      return {
        recommendedTypes: [ContentType.Assessment, ContentType.Quiz, ContentType.StudyGuide],
        defaultType: ContentType.Quiz,
        rationale:
          'Insufficient assessment evidence recorded; targeted practice or formative assessment is suggested to gather baseline evidence without remedial labeling.',
      };
    }

    switch (action.actionType) {
      case 'RETEACH':
        return {
          recommendedTypes: [ContentType.LessonNotes, ContentType.LessonPlan],
          defaultType: ContentType.LessonNotes,
          rationale: 'Reteaching benefits from structured Lesson Notes or a revised Lesson Plan.',
        };
      case 'GUIDED_PRACTICE':
        return {
          recommendedTypes: [ContentType.StudyGuide, ContentType.LessonNotes, ContentType.Quiz],
          defaultType: ContentType.StudyGuide,
          rationale: 'Guided practice is supported by structured practice guides or notes.',
        };
      case 'DIFFERENTIATED_PRACTICE':
        return {
          recommendedTypes: [ContentType.StudyGuide, ContentType.Quiz, ContentType.LessonNotes],
          defaultType: ContentType.StudyGuide,
          rationale: 'Differentiated practice uses scaffolded study guides and practice items.',
        };
      case 'SMALL_GROUP_SUPPORT':
        return {
          recommendedTypes: [ContentType.LessonNotes, ContentType.StudyGuide, ContentType.LessonPlan],
          defaultType: ContentType.LessonNotes,
          rationale: 'Small-group support uses focused notes and guided practice activities.',
        };
      case 'INDIVIDUAL_FOLLOW_UP':
        return {
          recommendedTypes: [ContentType.StudyGuide, ContentType.LessonNotes, ContentType.Quiz],
          defaultType: ContentType.StudyGuide,
          rationale: 'Individual follow-up is supported by targeted practice or review notes.',
        };
      case 'PEER_SUPPORTED_PRACTICE':
        return {
          recommendedTypes: [ContentType.StudyGuide, ContentType.LessonNotes, ContentType.Quiz],
          defaultType: ContentType.StudyGuide,
          rationale: 'Peer-supported practice uses collaborative study guides and discussion tasks.',
        };
      case 'EXTENSION_CHALLENGE':
        return {
          recommendedTypes: [ContentType.StudyGuide, ContentType.Quiz, ContentType.Assessment],
          defaultType: ContentType.StudyGuide,
          rationale: 'Extension challenges provide advanced practice and higher-order inquiry.',
        };
      default:
        return {
          recommendedTypes: [
            ContentType.LessonNotes,
            ContentType.LessonPlan,
            ContentType.StudyGuide,
            ContentType.Assessment,
          ],
          defaultType: ContentType.LessonNotes,
          rationale: 'Select an existing ECG resource type to support your planned teacher action.',
        };
    }
  },

  /**
   * Phase 30: Opens the resource creation flow for a Teacher Action Plan.
   * Purely deterministic — ZERO Gemini calls.
   */
  openResourceCreationDialog(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    interpretation?: AssessmentEvidenceInterpretation;
    sourceContent?: GeneratedContent;
  }): {
    action: TeacherActionPlan;
    suggestedResourceTypes: ContentType[];
    defaultResourceType: ContentType;
    rationale: string;
    formState: FormState;
  } {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }

    const action = this.getActionById(params.actionId, params.schoolId, params.teacherId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }

    const suggestion = this.getSuggestedResourceTypes(action, params.interpretation);
    const formState = this.buildResourceFormState({
      actionId: params.actionId,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      resourceType: suggestion.defaultType,
      sourceContent: params.sourceContent,
    });

    return {
      action,
      suggestedResourceTypes: suggestion.recommendedTypes,
      defaultResourceType: suggestion.defaultType,
      rationale: suggestion.rationale,
      formState,
    };
  },

  /**
   * Phase 30: Builds the existing ECG Generator FormState from an approved/recorded TeacherActionPlan.
   * Preserves authoritative KICD curriculum metadata and protects against teacher-note overrides or PII leaks.
   * Makes ZERO Gemini calls.
   */
  buildResourceFormState(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    resourceType: ContentType;
    baseFormState?: Partial<FormState>;
    sourceContent?: GeneratedContent;
  }): FormState {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }

    const action = this.getActionById(params.actionId, params.schoolId, params.teacherId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }

    // Look up source artifact in repository if available
    let repoArtifact: ContentArtifact | undefined;
    try {
      repoArtifact = ContentArtifactRepository.getById(action.ecgArtifactId, params.schoolId);
    } catch {
      repoArtifact = undefined;
    }

    const repoContentMeta = (repoArtifact?.content as GeneratedContent | undefined)?.metadata;
    const sourceMeta = params.sourceContent?.metadata || repoContentMeta;
    const ctx = action.curriculumContext || {};

    // Authoritative curriculum fields (canonical curriculum takes precedence over free text)
    const grade =
      ctx.grade ||
      sourceMeta?.grade ||
      repoArtifact?.gradeLevelName ||
      CanonicalCurriculumService.getGradeById(repoArtifact?.gradeLevelId || '')?.name ||
      params.baseFormState?.grade ||
      'Grade 8';

    const subject =
      ctx.subject ||
      sourceMeta?.subject ||
      repoArtifact?.learningAreaName ||
      CanonicalCurriculumService.getLearningAreaById(repoArtifact?.learningAreaId || '')?.name ||
      params.baseFormState?.subject ||
      'Integrated Science';

    const term = (ctx.term || sourceMeta?.term || repoArtifact?.term || params.baseFormState?.term || 'Term 1') as
      | 'Term 1'
      | 'Term 2'
      | 'Term 3'
      | 'All Terms';

    const week = String(
      ctx.week !== undefined
        ? ctx.week
        : sourceMeta?.week !== undefined
        ? sourceMeta.week
        : repoArtifact?.weekNumber !== undefined
        ? repoArtifact.weekNumber
        : '1'
    );

    const lessonNumber = String(
      ctx.lesson !== undefined
        ? ctx.lesson
        : sourceMeta?.lessonNumber !== undefined
        ? sourceMeta.lessonNumber
        : repoArtifact?.lessonNumber !== undefined
        ? repoArtifact.lessonNumber
        : '1'
    );

    const strand =
      ctx.strand ||
      sourceMeta?.strand ||
      repoArtifact?.curriculumReferences?.[0]?.strandId ||
      '1.0 Mixtures, Elements and Compounds';

    const subStrand =
      ctx.subStrand ||
      sourceMeta?.subStrand ||
      repoArtifact?.curriculumReferences?.[0]?.subStrandId ||
      '1.2 Physical and Chemical Changes';

    const canonicalSlo =
      ctx.specificLearningOutcome ||
      sourceMeta?.specificLearningOutcome ||
      ctx.learningOutcomeId ||
      repoArtifact?.curriculumReferences?.[0]?.learningOutcomeIds?.[0] ||
      action.focusArea;

    // Preserve existing parentArtifactId hierarchy (NEVER make teacherActionId the parentArtifactId)
    const masterSowId = action.masterSowId || sourceMeta?.masterSowId;
    const parentArtifactId =
      action.parentArtifactId ||
      sourceMeta?.parentArtifactId ||
      masterSowId ||
      action.ecgArtifactId;

    const curriculumLessonId =
      action.curriculumLessonId ||
      sourceMeta?.curriculumLessonId ||
      `canonical-${grade.toLowerCase().replace(/\s+/g, '')}-${subject.toLowerCase().replace(/\s+/g, '')}-w${week}-l${lessonNumber}`;

    const scheduledLessonId =
      action.scheduledLessonId ||
      sourceMeta?.scheduledLessonId ||
      `sched-w${week}-p${lessonNumber}`;

    // Sanitize teacher notes for enrichment without leaking learner PII or overriding canonical SLO
    const sanitizedNotes = sanitizeTeacherNotesForPrompt(action.teacherNotes || '');
    const scopeDescription =
      action.scope === 'WHOLE_CLASS'
        ? 'Whole-class instruction'
        : action.scope === 'SELECTED_LEARNERS'
        ? 'Targeted small-group support'
        : 'Individual learner follow-up';

    const additionalInstructions = [
      `Teacher Action Intent: ${action.actionType.replace(/_/g, ' ')} (${scopeDescription}).`,
      `Curriculum Focus: ${strand} > ${subStrand}.`,
      `Authoritative Specific Learning Outcome: ${canonicalSlo}.`,
      `Action Focus Area: ${action.focusArea}.`,
      sanitizedNotes ? `Teacher Pedagogical Notes (Enrichment Only): ${sanitizedNotes}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const topicTitle = `${strand} - ${subStrand}`;

    return {
      schoolId: params.schoolId,
      grade,
      subject,
      topic: topicTitle,
      topicInputMode: 'curriculum',
      multiSelectTopics: { [strand]: [subStrand] },
      contentType: params.resourceType,
      term,
      terms: [term],
      week,
      lessonNumber,
      selectedWeeks: [week],
      selectedLessons: [{ week, lesson: lessonNumber }],
      distributionMode: 'manual',
      totalQuestions: 10,
      questionCounts: {
        [QuestionType.MultipleChoice]: 8,
        [QuestionType.ShortAnswer]: 2,
        [QuestionType.TrueFalse]: 0,
        [QuestionType.Essay]: 0,
        [QuestionType.Discussion]: 0,
      },
      questionMarks: {
        [QuestionType.MultipleChoice]: 1,
        [QuestionType.TrueFalse]: 1,
        [QuestionType.ShortAnswer]: 2,
        [QuestionType.Essay]: 0,
        [QuestionType.Discussion]: 0,
      },
      additionalInformation: sanitizedNotes || undefined,
      additionalInstructions,
      generateImages: false,
      imageSize: '1K',
      difficulty:
        action.actionType === 'EXTENSION_CHALLENGE'
          ? QuestionDifficulty.Hard
          : QuestionDifficulty.Mixed,
      textbookReference: '',
      strictCurriculumAdherence: true,
      showMarksAdjustment: true,
      // Lineage & Context Locking
      parentArtifactId,
      masterSowId,
      curriculumLessonId,
      scheduledLessonId,
      teacherActionId: action.actionId,
      sourceTeacherActionId: action.actionId,
      sourceInterpretationId: action.sourceInterpretationId,
      ecgArtifactId: action.ecgArtifactId,
      sowLessonContext: {
        sowTitle: `${grade} ${subject} (${term})`,
        week,
        lesson: lessonNumber,
        strand,
        subStrand,
        learningOutcomes: canonicalSlo,
      },
      teacherActionContext: {
        actionId: action.actionId,
        actionType: action.actionType,
        scope: action.scope,
        focusArea: action.focusArea,
        teacherNotes: sanitizedNotes,
        classGroupId: action.scope === 'WHOLE_CLASS' ? action.classGroupId : action.classGroupId,
        learnerId: action.scope === 'INDIVIDUAL_LEARNER' ? action.learnerId : undefined,
        selectedLearnerIds: action.scope === 'SELECTED_LEARNERS' ? (action.selectedLearnerIds ? [...action.selectedLearnerIds] : []) : undefined,
        sourceInterpretationId: action.sourceInterpretationId,
        ecgArtifactId: action.ecgArtifactId,
        grade,
        subject,
        term,
        week,
        lesson: lessonNumber,
        strand,
        subStrand,
        specificLearningOutcome: canonicalSlo,
      },
    };
  },

  /**
   * Phase 30: Maps a TeacherActionType to the default existing ECG ContentType (or null if NO_ACTION_REQUIRED).
   */
  getDefaultContentTypeForAction(actionType: TeacherActionType): ContentType | null {
    switch (actionType) {
      case 'NO_ADDITIONAL_ACTION':
      case 'NO_ACTION_REQUIRED':
        return null;
      case 'REMEDIAL_SUPPORT':
      case 'SMALL_GROUP_SUPPORT':
      case 'DIFFERENTIATED_PRACTICE':
      case 'GUIDED_PRACTICE':
      case 'PEER_SUPPORTED_PRACTICE':
      case 'OTHER':
        return ContentType.LessonNotes;
      case 'INDIVIDUAL_FOLLOW_UP':
        return ContentType.StudyGuide;
      case 'RETEACH':
      case 'RETEACHING':
        return ContentType.LessonPlan;
      case 'FURTHER_ASSESSMENT':
        return ContentType.Quiz;
      case 'EXTENSION_CHALLENGE':
        return ContentType.Assessment;
      default:
        return ContentType.LessonNotes;
    }
  },

  /**
   * Phase 30: Verifies that no learner PII (names, identifiers, IDs, emails, phone numbers) appears in a prompt string.
   */
  assertNoLearnerPii(schoolId: string, text: string): void {
    if (!text) return;
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
      throw new Error('Privacy violation: Email address detected in generation prompt');
    }
    if (/\b(?:\+?254|0)\d{9}\b/.test(text)) {
      throw new Error('Privacy violation: Phone number detected in generation prompt');
    }
    const learners = LearnerRosterService.getLearnersBySchool(schoolId);
    for (const lrn of learners) {
      if (lrn.id && text.includes(lrn.id)) {
        throw new Error(`Privacy violation: Learner ID (${lrn.id}) detected in generation prompt`);
      }
      if (lrn.displayName && lrn.displayName.length >= 3 && text.toLowerCase().includes(lrn.displayName.toLowerCase())) {
        throw new Error(`Privacy violation: Learner name (${lrn.displayName}) detected in generation prompt`);
      }
      if (lrn.learnerIdentifier && text.toLowerCase().includes(lrn.learnerIdentifier.toLowerCase())) {
        throw new Error(`Privacy violation: Learner admission identifier (${lrn.learnerIdentifier}) detected in generation prompt`);
      }
    }
  },

  /**
   * Phase 30: Builds a pre-populated FormState from a TeacherActionPlan for the existing ECG Generator.
   */
  buildResourceCreationContext(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    preferredContentType?: ContentType;
    baseFormState?: Partial<FormState>;
    sourceContent?: GeneratedContent;
  }): FormState {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const rawAction = actionStore.get(params.actionId);
    if (!rawAction) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (rawAction.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }
    if (rawAction.status === 'CANCELLED' || rawAction.status === 'REJECTED' || rawAction.status === 'COMPLETED') {
      throw new Error(`Cannot create a supporting resource for a ${rawAction.status} teacher action plan.`);
    }
    const defaultType = this.getDefaultContentTypeForAction(rawAction.actionType);
    if (!defaultType && !params.preferredContentType) {
      throw new Error(`Action type ${rawAction.actionType} does not require a supporting resource.`);
    }
    const resourceType = params.preferredContentType || defaultType || ContentType.LessonNotes;
    const formState = this.buildResourceFormState({
      actionId: params.actionId,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      resourceType,
      baseFormState: params.baseFormState,
      sourceContent: params.sourceContent,
    });
    if (formState.teacherActionContext && rawAction.curriculumContext?.learningOutcomes) {
      formState.teacherActionContext.learningOutcomes = rawAction.curriculumContext.learningOutcomes;
    } else if (formState.teacherActionContext && formState.teacherActionContext.specificLearningOutcome) {
      formState.teacherActionContext.learningOutcomes = formState.teacherActionContext.specificLearningOutcome;
    }
    this.assertNoLearnerPii(params.schoolId, `${formState.topic}\n${formState.additionalInformation || ''}`);
    return formState;
  },

  /**
   * Phase 30: Validates that authoritative curriculum fields have not been silently altered while bound to an action.
   * Supports both validateCurriculumLock(formState) and validateCurriculumLock(action, formState).
   */
  validateCurriculumLock(
    actionOrFormState: TeacherActionPlan | FormState,
    maybeFormState?: FormState
  ): { valid: boolean; error?: string } {
    const isTwoArg = !!maybeFormState;
    const formState = (maybeFormState || actionOrFormState) as FormState;
    const actionPlan = isTwoArg ? (actionOrFormState as TeacherActionPlan) : undefined;
    const actCtx = formState.teacherActionContext || (actionPlan ? {
      grade: actionPlan.curriculumContext?.grade,
      subject: actionPlan.curriculumContext?.subject,
      term: actionPlan.curriculumContext?.term,
      week: actionPlan.curriculumContext?.week !== undefined ? String(actionPlan.curriculumContext.week) : undefined,
      lesson: actionPlan.curriculumContext?.lesson !== undefined ? String(actionPlan.curriculumContext.lesson) : undefined,
      strand: actionPlan.curriculumContext?.strand,
      subStrand: actionPlan.curriculumContext?.subStrand,
      specificLearningOutcome: actionPlan.curriculumContext?.specificLearningOutcome || actionPlan.curriculumContext?.learningOutcomes,
    } : undefined);

    if (!actCtx) return { valid: true };

    const fail = (msg: string) => {
      if (isTwoArg) throw new Error(msg);
      return { valid: false, error: msg };
    };

    if (actCtx.grade && formState.grade !== actCtx.grade) {
      return fail(`Curriculum lock violation: grade cannot be changed from "${actCtx.grade}" to "${formState.grade}".`);
    }
    if (actCtx.subject && formState.subject !== actCtx.subject) {
      return fail(`Curriculum lock violation: subject cannot be changed from "${actCtx.subject}" to "${formState.subject}".`);
    }
    if (actCtx.term && formState.term && formState.term !== actCtx.term) {
      return fail(`Curriculum lock violation: term cannot be changed from "${actCtx.term}" to "${formState.term}".`);
    }
    if (actCtx.week && formState.week && String(formState.week) !== String(actCtx.week)) {
      return fail(`Curriculum lock violation: week cannot be changed from "${actCtx.week}" to "${formState.week}".`);
    }
    if (actCtx.lesson && formState.lessonNumber && String(formState.lessonNumber) !== String(actCtx.lesson)) {
      return fail(`Curriculum lock violation: lesson cannot be changed from "${actCtx.lesson}" to "${formState.lessonNumber}".`);
    }
    const sowCtx = formState.sowLessonContext;
    if (actCtx.strand && sowCtx?.strand && sowCtx.strand !== actCtx.strand) {
      return fail('Curriculum lock violation: strand cannot be changed while bound to a Teacher Action Plan.');
    }
    if (actCtx.subStrand && sowCtx?.subStrand && sowCtx.subStrand !== actCtx.subStrand) {
      return fail('Curriculum lock violation: sub-strand cannot be changed while bound to a Teacher Action Plan.');
    }

    return { valid: true };
  },

  /**
   * Phase 30: Explicitly unbinds the Teacher Action / SOW context so the teacher can freely change curriculum fields.
   */
  clearActionContext(formState: FormState): FormState {
    return {
      ...formState,
      parentArtifactId: undefined,
      masterSowId: undefined,
      curriculumLessonId: undefined,
      scheduledLessonId: undefined,
      teacherActionId: undefined,
      sourceTeacherActionId: undefined,
      sourceInterpretationId: undefined,
      ecgArtifactId: undefined,
      teacherActionContext: undefined,
      sowLessonContext: undefined,
    };
  },

  /**
   * Phase 30: Explicit resource generation triggered by the teacher for a TeacherActionPlan.
   * Uses the existing ECG generator (geminiService.generateContent), enforces duplicate-click protection,
   * preserves action state on failure, and links the generated resource without completing the action.
   */
  async generateSupportingResource(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    formState: FormState;
    teacherName?: string;
    schoolName?: string;
  }): Promise<GeneratedContent> {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }

    const action = this.getActionById(params.actionId, params.schoolId, params.teacherId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }

    // Duplicate-click / concurrent request protection
    if (inFlightGenerations.has(params.actionId)) {
      throw new Error('Duplicate generation blocked: Resource generation is already in progress for this Teacher Action.');
    }

    const lockCheck = this.validateCurriculumLock(params.formState);
    if (!lockCheck.valid) {
      throw new Error(lockCheck.error || 'Curriculum lock validation failed.');
    }

    inFlightGenerations.add(params.actionId);

    try {
      const generated = await generateContent(
        params.formState,
        params.teacherName || 'Teacher',
        params.schoolName || params.schoolId
      );

      const distinctId = `gen_res_${action.actionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const learners = LearnerRosterService.getLearnersBySchool(params.schoolId);

      // Privacy safeguard: ensure no learner PII or internal IDs appear in visible body/questions
      let cleanBody = generated.body;
      if (cleanBody) {
        cleanBody = sanitizeTeacherNotesForPrompt(cleanBody);
        for (const lrn of learners) {
          if (lrn.id) cleanBody = cleanBody.split(lrn.id).join('[Learner]');
          if (lrn.learnerIdentifier) cleanBody = cleanBody.split(lrn.learnerIdentifier).join('[Learner]');
        }
      }

      const actCtx = params.formState.teacherActionContext;
      const sowCtx = params.formState.sowLessonContext;

      const enrichedContent: GeneratedContent = {
        ...generated,
        id: distinctId,
        ownerId: params.teacherId,
        body: cleanBody,
        savedAt: new Date().toISOString(),
        metadata: {
          ...generated.metadata,
          schoolId: params.schoolId,
          grade: actCtx?.grade || params.formState.grade,
          subject: actCtx?.subject || params.formState.subject,
          topic: params.formState.topic,
          contentType: params.formState.contentType,
          term: actCtx?.term || params.formState.term || params.formState.terms?.[0],
          terms: params.formState.terms,
          teacherActionId: action.actionId,
          sourceTeacherActionId: action.actionId,
          sourceInterpretationId: action.sourceInterpretationId,
          ecgArtifactId: action.ecgArtifactId,
          parentArtifactId:
            params.formState.parentArtifactId !== action.actionId
              ? params.formState.parentArtifactId || action.parentArtifactId || action.masterSowId || action.ecgArtifactId
              : action.parentArtifactId || action.masterSowId || action.ecgArtifactId,
          masterSowId: params.formState.masterSowId || action.masterSowId,
          curriculumLessonId: params.formState.curriculumLessonId || action.curriculumLessonId,
          scheduledLessonId: params.formState.scheduledLessonId || action.scheduledLessonId,
          week: actCtx?.week || sowCtx?.week || params.formState.week,
          lessonNumber: actCtx?.lesson || sowCtx?.lesson || params.formState.lessonNumber,
          strand: actCtx?.strand || sowCtx?.strand,
          subStrand: actCtx?.subStrand || sowCtx?.subStrand,
          specificLearningOutcome: actCtx?.specificLearningOutcome || sowCtx?.learningOutcomes,
          classGroupId: action.classGroupId,
          actionScope: action.scope,
          selectedLearnerIds: action.scope === 'SELECTED_LEARNERS' ? action.selectedLearnerIds : undefined,
          targetLearnerId: action.scope === 'INDIVIDUAL_LEARNER' ? action.learnerId : undefined,
          // Never auto-publish to ELMS
          elmsPublication: undefined,
        },
      };

      // Link resource to action plan WITHOUT marking the action COMPLETED
      this.linkArtifactToActionPlan({
        actionId: action.actionId,
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        artifactId: distinctId,
        contentType: enrichedContent.metadata?.contentType,
        title: enrichedContent.title,
      });

      return enrichedContent;
    } finally {
      inFlightGenerations.delete(params.actionId);
    }
  },

  /**
   * Phase 30: Saves a generated or reviewed/edited resource to the existing Teacher Library & ContentArtifactRepository.
   */
  saveGeneratedResourceToLibrary(params: {
    schoolId: string;
    teacherId: string;
    content: GeneratedContent;
  }): ContentArtifact<GeneratedContent> {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }

    const meta = params.content.metadata;
    if (meta?.schoolId && meta.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school resource save');
    }

    const actionId = meta?.teacherActionId || meta?.sourceTeacherActionId;
    if (actionId) {
      const action = this.getActionById(actionId, params.schoolId, params.teacherId);
      if (!action) {
        throw new Error(`Action not found in school ${params.schoolId}: ${actionId}`);
      }
      this.linkArtifactToActionPlan({
        actionId,
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        artifactId: params.content.id || `gen_res_${Date.now()}`,
        contentType: meta?.contentType,
        title: params.content.title,
      });
    }

    const artifactId = params.content.id || `gen_res_${Date.now()}`;
    const gradeLevelId = resolveCanonicalGradeId(meta?.grade);
    const learningAreaId = resolveCanonicalLearningAreaId(meta?.subject);
    const artifactType = mapContentTypeToArtifactType(meta?.contentType || ContentType.StudyGuide);

    const existing = ContentArtifactRepository.getById<GeneratedContent>(artifactId, params.schoolId);
    const version = existing ? existing.version + 1 : 1;

    const artifact: ContentArtifact<GeneratedContent> = {
      id: artifactId,
      artifactType,
      schoolId: params.schoolId,
      curriculumId: 'kicd-cbc-2026',
      curriculumVersion: '2026.1',
      gradeLevelId,
      gradeLevelName: meta?.grade,
      learningAreaId,
      learningAreaName: meta?.subject,
      term: meta?.term,
      weekNumber: meta?.week ? parseInt(String(meta.week), 10) || 1 : undefined,
      lessonNumber: meta?.lessonNumber ? parseInt(String(meta.lessonNumber), 10) || 1 : undefined,
      curriculumReferences: [
        {
          gradeLevelId,
          learningAreaId,
          strandId: meta?.strand,
          subStrandId: meta?.subStrand,
          learningOutcomeIds: meta?.specificLearningOutcome ? [meta.specificLearningOutcome] : ['slo-default'],
        },
      ],
      version,
      status: 'validated',
      source: version > 1 ? 'human_edited' : 'ai_generated',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content: {
        ...params.content,
        id: artifactId,
        ownerId: params.teacherId,
        savedAt: new Date().toISOString(),
      },
      teacherActionId: actionId,
      sourceInterpretationId: meta?.sourceInterpretationId,
      ecgArtifactId: meta?.ecgArtifactId,
      originalEcgArtifactId: meta?.originalEcgArtifactId,
      originalAssessmentId: meta?.originalAssessmentId,
      supportingResourceId: meta?.supportingResourceId,
      isFollowUpAssessment: meta?.isFollowUpAssessment,
      masterSowId: meta?.masterSowId,
      parentArtifactId: meta?.parentArtifactId,
      curriculumLessonId: meta?.curriculumLessonId,
      scheduledLessonId: meta?.scheduledLessonId,
      classGroupId: meta?.classGroupId,
      actionScope: meta?.actionScope,
      selectedLearnerIds: meta?.selectedLearnerIds,
      targetLearnerId: meta?.targetLearnerId,
    };

    const saved = ContentArtifactRepository.save(artifact);
    (saved as any).contentType = artifactType;
    teacherLibraryStore.set(`${params.schoolId}:${artifactId}`, saved.content);

    return saved;
  },

  isGenerationInFlight(actionId: string): boolean {
    return inFlightGenerations.has(actionId);
  },

  /**
   * Phase 30: Records a generated resource against a Teacher Action Plan, transitions PLANNED/PROPOSED/ACCEPTED -> IN_PROGRESS
   * (never auto-completing to COMPLETED), and persists to Teacher Library & ContentArtifactRepository.
   */
  recordGeneratedResource(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    content: GeneratedContent;
  }): {
    updatedAction: TeacherActionPlan;
    artifact: ContentArtifact<GeneratedContent>;
    link: TeacherActionResourceLink;
  } {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const action = actionStore.get(params.actionId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }
    if (action.status === 'CANCELLED' || action.status === 'REJECTED' || action.status === 'COMPLETED') {
      throw new Error(`Cannot record resource on a ${action.status} teacher action plan.`);
    }

    const artifactId = params.content.id || `gen_res_${action.actionId}_${Date.now()}`;
    const enrichedContent: GeneratedContent = {
      ...params.content,
      id: artifactId,
      ownerId: params.teacherId,
      savedAt: params.content.savedAt || new Date().toISOString(),
      metadata: {
        ...params.content.metadata,
        grade: (params.content.metadata?.grade || (action as any).grade || 'Grade 7') as string,
        subject: (params.content.metadata?.subject || (action as any).subject || 'Integrated Science') as string,
        topic: (params.content.metadata?.topic || (action as any).topic || '') as string,
        contentType: (params.content.metadata?.contentType || (params.content as any).type || ContentType.LessonPlan) as ContentType,
        schoolId: params.schoolId,
        teacherActionId: action.actionId,
        sourceTeacherActionId: action.actionId,
        sourceInterpretationId: action.sourceInterpretationId,
        ecgArtifactId: action.ecgArtifactId,
        masterSowId: params.content.metadata?.masterSowId || action.masterSowId,
        parentArtifactId: params.content.metadata?.parentArtifactId || action.parentArtifactId || action.masterSowId || action.ecgArtifactId,
        curriculumLessonId: params.content.metadata?.curriculumLessonId || action.curriculumLessonId,
        scheduledLessonId: params.content.metadata?.scheduledLessonId || action.scheduledLessonId,
        elmsPublicationStatus: undefined,
        elmsAssessmentId: undefined,
        publishedAt: undefined,
      },
    };

    const artifact = this.saveGeneratedResourceToLibrary({
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      content: enrichedContent,
    });

    if (action.status === 'PROPOSED' || action.status === 'PLANNED' || action.status === 'ACCEPTED') {
      action.status = 'IN_PROGRESS';
      action.updatedAt = new Date().toISOString();
    }
    PersistentStateService.persistTeacherActionPlan(action);

    const link = action.linkedResources?.find((r) => r.artifactId === artifactId)!;
    return {
      updatedAction: action,
      artifact,
      link,
    };
  },

  /**
   * Phase 30: Generates a supporting resource from an approved TeacherActionPlan via the existing ECG generator
   * (or an injected generatorFn for deterministic testing), enforcing curriculum locks, PII checks, and duplicate-click protection.
   */
  async generateSupportingResourceFromAction(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    preferredContentType?: ContentType;
    customFormState?: FormState;
    teacherName?: string;
    schoolName?: string;
    generatorFn?: (formState: FormState) => Promise<GeneratedContent>;
  }): Promise<{
    content: GeneratedContent;
    artifact: ContentArtifact<GeneratedContent>;
    updatedAction: TeacherActionPlan;
    link: TeacherActionResourceLink;
  }> {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const action = actionStore.get(params.actionId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }
    if (action.status === 'CANCELLED' || action.status === 'REJECTED' || action.status === 'COMPLETED') {
      throw new Error(`Cannot create a supporting resource for a ${action.status} teacher action plan.`);
    }
    if (inFlightGenerations.has(params.actionId)) {
      throw new Error(`Duplicate generation request blocked: Resource generation is already in progress for action ${params.actionId}.`);
    }

    const formState =
      params.customFormState ||
      this.buildResourceCreationContext({
        actionId: params.actionId,
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        preferredContentType: params.preferredContentType,
      });

    this.validateCurriculumLock(action, formState);
    this.assertNoLearnerPii(params.schoolId, `${formState.topic}\n${formState.additionalInformation || ''}`);

    inFlightGenerations.add(params.actionId);
    try {
      const execGenerator =
        params.generatorFn ||
        ((fs: FormState) =>
          generateContent(fs, params.teacherName || 'Teacher', params.schoolName || params.schoolId));

      const rawContent = await execGenerator(formState);
      const distinctId =
        rawContent.id || `gen_res_${action.actionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const enrichedContent: GeneratedContent = {
        ...rawContent,
        id: distinctId,
        ownerId: params.teacherId,
        savedAt: new Date().toISOString(),
        metadata: {
          ...rawContent.metadata,
          schoolId: params.schoolId,
          grade: formState.grade,
          subject: formState.subject,
          topic: formState.topic,
          contentType: formState.contentType,
          difficulty: rawContent.metadata?.difficulty || formState.difficulty,
          teacherActionId: action.actionId,
          sourceTeacherActionId: action.actionId,
          sourceInterpretationId: action.sourceInterpretationId,
          ecgArtifactId: action.ecgArtifactId,
          masterSowId: formState.masterSowId || action.masterSowId,
          parentArtifactId: formState.parentArtifactId || action.parentArtifactId || action.masterSowId || action.ecgArtifactId,
          curriculumLessonId: formState.curriculumLessonId || action.curriculumLessonId,
          scheduledLessonId: formState.scheduledLessonId || action.scheduledLessonId,
          teacherActionContext: formState.teacherActionContext,
          elmsPublicationStatus: undefined,
          elmsAssessmentId: undefined,
          publishedAt: undefined,
        },
      };

      const recorded = this.recordGeneratedResource({
        actionId: action.actionId,
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        content: enrichedContent,
      });

      return {
        content: recorded.artifact.content,
        artifact: recorded.artifact,
        updatedAction: recorded.updatedAction,
        link: recorded.link,
      };
    } finally {
      inFlightGenerations.delete(params.actionId);
    }
  },

  /**
   * Phase 30: Queries Teacher Library / ContentArtifactRepository for resources linked to a specific Teacher Action.
   * Supports both (actionId, schoolId, teacherId) and (schoolId, actionId, teacherId).
   */
  getResourcesForAction(
    firstArg: string,
    secondArg: string,
    teacherId?: string
  ): ContentArtifact<GeneratedContent>[] & {
    links: TeacherActionResourceLink[];
    artifacts: ContentArtifact<GeneratedContent>[];
    libraryItems: GeneratedContent[];
  } {
    const isFirstActionId = actionStore.has(firstArg) || firstArg.startsWith('action_');
    const actionId = isFirstActionId ? firstArg : secondArg;
    const schoolId = isFirstActionId ? secondArg : firstArg;

    if (teacherId && !AssessmentEvidenceService.isAuthorizedTeacher(teacherId, schoolId)) {
      throw new Error(`Unauthorized teacher: User ${teacherId} in school ${schoolId}`);
    }

    const action = this.getActionById(actionId, schoolId, teacherId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    const allSchoolArtifacts = ContentArtifactRepository.list(schoolId) as ContentArtifact<GeneratedContent>[];
    const matchedArtifacts = allSchoolArtifacts.filter(
      (a) =>
        a.teacherActionId === actionId ||
        a.content?.metadata?.teacherActionId === actionId ||
        a.content?.metadata?.sourceTeacherActionId === actionId
    );
    const libraryItems = matchedArtifacts.map((a) => a.content).filter(Boolean);
    const links = action.linkedResources ? [...action.linkedResources] : [];

    return Object.assign([...matchedArtifacts], {
      links,
      artifacts: matchedArtifacts,
      libraryItems,
    });
  },

  getTeacherLibraryResources(
    schoolId: string,
    teacherId: string,
    filters?: { teacherActionId?: string }
  ): GeneratedContent[] {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(teacherId, schoolId)) {
      throw new Error(`Unauthorized teacher: User ${teacherId} in school ${schoolId}`);
    }

    const artifacts = ContentArtifactRepository.list(schoolId) as ContentArtifact<GeneratedContent>[];
    const results: GeneratedContent[] = [];

    for (const art of artifacts) {
      const content = art.content;
      if (!content || typeof content !== 'object' || !('title' in content)) continue;
      const linkedActionId = art.teacherActionId || content.metadata?.teacherActionId || content.metadata?.sourceTeacherActionId;
      if (filters?.teacherActionId && linkedActionId !== filters.teacherActionId) continue;
      results.push(content);
    }

    return results;
  },

  generateSuggestions(interpretation: AssessmentEvidenceInterpretation): SuggestedTeacherAction[] {
    const suggestions: SuggestedTeacherAction[] = [];
    const { factualSummary, competencyDistribution, learnerInterpretations } = interpretation;

    // 1. Whole Class: Low overall average
    if (factualSummary.averageScorePercentage < 60 && factualSummary.totalLearnersAssessed > 0) {
      suggestions.push({
        id: `sug_reteach_${Date.now()}`,
        actionType: 'RETEACH',
        scope: 'WHOLE_CLASS',
        focusArea: interpretation.learningOutcomeId,
        rationale: `Class average of ${factualSummary.averageScorePercentage}% is below the target baseline. A whole-class review of the core concepts is suggested.`,
      });
    }

    // 2. Whole Class: Specific Item Deficit
    factualSummary.itemAnalytics.forEach(item => {
      if (item.successRatePercentage < LO_MASTERY_V1_CONFIG.itemDeficitThreshold) {
        suggestions.push({
          id: `sug_item_${item.itemId}_${Date.now()}`,
          actionType: 'GUIDED_PRACTICE',
          scope: 'WHOLE_CLASS',
          focusArea: `Question ${item.sequence}: ${item.prompt}`,
          rationale: `Item ${item.sequence} showed a lower success rate (${item.successRatePercentage}%). Targeted guided practice on this specific inquiry is suggested.`,
        });
      }
    });

    // 3. Selected Learners: Emerging/Developing
    const strugglingLearners = learnerInterpretations.filter(l => 
      l.status === 'EMERGING' || l.status === 'DEVELOPING'
    );

    if (strugglingLearners.length > 0 && strugglingLearners.length <= factualSummary.totalLearnersAssessed * 0.5) {
      suggestions.push({
        id: `sug_small_group_${Date.now()}`,
        actionType: 'SMALL_GROUP_SUPPORT',
        scope: 'SELECTED_LEARNERS',
        focusArea: interpretation.learningOutcomeId,
        rationale: `${strugglingLearners.length} learner(s) are demonstrating emerging or developing understanding. Focused small-group instruction is suggested.`,
        targetLearnerIds: strugglingLearners.map(l => l.learnerId),
      });
    }

    // 4. Individual: Insufficient Evidence
    const noSubmissionLearners = learnerInterpretations.filter(l => l.status === 'INSUFFICIENT_EVIDENCE');
    noSubmissionLearners.forEach(l => {
      suggestions.push({
        id: `sug_follow_up_${l.learnerId}_${Date.now()}`,
        actionType: 'INDIVIDUAL_FOLLOW_UP',
        scope: 'INDIVIDUAL_LEARNER',
        focusArea: 'Assessment Participation',
        rationale: `No assessment evidence recorded for ${l.learnerName || l.learnerId}. Follow-up to confirm participation or technical status is suggested.`,
        targetLearnerIds: [l.learnerId],
      });
    });

    // 5. Individual: High Conflict
    const conflictLearners = learnerInterpretations.filter(l => l.conflictStatus === 'HIGH_CONFLICT');
    conflictLearners.forEach(l => {
      suggestions.push({
        id: `sug_review_${l.learnerId}_${Date.now()}`,
        actionType: 'FURTHER_ASSESSMENT',
        scope: 'INDIVIDUAL_LEARNER',
        focusArea: 'Evidence Consistency',
        rationale: `High variance in attempt scores for ${l.learnerName || l.learnerId}. Gathering additional evidence before drawing a conclusion is suggested.`,
        targetLearnerIds: [l.learnerId],
      });
    });

    return suggestions;
  },

  // ============================================================
  // PHASE 31: TEACHER ACTION FOLLOW-UP & EVIDENCE REASSESSMENT
  // ============================================================

  /**
   * Phase 31: Builds a pre-populated FormState specifically for creating a Follow-Up Assessment / Quiz
   * from an existing Teacher Action Plan. Preserves curriculum locks and lineage. Makes ZERO Gemini calls.
   */
  buildFollowUpAssessmentContext(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    preferredContentType?: ContentType;
    supportingResourceId?: string;
    totalQuestions?: number;
    difficulty?: QuestionDifficulty;
    baseFormState?: Partial<FormState>;
    sourceContent?: GeneratedContent;
  }): FormState {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const action = actionStore.get(params.actionId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }
    if (action.status === 'CANCELLED' || action.status === 'REJECTED') {
      throw new Error(`Cannot create a follow-up assessment for a ${action.status} teacher action plan.`);
    }
    if (action.actionType === 'NO_ACTION_REQUIRED' || action.actionType === 'NO_ADDITIONAL_ACTION') {
      throw new Error(`Action type ${action.actionType} does not require a follow-up assessment.`);
    }

    const allowedAssessmentTypes: ContentType[] = [
      ContentType.Quiz,
      ContentType.Assessment,
      ContentType.TopicExam,
      ContentType.TermExam,
    ];
    const chosenType = params.preferredContentType || ContentType.Quiz;
    if (!allowedAssessmentTypes.includes(chosenType)) {
      throw new Error(
        `Invalid follow-up assessment contentType "${chosenType}". Follow-up reassessment must use Quiz or Assessment.`
      );
    }

    // Verify supportingResourceId belongs to the same school if provided
    const resolvedSupportingResourceId =
      params.supportingResourceId || action.linkedResources?.[0]?.artifactId || action.resultArtifactId;
    if (params.supportingResourceId) {
      const resourceArtifact = ContentArtifactRepository.getById(params.supportingResourceId, params.schoolId);
      if (!resourceArtifact && !action.linkedResources?.some(r => r.artifactId === params.supportingResourceId)) {
        throw new Error(
          `Supporting resource ${params.supportingResourceId} not found in school ${params.schoolId}`
        );
      }
    }

    const baseState = this.buildResourceFormState({
      actionId: params.actionId,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      resourceType: chosenType,
      baseFormState: params.baseFormState,
      sourceContent: params.sourceContent,
    });

    const totalQuestions = params.totalQuestions || 5;
    const mcqCount = Math.max(1, totalQuestions - 1);
    const shortCount = Math.max(0, totalQuestions - mcqCount);

    const followUpInstructions = [
      baseState.additionalInstructions,
      `Follow-Up Reassessment Purpose: Gather new post-intervention evidence for Teacher Action (${action.actionId}) without modifying original assessment evidence (${action.ecgArtifactId}).`,
      resolvedSupportingResourceId ? `Linked Supporting Resource Reference: ${resolvedSupportingResourceId}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const formState: FormState = {
      ...baseState,
      contentType: chosenType,
      totalQuestions,
      questionCounts: {
        [QuestionType.MultipleChoice]: mcqCount,
        [QuestionType.ShortAnswer]: shortCount,
        [QuestionType.TrueFalse]: 0,
        [QuestionType.Essay]: 0,
        [QuestionType.Discussion]: 0,
      },
      difficulty: params.difficulty || baseState.difficulty,
      additionalInstructions: followUpInstructions,
      isFollowUpAssessment: true,
      originalEcgArtifactId: action.ecgArtifactId,
      originalAssessmentId: action.assessmentId,
      supportingResourceId: resolvedSupportingResourceId,
      teacherActionContext: baseState.teacherActionContext
        ? {
            ...baseState.teacherActionContext,
            isFollowUpAssessment: true,
            originalEcgArtifactId: action.ecgArtifactId,
            originalAssessmentId: action.assessmentId,
            supportingResourceId: resolvedSupportingResourceId,
            learningOutcomes:
              action.curriculumContext?.learningOutcomes ||
              baseState.teacherActionContext.specificLearningOutcome,
          }
        : undefined,
    };

    this.assertNoLearnerPii(
      params.schoolId,
      `${formState.topic}\n${formState.additionalInformation || ''}\n${formState.additionalInstructions || ''}`
    );

    return formState;
  },

  /**
   * Phase 31: Explicitly links a distinct follow-up assessment artifact to a Teacher Action Plan,
   * validating curriculum alignment, school isolation, and ensuring the original assessment is never overwritten.
   */
  linkFollowUpAssessmentToAction(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    followUpArtifactId: string;
    followUpAssessmentId?: string;
    supportingResourceId?: string;
    title?: string;
    contentType?: string;
  }): {
    updatedAction: TeacherActionPlan;
    followUpLink: TeacherActionFollowUpLink;
    followUpAssessment: Assessment;
  } {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const action = actionStore.get(params.actionId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }
    if (action.status === 'CANCELLED' || action.status === 'REJECTED') {
      throw new Error(`Cannot link a follow-up assessment to a ${action.status} teacher action plan.`);
    }

    // Critical safeguard: never allow linking the original assessment as its own follow-up assessment
    if (
      params.followUpArtifactId === action.ecgArtifactId ||
      (action.assessmentId &&
        (params.followUpArtifactId === action.assessmentId ||
          params.followUpAssessmentId === action.assessmentId))
    ) {
      throw new Error(
        'Invalid follow-up assessment: Cannot link the original assessment as its own follow-up assessment. Follow-up must be a distinct assessment record.'
      );
    }

    // Check artifact in repository (enforces cross-school check if artifact exists in another school)
    const repoArtifact = ContentArtifactRepository.getById<GeneratedContent>(
      params.followUpArtifactId,
      params.schoolId
    );
    const repoMeta = repoArtifact?.content?.metadata;

    // Validate curriculum alignment if artifact exists in repository
    const actCtx = action.curriculumContext;
    if (repoArtifact && actCtx) {
      const artGrade = repoMeta?.grade || repoArtifact.gradeLevelName;
      if (actCtx.grade && artGrade && artGrade !== actCtx.grade) {
        throw new Error(
          `Curriculum mismatch: Follow-up assessment grade "${artGrade}" does not match action grade "${actCtx.grade}".`
        );
      }
      const artSubject = repoMeta?.subject || repoArtifact.learningAreaName;
      if (actCtx.subject && artSubject && artSubject !== actCtx.subject) {
        throw new Error(
          `Curriculum mismatch: Follow-up assessment subject "${artSubject}" does not match action subject "${actCtx.subject}".`
        );
      }
      const artStrand = repoMeta?.strand || repoArtifact.curriculumReferences?.[0]?.strandId;
      if (actCtx.strand && artStrand && artStrand !== actCtx.strand) {
        throw new Error(
          `Curriculum mismatch: Follow-up assessment strand "${artStrand}" does not match action strand "${actCtx.strand}".`
        );
      }
      const artSubStrand = repoMeta?.subStrand || repoArtifact.curriculumReferences?.[0]?.subStrandId;
      if (actCtx.subStrand && artSubStrand && artSubStrand !== actCtx.subStrand) {
        throw new Error(
          `Curriculum mismatch: Follow-up assessment sub-strand "${artSubStrand}" does not match action sub-strand "${actCtx.subStrand}".`
        );
      }
    }

    // Ensure a formal Assessment contract exists in AssessmentEvidenceService for this follow-up artifact
    let followUpAssessment =
      (params.followUpAssessmentId
        ? AssessmentEvidenceService.getAssessment(params.followUpAssessmentId, params.schoolId)
        : undefined) ||
      AssessmentEvidenceService.getAssessmentByArtifactId(params.followUpArtifactId, params.schoolId);

    const origAssessment =
      (action.assessmentId
        ? AssessmentEvidenceService.getAssessment(action.assessmentId, params.schoolId)
        : undefined) ||
      AssessmentEvidenceService.getAssessmentByArtifactId(action.ecgArtifactId, params.schoolId);

    const learningOutcomeId =
      origAssessment?.learningOutcomeId ||
      actCtx?.learningOutcomeId ||
      repoArtifact?.curriculumReferences?.[0]?.learningOutcomeIds?.[0] ||
      actCtx?.specificLearningOutcome ||
      action.focusArea ||
      'slo-default';

    const curriculumVersionId = origAssessment?.curriculumVersionId || repoArtifact?.curriculumVersion || '2026.1';

    if (!followUpAssessment) {
      const questions = repoArtifact?.content?.questions || [];
      const items =
        questions.length > 0
          ? questions.map((q, idx) => ({
              learningOutcomeId,
              sequence: idx + 1,
              type: (q.questionType === QuestionType.MultipleChoice ? 'MULTIPLE_CHOICE' : 'STRUCTURED') as
                | 'MULTIPLE_CHOICE'
                | 'STRUCTURED',
              prompt: q.questionText,
              correctAnswer: q.correctOption || q.correctAnswer,
              marks: q.marks || 1,
            }))
          : [
              {
                learningOutcomeId,
                sequence: 1,
                type: 'STRUCTURED' as const,
                prompt: `Follow-up assessment item for ${action.focusArea}`,
                correctAnswer: 'Demonstrates understanding of core concept.',
                marks: 5,
              },
              {
                learningOutcomeId,
                sequence: 2,
                type: 'MULTIPLE_CHOICE' as const,
                prompt: `Application check for ${action.focusArea}`,
                correctAnswer: 'A',
                marks: 5,
              },
            ];

      followUpAssessment = AssessmentEvidenceService.createAssessment({
        schoolId: params.schoolId,
        curriculumVersionId,
        learningOutcomeId,
        title: params.title || repoArtifact?.content?.title || `Follow-Up: ${action.focusArea}`,
        type: 'FORMATIVE',
        status: 'PUBLISHED',
        contentArtifactId: params.followUpArtifactId,
        classGroupId: action.classGroupId,
        items,
      });
    }

    if (!action.linkedFollowUpAssessments) {
      action.linkedFollowUpAssessments = [];
    }

    const resolvedSupportingResourceId =
      params.supportingResourceId ||
      repoMeta?.supportingResourceId ||
      action.linkedResources?.[0]?.artifactId ||
      action.resultArtifactId;

    let existingLink = action.linkedFollowUpAssessments.find(
      f => f.followUpArtifactId === params.followUpArtifactId
    );

    if (!existingLink) {
      existingLink = {
        followUpId: `fup_${action.actionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        actionId: action.actionId,
        schoolId: params.schoolId,
        followUpArtifactId: params.followUpArtifactId,
        followUpAssessmentId: followUpAssessment.assessmentId,
        originalEcgArtifactId: action.ecgArtifactId,
        originalAssessmentId: origAssessment?.assessmentId || action.assessmentId,
        sourceInterpretationId: action.sourceInterpretationId,
        supportingResourceId: resolvedSupportingResourceId,
        title:
          params.title ||
          repoArtifact?.content?.title ||
          followUpAssessment.title ||
          `Follow-Up Assessment (${params.followUpArtifactId})`,
        contentType: params.contentType || repoMeta?.contentType || ContentType.Quiz,
        scope: action.scope,
        classGroupId: action.classGroupId,
        selectedLearnerIds:
          action.scope === 'SELECTED_LEARNERS' && action.selectedLearnerIds
            ? [...action.selectedLearnerIds]
            : undefined,
        learnerId: action.scope === 'INDIVIDUAL_LEARNER' ? action.learnerId : undefined,
        elmsPublicationStatus: 'NOT_PUBLISHED',
        createdAt: new Date().toISOString(),
        createdBy: params.teacherId,
      };
      action.linkedFollowUpAssessments.push(existingLink);
    } else {
      existingLink.followUpAssessmentId = followUpAssessment.assessmentId;
      if (resolvedSupportingResourceId) {
        existingLink.supportingResourceId = resolvedSupportingResourceId;
      }
    }

    if (action.status === 'PROPOSED' || action.status === 'PLANNED' || action.status === 'ACCEPTED') {
      action.status = 'IN_PROGRESS';
    }
    if (!action.followUpReviewStatus || action.followUpReviewStatus === 'NOT_STARTED') {
      action.followUpReviewStatus = 'AWAITING_EVIDENCE';
    }
    action.updatedAt = new Date().toISOString();
    PersistentStateService.persistTeacherActionPlan(action);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'TEACHER_ACTION_FOLLOW_UP_ASSESSMENT_LINKED',
      actionId: action.actionId,
      followUpId: existingLink.followUpId,
      followUpArtifactId: params.followUpArtifactId,
      followUpAssessmentId: followUpAssessment.assessmentId,
      originalEcgArtifactId: action.ecgArtifactId,
      teacherId: params.teacherId,
    });

    return {
      updatedAction: action,
      followUpLink: existingLink,
      followUpAssessment,
    };
  },

  /**
   * Phase 31: Explicitly generates a Follow-Up Assessment / Quiz from a TeacherActionPlan using the existing ECG generator,
   * saves it to the Teacher Library & ContentArtifactRepository, creates its Assessment contract, and links it to the action plan.
   * Never auto-publishes to ELMS and never mutates original evidence.
   */
  async generateFollowUpAssessmentFromAction(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    preferredContentType?: ContentType;
    supportingResourceId?: string;
    totalQuestions?: number;
    difficulty?: QuestionDifficulty;
    customFormState?: FormState;
    teacherName?: string;
    schoolName?: string;
    generatorFn?: (formState: FormState) => Promise<GeneratedContent>;
  }): Promise<{
    content: GeneratedContent;
    artifact: ContentArtifact<GeneratedContent>;
    followUpAssessment: Assessment;
    followUpLink: TeacherActionFollowUpLink;
    updatedAction: TeacherActionPlan;
  }> {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const action = actionStore.get(params.actionId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }
    if (action.status === 'CANCELLED' || action.status === 'REJECTED') {
      throw new Error(`Cannot create a follow-up assessment for a ${action.status} teacher action plan.`);
    }
    if (inFlightGenerations.has(params.actionId)) {
      throw new Error(
        `Duplicate generation request blocked: Generation is already in progress for action ${params.actionId}.`
      );
    }
    if (params.generatorFn && !AssessmentEvidenceService.isDemoSimulationAllowed()) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'PRODUCTION_SYNTHETIC_FOLLOW_UP_GENERATOR_BLOCKED',
        actionId: params.actionId,
        teacherId: params.teacherId,
      });
      throw new Error(
        'Production security guard: Custom or synthetic follow-up assessment generatorFn is not permitted in production.'
      );
    }

    const formState =
      params.customFormState ||
      this.buildFollowUpAssessmentContext({
        actionId: params.actionId,
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        preferredContentType: params.preferredContentType || ContentType.Quiz,
        supportingResourceId: params.supportingResourceId,
        totalQuestions: params.totalQuestions,
        difficulty: params.difficulty,
      });

    const allowedAssessmentTypes: ContentType[] = [
      ContentType.Quiz,
      ContentType.Assessment,
      ContentType.TopicExam,
      ContentType.TermExam,
    ];
    if (!allowedAssessmentTypes.includes(formState.contentType)) {
      throw new Error(
        `Invalid follow-up assessment contentType "${formState.contentType}". Follow-up reassessment must use Quiz or Assessment.`
      );
    }

    this.validateCurriculumLock(action, formState);
    this.assertNoLearnerPii(
      params.schoolId,
      `${formState.topic}\n${formState.additionalInformation || ''}\n${formState.additionalInstructions || ''}`
    );

    inFlightGenerations.add(params.actionId);
    try {
      const execGenerator =
        params.generatorFn ||
        ((fs: FormState) =>
          generateContent(fs, params.teacherName || 'Teacher', params.schoolName || params.schoolId));

      const rawContent = await execGenerator(formState);
      const distinctId =
        rawContent.id && rawContent.id !== action.ecgArtifactId
          ? rawContent.id
          : `gen_fup_${action.actionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const learners = LearnerRosterService.getLearnersBySchool(params.schoolId);
      const scrubText = (txt?: string) => {
        if (!txt) return txt;
        let cleaned = sanitizeTeacherNotesForPrompt(txt);
        for (const lrn of learners) {
          if (lrn.id) cleaned = cleaned.split(lrn.id).join('[Learner]');
          if (lrn.learnerIdentifier) cleaned = cleaned.split(lrn.learnerIdentifier).join('[Learner]');
          if (lrn.displayName && lrn.displayName.length >= 3) {
            cleaned = cleaned.replace(new RegExp(lrn.displayName, 'gi'), '[Learner]');
          }
        }
        return cleaned;
      };

      const scrubbedQuestions = rawContent.questions?.map(q => ({
        ...q,
        questionText: scrubText(q.questionText) || q.questionText,
        explanation: scrubText(q.explanation),
      }));

      const resolvedSupportingResourceId =
        params.supportingResourceId ||
        formState.supportingResourceId ||
        action.linkedResources?.[0]?.artifactId ||
        action.resultArtifactId;

      const origAssessment =
        (action.assessmentId
          ? AssessmentEvidenceService.getAssessment(action.assessmentId, params.schoolId)
          : undefined) ||
        AssessmentEvidenceService.getAssessmentByArtifactId(action.ecgArtifactId, params.schoolId);

      const enrichedContent: GeneratedContent = {
        ...rawContent,
        id: distinctId,
        ownerId: params.teacherId,
        body: scrubText(rawContent.body),
        questions: scrubbedQuestions,
        savedAt: new Date().toISOString(),
        metadata: {
          ...rawContent.metadata,
          schoolId: params.schoolId,
          grade: formState.grade,
          subject: formState.subject,
          topic: formState.topic,
          contentType: formState.contentType,
          term: formState.term,
          terms: formState.terms,
          week: formState.week,
          lessonNumber: formState.lessonNumber,
          strand: formState.teacherActionContext?.strand || formState.sowLessonContext?.strand,
          subStrand: formState.teacherActionContext?.subStrand || formState.sowLessonContext?.subStrand,
          specificLearningOutcome:
            formState.teacherActionContext?.specificLearningOutcome ||
            formState.sowLessonContext?.learningOutcomes,
          difficulty: rawContent.metadata?.difficulty || formState.difficulty,
          teacherActionId: action.actionId,
          sourceTeacherActionId: action.actionId,
          sourceInterpretationId: action.sourceInterpretationId,
          ecgArtifactId: action.ecgArtifactId,
          originalEcgArtifactId: action.ecgArtifactId,
          originalAssessmentId: origAssessment?.assessmentId || action.assessmentId,
          supportingResourceId: resolvedSupportingResourceId,
          isFollowUpAssessment: true,
          masterSowId: formState.masterSowId || action.masterSowId,
          parentArtifactId:
            formState.parentArtifactId ||
            action.parentArtifactId ||
            action.masterSowId ||
            action.ecgArtifactId,
          curriculumLessonId: formState.curriculumLessonId || action.curriculumLessonId,
          scheduledLessonId: formState.scheduledLessonId || action.scheduledLessonId,
          classGroupId: action.classGroupId,
          actionScope: action.scope,
          selectedLearnerIds: action.scope === 'SELECTED_LEARNERS' ? action.selectedLearnerIds : undefined,
          targetLearnerId: action.scope === 'INDIVIDUAL_LEARNER' ? action.learnerId : undefined,
          teacherActionContext: formState.teacherActionContext,
          // Never auto-publish to ELMS
          elmsPublication: undefined,
          elmsPublicationStatus: undefined,
          elmsAssessmentId: undefined,
          publishedAt: undefined,
        },
      };

      const artifact = this.saveGeneratedResourceToLibrary({
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        content: enrichedContent,
      });

      const linked = this.linkFollowUpAssessmentToAction({
        actionId: action.actionId,
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        followUpArtifactId: distinctId,
        supportingResourceId: resolvedSupportingResourceId,
        title: enrichedContent.title,
        contentType: enrichedContent.metadata?.contentType,
      });

      return {
        content: artifact.content,
        artifact,
        followUpAssessment: linked.followUpAssessment,
        followUpLink: linked.followUpLink,
        updatedAction: linked.updatedAction,
      };
    } finally {
      inFlightGenerations.delete(params.actionId);
    }
  },

  /**
   * Phase 31: Explicitly publishes a linked follow-up assessment to ELMS (and optionally assigns it to the class group).
   */
  publishFollowUpAssessmentToElms(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    followUpArtifactId: string;
    classGroupId?: string;
  }) {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const action = actionStore.get(params.actionId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }

    const followUpLink = action.linkedFollowUpAssessments?.find(
      f => f.followUpArtifactId === params.followUpArtifactId
    );
    if (!followUpLink) {
      throw new Error(
        `Follow-up assessment ${params.followUpArtifactId} is not linked to teacher action ${params.actionId}`
      );
    }

    const targetClassGroupId = params.classGroupId || action.classGroupId;
    const publication = ElmsIntegrationService.publishResource({
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      ecgArtifactId: params.followUpArtifactId,
      classGroupId: targetClassGroupId,
      metadata: {
        teacherActionId: action.actionId,
        originalEcgArtifactId: action.ecgArtifactId,
        isFollowUpAssessment: true,
        scope: action.scope,
      },
    });

    followUpLink.elmsResourceId = publication.elmsResourceId;
    followUpLink.elmsPublicationStatus = targetClassGroupId ? 'ASSIGNED' : 'PUBLISHED';
    if (targetClassGroupId) {
      followUpLink.classGroupId = targetClassGroupId;
      followUpLink.elmsAssignmentId = `asgn_elms_${params.schoolId}_${params.followUpArtifactId}_${targetClassGroupId}`;
    }
    action.updatedAt = new Date().toISOString();
    PersistentStateService.persistTeacherActionPlan(action);

    return {
      publication,
      followUpLink,
      updatedAction: action,
    };
  },

  /**
   * Phase 31 & 31.2: Records new learner attempt evidence for a linked Follow-Up Assessment.
   * Requires mandatory authenticated teacher identity (never falls back to SYSTEM).
   * Rejects synthetic/demo follow-up evidence in production and stamps explicit DEMO/SIMULATED provenance in non-production.
   * Preserves original ElmsAssessmentEvidenceRecord and LearningOutcomeEvidence without mutation.
   * Never auto-completes the Teacher Action Plan.
   */
  recordFollowUpAssessmentEvidence(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    followUpArtifactId: string;
    learnerId: string;
    score: number;
    maxScore: number;
    attemptId?: string;
    classGroupId?: string;
    responses?: ElmsAssessmentEvidenceResponse[];
    submittedAt?: string;
    evaluatedAt?: string;
    elmsEventId?: string;
    sourceSystem?: 'ELMS' | 'DEMO';
    evidenceOrigin?: 'AUTHORITATIVE_ELMS' | 'TEACHER_RECORDED' | 'SIMULATED' | 'TEST_FIXTURE';
    isSimulated?: boolean;
  }): ElmsAssessmentEvidenceRecord {
    if (
      !params.teacherId ||
      typeof params.teacherId !== 'string' ||
      params.teacherId.trim() === '' ||
      params.teacherId.trim().toLowerCase() === 'system'
    ) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'MISSING_TEACHER_IDENTITY_FOLLOW_UP_EVIDENCE',
        actionId: params.actionId,
      });
      throw new Error(
        'Mandatory teacher identity required: Authenticated teacherId is required to record follow-up assessment evidence.'
      );
    }
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'UNAUTHORIZED_FOLLOW_UP_EVIDENCE_ATTEMPT',
        teacherId: params.teacherId,
        actionId: params.actionId,
      });
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const action = actionStore.get(params.actionId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }

    if (params.followUpArtifactId === action.ecgArtifactId) {
      throw new Error(
        'Immutability violation: Follow-up evidence cannot be recorded against the original assessment artifact ID.'
      );
    }

    const followUpLink = action.linkedFollowUpAssessments?.find(
      f => f.followUpArtifactId === params.followUpArtifactId
    );
    if (!followUpLink) {
      throw new Error(
        `Follow-up assessment ${params.followUpArtifactId} is not linked to action ${params.actionId}`
      );
    }

    if (params.score < 0 || params.maxScore <= 0 || params.score > params.maxScore) {
      throw new Error(`Invalid follow-up score: ${params.score}/${params.maxScore}`);
    }

    // Phase 31.2: Verify whether this evidence is backed by an authoritative processed ELMS event
    const verifiedElmsEvent =
      params.elmsEventId && params.sourceSystem !== 'DEMO' && !params.isSimulated
        ? ElmsIntegrationService.getEvent(params.schoolId, params.elmsEventId)
        : undefined;
    const isAuthoritativeElms = Boolean(
      verifiedElmsEvent &&
        verifiedElmsEvent.status === 'PROCESSED' &&
        verifiedElmsEvent.sourceSystem === 'ELMS' &&
        !ElmsIntegrationService.isSimulatedLearningEvent(verifiedElmsEvent) &&
        Array.isArray(params.responses) &&
        params.responses.length > 0
    );

    if (!isAuthoritativeElms && !AssessmentEvidenceService.isDemoSimulationAllowed()) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'PRODUCTION_SYNTHETIC_FOLLOW_UP_EVIDENCE_BLOCKED',
        actionId: action.actionId,
        followUpArtifactId: params.followUpArtifactId,
        teacherId: params.teacherId,
      });
      throw new Error(
        'Production security guard: Synthetic or demo follow-up assessment evidence cannot be recorded in production. Authoritative ELMS event ingestion is required.'
      );
    }

    const followUpAssessment =
      (followUpLink.followUpAssessmentId
        ? AssessmentEvidenceService.getAssessment(followUpLink.followUpAssessmentId, params.schoolId)
        : undefined) ||
      AssessmentEvidenceService.getAssessmentByArtifactId(params.followUpArtifactId, params.schoolId);

    const assessmentId = followUpAssessment?.assessmentId || `asmt_${params.followUpArtifactId}`;
    const learningOutcomeId =
      followUpAssessment?.learningOutcomeId ||
      action.curriculumContext?.learningOutcomeId ||
      action.curriculumContext?.specificLearningOutcome ||
      action.focusArea ||
      'slo-default';
    const curriculumVersionId = followUpAssessment?.curriculumVersionId || '2026.1';

    const percentage = Number(((params.score / params.maxScore) * 100).toFixed(1));
    const attemptId =
      params.attemptId ||
      `att_fup_${params.schoolId}_${params.learnerId}_${params.followUpArtifactId}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 5)}`;
    const now = new Date().toISOString();

    // Phase 31.2: Never fabricate synthetic responses when real responses are not supplied
    const recordedResponses: ElmsAssessmentEvidenceResponse[] = params.responses
      ? [...params.responses]
      : [];

    const resolvedSourceSystem: 'ELMS' | 'DEMO' = isAuthoritativeElms ? 'ELMS' : 'DEMO';
    const resolvedEvidenceOrigin: 'AUTHORITATIVE_ELMS' | 'SIMULATED' | 'TEST_FIXTURE' =
      isAuthoritativeElms
        ? 'AUTHORITATIVE_ELMS'
        : params.evidenceOrigin === 'TEST_FIXTURE'
        ? 'TEST_FIXTURE'
        : 'SIMULATED';
    const resolvedStatus: 'RECORDED' | 'EVALUATED' | 'SYNCHRONIZED' = isAuthoritativeElms
      ? 'SYNCHRONIZED'
      : 'RECORDED';

    const record = AssessmentEvidenceService.recordElmsEvidenceRecord({
      evidenceRecordId: `elms_evd_fup_${attemptId}`,
      schoolId: params.schoolId,
      ecgArtifactId: params.followUpArtifactId,
      elmsResourceId: followUpLink.elmsResourceId || `elms_res_${params.followUpArtifactId}`,
      assessmentId,
      attemptId,
      learnerId: params.learnerId,
      classGroupId: params.classGroupId || action.classGroupId,
      curriculumVersionId,
      learningOutcomeId,
      score: params.score,
      maxScore: params.maxScore,
      percentage,
      status: resolvedStatus,
      responses: recordedResponses,
      submittedAt: params.submittedAt || now,
      evaluatedAt: params.evaluatedAt || now,
      provenance: {
        sourceSystem: resolvedSourceSystem,
        evidenceOrigin: resolvedEvidenceOrigin,
        eventId: isAuthoritativeElms ? params.elmsEventId : undefined,
        evaluatorType: 'TEACHER',
        evaluatorId: params.teacherId,
        notes: isAuthoritativeElms
          ? `Authoritative ELMS follow-up evidence for Teacher Action ${action.actionId}`
          : `Demo/simulated follow-up evidence (${resolvedEvidenceOrigin}) for Teacher Action ${action.actionId}`,
      },
      metadata: {
        teacherActionId: action.actionId,
        originalEcgArtifactId: action.ecgArtifactId,
        isFollowUpAssessment: true,
        isSimulated: !isAuthoritativeElms,
        evidenceOrigin: resolvedEvidenceOrigin,
      },
    });

    // Transition review status to PENDING_REVIEW without auto-completing the action plan
    if (action.followUpReviewStatus !== 'REVIEWED') {
      action.followUpReviewStatus = 'PENDING_REVIEW';
    }
    if (action.status === 'PROPOSED' || action.status === 'PLANNED' || action.status === 'ACCEPTED') {
      action.status = 'IN_PROGRESS';
    }
    action.updatedAt = now;
    PersistentStateService.persistTeacherActionPlan(action);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'TEACHER_ACTION_FOLLOW_UP_EVIDENCE_RECORDED',
      actionId: action.actionId,
      followUpArtifactId: params.followUpArtifactId,
      evidenceRecordId: record.evidenceRecordId,
      learnerId: params.learnerId,
      percentage,
    });

    return record;
  },

  /**
   * Phase 31: Deterministic Before/After Evidence Comparison for a Teacher Action Plan.
   * Compares Original Assessment Evidence ("Before") with Follow-Up Assessment Evidence ("After")
   * under LO-MASTERY-V1 policy without mutating original evidence or fabricating 0% scores for missing submissions.
   */
  compareActionBeforeAfterEvidence(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    followUpArtifactId?: string;
    classGroupId?: string;
  }): TeacherActionFollowUpComparison {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      AuditService.log('SECURITY_VIOLATION', params.schoolId, {
        action: 'UNAUTHORIZED_FOLLOW_UP_COMPARISON_ATTEMPT',
        teacherId: params.teacherId,
        actionId: params.actionId,
      });
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }

    const action = actionStore.get(params.actionId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }

    const linkedFollowUps = action.linkedFollowUpAssessments || [];
    if (linkedFollowUps.length === 0) {
      throw new Error(`No follow-up assessment linked to teacher action ${params.actionId}`);
    }

    const followUpLink = params.followUpArtifactId
      ? linkedFollowUps.find(f => f.followUpArtifactId === params.followUpArtifactId)
      : linkedFollowUps[linkedFollowUps.length - 1];

    if (!followUpLink) {
      throw new Error(
        `Follow-up assessment ${params.followUpArtifactId} is not linked to teacher action ${params.actionId}`
      );
    }

    const resolvedClassGroupId = params.classGroupId || followUpLink.classGroupId || action.classGroupId;

    // 1. Interpret Original ("Before") Evidence (read-only on original records)
    const originalInterp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
      ecgArtifactId: action.ecgArtifactId,
      schoolId: params.schoolId,
      requestingTeacherId: params.teacherId,
      classGroupId: resolvedClassGroupId,
    });

    // 2. Interpret Follow-Up ("After") Evidence
    const followUpInterp = LearningOutcomeInterpretationService.interpretAssessmentEvidence({
      ecgArtifactId: followUpLink.followUpArtifactId,
      schoolId: params.schoolId,
      requestingTeacherId: params.teacherId,
      classGroupId: resolvedClassGroupId,
    });

    // 3. Determine Target Cohort based on Action Scope
    const origMap = new Map(originalInterp.learnerInterpretations.map(l => [l.learnerId, l]));
    const fupMap = new Map(followUpInterp.learnerInterpretations.map(l => [l.learnerId, l]));

    const allCohortLearnerIds: string[] = [];
    const addUnique = (id?: string) => {
      if (id && !allCohortLearnerIds.includes(id)) {
        allCohortLearnerIds.push(id);
      }
    };

    if (action.scope === 'INDIVIDUAL_LEARNER' && action.learnerId) {
      addUnique(action.learnerId);
    } else if (action.scope === 'SELECTED_LEARNERS' && action.selectedLearnerIds?.length) {
      action.selectedLearnerIds.forEach(addUnique);
    }
    originalInterp.learnerInterpretations.forEach(l => addUnique(l.learnerId));
    followUpInterp.learnerInterpretations.forEach(l => addUnique(l.learnerId));

    const isLearnerTargeted = (learnerId: string): boolean => {
      if (action.scope === 'INDIVIDUAL_LEARNER') {
        return action.learnerId === learnerId;
      }
      if (action.scope === 'SELECTED_LEARNERS') {
        return (action.selectedLearnerIds || []).includes(learnerId);
      }
      return true; // WHOLE_CLASS
    };

    const learnerComparisons: LearnerBeforeAfterComparison[] = [];

    let totalTargetedLearners = 0;
    let originalSubmittedCount = 0;
    let followUpSubmittedCount = 0;
    let awaitingFollowUpCount = 0;

    let origPercentagesSum = 0;
    let fupPercentagesSum = 0;
    const pairedDeltas: number[] = [];

    let improvedCount = 0;
    let maintainedCompetencyCount = 0;
    let noChangeCount = 0;
    let regressedCount = 0;
    let newEvidenceRecordedCount = 0;

    const origDist = {
      strongDemonstrationCount: 0,
      demonstratedCount: 0,
      developingCount: 0,
      emergingCount: 0,
      insufficientEvidenceCount: 0,
    };

    const fupDist = {
      strongDemonstrationCount: 0,
      demonstratedCount: 0,
      developingCount: 0,
      emergingCount: 0,
      insufficientEvidenceCount: 0,
    };

    const incrementDist = (dist: typeof origDist, st: InterpretationStatus) => {
      if (st === 'STRONG_DEMONSTRATION') dist.strongDemonstrationCount++;
      else if (st === 'DEMONSTRATED') dist.demonstratedCount++;
      else if (st === 'DEVELOPING') dist.developingCount++;
      else if (st === 'EMERGING') dist.emergingCount++;
      else dist.insufficientEvidenceCount++;
    };

    for (const learnerId of allCohortLearnerIds) {
      const targeted = isLearnerTargeted(learnerId);
      // For INDIVIDUAL_LEARNER or SELECTED_LEARNERS, only include targeted learners in the action comparison list
      if (!targeted && action.scope !== 'WHOLE_CLASS') {
        continue;
      }

      const origL = origMap.get(learnerId);
      const fupL = fupMap.get(learnerId);
      const rosterLearner = LearnerRosterService.getLearner(learnerId, params.schoolId);

      const originalStatus: InterpretationStatus = origL?.status || 'INSUFFICIENT_EVIDENCE';
      const followUpStatus: InterpretationStatus = fupL?.status || 'INSUFFICIENT_EVIDENCE';

      const hasOriginalSubmission =
        originalStatus !== 'INSUFFICIENT_EVIDENCE' && typeof origL?.percentage === 'number';
      const hasFollowUpSubmission =
        followUpStatus !== 'INSUFFICIENT_EVIDENCE' && typeof fupL?.percentage === 'number';

      // Never fabricate 0% score for learners with INSUFFICIENT_EVIDENCE
      const originalPercentage = hasOriginalSubmission ? origL!.percentage : undefined;
      const followUpPercentage = hasFollowUpSubmission ? fupL!.percentage : undefined;

      const scoreDeltaPercentage =
        originalPercentage !== undefined && followUpPercentage !== undefined
          ? Number((followUpPercentage - originalPercentage).toFixed(1))
          : undefined;

      const statusTransition = `${originalStatus} -> ${followUpStatus}`;
      const beforeRank = STATUS_RANK[originalStatus];
      const afterRank = STATUS_RANK[followUpStatus];

      let movement: LearnerFollowUpMovementStatus;
      let factualObservation: string;

      if (!hasFollowUpSubmission && followUpStatus === 'INSUFFICIENT_EVIDENCE') {
        if (!hasOriginalSubmission && originalStatus === 'INSUFFICIENT_EVIDENCE') {
          movement = 'INSUFFICIENT_BOTH';
          factualObservation =
            'No submission recorded in either original or follow-up assessment. Insufficient evidence to evaluate progress.';
        } else {
          movement = 'AWAITING_FOLLOW_UP';
          factualObservation = `Original status was ${originalStatus}${
            originalPercentage !== undefined ? ` (${originalPercentage}%)` : ''
          }. Awaiting follow-up assessment submission; no follow-up score fabricated.`;
        }
      } else if (!hasOriginalSubmission && originalStatus === 'INSUFFICIENT_EVIDENCE') {
        movement = 'NEW_EVIDENCE_RECORDED';
        factualObservation = `Baseline evidence was missing (INSUFFICIENT_EVIDENCE); follow-up submission recorded ${followUpStatus}${
          followUpPercentage !== undefined ? ` (${followUpPercentage}%)` : ''
        }.`;
      } else if (
        afterRank > beforeRank ||
        (afterRank === beforeRank &&
          scoreDeltaPercentage !== undefined &&
          scoreDeltaPercentage >= 5 &&
          afterRank < STATUS_RANK.DEMONSTRATED)
      ) {
        movement = 'IMPROVED';
        factualObservation = `Competency evidence progressed from ${originalStatus}${
          originalPercentage !== undefined ? ` (${originalPercentage}%)` : ''
        } to ${followUpStatus}${
          followUpPercentage !== undefined ? ` (${followUpPercentage}%)` : ''
        }${scoreDeltaPercentage !== undefined ? ` (${scoreDeltaPercentage >= 0 ? '+' : ''}${scoreDeltaPercentage}%)` : ''}.`;
      } else if (
        afterRank < beforeRank ||
        (afterRank === beforeRank && scoreDeltaPercentage !== undefined && scoreDeltaPercentage <= -10)
      ) {
        movement = 'REGRESSED';
        factualObservation = `Follow-up evidence (${followUpStatus}${
          followUpPercentage !== undefined ? `, ${followUpPercentage}%` : ''
        }) is lower than original evidence (${originalStatus}${
          originalPercentage !== undefined ? `, ${originalPercentage}%` : ''
        }). Teacher review recommended.`;
      } else if (afterRank >= STATUS_RANK.DEMONSTRATED && beforeRank >= STATUS_RANK.DEMONSTRATED) {
        movement = 'MAINTAINED_COMPETENCY';
        factualObservation = `Learner maintained demonstrated competency (${originalStatus} -> ${followUpStatus}).`;
      } else {
        movement = 'NO_CHANGE';
        factualObservation = `Competency status remained ${followUpStatus}${
          scoreDeltaPercentage !== undefined
            ? ` (score delta ${scoreDeltaPercentage >= 0 ? '+' : ''}${scoreDeltaPercentage}%)`
            : ''
        }. Additional guided support may be considered.`;
      }

      if (targeted) {
        totalTargetedLearners++;
        incrementDist(origDist, originalStatus);
        incrementDist(fupDist, followUpStatus);

        if (hasOriginalSubmission && originalPercentage !== undefined) {
          originalSubmittedCount++;
          origPercentagesSum += originalPercentage;
        }
        if (hasFollowUpSubmission && followUpPercentage !== undefined) {
          followUpSubmittedCount++;
          fupPercentagesSum += followUpPercentage;
        } else {
          awaitingFollowUpCount++;
        }

        if (scoreDeltaPercentage !== undefined) {
          pairedDeltas.push(scoreDeltaPercentage);
        }

        if (movement === 'IMPROVED') improvedCount++;
        else if (movement === 'MAINTAINED_COMPETENCY') maintainedCompetencyCount++;
        else if (movement === 'NO_CHANGE') noChangeCount++;
        else if (movement === 'REGRESSED') regressedCount++;
        else if (movement === 'NEW_EVIDENCE_RECORDED') newEvidenceRecordedCount++;
      }

      learnerComparisons.push({
        learnerId,
        learnerName: origL?.learnerName || fupL?.learnerName || rosterLearner?.displayName || `Learner ${learnerId}`,
        isTargetedByAction: targeted,
        originalAttemptId: origL?.attemptId,
        originalScore: hasOriginalSubmission ? origL?.score : undefined,
        originalMaxScore: hasOriginalSubmission ? origL?.maxScore : undefined,
        originalPercentage,
        originalStatus,
        originalEvidenceIds: origL?.supportingEvidenceIds ? [...origL.supportingEvidenceIds] : [],
        followUpAttemptId: fupL?.attemptId,
        followUpScore: hasFollowUpSubmission ? fupL?.score : undefined,
        followUpMaxScore: hasFollowUpSubmission ? fupL?.maxScore : undefined,
        followUpPercentage,
        followUpStatus,
        followUpEvidenceIds: fupL?.supportingEvidenceIds ? [...fupL.supportingEvidenceIds] : [],
        scoreDeltaPercentage,
        statusTransition,
        movement,
        factualObservation,
        teacherFollowUpOverride: fupL?.teacherOverride,
      });
    }

    const originalAveragePercentage =
      originalSubmittedCount > 0 ? Number((origPercentagesSum / originalSubmittedCount).toFixed(1)) : 0;
    const followUpAveragePercentage =
      followUpSubmittedCount > 0 ? Number((fupPercentagesSum / followUpSubmittedCount).toFixed(1)) : 0;
    const averageDeltaPercentage =
      pairedDeltas.length > 0
        ? Number((pairedDeltas.reduce((a, b) => a + b, 0) / pairedDeltas.length).toFixed(1))
        : originalSubmittedCount > 0 && followUpSubmittedCount > 0
        ? Number((followUpAveragePercentage - originalAveragePercentage).toFixed(1))
        : 0;

    // 4. Generate Factual Observations & Advisory Next Steps
    const factualObservations: string[] = [];
    const suggestedNextSteps: string[] = [];

    factualObservations.push(
      `Targeted Cohort (${action.scope}): ${followUpSubmittedCount} of ${totalTargetedLearners} learner(s) have submitted follow-up assessment evidence.`
    );
    if (improvedCount > 0) {
      factualObservations.push(
        `${improvedCount} targeted learner(s) showed positive competency or score progression on the follow-up assessment.`
      );
    }
    if (newEvidenceRecordedCount > 0) {
      factualObservations.push(
        `${newEvidenceRecordedCount} learner(s) with previous insufficient evidence now have recorded follow-up assessment evidence.`
      );
    }
    if (awaitingFollowUpCount > 0) {
      factualObservations.push(
        `${awaitingFollowUpCount} targeted learner(s) are still awaiting follow-up submission and retain INSUFFICIENT_EVIDENCE status on the follow-up.`
      );
    }
    if (regressedCount > 0) {
      factualObservations.push(
        `${regressedCount} targeted learner(s) recorded lower follow-up performance compared to baseline evidence.`
      );
    }

    if (followUpSubmittedCount === 0) {
      suggestedNextSteps.push(
        'Publish or assign the follow-up assessment in ELMS and collect learner submissions before concluding review.'
      );
    } else {
      if (awaitingFollowUpCount > 0) {
        suggestedNextSteps.push(
          `Follow up with ${awaitingFollowUpCount} targeted learner(s) who have not yet submitted the follow-up assessment.`
        );
      }
      if (regressedCount > 0 || fupDist.emergingCount > 0) {
        suggestedNextSteps.push(
          'Review item-level responses for learners still demonstrating emerging understanding and consider targeted one-on-one or small-group follow-up.'
        );
      }
      if (
        awaitingFollowUpCount === 0 &&
        regressedCount === 0 &&
        fupDist.emergingCount === 0 &&
        followUpSubmittedCount > 0
      ) {
        suggestedNextSteps.push(
          'Targeted learners have demonstrated positive progress. You may confirm the follow-up review and mark this Teacher Action Plan as COMPLETED.'
        );
      } else {
        suggestedNextSteps.push(
          'Review the before/after comparison table and either confirm review or plan a subsequent instructional adjustment.'
        );
      }
    }

    const storeKey = `${params.schoolId}:${action.actionId}:${followUpLink.followUpArtifactId}`;
    const existingComparison = followUpComparisonStore.get(storeKey);
    const hasOverrides = learnerComparisons.some(l => !!l.teacherFollowUpOverride);

    let teacherReviewStatus: 'PENDING_REVIEW' | 'REVIEWED' | 'OVERRIDDEN' = 'PENDING_REVIEW';
    if (hasOverrides) {
      teacherReviewStatus = 'OVERRIDDEN';
    } else if (existingComparison?.teacherReviewStatus === 'REVIEWED') {
      teacherReviewStatus = 'REVIEWED';
    }

    const comparisonId =
      existingComparison?.comparisonId ||
      `cmp_${params.schoolId}_${action.actionId}_${followUpLink.followUpArtifactId}`;

    const comparison: TeacherActionFollowUpComparison = {
      comparisonId,
      actionId: action.actionId,
      schoolId: params.schoolId,
      classGroupId: resolvedClassGroupId,
      scope: action.scope,
      learningOutcomeId: originalInterp.learningOutcomeId,
      curriculumVersionId: originalInterp.curriculumVersionId,
      policyVersion: LO_MASTERY_V1_CONFIG.version,
      originalEcgArtifactId: action.ecgArtifactId,
      originalAssessmentId: originalInterp.assessmentId,
      originalInterpretationId: originalInterp.interpretationId,
      followUpArtifactId: followUpLink.followUpArtifactId,
      followUpAssessmentId: followUpInterp.assessmentId,
      followUpInterpretationId: followUpInterp.interpretationId,
      supportingResourceIds: (action.linkedResources || []).map(r => r.artifactId),
      cohortSummary: {
        totalTargetedLearners,
        originalSubmittedCount,
        followUpSubmittedCount,
        awaitingFollowUpCount,
        originalAveragePercentage,
        followUpAveragePercentage,
        averageDeltaPercentage,
        improvedCount,
        maintainedCompetencyCount,
        noChangeCount,
        regressedCount,
        newEvidenceRecordedCount,
        originalCompetencyDistribution: origDist,
        followUpCompetencyDistribution: fupDist,
      },
      learnerComparisons,
      advisoryInsights: {
        factualObservations,
        suggestedNextSteps,
        nonDiagnosticNotice:
          'Advisory before/after comparison based strictly on objective curriculum assessment evidence under LO-MASTERY-V1. The system does not make clinical, cognitive, or diagnostic determinations.',
      },
      teacherReviewStatus,
      reviewedBy: existingComparison?.reviewedBy,
      reviewedAt: existingComparison?.reviewedAt,
      teacherReviewNotes: existingComparison?.teacherReviewNotes,
      evaluatedAt: new Date().toISOString(),
    };

    followUpComparisonStore.set(storeKey, comparison);
    action.latestFollowUpComparisonId = comparisonId;
    if (action.followUpReviewStatus !== 'REVIEWED') {
      action.followUpReviewStatus = followUpSubmittedCount > 0 ? 'PENDING_REVIEW' : 'AWAITING_EVIDENCE';
    }
    PersistentStateService.persistTeacherActionFollowUpComparison(
      params.schoolId,
      action.actionId,
      followUpLink.followUpArtifactId,
      comparison
    );
    PersistentStateService.persistTeacherActionPlan(action);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'TEACHER_ACTION_FOLLOW_UP_COMPARED',
      comparisonId,
      actionId: action.actionId,
      originalEcgArtifactId: action.ecgArtifactId,
      followUpArtifactId: followUpLink.followUpArtifactId,
      teacherId: params.teacherId,
    });

    return comparison;
  },

  /**
   * Phase 31: Allows an authorized teacher to override a learner's follow-up competency status
   * with a mandatory professional rationale, updating the before/after comparison.
   */
  overrideFollowUpLearnerStatus(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    learnerId: string;
    newStatus: InterpretationStatus;
    reason: string;
    followUpArtifactId?: string;
    classGroupId?: string;
  }): TeacherActionFollowUpComparison {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const action = this.getActionById(params.actionId, params.schoolId, params.teacherId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    const linkedFollowUps = action.linkedFollowUpAssessments || [];
    const followUpLink = params.followUpArtifactId
      ? linkedFollowUps.find(f => f.followUpArtifactId === params.followUpArtifactId)
      : linkedFollowUps[linkedFollowUps.length - 1];

    if (!followUpLink) {
      throw new Error(`No follow-up assessment linked to action ${params.actionId}`);
    }

    LearningOutcomeInterpretationService.overrideAssessmentLearnerStatus({
      ecgArtifactId: followUpLink.followUpArtifactId,
      schoolId: params.schoolId,
      learnerId: params.learnerId,
      teacherId: params.teacherId,
      newStatus: params.newStatus,
      reason: params.reason,
      classGroupId: params.classGroupId || action.classGroupId,
    });

    return this.compareActionBeforeAfterEvidence({
      actionId: params.actionId,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      followUpArtifactId: followUpLink.followUpArtifactId,
      classGroupId: params.classGroupId,
    });
  },

  /**
   * Phase 31: Teacher explicitly confirms review of the Before/After Follow-Up Comparison.
   * Does not automatically mark the action COMPLETED unless completeAction is true or completeActionAfterFollowUpReview is called.
   */
  confirmFollowUpReview(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    followUpArtifactId?: string;
    classGroupId?: string;
    teacherReviewNotes?: string;
    completeAction?: boolean;
  }): {
    comparison: TeacherActionFollowUpComparison;
    updatedAction: TeacherActionPlan;
  } {
    if (!AssessmentEvidenceService.isAuthorizedTeacher(params.teacherId, params.schoolId)) {
      throw new Error(`Unauthorized teacher: User ${params.teacherId} in school ${params.schoolId}`);
    }
    const action = actionStore.get(params.actionId);
    if (!action) {
      throw new Error(`Action not found: ${params.actionId}`);
    }
    if (action.schoolId !== params.schoolId) {
      throw new Error('Unauthorized cross-school access to teacher action');
    }

    const comparison = this.compareActionBeforeAfterEvidence({
      actionId: params.actionId,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      followUpArtifactId: params.followUpArtifactId,
      classGroupId: params.classGroupId,
    });

    const now = new Date().toISOString();
    comparison.teacherReviewStatus =
      comparison.teacherReviewStatus === 'OVERRIDDEN' ? 'OVERRIDDEN' : 'REVIEWED';
    comparison.reviewedBy = params.teacherId;
    comparison.reviewedAt = now;
    if (params.teacherReviewNotes !== undefined) {
      comparison.teacherReviewNotes = params.teacherReviewNotes;
    }

    const storeKey = `${params.schoolId}:${action.actionId}:${comparison.followUpArtifactId}`;
    followUpComparisonStore.set(storeKey, comparison);

    action.followUpReviewStatus = 'REVIEWED';
    action.updatedAt = now;

    if (params.completeAction) {
      action.status = 'COMPLETED';
      action.completedAt = now;
      action.completedBy = params.teacherId;
    }
    PersistentStateService.persistTeacherActionFollowUpComparison(
      params.schoolId,
      action.actionId,
      comparison.followUpArtifactId,
      comparison
    );
    PersistentStateService.persistTeacherActionPlan(action);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'TEACHER_ACTION_FOLLOW_UP_REVIEW_CONFIRMED',
      actionId: action.actionId,
      comparisonId: comparison.comparisonId,
      followUpArtifactId: comparison.followUpArtifactId,
      teacherId: params.teacherId,
      completedAction: !!params.completeAction,
    });

    return {
      comparison,
      updatedAction: action,
    };
  },

  /**
   * Phase 31: Explicitly confirms the follow-up review AND marks the Teacher Action Plan as COMPLETED.
   */
  completeActionAfterFollowUpReview(params: {
    actionId: string;
    schoolId: string;
    teacherId: string;
    followUpArtifactId?: string;
    classGroupId?: string;
    teacherReviewNotes?: string;
  }): {
    comparison: TeacherActionFollowUpComparison;
    updatedAction: TeacherActionPlan;
  } {
    return this.confirmFollowUpReview({
      ...params,
      completeAction: true,
    });
  },

  ingestActionPlan(action: TeacherActionPlan): void {
    if (!action || !action.actionId || !action.schoolId) return;
    actionStore.set(action.actionId, action);
  },

  ingestFollowUpComparison(docData: {
    schoolId?: string;
    actionId?: string;
    followUpArtifactId?: string;
    comparison?: TeacherActionFollowUpComparison;
  }): void {
    if (!docData?.schoolId || !docData?.actionId || !docData?.followUpArtifactId || !docData?.comparison) {
      return;
    }
    const storeKey = `${docData.schoolId}:${docData.actionId}:${docData.followUpArtifactId}`;
    followUpComparisonStore.set(storeKey, docData.comparison);
  },

  async syncSchoolActionsFromFirestore(schoolId: string): Promise<TeacherActionPlan[]> {
    await PersistentStateService.hydrateSchoolTeacherActions(schoolId);
    return this.getActionPlans(schoolId);
  }
};

PersistentStateService.registerDomainService('TeacherActionService', {
  clearInMemoryOnly: () => {
    TeacherActionService.clearStore();
  },
  ingestState: (data: {
    schoolId?: string;
    actions?: TeacherActionPlan[];
    comparisons?: Array<{
      schoolId?: string;
      actionId?: string;
      followUpArtifactId?: string;
      comparison?: TeacherActionFollowUpComparison;
    }>;
  }) => {
    if (Array.isArray(data?.actions)) {
      for (const act of data.actions) {
        TeacherActionService.ingestActionPlan(act);
      }
    }
    if (Array.isArray(data?.comparisons)) {
      for (const cmp of data.comparisons) {
        TeacherActionService.ingestFollowUpComparison(cmp);
      }
    }
  },
});
