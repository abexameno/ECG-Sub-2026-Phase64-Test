import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { ArtifactService } from './services/artifactService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';

describe('ContentArtifactRepository & Operational Management (Phase 6)', () => {
  beforeEach(() => {
    ContentArtifactRepository.clearStore();
    // Register School B if not registered
    try {
      SchoolConfigService.getSchoolProfile('school-b');
    } catch {
      SchoolConfigService.registerProfile({
        id: 'school-b',
        name: 'School B Academy',
        teachingConfig: { lessonsPerWeek: 4, teachingWeeksPerTerm: 12, lessonDurationMinutes: 40 },
        contentPreferences: { defaultPublisher: 'KLB' }
      });
    }
  });

  test('should save and retrieve artifact with version awareness and school isolation', () => {
    const art = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [],
      { title: 'Lesson V1' }
    );

    ContentArtifactRepository.save(art);

    const retrieved = ContentArtifactRepository.getById(art.id, 'lwps');
    expect(retrieved).toBeDefined();
    expect(retrieved?.version).toBe(1);
    expect(retrieved?.content).toEqual({ title: 'Lesson V1' });

    // Unauthorized access across schools must throw security error
    expect(() => {
      ContentArtifactRepository.getById(art.id, 'school-b');
    }).toThrow();
  });

  test('should handle human edits and preserve version history', () => {
    const art = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [],
      { title: 'V1' }
    );
    ContentArtifactRepository.save(art);

    const updated = ArtifactService.updateArtifactContent(art, { title: 'V2' }, 'human_edited');
    ContentArtifactRepository.save(updated);

    const latest = ContentArtifactRepository.getById(art.id, 'lwps');
    expect(latest?.version).toBe(2);
    expect(latest?.content).toEqual({ title: 'V2' });

    const v1 = ContentArtifactRepository.getById(art.id, 'lwps', 1);
    expect(v1?.version).toBe(1);
    expect(v1?.content).toEqual({ title: 'V1' });
  });

  test('should copy artifact safely between schools with independent identity', () => {
    const artA = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [],
      { title: 'LWPS Lesson' }
    );
    ContentArtifactRepository.save(artA);

    const copyB = ContentArtifactRepository.copyForSchool(artA.id, 'lwps', 'school-b');
    expect(copyB.id).not.toBe(artA.id);
    expect(copyB.schoolId).toBe('school-b');
    expect(copyB.version).toBe(1);

    const retrievedB = ContentArtifactRepository.getById(copyB.id, 'school-b');
    expect(retrievedB).toBeDefined();
    expect(retrievedB?.schoolId).toBe('school-b');
  });

  test('should archive and restore artifacts correctly', () => {
    const art = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [],
      { title: 'Active Lesson' }
    );
    ContentArtifactRepository.save(art);

    const archived = ContentArtifactRepository.archive(art.id, 'lwps');
    expect(archived.status).toBe('archived');

    const activeList = ContentArtifactRepository.list('lwps', { status: 'validated' });
    expect(activeList.length).toBe(0);

    const restored = ContentArtifactRepository.restore(art.id, 'lwps');
    expect(restored.status).toBe('validated');
  });
});
