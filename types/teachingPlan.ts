export interface LessonSlot {
  lessonNumber: number;
  weekNumber: number;
  strandId?: string;
  subStrandId?: string;
  learningOutcomeIds?: string[];
  status: 'planned' | 'generated' | 'validated' | 'completed';
  slotType?: 'CURRICULUM_LESSON' | 'REVISION' | 'ASSESSMENT' | 'REMEDIATION' | 'EXTENSION' | 'PROJECT' | 'FLEXIBLE_LEARNING';
  title?: string;
}

export interface TeachingWeek {
  weekNumber: number;
  lessonSlots: LessonSlot[];
}

export type CapacityStatus = 'sufficient' | 'tight' | 'insufficient' | 'SURPLUS' | 'INSUFFICIENT';
export type CoverageStatus = 'WELL_ALIGNED' | 'COVERAGE_GAP' | 'SURPLUS';
export type PlanStatus = 'draft' | 'active' | 'archived';

export interface TeachingAllocationItem {
  subStrandId: string;
  subStrandTitle?: string;
  curriculumSuggestedLessons: number;
  schoolPlannedLessons: number;
  gapCount: number; // schoolPlannedLessons - curriculumSuggestedLessons
  pacingStatus: 'FULLY_COVERED' | 'UNDER_PLANNED' | 'OVER_PLANNED';
}

export interface TeachingPlanProvenance {
  createdById: string;
  createdAt: string;
  updatedAt: string;
  sourceType?: string;
  aiModel?: string;
}

export interface TeachingPlanAuditInfo {
  createdBy: string;
  updatedBy: string;
  version: number;
}

export interface TeachingPlan {
  id: string;
  schoolId: string;
  academicYear?: number | string;
  term: string;
  gradeLevelId: string;
  classId?: string;
  learningAreaId: string;
  curriculumId: string;
  curriculumVersion: string;
  curriculumStrandId?: string;
  curriculumSubStrandId?: string;

  plannedStartDate?: string;
  plannedEndDate?: string;

  totalTeachingWeeks: number;
  lessonsPerWeek: number;
  totalLessonCapacity: number;

  requiredLessonsCount: number; // Curriculum demand (sum of KICD suggested allocations)
  allocatedLessonsCount?: number; // Total slots allocated to curriculum
  unallocatedSubStrandIds?: string[];
  unallocatedLessonCount?: number;
  surplusSlotCount?: number;

  capacityStatus: CapacityStatus;
  coverageStatus?: CoverageStatus;
  status?: PlanStatus;

  teacherId?: string;
  allocations?: TeachingAllocationItem[];
  provenance?: TeachingPlanProvenance;
  auditInfo?: TeachingPlanAuditInfo;

  recommendedTeacherAction?: string;
  weeks: TeachingWeek[];
  createdAt?: string;
  updatedAt?: string;
}

