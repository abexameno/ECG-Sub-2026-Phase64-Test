import { validateSowWeekLessonCoverage } from './services/sowCoverageValidation.ts';

const makeEntries = (weeks: number[], lessonsPerWeek: number) =>
  weeks.flatMap(week =>
    Array.from({ length: lessonsPerWeek }, (_, index) => ({
      week: String(week),
      lesson: String(index + 1),
    }))
  );

describe('Scheme of Work week/lesson completeness validation', () => {
  it('accepts a complete multi-week schedule', () => {
    expect(validateSowWeekLessonCoverage(makeEntries([1, 2, 3], 5), [1, 2, 3], 5)).toEqual([]);
  });

  it('reports a missing middle week and every missing lesson in that week', () => {
    const entries = makeEntries([1, 3], 5);
    const issues = validateSowWeekLessonCoverage(entries, [1, 2, 3], 5);
    expect(issues).toContainEqual({ code: 'MISSING_WEEK', week: 2, message: 'Week 2 has no lesson entries.' });
    expect(issues.filter(issue => issue.code === 'MISSING_LESSON' && issue.week === 2)).toHaveLength(5);
  });

  it('reports a missing lesson without marking the whole week missing', () => {
    const entries = makeEntries([1, 2], 5).filter(entry => !(entry.week === '2' && entry.lesson === '4'));
    const issues = validateSowWeekLessonCoverage(entries, [1, 2], 5);
    expect(issues).toContainEqual({ code: 'MISSING_LESSON', week: 2, lesson: 4, message: 'Week 2 lesson 4 is missing.' });
    expect(issues.some(issue => issue.code === 'MISSING_WEEK' && issue.week === 2)).toBe(false);
  });

  it('detects duplicate slots, out-of-range weeks, and lessons', () => {
    const issues = validateSowWeekLessonCoverage([
      ...makeEntries([1], 2),
      { week: '1', lesson: '2' },
      { week: '9', lesson: '1' },
      { week: '1', lesson: '3' },
    ], [1], 2);
    expect(issues.some(issue => issue.code === 'DUPLICATE_SLOT')).toBe(true);
    expect(issues.some(issue => issue.code === 'UNEXPECTED_WEEK')).toBe(true);
    expect(issues.some(issue => issue.code === 'UNEXPECTED_LESSON')).toBe(true);
  });

  it('rejects invalid expectations rather than silently passing', () => {
    expect(validateSowWeekLessonCoverage([], [], 5)[0].code).toBe('INVALID_EXPECTED_WEEKS');
    expect(validateSowWeekLessonCoverage([], [1], 0)[0].code).toBe('INVALID_LESSONS_PER_WEEK');
  });
});
