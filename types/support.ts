export type SupportNeedSourceType =
  | 'ATTENTION_SIGNAL'
  | 'TEACHER_OBSERVATION'
  | 'ASSESSMENT_EVIDENCE'
  | 'INTERPRETATION'
  | 'TEACHER_REQUEST';

export type SupportNeedStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';

export interface LearnerSupportNeed {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  learningOutcomeId: string;
  sourceType: SupportNeedSourceType;
  sourceReference?: string;
  reason: string;
  status: SupportNeedStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  dismissedAt?: string;
  dismissedBy?: string;
}

export type SupportStrategy =
  | 'RETEACH_CONCEPT'
  | 'GUIDED_PRACTICE'
  | 'ADDITIONAL_PRACTICE'
  | 'SCAFFOLDED_ACTIVITY'
  | 'EXAMPLE_AND_MODELLING'
  | 'SMALL_GROUP_SUPPORT'
  | 'PEER_SUPPORTED_ACTIVITY'
  | 'EXTENSION_ACTIVITY'
  | 'REVIEW_PREVIOUS_CONCEPT'
  | 'TARGETED_ASSESSMENT'
  | 'MONITOR_AND_REVIEW'
  | 'OTHER';

export type SupportIntensity = 'STANDARD' | 'ADDITIONAL_SUPPORT' | 'INTENSIVE_SUPPORT';

export type SupportPlanStatus = 'PLANNED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

export type SupportOutcomeDecision =
  | 'CONTINUE_SUPPORT'
  | 'MONITOR'
  | 'REASSESS'
  | 'RESOLVED'
  | 'REFER_FOR_REVIEW';

export interface SupportHistoryEntry {
  id: string;
  action: string;
  actorId: string;
  timestamp: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  reason?: string;
}

export interface LearnerSupportPlan {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  supportNeedId: string;
  learningOutcomeIds: string[];
  strategy: SupportStrategy;
  intensity: SupportIntensity;
  objective: string;
  plannedDate: string; // YYYY-MM-DD
  status: SupportPlanStatus;
  notes?: string;
  createdAt: string;
  createdBy: string;
  artifactId?: string;
  artifactVersion?: number;
  groupSupportId?: string;
  deliveredAt?: string;
  deliveredBy?: string;
  outcomeDecision?: SupportOutcomeDecision;
  outcomeNotes?: string;
  outcomeRecordedAt?: string;
  outcomeRecordedBy?: string;
  history: SupportHistoryEntry[];
  idempotencyKey?: string;
}

export interface LearnerSupportContext {
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  curriculumVersionId: string;
  gradeLevelId: string;
  learningAreaId: string;
  learningOutcomeIds: string[];
  sourceSignalIds: string[];
  sourceEvidenceReferences: string[];
  currentInterpretationReferences: string[];
  teachingAllocationReferences: string[];
}

export interface GroupSupportAssignment {
  id: string;
  schoolId: string;
  classGroupId: string;
  teacherId: string;
  learnerIds: string[];
  supportPlanIds: string[];
  strategy: SupportStrategy;
  learningOutcomeId: string;
  createdAt: string;
}
