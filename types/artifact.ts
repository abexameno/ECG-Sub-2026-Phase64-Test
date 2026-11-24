export type ArtifactType =
  | 'scheme_of_work'
  | 'lesson_plan'
  | 'learning_activity'
  | 'assessment'
  | 'revision_content'
  | 'learner_content'
  | 'teacher_resource';

export type ArtifactStatus = 'draft' | 'generated' | 'validated' | 'published' | 'archived';

export type ArtifactSource = 'ai_generated' | 'human_created' | 'human_edited';

export interface CurriculumReference {
  curriculumId?: string;
  gradeLevelId: string;
  learningAreaId: string;
  strandId?: string;
  subStrandId?: string;
  learningOutcomeIds: string[];
}

export interface GenerationMetadata {
  generationId?: string;
  model?: string;
  modelName?: string;
  promptVersion?: string;
  promptTemplateId?: string;
  generatedAt: string;
  generationParameters?: any;
  contentHash?: string;
  generatedByUserId?: string;
}

export interface ContentArtifact<T = unknown> {
  id: string;
  artifactType: ArtifactType;
  schoolId: string;
  schoolName?: string;
  schoolLogo?: string;
  county?: string;
  academicYear?: string;
  term?: string;
  curriculumId: string;
  curriculumVersion: string;
  gradeLevelId: string;
  gradeLevelName?: string;
  learningAreaId: string;
  learningAreaName?: string;
  teachingPlanId?: string;
  termId?: string;
  weekNumber?: number;
  lessonNumber?: number;
  curriculumReferences: CurriculumReference[];
  generationMetadata?: GenerationMetadata;
  version: number;
  status: ArtifactStatus;
  source: ArtifactSource;
  createdAt: string;
  updatedAt: string;
  content: T;
  alignmentStatus?: 'well_aligned' | 'needs_review' | 'significant_misalignment';
  alignmentFindings?: AlignmentFinding[];
  // Phase 30 & 31 Action, Resource & Follow-Up Lineage
  teacherActionId?: string;
  sourceInterpretationId?: string;
  ecgArtifactId?: string;
  originalEcgArtifactId?: string;
  originalAssessmentId?: string;
  supportingResourceId?: string;
  isFollowUpAssessment?: boolean;
  masterSowId?: string;
  parentArtifactId?: string;
  curriculumLessonId?: string;
  scheduledLessonId?: string;
  classGroupId?: string;
  actionScope?: 'WHOLE_CLASS' | 'SELECTED_LEARNERS' | 'INDIVIDUAL_LEARNER';
  selectedLearnerIds?: string[];
  targetLearnerId?: string;
}

export interface AlignmentFinding {
  category: string;
  status: 'well_aligned' | 'needs_review' | 'significant_misalignment';
  message: string;
  evidence?: string;
  reference?: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

export interface ArtifactValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
