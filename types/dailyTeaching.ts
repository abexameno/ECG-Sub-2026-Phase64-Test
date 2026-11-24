import { TeachingActivityStatus, LearnerActivityStatus, CompletionEvidence } from './activity.ts';
import { InterpretationStatus } from './interpretation.ts';

export interface LessonResourceSummary {
  type: 'LESSON_PLAN' | 'LESSON_NOTES' | 'SCHEME_OF_WORK' | 'ASSESSMENT';
  title: string;
  isAvailable: boolean;
  artifactId?: string;
  artifactVersion?: number;
  assessmentId?: string;
}

export interface NextLessonSummary {
  teachingPlanId: string;
  teachingAllocationId: string;
  weekNumber: number;
  lessonNumber: number;
  grade: string;
  learningArea: string;
  topicTitle: string;
  learningOutcomeId: string;
  learningOutcomeStatement: string;
}

export interface TodayLessonView {
  schoolId: string;
  teacherId: string;
  teachingPlanId: string;
  teachingAllocationId: string;
  curriculumVersionId: string;
  grade: string;
  learningArea: string;
  term: string;
  weekNumber: number;
  lessonNumber: number;
  strandTitle: string;
  subStrandTitle: string;
  topicTitle: string;
  learningOutcomeId: string;
  learningOutcomeStatement: string;
  status: TeachingActivityStatus;
  activityId?: string;
  startedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  completionEvidence?: CompletionEvidence;
  resources: LessonResourceSummary[];
  nextLesson?: NextLessonSummary;
  isTeachingDay?: boolean;
  dayType?: string;
  operationalNotice?: string;
  exceptionCode?: string;
  exceptionMessage?: string;
}

export interface LearnerClassroomItem {
  learnerId: string;
  learnerName: string;
  activityStatus: LearnerActivityStatus;
  assessmentAttemptId?: string;
  scorePercentage?: number;
  interpretationStatus?: InterpretationStatus;
}

export interface LessonReviewSummary {
  learningOutcomeId: string;
  learningOutcomeStatement: string;
  totalLearnersEvaluated: number;
  strongDemonstrationCount: number;
  developingCount: number;
  insufficientEvidenceCount: number;
  learners: Array<{
    learnerId: string;
    learnerName: string;
    status: InterpretationStatus;
  }>;
}
