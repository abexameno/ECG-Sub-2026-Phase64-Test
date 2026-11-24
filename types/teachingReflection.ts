export type DeliveryStatus = 'DELIVERED' | 'PARTIALLY_DELIVERED' | 'CANCELLED' | 'RESCHEDULED';

export type ReflectionStatus = 'NOT_REVIEWED' | 'REVIEWED' | 'FOLLOW_UP_REQUIRED' | 'CLOSED';

export type PacingObservation = 'TOO_FAST' | 'APPROPRIATE' | 'TOO_SLOW';

export type LearnerResponseObservation = 'STRONG' | 'MIXED' | 'LIMITED' | 'UNCLEAR';

export type ResourceEffectiveness = 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'NEEDS_CHANGE' | 'NOT_REVIEWED';

export type RecommendationType =
  | 'PROCEED'
  | 'REINFORCE'
  | 'RETEACH'
  | 'REASSESS'
  | 'EXTEND'
  | 'CONTINUE_SUPPORT'
  | 'REGROUP'
  | 'REVIEW_PREREQUISITE'
  | 'TEACHER_DEFINED';

export type RecommendationStatus = 'PROPOSED' | 'ACCEPTED' | 'MODIFIED' | 'REJECTED';

export type NextLessonPlanStatus = 'PROPOSED' | 'ACCEPTED' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface LessonReview {
  id: string;
  schoolId: string;
  teacherId: string;
  classGroupId: string;
  teachingPlanId: string;
  teachingAllocationId: string;
  teachingActivityId?: string;
  curriculumVersionId: string;
  learningAreaId: string;
  learningOutcomeIds: string[];
  lessonDate: string;
  deliveryStatus: DeliveryStatus;
  reflectionStatus: ReflectionStatus;
  overallReflection?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TeachingReflection {
  id: string;
  lessonReviewId: string;
  schoolId: string;
  teacherId: string;
  pacing: PacingObservation;
  learnerResponse: LearnerResponseObservation;
  resourceEffectiveness: ResourceEffectiveness;
  whatWorked?: string;
  whatWasDifficult?: string;
  timingObservation?: string;
  teacherObservation?: string;
  corrections?: Array<{
    timestamp: string;
    actor: string;
    reason: string;
    previousValues: Record<string, any>;
    newValues: Record<string, any>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface LessonEvidenceSummary {
  lessonReviewId: string;
  schoolId: string;
  classGroupId: string;
  attendanceCount: { present: number; total: number };
  participationCount: number;
  learnerActivityCount: number;
  assessmentEvidenceCount: number;
  attentionSignalCount: number;
  supportPlanCount: number;
  activeGroupCount: number;
  interpretationBreakdown: {
    mastered: number;
    developing: number;
    belowExpectation: number;
    insufficientEvidence: number;
  };
}

export interface NextLessonRecommendation {
  id: string;
  schoolId: string;
  teacherId: string;
  classGroupId: string;
  sourceLessonReviewId: string;
  learningOutcomeIds: string[];
  recommendationType: RecommendationType;
  reason: string;
  evidenceReferences: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: RecommendationStatus;
  createdAt: string;
}

export interface NextLessonPlan {
  id: string;
  schoolId: string;
  teacherId: string;
  classGroupId: string;
  sourceLessonReviewId: string;
  teachingPlanId: string;
  teachingAllocationId: string;
  curriculumVersionId: string;
  learningOutcomeIds: string[];
  actionType: RecommendationType;
  objective: string;
  resourceReferences: string[];
  groupReferences: string[];
  plannedDate: string;
  status: NextLessonPlanStatus;
  createdAt: string;
  updatedAt: string;
}
