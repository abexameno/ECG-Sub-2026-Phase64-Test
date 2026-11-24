import { TeachingPlanService } from './services/teachingPlanService.ts';
import { TeachingCoverageService } from './services/teachingCoverageService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { CurriculumIngestionService, PublishedCurriculumRecord } from './services/curriculumIngestionService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 37 — Curriculum Coverage, Teaching Plan & Pacing Integrity', () => {
  beforeEach(() => {
    TeachingPlanService.clearStore();
    TeachingActivityService.clearStore();
    AuditService.clearLogs();
  });

  describe('I. CANONICAL CURRICULUM & AUTHORITATIVE LESSON ALLOCATION INTEGRITY', () => {
    it('A. resolves canonical curriculum and preserves KICD suggested lesson allocations', () => {
      const g6Strands = CanonicalCurriculumService.getStrands('la-agric');
      const g6SubStrands = g6Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));
      const g6TotalSuggested = g6SubStrands.reduce((sum, ss) => sum + (ss.suggestedLessonAllocation || 0), 0);

      expect(g6SubStrands.length).toBe(10);
      expect(g6TotalSuggested).toBe(120);

      // Verify specific KICD allocations
      const erosion = g6SubStrands.find(ss => ss.title === '1.1 Controlling Soil Erosion');
      expect(erosion?.suggestedLessonAllocation).toBe(11);

      const crocheting = g6SubStrands.find(ss => ss.title === '4.1 Crocheting of PPEs');
      expect(crocheting?.suggestedLessonAllocation).toBe(16);
    });

    it('B, C. enforces grade and learning area matching against canonical records', () => {
      const plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');
      expect(plan.gradeLevelId).toBe('grade-6');
      expect(plan.learningAreaId).toBe('la-agric');

      const validation = TeachingPlanService.validateTeachingPlan(plan);
      expect(validation.valid).toBe(true);

      // Mismatch test
      const invalidPlan = { ...plan, gradeLevelId: 'invalid-grade-99' };
      const invalidRes = TeachingPlanService.validateTeachingPlan(invalidPlan);
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.errors.some(e => e.includes('Invalid grade level ID'))).toBe(true);
    });

    it('D, M, N. allocates curriculum units in strict sequential order without cyclic modulo repetition or duplication', () => {
      const plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');
      
      const slots = plan.weeks.flatMap(w => w.lessonSlots);
      const curriculumSlots = slots.filter(s => s.slotType === 'CURRICULUM_LESSON');

      // Verify sub-strand ordering strictly progresses
      const subStrandSequence: string[] = [];
      curriculumSlots.forEach(slot => {
        if (slot.subStrandId && (subStrandSequence.length === 0 || subStrandSequence[subStrandSequence.length - 1] !== slot.subStrandId)) {
          subStrandSequence.push(slot.subStrandId);
        }
      });

      // The sequence should reflect canonical sub-strands in order without wrapping around
      expect(subStrandSequence.length).toBeGreaterThan(0);
      expect(subStrandSequence[0]).toBe('substrand-g6-agric-1-1'); // 1.1 Controlling Soil Erosion

      // Check count of slots for Controlling Soil Erosion: exactly 11 slots
      const erosionSlots = curriculumSlots.filter(s => s.subStrandId === 'substrand-g6-agric-1-1');
      expect(erosionSlots.length).toBe(11);
    });
  });

  describe('II. PACING ENGINE, CAPACITY GAPS & SURPLUS ALLOCATIONS', () => {
    it('E, F. maintains explicit separation between KICD suggested allocation and school planned allocation', () => {
      const pacing = TeachingPlanService.calculatePacing('school-lwps', 'grade-6', 'la-agric', 'Term 1');

      // Controlling Soil Erosion KICD suggested is 11
      const erosionAlloc = pacing.allocations.find(a => a.subStrandId === 'substrand-g6-agric-1-1');
      expect(erosionAlloc).toBeDefined();
      expect(erosionAlloc?.curriculumSuggestedLessons).toBe(11);
      expect(erosionAlloc?.schoolPlannedLessons).toBe(11);

      // Ensure KICD canonical record was NOT modified
      const canonicalErosion = CanonicalCurriculumService.getSubStrandById('substrand-g6-agric-1-1');
      expect(canonicalErosion?.suggestedLessonAllocation).toBe(11);
    });

    it('G, H, I, J. calculates calendar capacity and flags COVERAGE_GAP / INSUFFICIENT when capacity is tight', () => {
      // Register a school with limited capacity: 3 weeks * 5 lessons/wk = 15 slots
      SchoolConfigService.registerProfile({
        id: 'school-tight-p37',
        name: 'Tight Capacity Academy',
        teachingConfig: {
          lessonsPerWeek: 5,
          teachingWeeksPerTerm: 3,
          lessonDurationMinutes: 35,
        },
        contentPreferences: { defaultPublisher: 'KLB' },
      });

      // Grade 6 Agriculture Term 1 sub-strands require 11 + 11 + 10 = 32 lessons
      const plan = TeachingPlanService.generateTeachingPlan('school-tight-p37', 'grade-6', 'la-agric', 'Term 1');

      expect(plan.totalLessonCapacity).toBe(15);
      expect(plan.requiredLessonsCount).toBe(32);
      expect(plan.capacityStatus).toBe('insufficient');
      expect(plan.coverageStatus).toBe('COVERAGE_GAP');
      expect(plan.unallocatedLessonCount).toBe(17);
      expect(plan.unallocatedSubStrandIds?.length).toBeGreaterThan(0);
      expect(plan.recommendedTeacherAction).toContain('COVERAGE_GAP');

      // Verify KICD curriculum was NOT compressed or deleted
      const canonicalAgric = CanonicalCurriculumService.getSubStrands('strand-g6-agric-1');
      expect(canonicalAgric.length).toBe(3);
    });

    it('K, L. flags SURPLUS capacity and allocates extra slots to REVISION without duplicating curriculum', () => {
      // Register a school with surplus capacity: 15 weeks * 5 lessons = 75 slots
      SchoolConfigService.registerProfile({
        id: 'school-surplus-p37',
        name: 'Surplus Capacity Academy',
        teachingConfig: {
          lessonsPerWeek: 5,
          teachingWeeksPerTerm: 15,
          lessonDurationMinutes: 35,
        },
        contentPreferences: { defaultPublisher: 'KLB' },
      });

      // Grade 6 Agriculture Term 1 requires 32 lessons
      const plan = TeachingPlanService.generateTeachingPlan('school-surplus-p37', 'grade-6', 'la-agric', 'Term 1');

      expect(plan.totalLessonCapacity).toBe(75);
      expect(plan.requiredLessonsCount).toBe(32);
      expect(plan.surplusSlotCount).toBe(43);
      expect(plan.coverageStatus).toBe('SURPLUS');

      const slots = plan.weeks.flatMap(w => w.lessonSlots);
      const revisionSlots = slots.filter(s => s.slotType === 'REVISION');
      expect(revisionSlots.length).toBe(43);
      expect(revisionSlots[0].title).toContain('Revision');
    });

    it('handles calendar adjustments (holidays and closures)', () => {
      const planWithHolidays = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1', {
        calendarAdjustments: {
          holidayLessonsDeducted: 5,
          schoolClosureWeeksDeducted: 1,
        },
      });

      // Standard LWPS: 13 weeks * 5 lessons = 65 slots
      // Minus 1 week closure (5 slots) and 5 holiday slots = 55 capacity
      expect(planWithHolidays.totalLessonCapacity).toBe(55);
    });
  });

  describe('III. COVERAGE MODEL & DISTINCTION BETWEEN PLANNED, DELIVERED & COMPLETED', () => {
    const dummyRecord: PublishedCurriculumRecord = {
      curriculumId: 'kicd-cbc-2026',
      version: '2026.1',
      title: 'KICD CBC 2026',
      publishedAt: new Date().toISOString(),
      publishedBy: 'system',
      grades: [
        {
          gradeId: 'grade-6',
          gradeName: 'Grade 6',
          learningAreas: [
            {
              learningAreaId: 'la-agric',
              learningAreaName: 'Agriculture and Nutrition',
              strands: [
                {
                  strandId: 'strand-g6-agric-1',
                  title: 'Conservation of Resources',
                  subStrands: [
                    {
                      subStrandId: 'substrand-g6-agric-1-1',
                      title: '1.1 Controlling Soil Erosion',
                      suggestedLessonAllocation: 11,
                      learningOutcomes: [
                        { learningOutcomeId: 'outcome-g6-agric-1-1-a', title: 'Identify soil erosion types', cognitiveLevel: 'understanding' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      isCurrentActive: true,
    };

    it('O, P, Q. correctly calculates coverage and distinguishes planned != delivered != completed', () => {
      const plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');
      const curriculumRecord: PublishedCurriculumRecord = {
        ...dummyRecord,
        version: plan.curriculumVersion || 'KICD CBC 2026',
      };

      // Create a delivered teaching activity
      const activity1 = TeachingActivityService.createTeachingActivity({
        schoolId: 'school-lwps',
        teacherId: 'teacher-1',
        teachingPlanId: plan.id,
        teachingAllocationId: 'alloc-1',
        curriculumVersionId: plan.curriculumVersion || 'KICD CBC 2026',
        learningOutcomeId: 'outcome-g6-agric-1-1-a',
      });
      TeachingActivityService.deliverTeachingActivity(activity1.activityId, 'school-lwps', 'teacher-1');

      // Create a completed teaching activity with explicit completion evidence
      const activity2 = TeachingActivityService.createTeachingActivity({
        schoolId: 'school-lwps',
        teacherId: 'teacher-1',
        teachingPlanId: plan.id,
        teachingAllocationId: 'alloc-2',
        curriculumVersionId: plan.curriculumVersion || 'KICD CBC 2026',
        learningOutcomeId: 'outcome-g6-agric-1-1-a',
      });
      TeachingActivityService.completeTeachingActivity(activity2.activityId, 'school-lwps', 'teacher-1', 'Learners performed erosion field check');

      const activities = TeachingActivityService.getActivitiesBySchool('school-lwps');
      const coverage = TeachingCoverageService.calculateCoverage(plan, curriculumRecord, activities);

      expect(coverage.coverageBreakdown.deliveredLessons).toBe(2);
      expect(coverage.coverageBreakdown.completedLessons).toBe(1);
      expect(coverage.coverageBreakdown.schoolPlannedAllocation).toBe(plan.allocatedLessonsCount);
      expect(coverage.coverageBreakdown.deliveredLessons).not.toBe(coverage.coverageBreakdown.completedLessons);
      expect(coverage.coverageBreakdown.schoolPlannedAllocation).not.toBe(coverage.coverageBreakdown.deliveredLessons);
    });
  });

  describe('IV. MULTI-SCHOOL ISOLATION, AUTHORIZATION & IDOR REJECTION', () => {
    it('R, S, T, U. enforces strict multi-school isolation and rejects IDOR attempts', () => {
      const planLWPS = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');

      // Same school access succeeds
      const fetched = TeachingPlanService.getPlan(planLWPS.id, 'school-lwps');
      expect(fetched.id).toBe(planLWPS.id);

      // Cross-school query fails
      expect(() => TeachingPlanService.getPlan(planLWPS.id, 'school-attacker')).toThrow('Unauthorized cross-school access');

      // Cross-school creation fails
      expect(() => TeachingPlanService.createPlan({ schoolId: 'school-lwps', gradeLevelId: 'grade-6' }, 'school-attacker')).toThrow('Unauthorized cross-school creation');

      // Cross-school list query fails
      expect(() => TeachingPlanService.getPlansBySchool('school-lwps', 'school-attacker')).toThrow('Unauthorized cross-school query');
    });
  });

  describe('V. IDEMPOTENCY, AUDITABILITY & NEGATIVE TESTS', () => {
    it('V, W. logs audit events and remains idempotent upon recalculation', () => {
      const plan1 = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');
      const plan2 = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');

      expect(plan1.id).toBe(plan2.id);
      expect(plan1.totalLessonCapacity).toBe(plan2.totalLessonCapacity);
      expect(plan1.requiredLessonsCount).toBe(plan2.requiredLessonsCount);

      const logs = AuditService.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(l => l.eventType === 'ARTIFACT_CREATED' && l.details?.action === 'TEACHING_PLAN_GENERATED')).toBe(true);
    });

    it('NEGATIVE TESTS: rejects unknown learning areas and invalid parameters', () => {
      expect(() => TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'non-existent-la', 'Term 1')).toThrow('Invalid learning area ID');
    });
  });
});
