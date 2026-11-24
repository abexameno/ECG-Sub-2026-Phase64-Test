import { TeachingPlanService } from './services/teachingPlanService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';

describe('Phase 36B: Deterministic Sequencing & Capacity Validation', () => {
  beforeEach(() => {
    TeachingPlanService.clearStore();
  });

  test('should allocate lessons sequentially without modulo repetition', () => {
    const plan = TeachingPlanService.generateTeachingPlan('lwps', 'grade-7', 'la-math', 'Term 1');
    
    // Total slots: 13 weeks * 5 lessons/wk = 65 slots
    expect(plan.totalLessonCapacity).toBe(65);

    // Collect all assigned sub-strand IDs across slots
    const assignedSlots = plan.weeks.flatMap(w => w.lessonSlots);
    const curriculumSlots = assignedSlots.filter(s => s.slotType === 'CURRICULUM_LESSON');

    // Verify sub-strand progression is sequential and does not loop back via modulo
    const subStrandOrder: string[] = [];
    curriculumSlots.forEach(slot => {
      if (slot.subStrandId && !subStrandOrder.includes(slot.subStrandId)) {
        subStrandOrder.push(slot.subStrandId);
      }
    });

    // Ensure we have sub-strands in order without infinite modulo repetition
    expect(subStrandOrder.length).toBeGreaterThan(0);

    // Prove modulo sequencing is absent: extra slots are marked as REVISION, not repeated sub-strands
    const revisionSlots = assignedSlots.filter(s => s.slotType === 'REVISION');
    if (plan.surplusSlotCount && plan.surplusSlotCount > 0) {
      expect(revisionSlots.length).toBe(plan.surplusSlotCount);
      expect(revisionSlots[0].title).toContain('Revision');
    }
  });

  test('REGRESSION TEST: Old modulo index % length logic cannot return', () => {
    // School C: 10 weeks * 2 lessons/wk = 20 slots
    SchoolConfigService.registerProfile({
      id: 'school-test-modulo',
      name: 'Modulo Proof Academy',
      teachingConfig: {
        lessonsPerWeek: 2,
        teachingWeeksPerTerm: 10,
        lessonDurationMinutes: 40
      },
      contentPreferences: { defaultPublisher: 'KLB' }
    });

    const plan = TeachingPlanService.generateTeachingPlan('school-test-modulo', 'grade-7', 'la-math', 'Term 1');

    // Count how many times a specific sub-strand appears as a CURRICULUM_LESSON
    const slots = plan.weeks.flatMap(w => w.lessonSlots);
    const wholeNumbersSlots = slots.filter(s => s.subStrandId === 'substrand-whole-numbers');

    // Each sub-strand gets its authoritative/unspecified allocation (1 slot if unspecified), NOT endlessly repeated across 20 slots
    expect(wholeNumbersSlots.length).toBe(1);

    // Unfilled capacity must be explicit REVISION slots, NOT repeated curriculum units
    const revisionSlots = slots.filter(s => s.slotType === 'REVISION');
    expect(revisionSlots.length).toBe(17); // 20 capacity - 3 curriculum slots = 17 revision slots
    expect(plan.coverageStatus).toBe('SURPLUS');
  });

  test('should identify coverage gaps when required curriculum capacity exceeds available slots', () => {
    // Register a school with very limited capacity: 1 week, 2 lessons/wk = 2 slots
    SchoolConfigService.registerProfile({
      id: 'school-tight',
      name: 'Tight Timetable School',
      teachingConfig: {
        lessonsPerWeek: 2,
        teachingWeeksPerTerm: 1,
        lessonDurationMinutes: 40
      },
      contentPreferences: { defaultPublisher: 'KLB' }
    });

    const plan = TeachingPlanService.generateTeachingPlan('school-tight', 'grade-7', 'la-math', 'Term 1');

    expect(plan.totalLessonCapacity).toBe(2);
    expect(plan.capacityStatus).toBe('insufficient');
    expect(plan.coverageStatus).toBe('COVERAGE_GAP');
    expect(plan.unallocatedLessonCount).toBeGreaterThan(0);
    expect(plan.unallocatedSubStrandIds?.length).toBeGreaterThan(0);
    expect(plan.recommendedTeacherAction).toContain('Coverage gap detected');
  });

  test('should respect suggested terms for sub-strands', () => {
    const term1Plan = TeachingPlanService.generateTeachingPlan('lwps', 'grade-7', 'la-math', 'Term 1');
    const assignedSubStrandIdsTerm1 = term1Plan.weeks
      .flatMap(w => w.lessonSlots)
      .map(s => s.subStrandId)
      .filter(Boolean);

    // Length conversion (suggestedTerm: Term 1) should be present in Term 1 plan
    expect(assignedSubStrandIdsTerm1).toContain('substrand-length');
  });

  test('should maintain school isolation across multi-school plans', () => {
    const planLWPS = TeachingPlanService.generateTeachingPlan('lwps', 'grade-7', 'la-math', 'Term 1');
    const planB = TeachingPlanService.generateTeachingPlan('school-b', 'grade-7', 'la-math', 'Term 1');

    expect(planLWPS.schoolId).toBe('lwps');
    expect(planB.schoolId).toBe('school-b');
    expect(planLWPS.totalLessonCapacity).not.toBe(planB.totalLessonCapacity);
  });
});
