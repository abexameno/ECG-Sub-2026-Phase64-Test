import { SchoolConfigService } from './schoolConfigService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { AuditService } from './auditService.ts';
import {
  TeachingPlan,
  TeachingWeek,
  LessonSlot,
  CapacityStatus,
  CoverageStatus,
  TeachingAllocationItem,
  TeachingPlanProvenance,
  TeachingPlanAuditInfo
} from '../types.ts';

const teachingPlanStore = new Map<string, TeachingPlan>();

export interface GenerateTeachingPlanOptions {
  classId?: string;
  teacherId?: string;
  academicYear?: number | string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  calendarAdjustments?: {
    holidayLessonsDeducted?: number;
    schoolClosureWeeksDeducted?: number;
  };
}

export interface PacingCalculationResult {
  schoolId: string;
  gradeLevelId: string;
  learningAreaId: string;
  term: string;
  academicYear: number | string;
  availableCapacity: number;
  curriculumDemand: number;
  plannedLessonsCount: number;
  capacityGap: number;
  surplusCapacity: number;
  capacityStatus: CapacityStatus;
  coverageStatus: CoverageStatus;
  allocations: TeachingAllocationItem[];
  recommendedTeacherAction: string;
}

function normalizeSchoolId(id?: string): string | undefined {
  if (!id) return undefined;
  if (SchoolConfigService.isRegisteredSchool(id)) {
    return SchoolConfigService.getSchoolProfile(id)?.id || id;
  }
  return id;
}

