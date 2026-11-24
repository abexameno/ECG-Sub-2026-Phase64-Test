
import { InterpretationStatus } from './interpretation';

export type TeacherActionType =
  | 'REMEDIAL_SUPPORT'
  | 'RETEACH'
  | 'RETEACHING'
  | 'GUIDED_PRACTICE'
  | 'DIFFERENTIATED_PRACTICE'
  | 'SMALL_GROUP_SUPPORT'
  | 'INDIVIDUAL_FOLLOW_UP'
  | 'PEER_SUPPORTED_PRACTICE'
  | 'EXTENSION_CHALLENGE'
  | 'FURTHER_ASSESSMENT'
  | 'NO_ADDITIONAL_ACTION'
  | 'NO_ACTION_REQUIRED'
  | 'OTHER';

export type TeacherActionScope =
  | 'WHOLE_CLASS'
  | 'SELECTED_LEARNERS'
  | 'INDIVIDUAL_LEARNER';

export type TeacherActionStatus =
  | 'PROPOSED'
  | 'PLANNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export interface TeacherActionResourceLink {
  artifactId: string;
  contentType: string;
  title: string;
  createdAt: string;
  createdBy: string;
  sourceInterpretationId?: string;
  ecgArtifactId?: string;
}

export interface TeacherActionFollowUpLink {
  followUpId: string;
  actionId: string;
  schoolId: string;
  followUpArtifactId: string;
  followUpAssessmentId?: string;
  originalEcgArtifactId: string;
  originalAssessmentId?: string;
  sourceInterpretationId?: string;
  supportingResourceId?: string;
  title: string;
  contentType: string;
  scope: TeacherActionScope;
  classGroupId?: string;
  selectedLearnerIds?: string[];
  learnerId?: string;
  elmsPublicationStatus: 'NOT_PUBLISHED' | 'PUBLISHED' | 'ASSIGNED';
  elmsResourceId?: string;
  elmsAssignmentId?: string;
  createdAt: string;
  createdBy: string;
}

export type LearnerFollowUpMovementStatus =
  | 'IMPROVED'
  | 'MAINTAINED_COMPETENCY'
  | 'NO_CHANGE'
  | 'REGRESSED'
  | 'NEW_EVIDENCE_RECORDED'
  | 'AWAITING_FOLLOW_UP'
  | 'INSUFFICIENT_BOTH';

export interface LearnerBeforeAfterComparison {
  learnerId: string;
  learnerName?: string;
  isTargetedByAction: boolean;
  // Original ("Before") Evidence Snapshot
  originalAttemptId?: string;
  originalScore?: number;
  originalMaxScore?: number;
  originalPercentage?: number;
  originalStatus: InterpretationStatus;
  originalEvidenceIds: string[];
  // Follow-up ("After") Evidence Snapshot
  followUpAttemptId?: string;
  followUpScore?: number;
  followUpMaxScore?: number;
  followUpPercentage?: number;
  followUpStatus: InterpretationStatus;
  followUpEvidenceIds: string[];
  // Deterministic Delta & Status Transition
  scoreDeltaPercentage?: number;
  statusTransition: string;
  movement: LearnerFollowUpMovementStatus;
  factualObservation: string;
  teacherFollowUpOverride?: {
    teacherId: string;
    previousStatus: InterpretationStatus;
    overriddenStatus: InterpretationStatus;
    reason: string;
    recordedAt: string;
  };
}

export interface TeacherActionFollowUpComparison {
  comparisonId: string;
  actionId: string;
  schoolId: string;
  classGroupId?: string;
  scope: TeacherActionScope;
  learningOutcomeId: string;
  curriculumVersionId: string;
  policyVersion: string;
  // Lineage
  originalEcgArtifactId: string;
  originalAssessmentId: string;
  originalInterpretationId: string;
  followUpArtifactId: string;
  followUpAssessmentId: string;
  followUpInterpretationId: string;
  supportingResourceIds: string[];
  // Cohort Before/After Summary
  cohortSummary: {
    totalTargetedLearners: number;
    originalSubmittedCount: number;
    followUpSubmittedCount: number;
    awaitingFollowUpCount: number;
    originalAveragePercentage: number;
    followUpAveragePercentage: number;
    averageDeltaPercentage: number;
    improvedCount: number;
    maintainedCompetencyCount: number;
    noChangeCount: number;
    regressedCount: number;
    newEvidenceRecordedCount: number;
    originalCompetencyDistribution: {
      strongDemonstrationCount: number;
      demonstratedCount: number;
      developingCount: number;
      emergingCount: number;
      insufficientEvidenceCount: number;
    };
    followUpCompetencyDistribution: {
      strongDemonstrationCount: number;
      demonstratedCount: number;
      developingCount: number;
      emergingCount: number;
      insufficientEvidenceCount: number;
    };
  };
  learnerComparisons: LearnerBeforeAfterComparison[];
  advisoryInsights: {
    factualObservations: string[];
    suggestedNextSteps: string[];
    nonDiagnosticNotice: string;
  };
  teacherReviewStatus: 'PENDING_REVIEW' | 'REVIEWED' | 'OVERRIDDEN';
  reviewedBy?: string;
  reviewedAt?: string;
  teacherReviewNotes?: string;
  evaluatedAt: string;
}

export interface TeacherActionPlan {
  actionId: string;
  ecgArtifactId: string;
  assessmentId?: string;
  schoolId: string;
  classGroupId?: string;
  learnerId?: string; // Set if INDIVIDUAL_LEARNER
  selectedLearnerIds?: string[]; // Set if SELECTED_LEARNERS
  curriculumLessonId?: string;
  scheduledLessonId?: string;
  masterSowId?: string;
  parentArtifactId?: string;
  actionType: TeacherActionType;
  scope: TeacherActionScope;
  focusArea: string;
  teacherNotes: string;
  status: TeacherActionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
  sourceInterpretationId?: string;
  resultArtifactId?: string;
  linkedResources?: TeacherActionResourceLink[];
  // Phase 31 Follow-Up Assessment & Evidence Reassessment
  linkedFollowUpAssessments?: TeacherActionFollowUpLink[];
  latestFollowUpComparisonId?: string;
  followUpReviewStatus?: 'NOT_STARTED' | 'AWAITING_EVIDENCE' | 'PENDING_REVIEW' | 'REVIEWED';
  
  // Curriculum Lineage Context
  curriculumContext?: {
    grade?: string;
    subject?: string;
    term?: string;
    week?: number | string;
    lesson?: number | string;
    strand?: string;
    subStrand?: string;
    learningOutcomeId?: string;
    specificLearningOutcome?: string;
    learningOutcomes?: string;
  };
}

export interface SuggestedTeacherAction {
  id: string;
  actionType: TeacherActionType;
  scope: TeacherActionScope;
  focusArea: string;
  rationale: string;
  targetLearnerIds?: string[];
}
