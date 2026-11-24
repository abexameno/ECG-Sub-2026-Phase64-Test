import { ArtifactService } from './services/artifactService.ts';

describe('ArtifactService & Content Artifact Architecture (Phase 5)', () => {
  test('should create valid content artifact with canonical provenance', () => {
    const artifact = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [{ gradeLevelId: 'grade-7', learningAreaId: 'la-math', learningOutcomeIds: ['lo-math-1'] }],
      { title: 'Introduction to Integers', objectives: ['Understand positive and negative integers'] },
      { weekNumber: 1, lessonNumber: 1, termId: 'Term 1' }
    );

    expect(artifact.id).toBeDefined();
    expect(artifact.schoolId).toBe('lwps');
    expect(artifact.artifactType).toBe('lesson_plan');
    expect(artifact.version).toBe(1);
    expect(artifact.status).toBe('draft');

    const validation = ArtifactService.validateArtifact(artifact);
    expect(validation.valid).toBe(true);
  });

  test('should version artifact on human edit', () => {
    const artifact = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [],
      { title: 'V1 Content' }
    );

    const updated = ArtifactService.updateArtifactContent(artifact, { title: 'V2 Content' }, 'human_edited');
    expect(updated.version).toBe(2);
    expect(updated.source).toBe('human_edited');
    expect(updated.content).toEqual({ title: 'V2 Content' });
  });

  test('should copy artifact safely for another school with new identity', () => {
    const artifactA = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [],
      { title: 'Shared Lesson' }
    );

    const artifactB = ArtifactService.copyArtifactForSchool(artifactA, 'school-b');
    expect(artifactB.id).not.toBe(artifactA.id);
    expect(artifactB.schoolId).toBe('school-b');
    expect(artifactB.version).toBe(1);
  });

  test('should reject invalid school or curriculum references', () => {
    expect(() => {
      ArtifactService.createArtifact(
        'lesson_plan',
        'non-existent-school',
        'grade-7',
        'la-math',
        [],
        {}
      );
    }).toThrow();
  });
});
