import { CapacityStatus } from './teachingPlan.ts';
import { AcademicDayType, CalendarEventType, OperationalExceptionType } from './academicOperations.ts';

export type AcademicRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'ACADEMIC_ADMIN' | 'TEACHER' | 'LEARNER' | 'admin' | 'teacher';

export type AcademicAttentionSeverity = 'INFORMATION' | 'ATTENTION' | 'WARNING' | 'CRITICAL';

export type AcademicAttentionCategory =
  | 'CAPACITY'
  | 'TEACHING_CONTROL'
  | 'COVERAGE'
  | 'EVIDENCE'
  | 'INTERPRETATION'
  | 'OPERATIONS';

export interface AcademicAttentionItem {
  id: string;
  schoolId: string;
  category: AcademicAttentionCategory;
  severity: AcademicAttentionSeverity;
  title: string;
  description: string;
  sourceEntityId?: string;
  sourceType: 'TEACHING_PLAN' | 'TEACHING_ALLOCATION' | 'ACADEMIC_CALENDAR' | 'LESSON_SCHEDULE' | 'LEARNING_OUTCOME' | 'TEACHER' | 'OPERATIONAL_EXCEPTION';
  recommendedAction: string;
  detectedAt: string;
}

export interface TeachingControlSummary {
  plannedLessons: number;
  expectedLessons: number;
  deliveredLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  cancelledLessons: number;
  rescheduledLessons: number;
  outstandingLessons: number;
  teachingDeliveryRatePercentage: number | null;
  status: 'ON_TRACK' | 'ATTENTION_NEEDED' | 'DISRUPTED';
  explanation: string;
}

export interface CoverageSummary {
  curriculumVersionId: string;
  totalOutcomes: number;
  allocatedOutcomes: number;
  unallocatedOutcomes: number;
  coveragePercentage: number | null;
  isZeroDenominator: boolean;
  status: 'SUFFICIENT' | 'ATTENTION_REQUIRED' | 'CRITICAL' | 'NOT_APPLICABLE';
  explanation: string;
}

export interface LearnerEvidenceOverview {
  totalLearners: number;
  learnersWithEvidence: number;
  learnersWithInsufficientEvidence: number;
  evidenceAvailabilityPercentage: number | null;
  totalAssessmentsConducted: number;
  totalEvidenceRecords: number;
  highConflictOutcomesCount: number;
  explanation: string;
}

export interface LearningOutcomeInterpretationOverview {
  totalEvaluated: number;
  strongDemonstrationCount: number;
  demonstratedCount: number;
  developingCount: number;
  emergingCount: number;
  insufficientEvidenceCount: number;
  distributionPercentages: {
    strongDemonstration: number;
    demonstrated: number;
    developing: number;
    emerging: number;
    insufficientEvidence: number;
  };
  policyVersion: string;
  explanation: string;
}

export interface CapacityOversightSummary {
  teachingWeeks: number;
  lessonsPerWeek: number;
  totalRequiredSlots: number;
  totalAvailableSlots: number;
  effectiveSlots: number;
  disruptedSlots: number;
  capacityStatus: CapacityStatus;
  explanation: string;
}

export interface SchoolAcademicOverview {
  schoolId: string;
  schoolName: string;
  academicYearId: string;
  academicYearName: string;
  termId: string;
  termName: string;
  currentWeekNumber?: number;
  generatedAt: string;
  teachingControl: TeachingControlSummary;
  curriculumCoverage: CoverageSummary;
  learnerEvidence: LearnerEvidenceOverview;
  outcomeInterpretation: LearningOutcomeInterpretationOverview;
  capacity: CapacityOversightSummary;
  attentionItems: AcademicAttentionItem[];
  isReadOnly: boolean;
}

export interface AcademicReportFilter {
  schoolId: string;
  academicYearId?: string;
  termId?: string;
  gradeId?: string;
  learningAreaId?: string;
  teacherId?: string;
  weekNumber?: number;
  status?: string;
  requestingUserId: string;
  requestingRole: AcademicRole;
}

