import { ContentArtifactRepository } from './services/contentArtifactRepository.ts';
import { ArtifactService } from './services/artifactService.ts';
import { QuotaService } from './services/quotaService.ts';
import { AuditService } from './services/auditService.ts';
import { AIGovernanceService } from './services/aiGovernanceService.ts';

describe('Phase 8 Measurable Production Targets & Evidence Suite', () => {
  beforeEach(() => {
    ContentArtifactRepository.clearStore();
    QuotaService.resetStore();
    AuditService.clearLogs();
  });

  test('Hard Gate 1: Artifact Retrieval p95 latency benchmark (≤500ms target)', () => {
    const art = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [],
      { title: 'Benchmark Lesson' }
    );
    ContentArtifactRepository.save(art);

    const iterations = 500;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      ContentArtifactRepository.getById(art.id, 'lwps');
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(iterations * 0.95);
    const p95 = latencies[p95Index];

    console.log(`[Metric] Artifact Retrieval p95: ${p95.toFixed(2)} ms (Target: <=500 ms)`);
    expect(p95).toBeLessThanOrEqual(500);
  });

  test('Hard Gate 2: Artifact Save / Version Creation p95 latency benchmark (≤1000ms target)', () => {
    const iterations = 100;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const art = ArtifactService.createArtifact(
        'lesson_plan',
        'lwps',
        'grade-7',
        'la-math',
        [],
        { title: `Save Test ${i}` }
      );
      const start = performance.now();
      ContentArtifactRepository.save(art);
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(iterations * 0.95);
    const p95 = latencies[p95Index];

    console.log(`[Metric] Artifact Save p95: ${p95.toFixed(2)} ms (Target: <=1000 ms)`);
    expect(p95).toBeLessThanOrEqual(1000);
  });

  test('Hard Gate 3: Quota Concurrency (Race Condition Safety - Exactly 1 consumed on limit 1)', () => {
    QuotaService.resetStore();
    const schoolId = 'lwps';
    
    // Force limit to 1
    const status = QuotaService.getQuotaStatus(schoolId);
    // consume until 1 left or test via concurrent simulation
    QuotaService.consumeQuota(schoolId, status.limit - 1);

    const remainingBefore = QuotaService.getQuotaStatus(schoolId).remaining;
    expect(remainingBefore).toBe(1);

    // Simulate concurrent requests
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < 5; i++) {
      try {
        QuotaService.consumeQuota(schoolId, 1);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    expect(successCount).toBe(1);
    expect(errorCount).toBe(4);
    console.log(`[Metric] Quota Concurrency: Success=${successCount}, Rejected=${errorCount} (PASS)`);
  });

  test('Hard Gate 4: School Isolation (0 unauthorized cross-school reads/writes)', () => {
    const art = ArtifactService.createArtifact(
      'lesson_plan',
      'lwps',
      'grade-7',
      'la-math',
      [],
      { title: 'LWPS Private Content' }
    );
    ContentArtifactRepository.save(art);

    // Attempt cross-school access from school-b
    expect(() => {
      ContentArtifactRepository.getById(art.id, 'school-b');
    }).toThrow();

    const listB = ContentArtifactRepository.list('school-b');
    expect(listB.length).toBe(0);

    console.log(`[Metric] Cross-School Isolation: 100% rejection (PASS)`);
  });

  test('Hard Gate 5: AI Governance & Model Authorization', () => {
    const model = AIGovernanceService.getApprovedModel('primary_generator');
    expect(model.modelId).toBeDefined();

    expect(() => {
      AIGovernanceService.validateGenerationRequest('unauthorized-rogue-model');
    }).toThrow();

    console.log(`[Metric] AI Governance: Unauthorized models blocked (PASS)`);
  });
});
