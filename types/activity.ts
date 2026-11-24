export type TeachingActivityStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

export type LearnerActivityStatus = 'NOT_STARTED' | 'STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED';

export interface CompletionEvidence {
  evidenceId: string;
  source: 'TEACHER_CONFIRMATION' | 'LEARNER_SUBMISSION' | 'ASSESSMENT_RULE' | 'SYSTEM_EVENT';
  recordedBy: string;
  recordedAt: string;
  notes?: string;
  supersededBy?: string;
  isRevoked?: boolean;
}

export interface TeachingActivity {
  activityId: string;
  schoolId: string;
  teacherId: string;
  teachingPlanId: string;
  teachingAllocationId: string; // e.g. "week_1_lesson_2"
  curriculumVersionId: string;
  learningOutcomeId: string;
  artifactId?: string;
  artifactVersion?: number;
  activityType: 'LESSON_DELIVERY' | 'PRACTICAL_EXERCISE' | 'TOPICAL_REVISION' | 'ASSESSMENT';
  status: TeachingActivityStatus;
  startedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  completionEvidence?: CompletionEvidence;
  createdAt: string;
  updatedAt: string;
}

export interface LearnerActivity {
  activityId: string;
  learnerId: string;
  schoolId: string;
  teachingPlanId: string;
  teachingAllocationId: string;
  curriculumVersionId: string;
  learningOutcomeId: string;
  artifactId?: string;
  artifactVersion?: number;
  activityType: 'LESSON_ENGAGEMENT' | 'PRACTICE_EXERCISE' | 'ASSIGNMENT_SUBMISSION' | 'ASSESSMENT';
  status: LearnerActivityStatus;
  startedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  evidenceReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressCalculationResult {
  scope: 'TEACHING_PLAN' | 'LEARNER' | 'OUTCOME';
  schoolId: string;
  targetId: string;
  totalApplicable: number;
  totalCompleted: number;
  progressPercentage: number;
  status: 'NOT_APPLICABLE' | 'IN_PROGRESS' | 'COMPLETED';
  calculatedAt: string;
}
