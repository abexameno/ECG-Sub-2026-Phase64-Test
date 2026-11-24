import { AIGovernanceService } from './services/aiGovernanceService.ts';
import { QuotaService } from './services/quotaService.ts';
import { AuditService } from './services/auditService.ts';
import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { ArtifactService } from './services/artifactService.ts';

describe('Production Governance, AI Reliability & Security (Phase 7)', () => {
  beforeEach(() => {
    QuotaService.resetStore();
    AuditService.clearLogs();
    ContentArtifactRepository.clearStore();
  });

  test('should enforce approved AI model governance', () => {
    const model = AIGovernanceService.getApprovedModel('primary_generator');
    expect(model.modelId).toBe('gemini-3.8-flash');

    expect(AIGovernanceService.validateGenerationRequest('gemini-3.8-flash')).toBe(true);

    expect(() => {
      AIGovernanceService.validateGenerationRequest('unauthorized-malicious-model');
    }).toThrow();
  });

  test('should enforce server-authoritative quotas', () => {
    const quota = QuotaService.getQuotaStatus('lwps');
    expect(quota.allowed).toBe(true);
    expect(quota.remaining).toBe(500);

    const consumed = QuotaService.consumeQuota('lwps', 10);
    expect(consumed).toBe(true);

    const updated = QuotaService.getQuotaStatus('lwps');
    expect(updated.consumed).toBe(10);
    expect(updated.remaining).toBe(490);
  });

  test('should record operational audit logs', () => {
    AuditService.log('GENERATION_STARTED', 'lwps', { promptVersion: '2026.1' });
    AuditService.log('ARTIFACT_CREATED', 'lwps', { artifactId: 'art_123' });

    const logs = AuditService.getLogs('lwps');
    expect(logs.length).toBe(2);
    expect(logs[0].eventType).toBe('GENERATION_STARTED');
    expect(logs[1].eventType).toBe('ARTIFACT_CREATED');
  });

  test('should maintain strict school isolation across repository and security boundaries', () => {
    const art = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [],
      { title: 'LWPS Secret Lesson' }
    );
    ContentArtifactRepository.save(art);

    // Register school-b
    try {
      ContentArtifactRepository.copyForSchool(art.id, 'lwps', 'school-b');
    } catch {
      // expected error or handled
    }

    // Direct cross-school getById must throw security violation
    expect(() => {
      ContentArtifactRepository.getById(art.id, 'school-b');
    }).toThrow();
  });
});
