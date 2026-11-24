import { DeliveryStatus, ReflectionStatus, PacingObservation, LearnerResponseObservation, ResourceEffectiveness, RecommendationType, RecommendationStatus, NextLessonPlanStatus } from './teachingReflection.ts';

export type SequenceEntryStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'REVIEWED'
  | 'FOLLOW_UP_REQUIRED'
  | 'CARRIED_FORWARD'
  | 'COMPLETED';

export type ContinuityIssueType =
  | 'REINFORCEMENT_REQUIRED'
  | 'RETEACH_REQUIRED'
  | 'REASSESSMENT_REQUIRED'
  | 'INCOMPLETE_ACTIVITY'
  | 'UNRESOLVED_MISCONCEPTION'
  | 'INSUFFICIENT_EVIDENCE'
  | 'PACING_INCOMPLETE';

export type ContinuityStatus =
  | 'ON_TRACK'
  | 'FOLLOW_UP_REQUIRED'
  | 'REINFORCEMENT_REQUIRED'
  | 'RETEACH_REQUIRED'
  | 'REASSESSMENT_REQUIRED'
  | 'EXTENSION_AVAILABLE'
  | 'PENDING_REVIEW';

export interface TeachingSequence {
  id: string;
  schoolId: string;
  classGroupId: string;
  teachingPlanId: string;
  learningAreaId: string;
  curriculumVersionId: string;
  title: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
}

export interface LessonSequenceEntry {
  id: string;
  teachingSequenceId: string;
  schoolId: string;
  classGroupId: string;
  teachingAllocationId: string;
  lessonReviewId?: string;
  nextLessonPlanId?: string;
  sequenceNumber: number;
  plannedFocus: string;
  actualFocus?: string;
  entryStatus: SequenceEntryStatus;
  plannedDate: string;
  deliveredDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContinuityIssue {
  id: string;
  schoolId: string;
  classGroupId: string;
  sourceLessonReviewId: string;
  issueType: ContinuityIssueType;
  description: string;
  status: 'OPEN' | 'CARRIED_FORWARD' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string;
}

export interface FollowThroughAction {
  id: string;
  schoolId: string;
  teacherId: string;
  classGroupId: string;
  sourceLessonReviewId: string;
  recommendationId: string;
  actionType: RecommendationType;
  teacherDecision: RecommendationStatus;
  teacherNotes?: string;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
}

export interface ContinuityEvidenceSummary {
  sequenceId: string;
  totalLessonsPlanned: number;
  totalLessonsDelivered: number;
  totalReviewsCompleted: number;
  openIssuesCount: number;
  activeFollowThroughs: number;
}

export interface InstructionalContinuity {
  classGroupId: string;
  learningAreaId: string;
  previousLesson?: {
    reviewId: string;
    intendedFocus: string;
    actualFocus?: string;
    deliveryStatus: DeliveryStatus;
    keyEvidence: string[];
    reflection?: any;
    unresolvedIssues: ContinuityIssue[];
    approvedAction?: FollowThroughAction;
  };
  currentLesson: {
    teachingAllocationId: string;
    plannedFocus: string;
    relevantPreviousContext?: string;
    outstandingFollowThrough: FollowThroughAction[];
  };
  nextLesson?: {
    plannedNextStep: string;
    teacherApprovedAdjustment?: string;
    requiredPreparation: string[];
    outstandingEvidenceActions: string[];
  };
  continuityStatus: ContinuityStatus;
  explanation: string;
}