export const TeachingPlanService = {
  clearStore(): void {
    teachingPlanStore.clear();
  },

  createPlan(planData: any, requestingSchoolId?: string): TeachingPlan {
    const normReq = normalizeSchoolId(requestingSchoolId);
    const normTarget = normalizeSchoolId(planData.schoolId);
    if (normReq && normTarget && normReq !== normTarget) {
      throw new Error('Unauthorized cross-school creation of teaching plan');
    }

    const id = planData.id || `plan_${planData.schoolId}_${planData.learningAreaId || planData.subject || 'gen'}_${Date.now()}`;
    const now = new Date().toISOString();

    const provenance: TeachingPlanProvenance = planData.provenance || {
      createdById: planData.teacherId || planData.createdById || 'system',
      createdAt: now,
      updatedAt: now,
      sourceType: 'deterministic_pacing',
    };

    const auditInfo: TeachingPlanAuditInfo = planData.auditInfo || {
      createdBy: planData.teacherId || 'system',
      updatedBy: planData.teacherId || 'system',
      version: 1,
    };

    const plan: TeachingPlan = {
      ...planData,
      id,
      academicYear: planData.academicYear || 2026,
      status: planData.status || 'active',
      provenance,
      auditInfo,
      createdAt: planData.createdAt || now,
      updatedAt: now,
    };

    teachingPlanStore.set(id, plan);

    AuditService.log('ARTIFACT_CREATED', plan.schoolId, {
      action: 'TEACHING_PLAN_CREATED',
      teachingPlanId: id,
      gradeLevelId: plan.gradeLevelId,
      learningAreaId: plan.learningAreaId,
      term: plan.term,
      requiredLessonsCount: plan.requiredLessonsCount,
      capacityStatus: plan.capacityStatus,
    });

    return plan;
  },

  updatePlan(planId: string, updates: Partial<TeachingPlan>, requestingSchoolId?: string): TeachingPlan {
    const existing = this.getPlan(planId, requestingSchoolId);
    const now = new Date().toISOString();

    const updatedAuditInfo: TeachingPlanAuditInfo = {
      createdBy: existing.auditInfo?.createdBy || 'system',
      updatedBy: updates.teacherId || existing.auditInfo?.updatedBy || 'system',
      version: (existing.auditInfo?.version || 1) + 1,
    };

    const updatedPlan: TeachingPlan = {
      ...existing,
      ...updates,
      auditInfo: updatedAuditInfo,
      updatedAt: now,
    };

    teachingPlanStore.set(planId, updatedPlan);

    AuditService.log('ARTIFACT_UPDATED', existing.schoolId, {
      action: 'TEACHING_PLAN_UPDATED',
      teachingPlanId: planId,
      version: updatedAuditInfo.version,
    });

    return updatedPlan;
  },

  getPlan(planId: string, requestingSchoolId?: string): TeachingPlan {
    const plan = teachingPlanStore.get(planId);
    if (!plan) {
      throw new Error(`Teaching plan not found: ${planId}`);
    }
    const normReq = normalizeSchoolId(requestingSchoolId);
    const normPlan = normalizeSchoolId(plan.schoolId);
    if (normReq && normPlan && normReq !== normPlan) {
      throw new Error('Unauthorized cross-school access to teaching plan');
    }
    return plan;
  },

  getPlansBySchool(schoolId: string, requestingSchoolId?: string): TeachingPlan[] {
    const normReq = normalizeSchoolId(requestingSchoolId);
    const normTarget = normalizeSchoolId(schoolId);
    if (normReq && normTarget && normReq !== normTarget) {
      throw new Error('Unauthorized cross-school query for teaching plans');
    }

    const list: TeachingPlan[] = [];
    for (const plan of teachingPlanStore.values()) {
      if (normalizeSchoolId(plan.schoolId) === normTarget) {
        list.push({ ...plan });
      }
    }
    return list;
  },

  calculatePacing(
    schoolId: string,
    gradeLevelId: string,
    learningAreaId: string,
    term: string,
    options?: GenerateTeachingPlanOptions
  ): PacingCalculationResult {
    const schoolProfile = SchoolConfigService.getSchoolProfile(schoolId);
    if (!schoolProfile) {
      throw new Error(`Invalid school profile ID: ${schoolId}`);
    }

    const teachingConfig = schoolProfile.teachingConfig;
    const holidayDeduction = options?.calendarAdjustments?.holidayLessonsDeducted || 0;
    const closureWeeksDeducted = options?.calendarAdjustments?.schoolClosureWeeksDeducted || 0;

    const baseWeeks = Math.max(1, teachingConfig.teachingWeeksPerTerm - closureWeeksDeducted);
    const lessonsPerWeek = teachingConfig.lessonsPerWeek;
    const availableCapacity = Math.max(0, (baseWeeks * lessonsPerWeek) - holidayDeduction);

    const strands = CanonicalCurriculumService.getStrands(learningAreaId);
    if (!strands || strands.length === 0) {
      // Fallback check if learningAreaId was specified as code or name
      const laObj = CanonicalCurriculumService.getLearningAreaById(learningAreaId);
      if (!laObj) {
        throw new Error(`Invalid learning area ID: ${learningAreaId}`);
      }
    }

    const normalizedTerm = term.toLowerCase().replace(/\s+/g, '');
    const allocationsMap = new Map<string, { subStrandId: string; title: string; suggestedLessons: number; strandId: string; outcomeIds: string[] }>();

    for (const strand of strands) {
      const subs = CanonicalCurriculumService.getSubStrands(strand.id);
      for (const sub of subs) {
        if (sub.suggestedTerms && sub.suggestedTerms.length > 0) {
          const matchesTerm = sub.suggestedTerms.some(st => {
            const normSt = st.toLowerCase().replace(/\s+/g, '');
            return normSt === normalizedTerm || normalizedTerm.includes(normSt) || normSt.includes(normalizedTerm);
          });
          if (!matchesTerm) {
            continue;
          }
        }

        const outcomes = CanonicalCurriculumService.getLearningOutcomes(sub.id);
        const suggested = (sub.suggestedLessonAllocation !== undefined && sub.suggestedLessonAllocation !== null)
          ? sub.suggestedLessonAllocation
          : 1;

        allocationsMap.set(sub.id, {
          subStrandId: sub.id,
          title: sub.title,
          suggestedLessons: suggested,
          strandId: strand.id,
          outcomeIds: outcomes.map(o => o.id),
        });
      }
    }

    let curriculumDemand = 0;
    allocationsMap.forEach(item => {
      curriculumDemand += item.suggestedLessons;
    });

    const plannedLessonsCount = Math.min(availableCapacity, curriculumDemand);
    const capacityGap = Math.max(0, curriculumDemand - availableCapacity);
    const surplusCapacity = Math.max(0, availableCapacity - curriculumDemand);

    const capacityStatus: CapacityStatus = capacityGap > 0 ? 'insufficient' : 'sufficient';
    let coverageStatus: CoverageStatus = 'WELL_ALIGNED';
    if (capacityGap > 0) {
      coverageStatus = 'COVERAGE_GAP';
    } else if (surplusCapacity > 0) {
      coverageStatus = 'SURPLUS';
    }

    // Build allocation breakdown items without changing KICD records
    let remainingCapacityToPlan = availableCapacity;
    const allocations: TeachingAllocationItem[] = [];

    allocationsMap.forEach(item => {
      const schoolPlanned = Math.min(item.suggestedLessons, remainingCapacityToPlan);
      remainingCapacityToPlan = Math.max(0, remainingCapacityToPlan - schoolPlanned);
      const gap = schoolPlanned - item.suggestedLessons;

      let pacingStatus: 'FULLY_COVERED' | 'UNDER_PLANNED' | 'OVER_PLANNED' = 'FULLY_COVERED';
      if (gap < 0) {
        pacingStatus = 'UNDER_PLANNED';
      } else if (gap > 0) {
        pacingStatus = 'OVER_PLANNED';
      }

      allocations.push({
        subStrandId: item.subStrandId,
        subStrandTitle: item.title,
        curriculumSuggestedLessons: item.suggestedLessons,
        schoolPlannedLessons: schoolPlanned,
        gapCount: gap,
        pacingStatus,
      });
    });

    let recommendedTeacherAction = 'Teaching plan pacing is well aligned with KICD curriculum allocations.';
    if (capacityGap > 0) {
      recommendedTeacherAction = `COVERAGE_GAP: Coverage gap detected. ${capacityGap} curriculum lesson(s) exceed available timetable capacity (${availableCapacity} slots). Schedule remedial/extended slots or adjust timetable allocations.`;
    } else if (surplusCapacity > 0) {
      recommendedTeacherAction = `SURPLUS: Surplus capacity detected. ${surplusCapacity} timetable slot(s) available for revision, continuous assessment, and enrichment.`;
    }

    const result: PacingCalculationResult = {
      schoolId,
      gradeLevelId,
      learningAreaId,
      term,
      academicYear: options?.academicYear || 2026,
      availableCapacity,
      curriculumDemand,
      plannedLessonsCount,
      capacityGap,
      surplusCapacity,
      capacityStatus,
      coverageStatus,
      allocations,
      recommendedTeacherAction,
    };

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'PACING_CALCULATED',
      gradeLevelId,
      learningAreaId,
      term,
      availableCapacity,
      curriculumDemand,
      capacityStatus,
      coverageStatus,
    });

    return result;
  },

  generateTeachingPlan(
    schoolId: string,
    gradeLevelId: string,
    learningAreaId: string,
    term: string,
    options?: GenerateTeachingPlanOptions
  ): TeachingPlan {
    const schoolProfile = SchoolConfigService.getSchoolProfile(schoolId);
    if (!schoolProfile) {
      throw new Error(`Invalid school profile ID: ${schoolId}`);
    }

    const curriculum = CanonicalCurriculumService.getCurriculum();
    const pacing = this.calculatePacing(schoolId, gradeLevelId, learningAreaId, term, options);

    const totalTeachingWeeks = schoolProfile.teachingConfig.teachingWeeksPerTerm;
    const lessonsPerWeek = schoolProfile.teachingConfig.lessonsPerWeek;
    const totalLessonCapacity = pacing.availableCapacity;

    const strands = CanonicalCurriculumService.getStrands(learningAreaId);
    const normalizedTerm = term.toLowerCase().replace(/\s+/g, '');

    const subStrandUnits: { strandId: string; subStrandId: string; outcomeIds: string[]; title?: string }[] = [];

    for (const strand of strands) {
      const subs = CanonicalCurriculumService.getSubStrands(strand.id);
      for (const sub of subs) {
        if (sub.suggestedTerms && sub.suggestedTerms.length > 0) {
          const matchesTerm = sub.suggestedTerms.some(st => {
            const normSt = st.toLowerCase().replace(/\s+/g, '');
            return normSt === normalizedTerm || normalizedTerm.includes(normSt) || normSt.includes(normalizedTerm);
          });
          if (!matchesTerm) {
            continue;
          }
        }

        const outcomes = CanonicalCurriculumService.getLearningOutcomes(sub.id);
        const allocationCount = (sub.suggestedLessonAllocation !== undefined && sub.suggestedLessonAllocation !== null)
          ? sub.suggestedLessonAllocation
          : 1;

        for (let i = 0; i < allocationCount; i++) {
          subStrandUnits.push({
            strandId: strand.id,
            subStrandId: sub.id,
            outcomeIds: outcomes.map(o => o.id),
            title: sub.title,
          });
        }
      }
    }

    const requiredLessonsCount = subStrandUnits.length;
    const lessonQueue = [...subStrandUnits];
    const unallocatedSubStrandIds: string[] = [];
    const weeks: TeachingWeek[] = [];
    let allocatedLessonsCount = 0;

    for (let w = 1; w <= totalTeachingWeeks; w++) {
      const lessonSlots: LessonSlot[] = [];
      for (let l = 1; l <= lessonsPerWeek; l++) {
        // If calendar deduction exhausts capacity for this slot
        const currentSlotIndex = (w - 1) * lessonsPerWeek + l;
        if (currentSlotIndex > totalLessonCapacity) {
          // Slot falls on holiday / closure
          continue;
        }

        if (lessonQueue.length > 0) {
          const unit = lessonQueue.shift()!;
          allocatedLessonsCount++;
          lessonSlots.push({
            lessonNumber: l,
            weekNumber: w,
            strandId: unit.strandId,
            subStrandId: unit.subStrandId,
            learningOutcomeIds: unit.outcomeIds,
            status: 'planned',
            slotType: 'CURRICULUM_LESSON',
            title: unit.title,
          });
        } else {
          // Surplus capacity slots
          lessonSlots.push({
            lessonNumber: l,
            weekNumber: w,
            status: 'planned',
            slotType: 'REVISION',
            title: 'Revision, Consolidation & Continuous Assessment',
          });
        }
      }

      if (lessonSlots.length > 0) {
        weeks.push({
          weekNumber: w,
          lessonSlots,
        });
      }
    }

    const unallocatedLessonCount = lessonQueue.length;
    if (unallocatedLessonCount > 0) {
      const remainingSubStrandSet = new Set<string>();
      lessonQueue.forEach(item => remainingSubStrandSet.add(item.subStrandId));
      unallocatedSubStrandIds.push(...Array.from(remainingSubStrandSet));
    }

    const planId = `plan_${schoolId}_${gradeLevelId}_${learningAreaId}_${term.replace(/\s+/g, '_')}`;
    const now = new Date().toISOString();

    const plan: TeachingPlan = {
      id: planId,
      schoolId: schoolProfile.id,
      academicYear: options?.academicYear || 2026,
      classId: options?.classId,
      teacherId: options?.teacherId,
      curriculumId: curriculum.id,
      curriculumVersion: curriculum.version,
      gradeLevelId,
      learningAreaId,
      term,
      plannedStartDate: options?.plannedStartDate,
      plannedEndDate: options?.plannedEndDate,
      totalTeachingWeeks,
      lessonsPerWeek,
      totalLessonCapacity,
      requiredLessonsCount,
      allocatedLessonsCount,
      unallocatedSubStrandIds,
      unallocatedLessonCount,
      surplusSlotCount: pacing.surplusCapacity,
      capacityStatus: pacing.capacityStatus,
      coverageStatus: pacing.coverageStatus,
      status: 'active',
      allocations: pacing.allocations,
      recommendedTeacherAction: pacing.recommendedTeacherAction,
      weeks,
      provenance: {
        createdById: options?.teacherId || 'system',
        createdAt: now,
        updatedAt: now,
        sourceType: 'deterministic_pacing',
      },
      auditInfo: {
        createdBy: options?.teacherId || 'system',
        updatedBy: options?.teacherId || 'system',
        version: 1,
      },
      createdAt: now,
      updatedAt: now,
    };

    teachingPlanStore.set(planId, plan);

    AuditService.log('ARTIFACT_CREATED', schoolProfile.id, {
      action: 'TEACHING_PLAN_GENERATED',
      planId,
      gradeLevelId,
      learningAreaId,
      term,
      capacityStatus: plan.capacityStatus,
      coverageStatus: plan.coverageStatus,
    });

    return plan;
  },

  validateTeachingPlan(plan: TeachingPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!plan.schoolId || !SchoolConfigService.isRegisteredSchool(plan.schoolId)) {
      errors.push(`Invalid school profile ID: ${plan.schoolId}`);
    } else {
      const school = SchoolConfigService.getSchoolProfile(plan.schoolId);
      if (plan.totalTeachingWeeks !== school.teachingConfig.teachingWeeksPerTerm) {
        errors.push(`Teaching weeks mismatch with school config for ${plan.schoolId}`);
      }

      if (plan.lessonsPerWeek !== school.teachingConfig.lessonsPerWeek) {
        errors.push(`Lessons per week mismatch with school config for ${plan.schoolId}`);
      }
    }

    const grade = CanonicalCurriculumService.getGradeById(plan.gradeLevelId);
    if (!grade) {
      errors.push(`Invalid grade level ID: ${plan.gradeLevelId}`);
    }

    const la = CanonicalCurriculumService.getLearningAreaById(plan.learningAreaId);
    if (!la) {
      errors.push(`Invalid learning area ID: ${plan.learningAreaId}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};
