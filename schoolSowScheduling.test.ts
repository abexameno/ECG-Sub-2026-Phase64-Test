import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { SowSchedulingService } from './services/sowSchedulingService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';

describe('Phase 24 — School SOW Scheduling & Flexible Teaching Calendar Tests', () => {
  describe('I. Master Curriculum SOW vs School Scheduled SOW Architectural Separation', () => {
    it('1. Master SOW returns 100% canonical KICD lesson allocations independent of school schedule', () => {
      const g8T1Master = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 8', 'Integrated Science', ['Term 1']);
      expect(g8T1Master.length).toBe(60);

      const g8T2Master = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 8', 'Integrated Science', ['Term 2']);
      expect(g8T2Master.length).toBe(54);

      const g8T3Master = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 8', 'Integrated Science', ['Term 3']);
      expect(g8T3Master.length).toBe(36);

      const g8FullYearMaster = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 8', 'Integrated Science', ['Term 1', 'Term 2', 'Term 3']);
      expect(g8FullYearMaster.length).toBe(150);
    });

    it('2. Master SOW returns 100% canonical KICD lesson allocations for Grade 6 Agriculture & Nutrition', () => {
      const g6T1Master = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 6', 'Agriculture and Nutrition', ['Term 1']);
      expect(g6T1Master.length).toBe(32);

      const g6T2Master = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 6', 'Agriculture and Nutrition', ['Term 2']);
      expect(g6T2Master.length).toBe(36);

      const g6T3Master = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 6', 'Agriculture and Nutrition', ['Term 3']);
      expect(g6T3Master.length).toBe(52);

      const g6FullYearMaster = CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 6', 'Agriculture and Nutrition', ['Term 1', 'Term 2', 'Term 3']);
      expect(g6FullYearMaster.length).toBe(120);
    });
  });

  describe('II. Capacity Evaluation Matrix (Exact Match, Excess Capacity, Insufficient Capacity)', () => {
    it('3. Grade 8 Term 1 (60 canonical lessons) with 10 weeks × 6 lessons/wk = 60: EXACT MATCH (PASS)', () => {
      const result = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 1'],
        teachingWeeks: 10,
        lessonsPerWeek: 6,
      });

      expect(result.canonicalLessonCount).toBe(60);
      expect(result.totalAvailablePeriods).toBe(60);
      expect(result.status).toBe('EXACT_MATCH');
      expect(result.canGenerate).toBe(true);
      expect(result.unscheduledLessons).toBe(0);
      expect(result.unusedCapacity).toBe(0);
      expect(result.message).toContain('✓');
    });

    it('4. Grade 8 Term 1 (60 canonical lessons) with 12 weeks × 5 lessons/wk = 60: EXACT MATCH (PASS)', () => {
      const result = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 1'],
        teachingWeeks: 12,
        lessonsPerWeek: 5,
      });

      expect(result.canonicalLessonCount).toBe(60);
      expect(result.totalAvailablePeriods).toBe(60);
      expect(result.status).toBe('EXACT_MATCH');
      expect(result.canGenerate).toBe(true);
      expect(result.unscheduledLessons).toBe(0);
      expect(result.unusedCapacity).toBe(0);
    });

    it('5. Grade 8 Term 1 (60 canonical lessons) with 10 weeks × 4 lessons/wk = 40: INSUFFICIENT CAPACITY (BLOCK)', () => {
      const result = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 1'],
        teachingWeeks: 10,
        lessonsPerWeek: 4,
      });

      expect(result.canonicalLessonCount).toBe(60);
      expect(result.totalAvailablePeriods).toBe(40);
      expect(result.status).toBe('INSUFFICIENT_CAPACITY');
      expect(result.canGenerate).toBe(false);
      expect(result.unscheduledLessons).toBe(20);
      expect(result.unusedCapacity).toBe(0);
      expect(result.message).toContain('Insufficient teaching capacity');
      expect(result.message).toContain('20 curriculum lessons cannot currently be scheduled');
    });

    it('6. Grade 8 Term 1 (60 canonical lessons) with 12 weeks × 6 lessons/wk = 72: EXCESS CAPACITY (PASS, ZERO FAKE LESSONS)', () => {
      const result = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 1'],
        teachingWeeks: 12,
        lessonsPerWeek: 6,
      });

      expect(result.canonicalLessonCount).toBe(60);
      expect(result.totalAvailablePeriods).toBe(72);
      expect(result.status).toBe('EXCESS_CAPACITY');
      expect(result.canGenerate).toBe(true);
      expect(result.unscheduledLessons).toBe(0);
      expect(result.unusedCapacity).toBe(12);
      expect(result.message).toContain('12 additional teaching periods available');

      // Schedule and verify that exactly 60 canonical nodes exist (no fake 61..72 lessons created)
      const scheduled = SowSchedulingService.scheduleMasterNodes(
        CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 8', 'Integrated Science', ['Term 1']),
        { teachingWeeks: 12, lessonsPerWeek: 6 },
        ['Term 1']
      );
      // Canonical: 60, Revision: 12, Total: 72
      expect(scheduled.length).toBe(72);
      const canonicalLessons = scheduled.filter(n => n.strandId && !n.strandId.startsWith('revision'));
      expect(canonicalLessons.length).toBe(60);
    });

    it('7. Grade 8 Term 2 (54 canonical lessons) capacity evaluation tests', () => {
      // 9 wks x 6 = 54 (Exact Match)
      const exact = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 2'],
        teachingWeeks: 9,
        lessonsPerWeek: 6,
      });
      expect(exact.status).toBe('EXACT_MATCH');
      expect(exact.canGenerate).toBe(true);

      // 10 wks x 5 = 50 (Insufficient: 4 unscheduled)
      const under = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 2'],
        teachingWeeks: 10,
        lessonsPerWeek: 5,
      });
      expect(under.status).toBe('INSUFFICIENT_CAPACITY');
      expect(under.canGenerate).toBe(false);
      expect(under.unscheduledLessons).toBe(4);

      // 10 wks x 6 = 60 (Excess: 6 unused)
      const over = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 2'],
        teachingWeeks: 10,
        lessonsPerWeek: 6,
      });
      expect(over.status).toBe('EXCESS_CAPACITY');
      expect(over.canGenerate).toBe(true);
      expect(over.unusedCapacity).toBe(6);
    });

    it('8. Grade 8 Term 3 (36 canonical lessons) capacity evaluation tests', () => {
      // 9 wks x 4 = 36 (Exact Match)
      const exact = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 3'],
        teachingWeeks: 9,
        lessonsPerWeek: 4,
      });
      expect(exact.status).toBe('EXACT_MATCH');
      expect(exact.canGenerate).toBe(true);

      // 8 wks x 4 = 32 (Insufficient: 4 unscheduled)
      const under = SowSchedulingService.evaluateCapacity({
        grade: 'Grade 8',
        subject: 'Integrated Science',
        terms: ['Term 3'],
        teachingWeeks: 8,
        lessonsPerWeek: 4,
      });
      expect(under.status).toBe('INSUFFICIENT_CAPACITY');
      expect(under.canGenerate).toBe(false);
      expect(under.unscheduledLessons).toBe(4);
    });
  });

  describe('III. Flexible Calendar & Non-Standard Week Counts', () => {
    it('9. Supports non-standard teaching calendar durations (8, 9, 10, 11, 12, 13 weeks)', () => {
      const weeksList = [8, 9, 10, 11, 12, 13];
      weeksList.forEach(wks => {
        const evalResult = SowSchedulingService.evaluateCapacity({
          grade: 'Grade 8',
          subject: 'Integrated Science',
          terms: ['Term 1'],
          teachingWeeks: wks,
          lessonsPerWeek: 5,
        });

        const expectedCapacity = wks * 5;
        expect(evalResult.totalAvailablePeriods).toBe(expectedCapacity);
        if (expectedCapacity >= 60) {
          expect(evalResult.canGenerate).toBe(true);
        } else {
          expect(evalResult.canGenerate).toBe(false);
        }
      });
    });
  });

  describe('IV. Independent Teacher Workflow (Zero School Directory Dependency)', () => {
    it('10. Allows standalone SOW generation without School Directory profile', () => {
      const schoolSow = SowSchedulingService.generateSchoolSow(
        'Grade 8',
        'Integrated Science',
        ['Term 1'],
        { teachingWeeks: 10, lessonsPerWeek: 6 }
      );

      expect(schoolSow.evaluation.canGenerate).toBe(true);
      expect(schoolSow.masterNodes.length).toBe(60);
      expect(schoolSow.scheduledNodes.length).toBe(60);
      expect(schoolSow.scheduledNodes[0].week).toBe(1);
      expect(schoolSow.scheduledNodes[0].lesson).toBe(1);
      expect(schoolSow.scheduledNodes[59].week).toBe(10);
      expect(schoolSow.scheduledNodes[59].lesson).toBe(6);
    });
  });

  describe('V. Negative Curriculum Isolation & Term Integrity', () => {
    it('11. Grade 8 Term 2 School Scheduled SOW contains ZERO Force and Energy (Strand 3.0)', () => {
      const scheduledT2 = SowSchedulingService.scheduleMasterNodes(
        CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 8', 'Integrated Science', ['Term 2']),
        { teachingWeeks: 10, lessonsPerWeek: 6 },
        ['Term 2']
      );

      const canonicalNodes = scheduledT2.filter(n => n.strandId && !n.strandId.startsWith('revision'));
      expect(canonicalNodes.length).toBe(54);
      canonicalNodes.forEach(node => {
        expect(node.strandTitle.toLowerCase()).not.toContain('force');
        expect(node.strandTitle.toLowerCase()).not.toContain('energy');
        expect(node.subStrandTitle.toLowerCase()).not.toContain('force');
        expect(node.subStrandTitle.toLowerCase()).not.toContain('energy');
        expect(node.strandTitle).toContain('Living Things');
      });
    });

    it('12. Grade 8 Term 1 contains ZERO Living Things and ZERO Force & Energy', () => {
      const scheduledT1 = SowSchedulingService.scheduleMasterNodes(
        CanonicalCurriculumService.getMasterCurriculumSowNodes('Grade 8', 'Integrated Science', ['Term 1']),
        { teachingWeeks: 10, lessonsPerWeek: 6 },
        ['Term 1']
      );

      expect(scheduledT1.length).toBe(60);
      scheduledT1.forEach(node => {
        expect(node.strandTitle).toContain('Mixtures');
        expect(node.strandTitle.toLowerCase()).not.toContain('living things');
        expect(node.strandTitle.toLowerCase()).not.toContain('force');
      });
    });
  });
});
