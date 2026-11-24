export type AssessmentType = 'DIAGNOSTIC' | 'FORMATIVE' | 'PRACTICE' | 'SUMMATIVE' | 'REVISION';

export type AssessmentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type AssessmentItemType = 'MULTIPLE_CHOICE' | 'STRUCTURED' | 'TRUE_FALSE' | 'ESSAY';

export type AssessmentAttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'EVALUATED' | 'CANCELLED';

export interface AssessmentOption {
  key: string; // e.g. 'A', 'B', 'C', 'D'
  text: string;
}

export interface AssessmentItem {
  itemId: string;
  assessmentId: string;
  learningOutcomeId: string;
  sequence: number;
  type: AssessmentItemType;
  prompt: string;
  options?: AssessmentOption[];
  correctAnswer?: string;
  marks: number;
  metadata?: Record<string, unknown>;
}

export interface Assessment {
  assessmentId: string;
  schoolId: string;
  curriculumVersionId: string;
  learningOutcomeId: string;
  teachingPlanId?: string;
  teachingAllocationId?: string;
  contentArtifactId?: string;
  contentArtifactVersion?: number;
  type: AssessmentType;
  title: string;
  status: AssessmentStatus;
  items: AssessmentItem[];
  classGroupId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentAttempt {
  attemptId: string;
  assessmentId: string;
  assessmentVersion: number;
  learnerId: string;
  schoolId: string;
  startedAt: string;
  submittedAt?: string;
  status: AssessmentAttemptStatus;
  attemptNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentResponse {
  responseId: string;
  attemptId: string;
  itemId: string;
  learnerId: string;
  schoolId: string;
  response: string | number | boolean | Record<string, unknown>;
  submittedAt: string;
  createdAt: string;
}

export interface ItemScore {
  itemId: string;
  marksAwarded: number;
  maxMarks: number;
  feedback?: string;
}

export interface AssessmentEvaluation {
  evaluationId: string;
  attemptId: string;
  schoolId: string;
  evaluatorType: 'SYSTEM' | 'TEACHER' | 'AUTHORIZED_MARKER';
  evaluatorId?: string;
  totalMarks: number;
  marksAwarded: number;
  percentage: number;
  status: 'PENDING' | 'EVALUATED' | 'REVIEW_REQUIRED' | 'VOIDED';
  evaluatedAt: string;
  feedback?: string;
  itemScores: ItemScore[];
}

export interface EvidenceProvenance {
  sourceId: string;
  evaluatorType: string;
  evaluatorId?: string;
  notes?: string;
}

export interface LearningOutcomeEvidence {
  evidenceId: string;
  schoolId: string;
  learnerId: string;
  curriculumVersionId: string;
  learningOutcomeId: string;
  assessmentId?: string;
  assessmentVersion?: number;
  attemptId?: string;
  evaluationId?: string;
  evidenceType: 'ASSESSMENT_RESULT' | 'TEACHER_EVALUATION' | 'LEARNER_SUBMISSION' | 'ACTIVITY_EVIDENCE';
  score?: number;
  percentage?: number;
  recordedAt: string;
  provenance: EvidenceProvenance;
  isVoided?: boolean;
}

export interface OutcomeEvidenceSummary {
  schoolId: string;
  learnerId: string;
  learningOutcomeId: string;
  curriculumVersionId: string;
  totalEvidenceRecords: number;
  latestScorePercentage?: number;
  evidenceList: LearningOutcomeEvidence[];
}

export interface ElmsAssessmentEvidenceResponse {
  itemId: string;
  questionText?: string;
  response: string | number | boolean | Record<string, unknown>;
  correctAnswer?: string;
  marksAwarded: number;
  maxMarks: number;
  isCorrect: boolean;
  feedback?: string;
}

export interface ElmsAssessmentEvidenceRecord {
  evidenceRecordId: string;
  evidenceId?: string;
  schoolId: string;
  ecgArtifactId: string;
  elmsResourceId: string;
  assessmentId: string;
  attemptId: string;
  learnerId: string;
  elmsLearnerId?: string;
  classGroupId?: string;
  curriculumVersionId: string;
  learningOutcomeId: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: 'RECORDED' | 'EVALUATED' | 'SYNCHRONIZED';
  responses: ElmsAssessmentEvidenceResponse[];
  submittedAt: string;
  evaluatedAt: string;
  provenance: {
    sourceSystem: 'ELMS' | 'DEMO';
    evidenceOrigin?: 'AUTHORITATIVE_ELMS' | 'TEACHER_RECORDED' | 'SIMULATED' | 'TEST_FIXTURE';
    eventId?: string;
    evaluatorType: 'SYSTEM' | 'TEACHER' | 'AUTHORIZED_MARKER';
    evaluatorId?: string;
    notes?: string;
  };
  metadata?: Record<string, unknown>;
}
