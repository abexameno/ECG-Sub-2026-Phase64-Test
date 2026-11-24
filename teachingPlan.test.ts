import { TeachingPlanService } from './services/teachingPlanService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';

describe('TeachingPlanService & Curriculum-to-Teaching Architecture (Phase 3)', () => {
  test('should generate deterministic teaching plans across multiple schools with the same curriculum', () => {
    // School A: 5 lessons/wk, 13 weeks = 65 capacity
    const planA = TeachingPlanService.generateTeachingPlan('lwps', 'grade-7', 'la-math', 'Term 1');
    expect(planA.lessonsPerWeek).toBe(5);
    expect(planA.totalTeachingWeeks).toBe(13);
    expect(planA.totalLessonCapacity).toBe(65);

    // School B: 4 lessons/wk, 12 weeks = 48 capacity
    const planB = TeachingPlanService.generateTeachingPlan('school-b', 'grade-7', 'la-math', 'Term 1');
    expect(planB.lessonsPerWeek).toBe(4);
    expect(planB.totalTeachingWeeks).toBe(12);
    expect(planB.totalLessonCapacity).toBe(48);

    // School C (hypothetical): Register and test
    SchoolConfigService.registerProfile({
      id: 'school-c',
      name: 'School C Academy',
      teachingConfig: {
        lessonsPerWeek: 6,
        teachingWeeksPerTerm: 11,
        lessonDurationMinutes: 35
      },
      contentPreferences: { defaultPublisher: 'KLB' }
    });

    const planC = TeachingPlanService.generateTeachingPlan('school-c', 'grade-7', 'la-math', 'Term 1');
    expect(planC.lessonsPerWeek).toBe(6);
    expect(planC.totalTeachingWeeks).toBe(11);
    expect(planC.totalLessonCapacity).toBe(66);

    // Ensure curriculum ID is identical across all three school plans (Curriculum is invariant)
    expect(planA.curriculumId).toBe(planB.curriculumId);
    expect(planB.curriculumId).toBe(planC.curriculumId);
  });

  test('should validate teaching plan correctly', () => {
    const plan = TeachingPlanService.generateTeachingPlan('lwps', 'grade-7', 'la-math', 'Term 1');
    const validation = TeachingPlanService.validateTeachingPlan(plan);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test('should detect invalid school or mismatch in configuration', () => {
    const plan = TeachingPlanService.generateTeachingPlan('lwps', 'grade-7', 'la-math', 'Term 1');
    plan.schoolId = 'non-existent';
    const validation = TeachingPlanService.validateTeachingPlan(plan);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
