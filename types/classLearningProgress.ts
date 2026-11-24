import { DeliveryStatus } from './teachingReflection.ts';

export type InstructionalHealthStatus =
  | 'ON_TRACK'
  | 'DELIVERY_LAG'
  | 'EVIDENCE_GAP'
  | 'FOLLOW_UP_REQUIRED'
  | 'ASSESSMENT_PENDING'
  | 'ATTENTION_REQUIRED';

export type OutcomeEvidenceState =
  | 'NO_EVIDENCE'
  | 'EVIDENCE_AVAILABLE'
  | 'ASSESSMENT_EVIDENCE_AVAILABLE'
  | 'INTERPRETATION_AVAILABLE'
  | 'FOLLOW_UP_REQUIRED';

export type CoverageVarianceStatus =
  | 'ON_PLAN'
  | 'AHEAD'
  | 'BEHIND'
  | 'NOT_YET_STARTED';

export interface ClassPlannedProgress {
  totalPlannedLessons: number;
  totalPlannedOutcomes: number;
  teachingPlanId?: string;
}

export interface ClassDeliveredProgress {
  totalDeliveredLessons: number;
  totalNotDeliveredLessons: number;
  deliveryPercentage: number;
}

export interface ClassEvidencedProgress {
  totalCompletedWithEvidence: number;
  evidenceGapCount: number;
  evidencePercentage: number;
}

export interface LearningOutcomeProgressSummary {
  learningOutcomeId: string;
  state: OutcomeEvidenceState;
  assessmentEvidenceCount: number;
  interpretationStatus?: string;
  hasFollowUp: boolean;
}

export interface ProgressAttentionItem {
  id: string;
  reason: string;
  originatingRecordId: string;
  originatingRecordType: 'LESSON_REVIEW' | 'TEACHING_ACTIVITY' | 'FOLLOW_UP' | 'ASSESSMENT_EVIDENCE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedAction: string;
  traceability: string;
}

export interface ClassCoverageSummaryStatus {
  plannedCoverageCount: number;
  actualCoverageCount: number;
  varianceStatus: CoverageVarianceStatus;
  coveragePercentage: number;
}

export interface ClassLearningProgress {
  schoolId: string;
  classGroupId: string;
  learningAreaId: string;
  plannedProgress: ClassPlannedProgress;
  deliveredProgress: ClassDeliveredProgress;
  evidencedProgress: ClassEvidencedProgress;
  outcomeSummaries: LearningOutcomeProgressSummary[];
  coverageSummary: ClassCoverageSummaryStatus;
  instructionalHealth: InstructionalHealthStatus;
  healthExplanation: string;
  attentionItems: ProgressAttentionItem[];
  generatedAt: string;
}
