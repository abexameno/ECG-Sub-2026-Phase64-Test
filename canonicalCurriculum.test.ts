import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';

describe('CanonicalCurriculumService (Phase 2 CBE Content Architecture)', () => {
  test('should return canonical KICD curriculum details', () => {
    const curriculum = CanonicalCurriculumService.getCurriculum();
    expect(curriculum.id).toBe('kicd-cbc-2026');
    expect(curriculum.country).toBe('Kenya');
    expect(curriculum.status).toBe('active');
  });

  test('should return data-driven grades hierarchically', () => {
    const grades = CanonicalCurriculumService.getGrades();
    expect(grades.length).toBeGreaterThanOrEqual(10);
    const grade7 = CanonicalCurriculumService.getGradeById('grade-7');
    expect(grade7?.name).toBe('Grade 7');
    expect(grade7?.levelType).toBe('Junior School');
  });

  test('should validate referential integrity deterministically', () => {
    // Valid references
    const validResult = CanonicalCurriculumService.validateCurriculumReference({
      gradeId: 'grade-7',
      learningAreaId: 'la-math',
      strandId: 'strand-math-numbers',
      subStrandId: 'substrand-whole-numbers',
      outcomeId: 'outcome-wn-1',
    });
    expect(validResult.valid).toBe(true);
    expect(validResult.errors.length).toBe(0);

    // Invalid reference (strand does not belong to learning area)
    const invalidResult = CanonicalCurriculumService.validateCurriculumReference({
      learningAreaId: 'la-eng',
      strandId: 'strand-math-numbers', // math strand in English la
    });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
});
