import { TeachingPlan } from '../types/teachingPlan.ts';
import { PublishedCurriculumRecord } from './curriculumIngestionService.ts';
import { AuditService } from './auditService.ts';
import { TeachingActivity } from '../types/activity.ts';

import { SchoolConfigService } from './schoolConfigService.ts';

export type CoverageStatus = 'PLANNED' | 'ALLOCATED' | 'TAUGHT' | 'COMPLETED' | 'EXCLUDED';

export interface CurriculumCoverageItem {
  id: string;
  curriculumVersionId: string;
  teachingPlanId: string;
  learningOutcomeId: string;
  status: CoverageStatus;
  teachingWeekId?: number;
  lessonSlotIds?: string[];
  sequence?: number;
}

export interface TeachingPlanValidationError {
  code: string;
  message: string;
}

export interface CoverageBreakdown {
  curriculumDemand: number;            // KICD suggested lesson allocation sum
  schoolPlannedAllocation: number;     // Total planned slots in school teaching plan
  deliveredLessons: number;            // Lessons actually delivered in classroom
  completedLessons: number;            // Lessons with explicit teacher completion evidence
  remainingPlannedLessons: number;     // Planned minus delivered
  remainingCurriculumDemand: number;   // Curriculum demand minus delivered
  plannedCoveragePercentage: number;  // (schoolPlannedAllocation / curriculumDemand) * 100
  deliveredCoveragePercentage: number; // (deliveredLessons / curriculumDemand) * 100
  completedCoveragePercentage: number; // (completedLessons / curriculumDemand) * 100
  gapStatus: 'WELL_ALIGNED' | 'COVERAGE_GAP' | 'SURPLUS';
}

export interface TeachingPlanValidationResult {
  valid: boolean;
  curriculumVersionId: string;
  teachingPlanId: string;
  errors: TeachingPlanValidationError[];
  warnings: string[];
  statistics: {
    totalOutcomes: number;
    allocatedOutcomes: number;
    unallocatedOutcomes: number;
    duplicatedOutcomes: number;
    invalidOutcomes: number;
    coveragePercentage: number;
  };
  coverageBreakdown: CoverageBreakdown;
  checkedAt: string;
}

