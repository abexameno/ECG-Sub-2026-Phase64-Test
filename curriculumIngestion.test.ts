import { CurriculumIngestionService, CurriculumIngestionRequest } from './services/curriculumIngestionService.ts';

describe('Phase 9 Authoritative Curriculum Ingestion & Management', () => {
  beforeEach(() => {
    CurriculumIngestionService.clearStore();
  });

  const validRequest: CurriculumIngestionRequest = {
    curriculumId: 'test-cbc-2026',
    name: 'Test CBC 2026',
    version: '1.0',
    source: {
      name: 'KICD Official Framework',
      type: 'OFFICIAL_DOCUMENT',
      version: '1.0'
    },
    ingestionMode: 'CREATE',
    grades: [
      {
        gradeId: 'g7',
        name: 'Grade 7',
        learningAreas: [
          {
            learningAreaId: 'la-sci',
            name: 'Integrated Science',
            strands: [
              {
                strandId: 'str-matter',
                name: 'Matter',
                subStrands: [
                  {
                    subStrandId: 'ss-prop',
                    name: 'Properties of Matter',
                    learningOutcomes: [
                      { learningOutcomeId: 'lo-001', statement: 'Describe properties of matter.' },
                      { learningOutcomeId: 'lo-002', statement: 'Classify materials according to properties.' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  test('EC-03 & EC-04: Should successfully ingest valid curriculum into DRAFT status', () => {
    const result = CurriculumIngestionService.ingest(validRequest);
    expect(result.success).toBe(true);
    expect(result.status).toBe('CREATED');
    expect(result.statistics?.grades).toBe(1);
    expect(result.statistics?.learningOutcomes).toBe(2);

    const record = CurriculumIngestionService.getRecord('test-cbc-2026', '1.0');
    expect(record).toBeDefined();
    expect(record?.status).toBe('DRAFT');
  });

  test('EC-05 & EC-06: Should reject curriculum with missing or orphan structural elements', () => {
    const invalidRequest: CurriculumIngestionRequest = {
      ...validRequest,
      grades: [
        {
          gradeId: 'g7',
          name: 'Grade 7',
          learningAreas: [
            {
              learningAreaId: '', // Invalid empty ID
              name: 'Science',
              strands: [] // Orphan learning area
            }
          ]
        }
      ]
    };

    const result = CurriculumIngestionService.ingest(invalidRequest);
    expect(result.success).toBe(false);
    expect(result.status).toBe('REJECTED');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('EC-13: Should prevent duplicate ingestion of the exact same version', () => {
    const res1 = CurriculumIngestionService.ingest(validRequest);
    expect(res1.success).toBe(true);

    const res2 = CurriculumIngestionService.ingest(validRequest);
    expect(res2.success).toBe(false);
    expect(res2.status).toBe('DUPLICATE');
  });

  test('EC-08, EC-09, EC-10: Should support full lifecycle from Draft -> Approved -> Published -> Active', () => {
    CurriculumIngestionService.ingest(validRequest);

    expect(() => {
      // Cannot publish before approval
      CurriculumIngestionService.publish('test-cbc-2026', '1.0');
    }).toThrow();

    CurriculumIngestionService.approve('test-cbc-2026', '1.0');
    let rec = CurriculumIngestionService.getRecord('test-cbc-2026', '1.0');
    expect(rec?.status).toBe('APPROVED');

    CurriculumIngestionService.publish('test-cbc-2026', '1.0');
    rec = CurriculumIngestionService.getRecord('test-cbc-2026', '1.0');
    expect(rec?.status).toBe('PUBLISHED');

    CurriculumIngestionService.activate('test-cbc-2026', '1.0');
    const active = CurriculumIngestionService.getActiveCurriculum();
    expect(active?.curriculumId).toBe('test-cbc-2026');
    expect(active?.status).toBe('ACTIVE');
  });
});
