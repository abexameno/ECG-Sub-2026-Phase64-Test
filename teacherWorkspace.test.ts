import { TeacherWorkspaceService } from './services/teacherWorkspaceService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 15 Simple Teacher Workspace & Resource Generation', () => {
  beforeEach(() => {
    TeacherWorkspaceService.clearStore();
    ContentArtifactRepository.clear();
    AuditService.clearLogs();
  });

  test('EC-01 to EC-04: Teacher establishes context with sensible defaults (no repeated asking)', () => {
    const context = TeacherWorkspaceService.getTeacherContext('teacher_jane', 'lwps');

    expect(context.schoolId).toBe('lwps');
    expect(context.gradeId).toBe('grade-8');
    expect(context.learningAreaId).toBe('la-sci');
    expect(context.termId).toBe('Term 1');
    expect(context.academicYear).toBe(2026);
  });

  test('EC-27: Teacher accesses Today\'s Lesson directly without searching repository', () => {
    const context = TeacherWorkspaceService.getTeacherContext('teacher_jane', 'lwps');
    const today = TeacherWorkspaceService.getTodayLesson(context, 'teacher_jane');

    expect(today.grade).toBe('Grade 8');
    expect(today.learningArea).toBe('Integrated Science');
    expect(today.term).toBe('Term 1');
    expect(today.week).toBe(1);
    expect(today.topicTitle).toBeDefined();
    expect(today.learningOutcome).toBeDefined();
  });

  test('EC-05 to EC-10: Single coordinated "Generate All" request produces SOW, Lesson Plan, Notes, and Assessment', async () => {
    const context = TeacherWorkspaceService.getTeacherContext('teacher_jane', 'lwps');
    const pkg = await TeacherWorkspaceService.generateTeachingPackage('teacher_jane', context, {
      schemeOfWork: true,
      lessonPlans: true,
      lessonNotes: true,
      assessments: true,
    });

    expect(pkg.status).toBe('READY');
    expect(pkg.resources.length).toBe(4);

    const sow = pkg.resources.find(r => r.type === 'SCHEME_OF_WORK');
    const lp = pkg.resources.find(r => r.type === 'LESSON_PLAN');
    const notes = pkg.resources.find(r => r.type === 'LESSON_NOTES');
    const ass = pkg.resources.find(r => r.type === 'ASSESSMENT');

    expect(sow).toBeDefined();
    expect(lp).toBeDefined();
    expect(notes).toBeDefined();
    expect(ass).toBeDefined();
    expect(sow?.status).toBe('READY');
    expect(lp?.status).toBe('READY');
    expect(notes?.status).toBe('READY');
    expect(ass?.status).toBe('READY');
  });

  test('EC-22: Existing valid resources are reused without unnecessary regeneration', async () => {
    const context = TeacherWorkspaceService.getTeacherContext('teacher_jane', 'lwps');
    
    // First generation
    const pkg1 = await TeacherWorkspaceService.generateTeachingPackage('teacher_jane', context, {
      schemeOfWork: true,
      lessonPlans: false,
      lessonNotes: false,
      assessments: false,
    });
    const sow1 = pkg1.resources[0];

    // Second generation (requests SOW again) -> Reuses existing artifact
    const pkg2 = await TeacherWorkspaceService.generateTeachingPackage('teacher_jane', context, {
      schemeOfWork: true,
      lessonPlans: false,
      lessonNotes: false,
      assessments: false,
    });
    const sow2 = pkg2.resources[0];

    expect(sow2.artifactId).toBe(sow1.artifactId);
    expect(sow2.artifactVersion).toBe(sow1.artifactVersion);
  });

  test('EC-23 & EC-24: Explicit regeneration creates a new version while preserving historical version', async () => {
    const context = TeacherWorkspaceService.getTeacherContext('teacher_jane', 'lwps');
    const pkg = await TeacherWorkspaceService.generateTeachingPackage('teacher_jane', context, {
      schemeOfWork: false,
      lessonPlans: true,
      lessonNotes: false,
      assessments: false,
    });
    const originalArtifactId = pkg.resources[0].artifactId!;

    const newVersion = TeacherWorkspaceService.regenerateResource('teacher_jane', originalArtifactId, 'lwps');

    expect(newVersion.version).toBe(2);

    // Verify historical version is still accessible in repository
    const historical = ContentArtifactRepository.getById(originalArtifactId, 'lwps', 1);
    expect(historical).toBeDefined();
    expect(historical?.version).toBe(1);
  });

  test('EC-35 & EC-36: Cross-school regeneration and access attempts are rejected (IDOR protection)', async () => {
    const contextA = TeacherWorkspaceService.getTeacherContext('teacher_a', 'lwps');
    const pkg = await TeacherWorkspaceService.generateTeachingPackage('teacher_a', contextA, {
      schemeOfWork: true,
      lessonPlans: false,
      lessonNotes: false,
      assessments: false,
    });
    const artifactId = pkg.resources[0].artifactId!;

    // Teacher from School B tries to regenerate School A's artifact
    expect(() => {
      TeacherWorkspaceService.regenerateResource('teacher_b', artifactId, 'school_b');
    }).toThrow('Unauthorized cross-school regeneration request');
  });
});
