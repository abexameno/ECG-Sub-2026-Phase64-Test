import { CurriculumIngestionService, CurriculumIngestionRequest } from './services/curriculumIngestionService.ts';
import { TeachingCoverageService } from './services/teachingCoverageService.ts';
import { TeachingPlan } from './types/teachingPlan.ts';

describe('Phase 10 Curriculum Coverage, Progression & Teaching Alignment', () => {
  beforeEach(() => {
    CurriculumIngestionService.clearStore();
  });

  const sampleCurriculum: CurriculumIngestionRequest = {
    curriculumId: 'test-cbc-2026',
    name: 'Test CBC 2026',
    version: '1.0',
    source: { name: 'KICD', type: 'OFFICIAL_DOCUMENT' },
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
                    name: 'Properties',
                    learningOutcomes: [
                      { learningOutcomeId: 'lo-001', statement: 'LO 1 statement' },
                      { learningOutcomeId: 'lo-002', statement: 'LO 2 statement' }
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

  test('EC-01 & EC-03: Should calculate 100% coverage for fully allocated valid teaching plan', () => {
    CurriculumIngestionService.ingest(sampleCurriculum);
    CurriculumIngestionService.approve('test-cbc-2026', '1.0');
    CurriculumIngestionService.publish('test-cbc-2026', '1.0');
    const rec = CurriculumIngestionService.getRecord('test-cbc-2026', '1.0')!;

    const plan: TeachingPlan = {
      id: 'plan_1',
      schoolId: 'lwps',
      curriculumId: 'test-cbc-2026',
      curriculumVersion: '1.0',
      gradeLevelId: 'g7',
      learningAreaId: 'la-sci',
      term: 'Term 1',
      totalTeachingWeeks: 10,
      lessonsPerWeek: 5,
      totalLessonCapacity: 50,
      requiredLessonsCount: 10,
      capacityStatus: 'sufficient',
      weeks: [
        {
          weekNumber: 1,
          lessonSlots: [
            { lessonNumber: 1, weekNumber: 1, learningOutcomeIds: ['lo-001'], status: 'planned' },
            { lessonNumber: 2, weekNumber: 1, learningOutcomeIds: ['lo-002'], status: 'planned' }
          ]
        }
      ]
    };

    const res = TeachingCoverageService.calculateCoverage(plan, rec);
    expect(res.valid).toBe(true);
    expect(res.statistics.totalOutcomes).toBe(2);
    expect(res.statistics.allocatedOutcomes).toBe(2);
    expect(res.statistics.coveragePercentage).toBe(100);
  });

  test('EC-04 & EC-05: Should detect unallocated outcomes and duplicate allocations', () => {
    CurriculumIngestionService.ingest(sampleCurriculum);
    const rec = CurriculumIngestionService.getRecord('test-cbc-2026', '1.0')!;

    const planWithDuplicateAndMissing: TeachingPlan = {
      id: 'plan_2',
      schoolId: 'lwps',
      curriculumId: 'test-cbc-2026',
      curriculumVersion: '1.0',
      gradeLevelId: 'g7',
      learningAreaId: 'la-sci',
      term: 'Term 1',
      totalTeachingWeeks: 10,
      lessonsPerWeek: 5,
      totalLessonCapacity: 50,
      requiredLessonsCount: 10,
      capacityStatus: 'sufficient',
      weeks: [
        {
          weekNumber: 1,
          lessonSlots: [
            { lessonNumber: 1, weekNumber: 1, learningOutcomeIds: ['lo-001'], status: 'planned' },
            { lessonNumber: 2, weekNumber: 1, learningOutcomeIds: ['lo-001'], status: 'planned' } // duplicate lo-001, lo-002 unallocated
          ]
        }
      ]
    };

    const res = TeachingCoverageService.calculateCoverage(planWithDuplicateAndMissing, rec);
    expect(res.statistics.allocatedOutcomes).toBe(1);
    expect(res.statistics.unallocatedOutcomes).toBe(1);
    expect(res.statistics.duplicatedOutcomes).toBe(1);
  });

  test('EC-06 & EC-07: Should reject invalid outcome references and wrong grades', () => {
    CurriculumIngestionService.ingest(sampleCurriculum);
    const rec = CurriculumIngestionService.getRecord('test-cbc-2026', '1.0')!;

    const invalidPlan: TeachingPlan = {
      id: 'plan_3',
      schoolId: 'lwps',
      curriculumId: 'test-cbc-2026',
      curriculumVersion: '1.0',
      gradeLevelId: 'g7',
      learningAreaId: 'la-sci',
      term: 'Term 1',
      totalTeachingWeeks: 10,
      lessonsPerWeek: 5,
      totalLessonCapacity: 50,
      requiredLessonsCount: 10,
      capacityStatus: 'sufficient',
      weeks: [
        {
          weekNumber: 1,
          lessonSlots: [
            { lessonNumber: 1, weekNumber: 1, learningOutcomeIds: ['lo-fake-999'], status: 'planned' }
          ]
        }
      ]
    };

    const res = TeachingCoverageService.calculateCoverage(invalidPlan, rec);
    expect(res.valid).toBe(false);
    expect(res.statistics.invalidOutcomes).toBe(1);
  });
});
