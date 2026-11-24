import { getCurriculumByTerm } from './curriculumData.ts';
import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { SowSchedulingService } from './services/sowSchedulingService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';

describe('ECG-Sub-2026 — Scheme of Work Setup Ordering & Term-Dependent Loading', () => {
  describe('1. Setup Flow & Term-Dependent Curriculum Loading', () => {
    it('loads curriculum topics dynamically when Academic Term is selected for Grade 8 Integrated Science', () => {
      const term1Topics = getCurriculumByTerm('Grade 8', 'Integrated Science', ['Term 1']);
      expect(term1Topics).toBeDefined();
      expect(Object.keys(term1Topics!).length).toBeGreaterThan(0);

      const term2Topics = getCurriculumByTerm('Grade 8', 'Integrated Science', ['Term 2']);
      expect(term2Topics).toBeDefined();

      // Term 1 and Term 2 have distinct strands/topics
      expect(term1Topics).not.toEqual(term2Topics);
    });

    it('loads curriculum topics dynamically when Academic Term is selected for Grade 6 Agriculture and Nutrition', () => {
      const term1Topics = getCurriculumByTerm('Grade 6', 'Agriculture and Nutrition', ['Term 1']);
      const term3Topics = getCurriculumByTerm('Grade 6', 'Agriculture and Nutrition', ['Term 3']);

      expect(term1Topics).toBeDefined();
      expect(term3Topics).toBeDefined();
      expect(Object.keys(term1Topics!).length).toBeGreaterThan(0);
      expect(term1Topics).not.toEqual(term3Topics);
    });
  });

  describe('2. Term-Dependent Capacity Evaluation & Schedule Calculations', () => {
    it('evaluates capacity based on the selected term for Grade 8 Integrated Science', () => {
      // Term 1 requires 60 canonical lessons
      const term1Eval = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 1'],
        teachingWeeks: 10,
        lessonsPerWeek: 6,
      });

      expect(term1Eval.canonicalLessonCount).toBe(60);
      expect(term1Eval.totalAvailablePeriods).toBe(60);
      expect(term1Eval.status).toBe('EXACT_MATCH');
      expect(term1Eval.canGenerate).toBe(true);

      // Term 2 requires 54 canonical lessons
      const term2Eval = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 2'],
        teachingWeeks: 10,
        lessonsPerWeek: 6,
      });

      expect(term2Eval.canonicalLessonCount).toBe(54);
      expect(term2Eval.totalAvailablePeriods).toBe(60);
      expect(term2Eval.status).toBe('EXCESS_CAPACITY');
      expect(term2Eval.canGenerate).toBe(true);
      expect(term2Eval.unusedCapacity).toBe(6);
    });

    it('evaluates capacity when switching terms on independent custom teaching schedules', () => {
      // Independent teacher with 8 weeks and 5 lessons/wk = 40 periods
      const term3Eval = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 3'],
        teachingWeeks: 8,
        lessonsPerWeek: 5,
      });

      // Grade 8 Term 3 requires 36 canonical lessons
      expect(term3Eval.canonicalLessonCount).toBe(36);
      expect(term3Eval.totalAvailablePeriods).toBe(40);
      expect(term3Eval.status).toBe('EXCESS_CAPACITY');
      expect(term3Eval.canGenerate).toBe(true);
      expect(term3Eval.unusedCapacity).toBe(4);
    });
  });

  describe('3. Support for Independent Custom Schedules and Optional School Profiles', () => {
    it('supports school profile configuration while retaining custom teaching schedule override', () => {
      const school = SchoolConfigService.getSchoolProfile('lwps');
      expect(school).toBeDefined();

      const profileEval = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 7',
        subject: 'Integrated Science',
        terms: ['Term 1'],
        teachingWeeks: school!.teachingConfig.teachingWeeksPerTerm,
        lessonsPerWeek: school!.teachingConfig.lessonsPerWeek,
      });

      expect(profileEval).toBeDefined();
      expect(profileEval.totalAvailablePeriods).toBe(
        school!.teachingConfig.teachingWeeksPerTerm * school!.teachingConfig.lessonsPerWeek
      );
    });
  });

  describe('4. Safe Term Change and Selection Reset Behavior', () => {
    it('resets topic selection when term changes while preserving canonical node integrity', () => {
      let formState = {
        grade: 'Grade 8',
        subject: 'Integrated Science',
        term: 'Term 1' as const,
        terms: ['Term 1' as const],
        multiSelectTopics: { 'Mixtures and Elements': [] },
      };

      // Simulate term change to Term 2
      const handleTermChange = (newTerm: 'Term 2') => {
        const hasTopics = Object.keys(formState.multiSelectTopics).length > 0;
        formState = {
          ...formState,
          term: newTerm,
          terms: [newTerm],
          multiSelectTopics: {},
        };
        return { hasTopics, newCurriculum: getCurriculumByTerm('Grade 8', 'Integrated Science', [newTerm]) };
      };

      const result = handleTermChange('Term 2');
      expect(result.hasTopics).toBe(true);
      expect(formState.multiSelectTopics).toEqual({});
      expect(result.newCurriculum).toBeDefined();

      const masterNodes = CanonicalCurriculumService.getMasterCurriculumSowNodes(
        formState.grade,
        formState.subject,
        formState.terms
      );
      expect(masterNodes.length).toBe(54); // Term 2 canonical node count
    });
  });
});
