export type LearnerLearningStateValue =
  | 'INSUFFICIENT_EVIDENCE'
  | 'NEEDS_REVIEW'
  | 'SUPPORT_RECOMMENDED'
  | 'READY_FOR_REINFORCEMENT'
  | 'READY_FOR_PROGRESSION'
  | 'EXTENSION_OPPORTUNITY';

export interface LearnerLearningState {
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  curriculumVersionId: string;
  gradeLevelId: string;
  learningAreaId: string;
  learningOutcomeId: string;
  evidenceSummary: string;
  interpretationStatus: string; // DEVELOPING, DEMONSTRATED, etc. from Phase 14
  supportHistorySummary: string;
  attentionSummary: string;
  lastEvidenceAt?: string;
  lastActivityAt?: string;
  state: LearnerLearningStateValue;
  generatedAt: string;
}

export type AdaptiveOptionType =
  | 'REVIEW_PREREQUISITE'
  | 'RETEACH'
  | 'GUIDED_PRACTICE'
  | 'ADDITIONAL_PRACTICE'
  | 'SCAFFOLDED_ACTIVITY'
  | 'REINFORCEMENT'
  | 'REASSESS'
  | 'PROCEED'
  | 'EXTENSION'
  | 'TEACHER_DEFINED';

export type EvidenceBasis = 'STRONG' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT';

export interface AdaptiveLearningOption {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  learningOutcomeIds: string[];
  optionType: AdaptiveOptionType;
  reason: string;
  evidenceBasis: EvidenceBasis;
  evidenceReferences: string[];
  source: 'DETERMINISTIC' | 'AI_RECOMMENDED' | 'TEACHER_DEFINED';
  priority: number;
  status: 'PENDING' | 'ACCEPTED' | 'MODIFIED' | 'DISMISSED';
  createdAt: string;
}

export type PathwayStatus = 'PROPOSED' | 'ACCEPTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'DISMISSED' | 'OUTDATED';

export type StepStatus = 'PENDING' | 'READY' | 'DELIVERED' | 'COMPLETED' | 'SKIPPED' | 'CANCELLED';

export type TeacherDecision = 'PENDING' | 'ACCEPT' | 'MODIFY' | 'REJECT' | 'POSTPONE' | 'CUSTOM';

export interface AdaptivePathwayStep {
  id: string;
  pathwayId: string;
  sequence: number;
  learningOutcomeIds: string[];
  stepType: AdaptiveOptionType;
  resourceReference?: string; // ContentArtifact ID
  objective: string;
  status: StepStatus;
  teacherDecision: TeacherDecision;
  createdAt: string;
  completedAt?: string;
}

export interface AdaptiveLearningPathway {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  curriculumVersionId: string;
  learningAreaId: string;
  targetLearningOutcomeIds: string[];
  sourceEvidenceReferences: string[];
  sourceSupportPlanIds?: string[];
  currentStep: number;
  steps: AdaptivePathwayStep[];
  status: PathwayStatus;
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
}

export interface PathwayHistoryEntry {
  id: string;
  pathwayId: string;
  action: string;
  actorId: string;
  timestamp: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  reason?: string;
}
