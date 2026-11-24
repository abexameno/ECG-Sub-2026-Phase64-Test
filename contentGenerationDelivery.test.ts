import { GenerationContextService } from './services/generationContextService.ts';
import { ArtifactService } from './services/artifactService.ts';
import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { QuotaService } from './services/quotaService.ts';
import { AIGovernanceService } from './services/aiGovernanceService.ts';

describe('Phase 11 Content Generation, Delivery & Experience', () => {
  beforeEach(() => {
    ContentArtifactRepository.clearStore();
    QuotaService.resetStore();
  });

  test('EC-01 to EC-05: Should build generation context and create validated ContentArtifact', () => {
    const context = GenerationContextService.buildContext(
      'lwps',
      'grade-7',
      'la-sci',
      'Term 1',
      {
        includeActivities: true,
        includeTeacherNotes: true,
        includeAssessment: true,
        difficulty: 'medium',
      }
    );

    expect(context.schoolContext.schoolId).toBe('lwps');
    expect(context.curriculumContext.gradeLevelId).toBe('grade-7');

    const artifact = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-sci',
      [{ curriculumId: 'kicd-cbc-2026', version: '2026.1', gradeId: 'grade-7', learningAreaId: 'la-sci', strandId: 'strand-sci-living', subStrandId: 'substrand-sci-plants', learningOutcomeId: 'slo_sci_01' }],
      { title: 'States of Matter Lesson', body: 'Generated lesson content.' },
      {
        source: 'ai_generated',
        generationMetadata: {
          model: 'gemini-2.5-pro',
          promptVersion: '2026.1',
          generatedAt: new Date().toISOString(),
        }
      }
    );

    expect(artifact).toBeDefined();
    expect(artifact.status).toBe('generated');
    expect(artifact.version).toBe(1);

    const saved = ContentArtifactRepository.save(artifact);
    expect(saved.id).toBe(artifact.id);

    const retrieved = ContentArtifactRepository.getById(artifact.id, 'lwps');
    expect(retrieved).toBeDefined();
    expect(retrieved?.content.title).toBe('States of Matter Lesson');
  });

  test('EC-06 & EC-07: Should enforce school isolation and security on repository access', () => {
    const artifact = ArtifactService.createArtifact(
      'lesson_notes',
      'lwps',
      'grade-7',
      'la-sci',
      [{ curriculumId: 'kicd-cbc-2026', version: '2026.1', gradeId: 'grade-7', learningAreaId: 'la-sci', strandId: 'strand-sci-living', subStrandId: 'substrand-sci-plants', learningOutcomeId: 'slo_sci_01' }],
      { notes: 'LWPS private notes' }
    );
    ContentArtifactRepository.save(artifact);

    expect(() => {
      ContentArtifactRepository.getById(artifact.id, 'school_b');
    }).toThrow();
  });

  test('EC-08 & EC-09: Should enforce AI governance model approval and quota checks', () => {
    const modelConfig = AIGovernanceService.getApprovedModel('primary_generator');
    expect(modelConfig.modelId).toBe('gemini-3.8-flash');

    const quota = QuotaService.getQuotaStatus('lwps');
    expect(quota.allowed).toBe(true);

    QuotaService.consumeQuota('lwps', 1);
    const updatedQuota = QuotaService.getQuotaStatus('lwps');
    expect(updatedQuota.consumed).toBe(1);
  });
});