export const TeachingCoverageService = {
  calculateCoverage(
    teachingPlan: TeachingPlan,
    curriculumRecord: PublishedCurriculumRecord,
    activities: TeachingActivity[] = []
  ): TeachingPlanValidationResult {
    const errors: TeachingPlanValidationError[] = [];
    const warnings: string[] = [];

    // 1. Validate explicit curriculum version linkage
    if (!teachingPlan.curriculumVersion && !teachingPlan.curriculumId) {
      errors.push({
        code: 'MISSING_CURRICULUM_VERSION',
        message: 'TeachingPlan lacks an explicit curriculum version reference.',
      });
    }

    if (teachingPlan.curriculumVersion && curriculumRecord.version !== teachingPlan.curriculumVersion) {
      errors.push({
        code: 'INVALID_CURRICULUM_VERSION',
        message: `TeachingPlan curriculum version (${teachingPlan.curriculumVersion}) does not match active record version (${curriculumRecord.version}).`,
      });
    }

    // 2. Gather all authoritative outcomes and calculate KICD curriculum demand
    const validOutcomeIds = new Set<string>();
    let totalOutcomes = 0;
    let curriculumDemand = 0;

    const grade = curriculumRecord.grades.find(g => g.gradeId === teachingPlan.gradeLevelId);
    if (!grade) {
      errors.push({
        code: 'INVALID_GRADE',
        message: `Grade level ${teachingPlan.gradeLevelId} not found in curriculum version.`,
      });
    } else {
      const la = grade.learningAreas.find(l => l.learningAreaId === teachingPlan.learningAreaId);
      if (!la) {
        errors.push({
          code: 'INVALID_LEARNING_AREA',
          message: `Learning area ${teachingPlan.learningAreaId} not found in grade ${teachingPlan.gradeLevelId}.`,
        });
      } else {
        for (const strand of la.strands) {
          for (const sub of strand.subStrands) {
            const suggested = (sub as any).suggestedLessonAllocation || (sub as any).suggestedLessons || 1;
            curriculumDemand += suggested;
            for (const lo of sub.learningOutcomes) {
              validOutcomeIds.add(lo.learningOutcomeId);
              totalOutcomes++;
            }
          }
        }
      }
    }

    // Fallback if curriculumRecord demand wasn't provided or empty
    if (curriculumDemand === 0 && teachingPlan.requiredLessonsCount > 0) {
      curriculumDemand = teachingPlan.requiredLessonsCount;
    }

    // 3. Inspect teaching plan allocations
    const allocatedOutcomeIds = new Set<string>();
    let duplicatedOutcomes = 0;
    let invalidOutcomes = 0;
    let schoolPlannedAllocation = 0;
    const outcomeAllocations = new Map<string, number>();

    if (teachingPlan.weeks) {
      for (const week of teachingPlan.weeks) {
        for (const slot of week.lessonSlots) {
          if (slot.slotType === 'CURRICULUM_LESSON' || slot.subStrandId) {
            schoolPlannedAllocation++;
          }
          if (slot.learningOutcomeIds) {
            for (const loId of slot.learningOutcomeIds) {
              const currentCount = outcomeAllocations.get(loId) || 0;
              outcomeAllocations.set(loId, currentCount + 1);

              if (currentCount > 0) {
                duplicatedOutcomes++;
              }

              if (!validOutcomeIds.has(loId)) {
                invalidOutcomes++;
                errors.push({
                  code: 'INVALID_OUTCOME_ALLOCATION',
                  message: `Outcome ID ${loId} allocated in TeachingPlan is not valid for this grade/learning area/curriculum version.`,
                });
              } else {
                allocatedOutcomeIds.add(loId);
              }
            }
          }
        }
      }
    }

    if (schoolPlannedAllocation === 0 && teachingPlan.allocatedLessonsCount) {
      schoolPlannedAllocation = teachingPlan.allocatedLessonsCount;
    }

    const allocatedOutcomes = allocatedOutcomeIds.size;
    const unallocatedOutcomes = Math.max(0, totalOutcomes - allocatedOutcomes);

    if (unallocatedOutcomes > 0) {
      warnings.push(`${unallocatedOutcomes} learning outcomes remain unallocated in the teaching plan.`);
    }

    // 4. Inspect delivery and completion evidence
    let deliveredLessons = 0;
    let completedLessons = 0;

    for (const act of activities) {
      const normActSchool = SchoolConfigService.getSchoolProfile(act.schoolId)?.id || act.schoolId;
      const normPlanSchool = SchoolConfigService.getSchoolProfile(teachingPlan.schoolId)?.id || teachingPlan.schoolId;
      if (act.teachingPlanId === teachingPlan.id && normActSchool === normPlanSchool) {
        if (act.status === 'DELIVERED' || act.status === 'COMPLETED') {
          deliveredLessons++;
        }
        if (act.status === 'COMPLETED' && act.completionEvidence && !act.completionEvidence.isRevoked) {
          completedLessons++;
        }
      }
    }

    const remainingPlannedLessons = Math.max(0, schoolPlannedAllocation - deliveredLessons);
    const remainingCurriculumDemand = Math.max(0, curriculumDemand - deliveredLessons);

    const plannedCoveragePercentage = curriculumDemand > 0
      ? Number(((schoolPlannedAllocation / curriculumDemand) * 100).toFixed(1))
      : 0;
    const deliveredCoveragePercentage = curriculumDemand > 0
      ? Number(((deliveredLessons / curriculumDemand) * 100).toFixed(1))
      : 0;
    const completedCoveragePercentage = curriculumDemand > 0
      ? Number(((completedLessons / curriculumDemand) * 100).toFixed(1))
      : 0;

    let gapStatus: 'WELL_ALIGNED' | 'COVERAGE_GAP' | 'SURPLUS' = 'WELL_ALIGNED';
    if (schoolPlannedAllocation < curriculumDemand) {
      gapStatus = 'COVERAGE_GAP';
    } else if (schoolPlannedAllocation > curriculumDemand) {
      gapStatus = 'SURPLUS';
    }

    const coverageBreakdown: CoverageBreakdown = {
      curriculumDemand,
      schoolPlannedAllocation,
      deliveredLessons,
      completedLessons,
      remainingPlannedLessons,
      remainingCurriculumDemand,
      plannedCoveragePercentage,
      deliveredCoveragePercentage,
      completedCoveragePercentage,
      gapStatus,
    };

    const overallCoveragePercentage = totalOutcomes > 0
      ? Number(((allocatedOutcomes / totalOutcomes) * 100).toFixed(1))
      : plannedCoveragePercentage;

    const result: TeachingPlanValidationResult = {
      valid: errors.length === 0,
      curriculumVersionId: curriculumRecord.version,
      teachingPlanId: teachingPlan.id,
      errors,
      warnings,
      statistics: {
        totalOutcomes,
        allocatedOutcomes,
        unallocatedOutcomes,
        duplicatedOutcomes,
        invalidOutcomes,
        coveragePercentage: overallCoveragePercentage,
      },
      coverageBreakdown,
      checkedAt: new Date().toISOString(),
    };

    AuditService.log('ARTIFACT_UPDATED', teachingPlan.schoolId, {
      action: 'TEACHING_PLAN_VALIDATED',
      teachingPlanId: teachingPlan.id,
      valid: result.valid,
      coveragePercentage: overallCoveragePercentage,
      gapStatus,
    });

    return result;
  },
};