export interface DailyTeachingReport {
  date: string;
  schoolId: string;
  isTeachingDay: boolean;
  dayType: AcademicDayType;
  expectedLessons: number;
  deliveredLessons: number;
  outstandingLessons: number;
  cancelledLessons: number;
  rescheduledLessons: number;
  lessons: Array<{
    scheduleId: string;
    learningAreaId: string;
    learningAreaName: string;
    gradeId: string;
    teacherId: string;
    status: 'SCHEDULED' | 'DELIVERED' | 'IN_PROGRESS' | 'CANCELLED' | 'RESCHEDULED' | 'MISSED';
    timeSlot: string;
  }>;
  summaryText: string;
}

export interface WeeklyTeachingReport {
  weekNumber: number;
  startDate: string;
  endDate: string;
  schoolId: string;
  planned: number;
  expected: number;
  delivered: number;
  outstanding: number;
  cancelled: number;
  rescheduled: number;
  dailyBreakdown: Array<{
    date: string;
    dayName: string;
    expected: number;
    delivered: number;
    outstanding: number;
    cancelled: number;
  }>;
}

export interface CurriculumCoverageReport {
  schoolId: string;
  curriculumVersionId: string;
  gradeId?: string;
  learningAreaId?: string;
  totalOutcomes: number;
  allocatedOutcomes: number;
  coveragePercentage: number | null;
  breakdownByLearningArea: Array<{
    learningAreaId: string;
    learningAreaTitle: string;
    gradeId: string;
    totalOutcomes: number;
    allocatedOutcomes: number;
    coveragePercentage: number | null;
    status: 'SUFFICIENT' | 'ATTENTION_REQUIRED' | 'CRITICAL' | 'NOT_APPLICABLE';
  }>;
}

export interface LearningOutcomeEvidenceReport {
  schoolId: string;
  gradeId?: string;
  learningAreaId?: string;
  totalOutcomesEvaluated: number;
  outcomes: Array<{
    outcomeId: string;
    outcomeDescription: string;
    learningAreaId: string;
    gradeId: string;
    learnersWithEvidence: number;
    totalLearners: number;
    evidenceCount: number;
    conflictStatus: 'NO_CONFLICT' | 'LOW_CONFLICT' | 'HIGH_CONFLICT';
    statusDistribution: {
      strongDemonstration: number;
      demonstrated: number;
      developing: number;
      emerging: number;
      insufficientEvidence: number;
    };
  }>;
}

export interface AcademicExceptionReport {
  schoolId: string;
  academicYearId: string;
  termId?: string;
  totalExceptions: number;
  exceptions: Array<{
    id: string;
    date: string;
    type: OperationalExceptionType | CalendarEventType;
    affectedGrade?: string;
    affectedLearningArea?: string;
    teacherId?: string;
    reason: string;
    actionRequired: string;
    status: 'ACTIVE' | 'RESOLVED' | 'REVIEW_RECOMMENDED';
  }>;
}

export interface TeacherAcademicView {
  teacherId: string;
  schoolId: string;
  plannedLessons: number;
  expectedLessons: number;
  deliveredLessons: number;
  outstandingLessons: number;
  cancelledLessons: number;
  rescheduledLessons: number;
  assignedGrades: string[];
  assignedLearningAreas: string[];
  deliveryRatePercentage: number | null;
}

export interface AcademicReportExport {
  reportType: 'OVERVIEW' | 'DAILY' | 'WEEKLY' | 'COVERAGE' | 'EVIDENCE' | 'EXCEPTIONS';
  format: 'CSV' | 'JSON' | 'PRINT_VIEW';
  metadata: {
    schoolId: string;
    academicYear: string;
    term: string;
    generatedAt: string;
    generatedBy: string;
    version: string;
    isAuthoritativeSnapshot: boolean;
  };
  content: string;
}
