import {
  GRADE_7_MATHEMATICS_SOURCE,
  GRADE_7_MATHEMATICS_SUBSTRAND_ALLOCATIONS,
} from './data/curriculum/grade-7-mathematics-authoritative.ts';

describe('KICD Grade 7 Mathematics source dataset', () => {
  it('contains all 18 KICD-listed sub-strands and matches the full-grade total of 150 lessons', () => {
    expect(GRADE_7_MATHEMATICS_SUBSTRAND_ALLOCATIONS).toHaveLength(18);
    expect(
      GRADE_7_MATHEMATICS_SUBSTRAND_ALLOCATIONS.reduce((sum, item) => sum + item.suggestedLessons, 0)
    ).toBe(GRADE_7_MATHEMATICS_SOURCE.expectedFullGradeLessonTotal);
    expect(new Set(GRADE_7_MATHEMATICS_SUBSTRAND_ALLOCATIONS.map(item => item.code)).size).toBe(18);
    expect(new Set(GRADE_7_MATHEMATICS_SUBSTRAND_ALLOCATIONS.map(item => item.subStrand)).size).toBe(18);
  });

  it('does not imply a term allocation when the cited KICD summary only verifies full-grade lesson counts', () => {
    expect(GRADE_7_MATHEMATICS_SOURCE.authorityStatus).toBe('AUTHORITATIVE_FULL_GRADE_ALLOCATION_VERIFIED');
    expect(GRADE_7_MATHEMATICS_SOURCE.termAllocationStatus).toBe('UNVERIFIED');
    expect(GRADE_7_MATHEMATICS_SOURCE.sourceUrl).toContain('kicd.ac.ke');
  });
});
