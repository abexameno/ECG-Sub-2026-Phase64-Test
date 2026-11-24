/**
 * Structural coverage validation for a planned Scheme of Work.
 *
 * This validator checks schedule completeness only. It does not establish
 * curriculum correctness or decide which sub-strand belongs to a term.
 */
export type SowCoverageEntry = {
  week: string | number;
  lesson: string | number;
};

export type SowCoverageIssue =
  | { code: 'INVALID_EXPECTED_WEEKS'; message: string }
  | { code: 'INVALID_LESSONS_PER_WEEK'; message: string }
  | { code: 'INVALID_WEEK_OR_LESSON'; week: string; lesson: string; message: string }
  | { code: 'DUPLICATE_SLOT'; week: number; lesson: number; message: string }
  | { code: 'MISSING_WEEK'; week: number; message: string }
  | { code: 'MISSING_LESSON'; week: number; lesson: number; message: string }
  | { code: 'UNEXPECTED_WEEK'; week: number; message: string }
  | { code: 'UNEXPECTED_LESSON'; week: number; lesson: number; message: string };

export function validateSowWeekLessonCoverage(
  entries: SowCoverageEntry[],
  expectedWeeks: number[],
  lessonsPerWeek: number,
): SowCoverageIssue[] {
  const issues: SowCoverageIssue[] = [];
  if (!expectedWeeks.length || expectedWeeks.some(w => !Number.isInteger(w) || w < 1)) {
    issues.push({ code: 'INVALID_EXPECTED_WEEKS', message: 'Expected weeks must be a non-empty list of positive integers.' });
    return issues;
  }
  if (!Number.isInteger(lessonsPerWeek) || lessonsPerWeek < 1) {
    issues.push({ code: 'INVALID_LESSONS_PER_WEEK', message: 'Lessons per week must be a positive integer.' });
    return issues;
  }

  const expected = new Set(expectedWeeks);
  const slots = new Map<string, number>();
  const seenWeeks = new Set<number>();

  for (const entry of entries) {
    const weekText = String(entry.week ?? '').trim();
    const lessonText = String(entry.lesson ?? '').trim();
    const week = Number(weekText);
    const lesson = Number(lessonText);
    if (!weekText || !lessonText || !Number.isInteger(week) || !Number.isInteger(lesson) || week < 1 || lesson < 1) {
      issues.push({
        code: 'INVALID_WEEK_OR_LESSON',
        week: weekText,
        lesson: lessonText,
        message: `Invalid week/lesson slot: week="${weekText}", lesson="${lessonText}".`,
      });
      continue;
    }
    if (!expected.has(week)) {
      issues.push({ code: 'UNEXPECTED_WEEK', week, message: `Week ${week} is outside the expected schedule.` });
      continue;
    }
    if (lesson > lessonsPerWeek) {
      issues.push({ code: 'UNEXPECTED_LESSON', week, lesson, message: `Week ${week} lesson ${lesson} exceeds ${lessonsPerWeek} lessons per week.` });
      continue;
    }
    const key = `${week}-${lesson}`;
    const count = slots.get(key) || 0;
    if (count > 0) {
      issues.push({ code: 'DUPLICATE_SLOT', week, lesson, message: `Week ${week} lesson ${lesson} appears more than once.` });
    }
    slots.set(key, count + 1);
    seenWeeks.add(week);
  }

  for (const week of expectedWeeks) {
    if (!seenWeeks.has(week)) {
      issues.push({ code: 'MISSING_WEEK', week, message: `Week ${week} has no lesson entries.` });
    }
    for (let lesson = 1; lesson <= lessonsPerWeek; lesson += 1) {
      if (!slots.has(`${week}-${lesson}`)) {
        issues.push({ code: 'MISSING_LESSON', week, lesson, message: `Week ${week} lesson ${lesson} is missing.` });
      }
    }
  }
  return issues;
}
