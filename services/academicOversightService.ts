import {
  SchoolAcademicOverview,
  TeachingControlSummary,
  CoverageSummary,
  LearnerEvidenceOverview,
  LearningOutcomeInterpretationOverview,
  CapacityOversightSummary,
  AcademicAttentionItem,
  AcademicReportFilter,
  DailyTeachingReport,
  WeeklyTeachingReport,
  CurriculumCoverageReport,
  LearningOutcomeEvidenceReport,
  AcademicExceptionReport,
  TeacherAcademicView,
  AcademicReportExport,
  AcademicRole,
} from '../types/academicOversight.ts';
import { SchoolConfigService } from './schoolConfigService.ts';
import { AcademicOperationsService } from './academicOperationsService.ts';
import { TeachingCoverageService } from './teachingCoverageService.ts';
import { TeachingActivityService } from './teachingActivityService.ts';
import { AssessmentEvidenceService } from './assessmentEvidenceService.ts';
import { LearningOutcomeInterpretationService } from './learningOutcomeInterpretationService.ts';
import { TeachingPlanService } from './teachingPlanService.ts';
import { CurriculumIngestionService } from './curriculumIngestionService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { AuditService } from './auditService.ts';

export const AcademicOversightService = {
  // ----------------------------------------------------
  // 1. PRIMARY SCHOOL ACADEMIC OVERVIEW (READ-ONLY)
  // ----------------------------------------------------
  getSchoolAcademicOverview(
    schoolId: string,
    options?: {
      academicYearId?: string;
      termId?: string;
      requestingUserId: string;
      requestingRole: AcademicRole;
    }
  ): SchoolAcademicOverview {
    // 1. Validate School & Strict School Isolation
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    const schoolProfile = SchoolConfigService.getSchoolProfile(schoolId);

    // 2. Authorize Requesting User Role
    if (options) {
      const role = options.requestingRole;
      const isAdminRole =
        role === 'SUPER_ADMIN' ||
        role === 'SCHOOL_ADMIN' ||
        role === 'ACADEMIC_ADMIN' ||
        role === 'admin';

      if (!isAdminRole && role !== 'TEACHER' && role !== 'teacher') {
        AuditService.log('SECURITY_VIOLATION', schoolId, {
          action: 'UNAUTHORIZED_DASHBOARD_ACCESS',
          requestingUserId: options.requestingUserId,
          requestingRole: role,
        });
        throw new Error('Unauthorized access: insufficient permissions for academic overview');
      }
    }

    // 3. Resolve Academic Year and Term Context
    let activeYear = options?.academicYearId
      ? AcademicOperationsService.listAcademicYears(schoolId).find(y => y.id === options.academicYearId)
      : AcademicOperationsService.getActiveAcademicYear(schoolId);

    if (!activeYear) {
      const years = AcademicOperationsService.listAcademicYears(schoolId);
      activeYear = years.length > 0 ? years[0] : {
        id: `ay_${schoolId}_default`,
        schoolId,
        name: '2026',
        startDate: '2026-01-05',
        endDate: '2026-11-20',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    let activeTerm = options?.termId
      ? AcademicOperationsService.listTerms(schoolId, activeYear.id).find(t => t.id === options.termId)
      : AcademicOperationsService.getActiveTerm(schoolId);

    if (!activeTerm) {
      const terms = AcademicOperationsService.listTerms(schoolId, activeYear.id);
      activeTerm = terms.length > 0 ? terms[0] : {
        id: `term_${schoolId}_1`,
        schoolId,
        academicYearId: activeYear.id,
        termNumber: 1,
        name: 'Term 1',
        startDate: '2026-01-05',
        endDate: '2026-04-03',
        teachingWeeks: schoolProfile.teachingConfig.teachingWeeksPerTerm || 13,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayView = AcademicOperationsService.getTodayOperationsView(schoolId, todayStr, 'admin');
    const currentWeekNumber = todayView.teachingWeekNumber || 1;

    // 4. Compute Teaching Control Summary
    const teachingControl = this.computeTeachingControlSummary(schoolId, activeTerm.id);

    // 5. Compute Curriculum Coverage Summary (Consuming Phase 10)
    const curriculumCoverage = this.computeCoverageSummary(schoolId);

    // 6. Compute Learner Evidence Overview (Consuming Phase 13)
    const learnerEvidence = this.computeLearnerEvidenceOverview(schoolId);

    // 7. Compute Outcome Interpretation Overview (Consuming Phase 14)
    const outcomeInterpretation = this.computeOutcomeInterpretationOverview(schoolId);

    // 8. Compute Capacity Oversight Summary
    const capacity = this.computeCapacitySummary(schoolId, activeTerm.id);

    // 9. Generate Deterministic Attention Queue Items
    const attentionItems = this.generateAttentionQueue({
      schoolId,
      teachingControl,
      curriculumCoverage,
      learnerEvidence,
      outcomeInterpretation,
      capacity,
    });

    return {
      schoolId,
      schoolName: schoolProfile.name,
      academicYearId: activeYear.id,
      academicYearName: activeYear.name,
      termId: activeTerm.id,
      termName: activeTerm.name,
      currentWeekNumber,
      generatedAt: new Date().toISOString(),
      teachingControl,
      curriculumCoverage,
      learnerEvidence,
      outcomeInterpretation,
      capacity,
      attentionItems,
      isReadOnly: true,
    };
  },

  // ----------------------------------------------------
  // 2. DETERMINISTIC SUMMARY CALCULATIONS (READ-ONLY)
  // ----------------------------------------------------
  computeTeachingControlSummary(schoolId: string, termId?: string): TeachingControlSummary {
    const plans = TeachingPlanService.getPlansBySchool(schoolId);
    let plannedLessons = 0;
    for (const p of plans) {
      if (p.allocations) {
        plannedLessons += p.allocations.length;
      }
    }

    const schedules = AcademicOperationsService.getLessonSchedules(schoolId);
    const exceptions = AcademicOperationsService.getOperationalExceptions(schoolId);
    const activities = TeachingActivityService.getActivitiesBySchool(schoolId);

    let expectedLessons = schedules.length * (plans.length > 0 ? 5 : 1);
    if (expectedLessons === 0 && plannedLessons > 0) {
      expectedLessons = plannedLessons;
    }

    let deliveredLessons = 0;
    let inProgressLessons = 0;
    let completedLessons = 0;

    for (const act of activities) {
      if (act.status === 'COMPLETED') {
        deliveredLessons++;
        completedLessons++;
      } else if (act.status === 'IN_PROGRESS') {
        inProgressLessons++;
      }
    }

    let cancelledLessons = 0;
    let rescheduledLessons = 0;

    for (const ex of exceptions) {
      const exType = ex.exceptionType || (ex as any).type;
      if (exType === 'LESSON_CANCELLED' || exType === 'SCHOOL_CLOSED') {
        cancelledLessons++;
      } else if (exType === 'LESSON_RESCHEDULED') {
        rescheduledLessons++;
      }
    }

    const outstandingLessons = Math.max(0, expectedLessons - deliveredLessons - cancelledLessons);
    const teachingDeliveryRatePercentage =
      expectedLessons > 0
        ? Number(((deliveredLessons / expectedLessons) * 100).toFixed(1))
        : null;

    let status: 'ON_TRACK' | 'ATTENTION_NEEDED' | 'DISRUPTED' = 'ON_TRACK';
    if (cancelledLessons > 3 || outstandingLessons > 10) {
      status = 'DISRUPTED';
    } else if (outstandingLessons > 0 || cancelledLessons > 0) {
      status = 'ATTENTION_NEEDED';
    }

    return {
      plannedLessons,
      expectedLessons,
      deliveredLessons,
      completedLessons,
      inProgressLessons,
      cancelledLessons,
      rescheduledLessons,
      outstandingLessons,
      teachingDeliveryRatePercentage,
      status,
      explanation: `Expected: ${expectedLessons} lessons, Delivered: ${deliveredLessons}, Outstanding: ${outstandingLessons}, Cancelled: ${cancelledLessons}.`,
    };
  },

  computeCoverageSummary(schoolId: string): CoverageSummary {
    const plans = TeachingPlanService.getPlansBySchool(schoolId);
    const canonical = CanonicalCurriculumService.getCurriculum();
    const learningAreas = CanonicalCurriculumService.getLearningAreas();

    let totalOutcomes = 0;
    for (const la of learningAreas) {
      const strands = CanonicalCurriculumService.getStrands(la.id);
      for (const st of strands) {
        const subStrands = CanonicalCurriculumService.getSubStrands(st.id);
        for (const sst of subStrands) {
          const outcomes = CanonicalCurriculumService.getLearningOutcomes(sst.id);
          totalOutcomes += outcomes.length;
        }
      }
    }

    let allocatedOutcomes = 0;
    let unallocatedOutcomes = 0;

    if (plans.length === 0) {
      unallocatedOutcomes = totalOutcomes;
    } else {
      const allocatedOutcomeIds = new Set<string>();
      for (const p of plans) {
        if (p.weeks) {
          for (const w of p.weeks) {
            for (const slot of w.lessonSlots) {
              if (slot.learningOutcomeIds) {
                slot.learningOutcomeIds.forEach((id: string) => allocatedOutcomeIds.add(id));
              }
            }
          }
        }
        if (p.allocations) {
          p.allocations.forEach((a: any) => {
            if (a.learningOutcomeId) allocatedOutcomeIds.add(a.learningOutcomeId);
          });
        }
      }
      allocatedOutcomes = Math.min(totalOutcomes, allocatedOutcomeIds.size);
      unallocatedOutcomes = Math.max(0, totalOutcomes - allocatedOutcomes);
    }

    const isZeroDenominator = totalOutcomes === 0;
    const coveragePercentage = isZeroDenominator
      ? null
      : Number(((allocatedOutcomes / totalOutcomes) * 100).toFixed(1));

    let status: 'SUFFICIENT' | 'ATTENTION_REQUIRED' | 'CRITICAL' | 'NOT_APPLICABLE' = 'SUFFICIENT';
    if (isZeroDenominator) {
      status = 'NOT_APPLICABLE';
    } else if (coveragePercentage! < 50) {
      status = 'CRITICAL';
    } else if (coveragePercentage! < 80) {
      status = 'ATTENTION_REQUIRED';
    }

    return {
      curriculumVersionId: canonical.version,
      totalOutcomes,
      allocatedOutcomes,
      unallocatedOutcomes,
      coveragePercentage,
      isZeroDenominator,
      status,
      explanation: isZeroDenominator
        ? 'No applicable Learning Outcomes for selected curriculum scope.'
        : `${allocatedOutcomes} of ${totalOutcomes} applicable Learning Outcomes have at least one valid Teaching Allocation.`,
    };
  },

  computeLearnerEvidenceOverview(schoolId: string): LearnerEvidenceOverview {
    const evidenceList = AssessmentEvidenceService.getEvidenceBySchool(schoolId);
    const assessments = AssessmentEvidenceService.getAssessmentsBySchool(schoolId);

    const uniqueLearners = new Set<string>();
    const learnersWithEvidenceSet = new Set<string>();

    for (const ev of evidenceList) {
      if (!ev.isVoided) {
        learnersWithEvidenceSet.add(ev.learnerId);
        uniqueLearners.add(ev.learnerId);
      }
    }

    // Include registered learners from default pool if any
    const totalLearners = Math.max(uniqueLearners.size, learnersWithEvidenceSet.size, 1);
    const learnersWithEvidence = learnersWithEvidenceSet.size;
    const learnersWithInsufficientEvidence = Math.max(0, totalLearners - learnersWithEvidence);

    const evidenceAvailabilityPercentage =
      totalLearners > 0
        ? Number(((learnersWithEvidence / totalLearners) * 100).toFixed(1))
        : null;

    // Check high conflict
    let highConflictOutcomesCount = 0;
    const interpretations = LearningOutcomeInterpretationService.getInterpretationsBySchool(schoolId);
    for (const interp of interpretations) {
      if (interp.conflictStatus === 'HIGH_CONFLICT') {
        highConflictOutcomesCount++;
      }
    }

    return {
      totalLearners,
      learnersWithEvidence,
      learnersWithInsufficientEvidence,
      evidenceAvailabilityPercentage,
      totalAssessmentsConducted: assessments.length,
      totalEvidenceRecords: evidenceList.filter(e => !e.isVoided).length,
      highConflictOutcomesCount,
      explanation: `${learnersWithEvidence} of ${totalLearners} learners have assessment evidence recorded. NO EVIDENCE != LOW PERFORMANCE.`,
    };
  },

  computeOutcomeInterpretationOverview(schoolId: string): LearningOutcomeInterpretationOverview {
    const interpretations = LearningOutcomeInterpretationService.getInterpretationsBySchool(schoolId);

    let strongDemonstrationCount = 0;
    let demonstratedCount = 0;
    let developingCount = 0;
    let emergingCount = 0;
    let insufficientEvidenceCount = 0;

    for (const interp of interpretations) {
      switch (interp.interpretationStatus) {
        case 'STRONG_DEMONSTRATION':
          strongDemonstrationCount++;
          break;
        case 'DEMONSTRATED':
          demonstratedCount++;
          break;
        case 'DEVELOPING':
          developingCount++;
          break;
        case 'EMERGING':
          emergingCount++;
          break;
        case 'INSUFFICIENT_EVIDENCE':
        default:
          insufficientEvidenceCount++;
          break;
      }
    }

    const totalEvaluated = interpretations.length;

    const distributionPercentages = {
      strongDemonstration:
        totalEvaluated > 0 ? Number(((strongDemonstrationCount / totalEvaluated) * 100).toFixed(1)) : 0,
      demonstrated:
        totalEvaluated > 0 ? Number(((demonstratedCount / totalEvaluated) * 100).toFixed(1)) : 0,
      developing:
        totalEvaluated > 0 ? Number(((developingCount / totalEvaluated) * 100).toFixed(1)) : 0,
      emerging:
        totalEvaluated > 0 ? Number(((emergingCount / totalEvaluated) * 100).toFixed(1)) : 0,
      insufficientEvidence:
        totalEvaluated > 0 ? Number(((insufficientEvidenceCount / totalEvaluated) * 100).toFixed(1)) : 0,
    };

    return {
      totalEvaluated,
      strongDemonstrationCount,
      demonstratedCount,
      developingCount,
      emergingCount,
      insufficientEvidenceCount,
      distributionPercentages,
      policyVersion: LearningOutcomeInterpretationService.CURRENT_POLICY_VERSION,
      explanation: `Mastery status derived from Phase 14 Interpretation Engine under policy ${LearningOutcomeInterpretationService.CURRENT_POLICY_VERSION}.`,
    };
  },

  computeCapacitySummary(schoolId: string, termId?: string): CapacityOversightSummary {
    const schoolProfile = SchoolConfigService.getSchoolProfile(schoolId);
    const teachingWeeks = schoolProfile.teachingConfig.teachingWeeksPerTerm || 13;
    const lessonsPerWeek = schoolProfile.teachingConfig.lessonsPerWeek || 5;

    const totalAvailableSlots = teachingWeeks * lessonsPerWeek;
    
    // Check plans for required slots
    const plans = TeachingPlanService.getPlansBySchool(schoolId);
    let totalRequiredSlots = 0;
    for (const p of plans) {
      const slotCount = p.weeks ? p.weeks.reduce((acc, w) => acc + (w.lessonSlots ? w.lessonSlots.length : 0), 0) : 0;
      totalRequiredSlots += (p as any).capacityRequired || slotCount;
    }

    if (totalRequiredSlots === 0) {
      totalRequiredSlots = totalAvailableSlots;
    }

    // Check operational impact
    let disruptedSlots = 0;
    if (termId) {
      try {
        const impact = AcademicOperationsService.evaluateCalendarCapacityImpact(schoolId, termId);
        disruptedSlots = impact.affectedLessonsCount;
      } catch {
        disruptedSlots = 0;
      }
    }

    const effectiveSlots = Math.max(0, totalAvailableSlots - disruptedSlots);

    let capacityStatus: CapacityOversightSummary['capacityStatus'] = 'sufficient';
    if (effectiveSlots < totalRequiredSlots) {
      capacityStatus = 'insufficient';
    } else if (effectiveSlots === totalRequiredSlots || effectiveSlots - totalRequiredSlots <= 2) {
      capacityStatus = 'tight';
    }

    return {
      teachingWeeks,
      lessonsPerWeek,
      totalRequiredSlots,
      totalAvailableSlots,
      effectiveSlots,
      disruptedSlots,
      capacityStatus,
      explanation: `Available capacity: ${effectiveSlots} slots (disrupted: ${disruptedSlots}), Required: ${totalRequiredSlots} slots. Status: ${capacityStatus}.`,
    };
  },

  // ----------------------------------------------------
  // 3. DETERMINISTIC ATTENTION QUEUE
  // ----------------------------------------------------
  generateAttentionQueue(params: {
    schoolId: string;
    teachingControl: TeachingControlSummary;
    curriculumCoverage: CoverageSummary;
    learnerEvidence: LearnerEvidenceOverview;
    outcomeInterpretation: LearningOutcomeInterpretationOverview;
    capacity: CapacityOversightSummary;
  }): AcademicAttentionItem[] {
    const items: AcademicAttentionItem[] = [];
    const detectedAt = new Date().toISOString();

    // 1. Capacity Attention
    if (params.capacity.capacityStatus === 'insufficient') {
      items.push({
        id: `att_cap_${params.schoolId}_${Date.now()}_1`,
        schoolId: params.schoolId,
        category: 'CAPACITY',
        severity: 'CRITICAL',
        title: 'Teaching capacity insufficient',
        description: `Effective capacity of ${params.capacity.effectiveSlots} slots is less than required ${params.capacity.totalRequiredSlots} slots.`,
        sourceType: 'TEACHING_PLAN',
        recommendedAction: 'Review Teaching Plan allocations or adjust teaching schedule.',
        detectedAt,
      });
    } else if (params.capacity.capacityStatus === 'tight') {
      items.push({
        id: `att_cap_${params.schoolId}_${Date.now()}_2`,
        schoolId: params.schoolId,
        category: 'CAPACITY',
        severity: 'WARNING',
        title: 'Teaching capacity tight',
        description: `Effective capacity (${params.capacity.effectiveSlots} slots) matches or marginally exceeds required slots.`,
        sourceType: 'TEACHING_PLAN',
        recommendedAction: 'Monitor remaining teaching weeks and avoid unplanned closures.',
        detectedAt,
      });
    }

    // 2. Outstanding Lessons Attention
    if (params.teachingControl.outstandingLessons > 0) {
      const severity = params.teachingControl.outstandingLessons > 5 ? 'WARNING' : 'ATTENTION';
      items.push({
        id: `att_tc_${params.schoolId}_${Date.now()}_3`,
        schoolId: params.schoolId,
        category: 'TEACHING_CONTROL',
        severity,
        title: `${params.teachingControl.outstandingLessons} lessons outstanding`,
        description: `There are ${params.teachingControl.outstandingLessons} expected lesson slots without completed delivery records.`,
        sourceType: 'LESSON_SCHEDULE',
        recommendedAction: 'Review missed teaching slots with assigned teachers in Classroom Delivery.',
        detectedAt,
      });
    }

    // 3. Cancelled Lessons Information / Attention
    if (params.teachingControl.cancelledLessons > 0) {
      items.push({
        id: `att_tc_${params.schoolId}_${Date.now()}_4`,
        schoolId: params.schoolId,
        category: 'OPERATIONS',
        severity: 'INFORMATION',
        title: `${params.teachingControl.cancelledLessons} lessons cancelled or disrupted`,
        description: `Operational exceptions recorded ${params.teachingControl.cancelledLessons} cancelled lessons.`,
        sourceType: 'OPERATIONAL_EXCEPTION',
        recommendedAction: 'Review rescheduled makeup options in Academic Operations.',
        detectedAt,
      });
    }

    // 4. Curriculum Coverage Attention
    if (params.curriculumCoverage.status === 'ATTENTION_REQUIRED' || params.curriculumCoverage.status === 'CRITICAL') {
      items.push({
        id: `att_cov_${params.schoolId}_${Date.now()}_5`,
        schoolId: params.schoolId,
        category: 'COVERAGE',
        severity: params.curriculumCoverage.status === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        title: `Curriculum coverage requires attention (${params.curriculumCoverage.coveragePercentage}%)`,
        description: `${params.curriculumCoverage.unallocatedOutcomes} applicable Learning Outcomes remain unallocated in Teaching Plans.`,
        sourceType: 'TEACHING_PLAN',
        recommendedAction: 'Allocate missing Learning Outcomes in Teaching Plan builder.',
        detectedAt,
      });
    }

    // 5. Learner Evidence Attention
    if (params.learnerEvidence.learnersWithInsufficientEvidence > 0) {
      items.push({
        id: `att_evi_${params.schoolId}_${Date.now()}_6`,
        schoolId: params.schoolId,
        category: 'EVIDENCE',
        severity: 'ATTENTION',
        title: `${params.learnerEvidence.learnersWithInsufficientEvidence} learners have insufficient evidence`,
        description: 'Learners require classroom assessment or teacher evaluation evidence for accurate mastery interpretation.',
        sourceType: 'LEARNING_OUTCOME',
        recommendedAction: 'Administer formative topical assessments in Classroom Delivery.',
        detectedAt,
      });
    }

    // 6. Conflicting Evidence Attention
    if (params.learnerEvidence.highConflictOutcomesCount > 0) {
      items.push({
        id: `att_cnf_${params.schoolId}_${Date.now()}_7`,
        schoolId: params.schoolId,
        category: 'INTERPRETATION',
        severity: 'WARNING',
        title: `${params.learnerEvidence.highConflictOutcomesCount} Learning Outcomes have conflicting evidence`,
        description: 'Multiple contradictory assessment attempts detected for certain learning outcomes.',
        sourceType: 'LEARNING_OUTCOME',
        recommendedAction: 'Conduct qualitative teacher evaluation to resolve conflicting evidence.',
        detectedAt,
      });
    }

    return items;
  },

  // ----------------------------------------------------
  // 4. SPECIFIC ACADEMIC REPORTS (READ-ONLY)
  // ----------------------------------------------------
  getDailyTeachingReport(
    schoolId: string,
    date: string,
    requestingUserId: string,
    requestingRole: AcademicRole
  ): DailyTeachingReport {
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    const dayView = AcademicOperationsService.getAcademicDayView(schoolId, date);
    const schedules = AcademicOperationsService.getLessonSchedules(schoolId);
    const activities = TeachingActivityService.getActivitiesBySchool(schoolId);
    const exceptions = AcademicOperationsService.getOperationalExceptions(schoolId);

    const lessons: DailyTeachingReport['lessons'] = [];
    let deliveredLessons = 0;
    let cancelledLessons = 0;
    let rescheduledLessons = 0;

    for (const sch of schedules) {
      // Check if exception exists for this schedule on this date
      const ex = exceptions.find(
        e => e.schoolId === schoolId && (e.effectiveDate === date || e.originalDate === date) && e.affectedScheduleId === sch.id
      );

      let status: DailyTeachingReport['lessons'][0]['status'] = 'SCHEDULED';
      if (ex) {
        if (ex.exceptionType === 'LESSON_CANCELLED' || ex.exceptionType === 'SCHOOL_CLOSED') {
          status = 'CANCELLED';
          cancelledLessons++;
        } else if (ex.exceptionType === 'LESSON_RESCHEDULED') {
          status = 'RESCHEDULED';
          rescheduledLessons++;
        }
      } else {
        const act = activities.find(
          a => a.schoolId === schoolId && a.teachingAllocationId === sch.id
        );
        if (act) {
          if (act.status === 'COMPLETED') {
            status = 'DELIVERED';
            deliveredLessons++;
          } else if (act.status === 'IN_PROGRESS') {
            status = 'IN_PROGRESS';
          }
        }
      }

      lessons.push({
        scheduleId: sch.id,
        learningAreaId: sch.learningAreaId,
        learningAreaName: sch.learningAreaId,
        gradeId: sch.gradeId,
        teacherId: sch.teacherId,
        status,
        timeSlot: `${sch.startTime} - ${sch.endTime}`,
      });
    }

    const expectedLessons = dayView.isTeachingDay ? schedules.length : 0;
    const outstandingLessons = Math.max(0, expectedLessons - deliveredLessons - cancelledLessons);

    return {
      date,
      schoolId,
      isTeachingDay: dayView.isTeachingDay,
      dayType: dayView.dayType,
      expectedLessons,
      deliveredLessons,
      outstandingLessons,
      cancelledLessons,
      rescheduledLessons,
      lessons,
      summaryText: dayView.isTeachingDay
        ? `Daily Teaching Report for ${date}: Expected ${expectedLessons}, Delivered ${deliveredLessons}, Outstanding ${outstandingLessons}.`
        : `Non-teaching day (${dayView.dayType}) for ${date}.`,
    };
  },

  getWeeklyTeachingReport(
    schoolId: string,
    weekNumber: number,
    termId: string,
    requestingUserId: string,
    requestingRole: AcademicRole
  ): WeeklyTeachingReport {
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    const weeks = AcademicOperationsService.getTeachingWeeks(schoolId, termId);
    const targetWeek = weeks.find(w => w.weekNumber === weekNumber) || {
      weekNumber,
      startDate: '2026-01-05',
      endDate: '2026-01-09',
      status: 'CURRENT',
      totalTeachingDays: 5,
    };

    const schedules = AcademicOperationsService.getLessonSchedules(schoolId);
    const activities = TeachingActivityService.getActivitiesBySchool(schoolId);
    const exceptions = AcademicOperationsService.getOperationalExceptions(schoolId);

    const planned = schedules.length * 5;
    const expected = schedules.length * targetWeek.totalTeachingDays;
    
    let delivered = 0;
    for (const act of activities) {
      if (act.status === 'COMPLETED') delivered++;
    }

    let cancelled = 0;
    let rescheduled = 0;
    for (const ex of exceptions) {
      if (ex.exceptionType === 'LESSON_CANCELLED' || ex.exceptionType === 'SCHOOL_CLOSED') cancelled++;
      else if (ex.exceptionType === 'LESSON_RESCHEDULED') rescheduled++;
    }

    const outstanding = Math.max(0, expected - delivered - cancelled);

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dailyBreakdown = dayNames.map((name, idx) => ({
      date: new Date(new Date(targetWeek.startDate).getTime() + idx * 86400000).toISOString().split('T')[0],
      dayName: name,
      expected: schedules.length,
      delivered: Math.floor(delivered / 5),
      outstanding: Math.floor(outstanding / 5),
      cancelled: Math.floor(cancelled / 5),
    }));

    return {
      weekNumber,
      startDate: targetWeek.startDate,
      endDate: targetWeek.endDate,
      schoolId,
      planned,
      expected,
      delivered,
      outstanding,
      cancelled,
      rescheduled,
      dailyBreakdown,
    };
  },

  getCurriculumCoverageReport(
    schoolId: string,
    filter: { gradeId?: string; learningAreaId?: string },
    requestingUserId: string,
    requestingRole: AcademicRole
  ): CurriculumCoverageReport {
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    const canonical = CanonicalCurriculumService.getCurriculum();
    const publishedRecord =
      CurriculumIngestionService.getActiveCurriculum() || {
        version: canonical.version,
        publishedAt: new Date().toISOString(),
        publishedBy: 'system',
        curriculum: canonical,
        sha256Hash: 'hash',
      };

    const breakdownByLearningArea: CurriculumCoverageReport['breakdownByLearningArea'] = [];
    let totalOutcomes = 0;
    let allocatedOutcomes = 0;

    const learningAreas = CanonicalCurriculumService.getLearningAreas(filter.gradeId);
    for (const la of learningAreas) {
      if (filter.learningAreaId && la.id !== filter.learningAreaId) continue;

      let laTotal = 0;
      const strands = CanonicalCurriculumService.getStrands(la.id);
      for (const st of strands) {
        const subStrands = CanonicalCurriculumService.getSubStrands(st.id);
        for (const sst of subStrands) {
          const outcomes = CanonicalCurriculumService.getLearningOutcomes(sst.id);
          laTotal += outcomes.length;
        }
      }

      // Find plans for this learning area
      const plans = TeachingPlanService.getPlansBySchool(schoolId).filter(
        p => p.learningAreaId === la.id || (p as any).subject === la.name
      );

      let laAllocated = 0;
      for (const p of plans) {
        if (p.weeks) {
          const outcomeIds = new Set<string>();
          p.weeks.forEach(w => w.lessonSlots.forEach(s => {
            if (s.learningOutcomeIds) s.learningOutcomeIds.forEach(id => outcomeIds.add(id));
          }));
          laAllocated += outcomeIds.size;
        } else if ((p as any).allocations) {
          const outcomeIds = new Set((p as any).allocations.map((a: any) => a.learningOutcomeId));
          laAllocated += outcomeIds.size;
        }
      }

      const isZero = laTotal === 0;
      const covPct = isZero ? null : Number(((laAllocated / laTotal) * 100).toFixed(1));

      let status: CurriculumCoverageReport['breakdownByLearningArea'][0]['status'] = 'SUFFICIENT';
      if (isZero) status = 'NOT_APPLICABLE';
      else if (covPct! < 50) status = 'CRITICAL';
      else if (covPct! < 80) status = 'ATTENTION_REQUIRED';

      totalOutcomes += laTotal;
      allocatedOutcomes += laAllocated;

      breakdownByLearningArea.push({
        learningAreaId: la.id,
        learningAreaTitle: la.name,
        gradeId: filter.gradeId || 'grade_8',
        totalOutcomes: laTotal,
        allocatedOutcomes: laAllocated,
        coveragePercentage: covPct,
        status,
      });
    }

    const overallCoveragePct =
      totalOutcomes > 0 ? Number(((allocatedOutcomes / totalOutcomes) * 100).toFixed(1)) : null;

    return {
      schoolId,
      curriculumVersionId: publishedRecord.version,
      gradeId: filter.gradeId,
      learningAreaId: filter.learningAreaId,
      totalOutcomes,
      allocatedOutcomes,
      coveragePercentage: overallCoveragePct,
      breakdownByLearningArea,
    };
  },

  getLearningOutcomeEvidenceReport(
    schoolId: string,
    filter: { gradeId?: string; learningAreaId?: string },
    requestingUserId: string,
    requestingRole: AcademicRole
  ): LearningOutcomeEvidenceReport {
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    const evidenceList = AssessmentEvidenceService.getEvidenceBySchool(schoolId);
    const interpretations = LearningOutcomeInterpretationService.getInterpretationsBySchool(schoolId);

    const outcomes: LearningOutcomeEvidenceReport['outcomes'] = [];
    const learningAreas = CanonicalCurriculumService.getLearningAreas(filter.gradeId);

    for (const la of learningAreas) {
      if (filter.learningAreaId && la.id !== filter.learningAreaId) continue;

      const strands = CanonicalCurriculumService.getStrands(la.id);
      for (const st of strands) {
        const subStrands = CanonicalCurriculumService.getSubStrands(st.id);
        for (const sst of subStrands) {
          const outcomeList = CanonicalCurriculumService.getLearningOutcomes(sst.id);
          for (const slo of outcomeList) {
            const outcomeEvidence = evidenceList.filter(
              e => e.learningOutcomeId === slo.id && !e.isVoided
            );

            const outcomeInterps = interpretations.filter(i => i.learningOutcomeId === slo.id);

            const learnersSet = new Set(outcomeEvidence.map(e => e.learnerId));

            let strong = 0,
              demo = 0,
              dev = 0,
              emg = 0,
              ins = 0;

            for (const inp of outcomeInterps) {
              if (inp.interpretationStatus === 'STRONG_DEMONSTRATION') strong++;
              else if (inp.interpretationStatus === 'DEMONSTRATED') demo++;
              else if (inp.interpretationStatus === 'DEVELOPING') dev++;
              else if (inp.interpretationStatus === 'EMERGING') emg++;
              else ins++;
            }

            const hasConflict = outcomeInterps.some(i => i.conflictStatus === 'HIGH_CONFLICT');

            outcomes.push({
              outcomeId: slo.id,
              outcomeDescription: (slo as any).text || (slo as any).statement || slo.code || slo.id,
              learningAreaId: la.id,
              gradeId: filter.gradeId || 'grade_8',
              learnersWithEvidence: learnersSet.size,
              totalLearners: Math.max(learnersSet.size, 1),
              evidenceCount: outcomeEvidence.length,
              conflictStatus: hasConflict ? 'HIGH_CONFLICT' : 'NO_CONFLICT',
              statusDistribution: {
                strongDemonstration: strong,
                demonstrated: demo,
                developing: dev,
                emerging: emg,
                insufficientEvidence: ins,
              },
            });
          }
        }
      }
    }

    return {
      schoolId,
      gradeId: filter.gradeId,
      learningAreaId: filter.learningAreaId,
      totalOutcomesEvaluated: outcomes.length,
      outcomes,
    };
  },

  getAcademicExceptionReport(
    schoolId: string,
    academicYearId: string,
    termId?: string,
    requestingUserId?: string,
    requestingRole?: AcademicRole
  ): AcademicExceptionReport {
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    const exceptions = AcademicOperationsService.getOperationalExceptions(schoolId);
    const reportExceptions: AcademicExceptionReport['exceptions'] = [];

    for (const ex of exceptions) {
      reportExceptions.push({
        id: ex.id,
        date: ex.effectiveDate || ex.originalDate || '',
        type: ex.exceptionType,
        affectedGrade: ex.gradeId,
        affectedLearningArea: ex.learningAreaId,
        teacherId: ex.teacherId,
        reason: ex.reason,
        actionRequired:
          ex.exceptionType === 'LESSON_CANCELLED'
            ? 'Schedule makeup lesson in timetable'
            : ex.exceptionType === 'LESSON_RESCHEDULED'
            ? 'Confirm updated lesson timing with assigned teacher'
            : 'Review operational calendar impact',
        status: ex.exceptionType === 'LESSON_RESCHEDULED' ? 'RESOLVED' : 'ACTIVE',
      });
    }

    return {
      schoolId,
      academicYearId,
      termId,
      totalExceptions: reportExceptions.length,
      exceptions: reportExceptions,
    };
  },

  getTeacherAcademicView(
    schoolId: string,
    teacherId: string,
    requestingUserId: string,
    requestingRole: AcademicRole
  ): TeacherAcademicView {
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    // Role-based authorization & teacher privacy
    const isAdmin =
      requestingRole === 'SUPER_ADMIN' ||
      requestingRole === 'SCHOOL_ADMIN' ||
      requestingRole === 'ACADEMIC_ADMIN' ||
      requestingRole === 'admin';

    if (!isAdmin && requestingUserId !== teacherId) {
      AuditService.log('SECURITY_VIOLATION', schoolId, {
        action: 'UNAUTHORIZED_PEER_TEACHER_VIEW_ACCESS',
        requestingUserId,
        targetTeacherId: teacherId,
      });
      throw new Error('Unauthorized access: teachers cannot view other teachers operational performance');
    }

    const schedules = AcademicOperationsService.getLessonSchedules(schoolId).filter(
      s => s.teacherId === teacherId
    );

    const activities = TeachingActivityService.getActivitiesBySchool(schoolId).filter(
      a => a.teacherId === teacherId
    );

    const exceptions = AcademicOperationsService.getOperationalExceptions(schoolId).filter(
      e => e.teacherId === teacherId
    );

    const plannedLessons = schedules.length * 5;
    const expectedLessons = schedules.length * 5;

    let deliveredLessons = 0;
    for (const act of activities) {
      if (act.status === 'COMPLETED') deliveredLessons++;
    }

    let cancelledLessons = 0;
    let rescheduledLessons = 0;
    for (const ex of exceptions) {
      if (ex.exceptionType === 'LESSON_CANCELLED' || ex.exceptionType === 'SCHOOL_CLOSED') cancelledLessons++;
      else if (ex.exceptionType === 'LESSON_RESCHEDULED') rescheduledLessons++;
    }

    const outstandingLessons = Math.max(0, expectedLessons - deliveredLessons - cancelledLessons);
    const deliveryRatePercentage =
      expectedLessons > 0
        ? Number(((deliveredLessons / expectedLessons) * 100).toFixed(1))
        : null;

    const gradesSet = new Set(schedules.map(s => s.gradeId));
    const learningAreasSet = new Set(schedules.map(s => s.learningAreaId));

    return {
      teacherId,
      schoolId,
      plannedLessons,
      expectedLessons,
      deliveredLessons,
      outstandingLessons,
      cancelledLessons,
      rescheduledLessons,
      assignedGrades: Array.from(gradesSet),
      assignedLearningAreas: Array.from(learningAreasSet),
      deliveryRatePercentage,
    };
  },

  // ----------------------------------------------------
  // 5. EXPORT READ MODELS (CSV / JSON / PRINT VIEW)
  // ----------------------------------------------------
  exportReport(params: {
    schoolId: string;
    reportType: AcademicReportExport['reportType'];
    format: AcademicReportExport['format'];
    academicYearName?: string;
    termName?: string;
    requestingUserId: string;
    requestingRole: AcademicRole;
  }): AcademicReportExport {
    if (!SchoolConfigService.isRegisteredSchool(params.schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${params.schoolId}`);
    }

    const overview = this.getSchoolAcademicOverview(params.schoolId, {
      requestingUserId: params.requestingUserId,
      requestingRole: params.requestingRole,
    });

    const generatedAt = new Date().toISOString();
    let content = '';

    if (params.format === 'JSON') {
      content = JSON.stringify(overview, null, 2);
    } else if (params.format === 'CSV') {
      content = `Metric,Value,Explanation\n`;
      content += `School,${overview.schoolName},-\n`;
      content += `Academic Year,${overview.academicYearName},-\n`;
      content += `Term,${overview.termName},-\n`;
      content += `Planned Lessons,${overview.teachingControl.plannedLessons},Total allocations in teaching plans\n`;
      content += `Expected Lessons,${overview.teachingControl.expectedLessons},Scheduled lesson slots\n`;
      content += `Delivered Lessons,${overview.teachingControl.deliveredLessons},Completed teaching activities\n`;
      content += `Outstanding Lessons,${overview.teachingControl.outstandingLessons},Remaining expected lessons\n`;
      content += `Cancelled Lessons,${overview.teachingControl.cancelledLessons},Operational cancellations\n`;
      content += `Curriculum Coverage,${overview.curriculumCoverage.coveragePercentage ?? 'N/A'}%,${overview.curriculumCoverage.explanation}\n`;
      content += `Evidence Available,${overview.learnerEvidence.evidenceAvailabilityPercentage ?? 'N/A'}%,${overview.learnerEvidence.explanation}\n`;
      content += `Capacity Status,${overview.capacity.capacityStatus},${overview.capacity.explanation}\n`;
    } else {
      // Print View
      content = `=== ECG ACADEMIC OVERSIGHT REPORT ===\n`;
      content += `School: ${overview.schoolName} (${overview.schoolId})\n`;
      content += `Academic Period: ${overview.academicYearName} - ${overview.termName} (Week ${overview.currentWeekNumber})\n`;
      content += `Generated At: ${generatedAt}\n\n`;
      content += `--- TEACHING CONTROL ---\n`;
      content += `Planned: ${overview.teachingControl.plannedLessons} | Expected: ${overview.teachingControl.expectedLessons} | Delivered: ${overview.teachingControl.deliveredLessons} | Outstanding: ${overview.teachingControl.outstandingLessons} | Cancelled: ${overview.teachingControl.cancelledLessons}\n`;
      content += `Delivery Rate: ${overview.teachingControl.teachingDeliveryRatePercentage ?? 'N/A'}%\n\n`;
      content += `--- CURRICULUM COVERAGE ---\n`;
      content += `Planned Coverage: ${overview.curriculumCoverage.coveragePercentage ?? 'N/A'}% (${overview.curriculumCoverage.allocatedOutcomes}/${overview.curriculumCoverage.totalOutcomes} outcomes)\n\n`;
      content += `--- LEARNER EVIDENCE ---\n`;
      content += `Evidence Availability: ${overview.learnerEvidence.evidenceAvailabilityPercentage ?? 'N/A'}% (${overview.learnerEvidence.learnersWithEvidence}/${overview.learnerEvidence.totalLearners} learners)\n\n`;
      content += `--- CAPACITY STATUS ---\n`;
      content += `Status: ${overview.capacity.capacityStatus} (Required: ${overview.capacity.totalRequiredSlots}, Effective Available: ${overview.capacity.effectiveSlots})\n\n`;
      content += `--- ATTENTION ITEMS (${overview.attentionItems.length}) ---\n`;
      overview.attentionItems.forEach((item, i) => {
        content += `${i + 1}. [${item.severity}] ${item.title}: ${item.description} -> Action: ${item.recommendedAction}\n`;
      });
    }

    return {
      reportType: params.reportType,
      format: params.format,
      metadata: {
        schoolId: params.schoolId,
        academicYear: overview.academicYearName,
        term: overview.termName,
        generatedAt,
        generatedBy: params.requestingUserId,
        version: '1.0.0',
        isAuthoritativeSnapshot: true,
      },
      content,
    };
  },

  // ----------------------------------------------------
  // 6. AI EXPLANATION BOUNDARY (OPTIONAL ASSISTANCE)
  // ----------------------------------------------------
  generateAdministrativeSummary(
    overview: SchoolAcademicOverview,
    aiFormattedNotes?: string
  ): {
    summary: string;
    sourceMetricsPreserved: boolean;
    isAIEnhanced: boolean;
  } {
    // Deterministic base summary
    const baseSummary = `School ${overview.schoolName} is in ${overview.academicYearName} ${overview.termName}. ` +
      `Teaching Control is ${overview.teachingControl.status} with ${overview.teachingControl.deliveredLessons} of ${overview.teachingControl.expectedLessons} lessons delivered (${overview.teachingControl.teachingDeliveryRatePercentage ?? 0}%). ` +
      `Curriculum Coverage is ${overview.curriculumCoverage.coveragePercentage ?? 0}% across ${overview.curriculumCoverage.allocatedOutcomes} allocated outcomes. ` +
      `Capacity is ${overview.capacity.capacityStatus}. ${overview.attentionItems.length} attention item(s) require review.`;

    if (aiFormattedNotes) {
      return {
        summary: `${baseSummary}\n\nAdministrative Notes (AI Assistance): ${aiFormattedNotes}`,
        sourceMetricsPreserved: true,
        isAIEnhanced: true,
      };
    }

    return {
      summary: baseSummary,
      sourceMetricsPreserved: true,
      isAIEnhanced: false,
    };
  }
};
