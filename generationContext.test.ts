import { GenerationContextService } from './services/generationContextService.ts';

describe('GenerationContextService & Pedagogical Generation Architecture (Phase 4)', () => {
  test('should build authoritative generation context deterministically', () => {
    const context = GenerationContextService.buildContext(
      'lwps',
      'grade-7',
      'la-math',
      'Term 1',
      { artifactType: 'scheme_of_work', lessonDurationMinutes: 40 },
      'strand-math-numbers',
      'substrand-whole-numbers',
      1,
      1
    );

    expect(context.schoolContext.schoolId).toBe('lwps');
    expect(context.schoolContext.lessonsPerWeek).toBe(5);
    expect(context.curriculumContext.gradeName).toBe('Grade 7');
    expect(context.curriculumContext.learningAreaName).toBe('Mathematics');
    expect(context.teachingContext.term).toBe('Term 1');
    expect(context.provenance.model).toBeDefined();
  });

  test('should validate generated artifact against authoritative context', () => {
    const context = GenerationContextService.buildContext(
      'lwps',
      'grade-7',
      'la-math',
      'Term 1',
      { artifactType: 'lesson_plan', lessonDurationMinutes: 40 }
    );

    const validResult = GenerationContextService.validateGeneratedArtifact(context, {
      schoolId: 'lwps',
      grade: 'Grade 7',
      subject: 'Mathematics'
    });
    expect(validResult.valid).toBe(true);

    const invalidResult = GenerationContextService.validateGeneratedArtifact(context, {
      schoolId: 'wrong-school'
    });
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
});
