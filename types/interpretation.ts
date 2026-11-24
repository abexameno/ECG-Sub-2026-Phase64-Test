export type InterpretationStatus =
  | 'INSUFFICIENT_EVIDENCE'
  | 'EMERGING'
  | 'DEVELOPING'
  | 'DEMONSTRATED'
  | 'STRONG_DEMONSTRATION';

export type EvidenceConflictStatus = 'CONSISTENT' | 'MODERATE_VARIANCE' | 'HIGH_CONFLICT' | 'NOT_APPLICABLE';

export type AssessmentAssignmentStatus =
  | 'NOT_PUBLISHED'
  | 'PUBLISHED_NOT_ASSIGNED'
  | 'ASSIGNED'
  | 'PARTIALLY_SUBMITTED'
  | 'ALL_SUBMITTED'
  | 'NO_SUBMISSIONS';

/**
 * Formalized LO-MASTERY-V1 Policy Configuration.
 * Authoritative single source of truth for CBE Learning Outcome Mastery thresholds and weighting.
 */
export const LO_MASTERY_V1_CONFIG = {
  version: 'LO-MASTERY-V1',
  strongMinAvg: 85,
  strongMinFloor: 70,
  demonstratedMinAvg: 70,
  demonstratedMinFloor: 50,
  developingMinAvg: 50,
  highConflictDelta: 40,
  moderateVarianceDelta: 20,
  itemDeficitThreshold: 60,
  minCorroboratingAttempts: 2,
  attemptWeighting: 'EQUAL',
} as const;

export type LoMasteryV1Config = typeof LO_MASTERY_V1_CONFIG;

export interface TeacherOverride {
  teacherId: string;
  previousStatus: InterpretationStatus;
  overriddenStatus: InterpretationStatus;
  reason: string;
  recordedAt: string;
}

export interface EvidenceMetric {
  totalEvidenceCount: number;
  validEvidenceCount: number;
  assessmentResultCount: number;
  teacherEvaluationCount: number;
  latestEvidenceDate?: string;
  highestScorePercentage?: number;
  lowestScorePercentage?: number;
  averagePercentage?: number;
}

export interface LearningOutcomeInterpretation {
  interpretationId: string;
  schoolId: string;
  learnerId: string;
  curriculumVersionId: string;
  learningOutcomeId: string;
  interpretationStatus: InterpretationStatus;
  evidenceCount: number;
  conflictStatus: EvidenceConflictStatus;
  metrics: EvidenceMetric;
  evaluatedAt: string;
  interpretationPolicyVersion: string;
  explanation: string;
  supportingEvidenceIds: string[];
  teacherOverride?: TeacherOverride;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerAssessmentInterpretation {
  learnerId: string;
  learnerName?: string;
  attemptId?: string;
  score?: number;
  maxScore?: number;
  percentage?: number;
  status: InterpretationStatus;
  conflictStatus: EvidenceConflictStatus;
  explanation: string;
  supportingEvidenceIds: string[];
  teacherOverride?: TeacherOverride;
}

export interface AssessmentItemAnalytic {
  itemId: string;
  sequence: number;
  prompt: string;
  maxMarks: number;
  averageScore: number;
  successRatePercentage: number;
  strugglingLearnerCount: number;
}

export interface TeacherSupportInsight {
  identifiedCurriculumGaps: string[];
  recommendedPedagogicalActions: string[];
  nonDiagnosticNotice: string;
}

export interface AssessmentEvidenceInterpretation {
  interpretationId: string;
  schoolId: string;
  ecgArtifactId: string;
  elmsResourceId: string;
  assessmentId: string;
  learningOutcomeId: string;
  curriculumVersionId: string;
  evaluatedAt: string;
  policyVersion: string;
  attemptWeighting: 'EQUAL';
  classGroupId?: string;
  assignmentId?: string;
  assignmentStatus: AssessmentAssignmentStatus;
  factualSummary: {
    totalLearnersAssessed: number;
    totalAttempts: number;
    averageScorePercentage: number;
    highestScorePercentage: number;
    lowestScorePercentage: number;
    totalLearnersAssigned?: number;
    totalLearnersSubmitted?: number;
    totalLearnersAwaitingSubmission?: number;
    evidenceStatus?: 'EVIDENCE_RECORDED' | 'AWAITING_LEARNER_SUBMISSIONS' | 'PARTIAL_SUBMISSIONS';
    itemAnalytics: AssessmentItemAnalytic[];
    availableAssignments?: { assignmentId: string; classGroupId: string; classGroupName?: string }[];
  };
  competencyDistribution: {
    strongDemonstrationCount: number;
    demonstratedCount: number;
    developingCount: number;
    emergingCount: number;
    insufficientEvidenceCount: number;
  };
  learnerInterpretations: LearnerAssessmentInterpretation[];
  teacherSupportInsights: TeacherSupportInsight;
  teacherReviewStatus: 'PENDING_REVIEW' | 'REVIEWED' | 'OVERRIDDEN';
  learningOutcomeStatement?: string;
  createdAt: string;
  updatedAt: string;
}
