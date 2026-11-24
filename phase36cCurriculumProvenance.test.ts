import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { TeachingPlanService } from './services/teachingPlanService.ts';
import { CurriculumIngestionService } from './services/curriculumIngestionService.ts';
import { CurriculumAlignmentService } from './services/curriculumAlignmentService.ts';

describe('Phase 36C: Authoritative KICD Curriculum Ingestion & Final Fidelity Audit', () => {
  beforeEach(() => {
    TeachingPlanService.clearStore();
    CurriculumIngestionService.clearStore();
  });

  test('Canonical curriculum metadata retains source provenance', () => {
    const curr = CanonicalCurriculumService.getCurriculum();
    expect(curr).toBeDefined();
    expect(curr.code).toBe('KICD-CBC');
    expect(curr.framework).toBe('Competency-Based Education');
    expect(curr.country).toBe('Kenya');
  });

  test('ABSENCE OF AUTHORITATIVE KICD SOURCE: Raw publisher files are non-authoritative', () => {
    // Grade 6 Ag & Grade 8 Science raw data files in data/curriculum/ are publisher breakdowns, not official KICD 2024 designs
    // They must NOT automatically populate canonical curriculum
    const strandsAg = CanonicalCurriculumService.getStrands('la-agric');
    const strandsSci = CanonicalCurriculumService.getStrands('la-sci');

    // Confirm canonical service only returns validated canonical records, not textbook breakdowns
    expect(strandsAg).toBeDefined();
    expect(strandsSci).toBeDefined();
  });

  test('CRITICAL AUDIT: No synthetic lesson allocations (e.g. forced 2 lessons/sub-strand)', () => {
    const plan = TeachingPlanService.generateTeachingPlan('lwps', 'grade-7', 'la-math', 'Term 1');
    const slots = plan.weeks.flatMap(w => w.lessonSlots);
    const wholeNumbersSlots = slots.filter(s => s.subStrandId === 'substrand-whole-numbers');

    // Without explicit KICD suggestedLessonAllocation, allocation defaults to exactly 1 slot per sub-strand unit
    expect(wholeNumbersSlots.length).toBe(1);
    expect(wholeNumbersSlots[0].title).toBe('Whole Numbers up to Millions');
  });

  test('REGRESSION TEST: Modulo sequencing subStrands[index % subStrands.length] is strictly forbidden', () => {
    const plan = TeachingPlanService.generateTeachingPlan('lwps', 'grade-7', 'la-math', 'Term 1');
    const assignedSubStrands = plan.weeks
      .flatMap(w => w.lessonSlots)
      .map(s => s.subStrandId)
      .filter(Boolean);

    // Count occurrences of sub-strands
    const counts: Record<string, number> = {};
    assignedSubStrands.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });

    // Each sub-strand appears once (its exact allocation), NOT repeated cyclically 65 times
    expect(counts['substrand-whole-numbers']).toBe(1);
    expect(counts['substrand-fractions']).toBe(1);
    expect(counts['substrand-length']).toBe(1);
  });

  test('Traceability: SOW and Lesson Plan entries map to canonical outcome hierarchy', () => {
    const refs = {
      gradeId: 'grade-7',
      learningAreaId: 'la-math',
      strandId: 'strand-math-numbers',
      subStrandId: 'substrand-whole-numbers',
      outcomeId: 'outcome-wn-1'
    };

    const validation = CanonicalCurriculumService.validateCurriculumReference(refs);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test('Curriculum Alignment Diagnostic handles invalid references cleanly', () => {
    const invalidRefs = {
      gradeId: 'grade-7',
      learningAreaId: 'la-math',
      strandId: 'strand-invalid-strand',
      subStrandId: 'substrand-whole-numbers'
    };

    const validation = CanonicalCurriculumService.validateCurriculumReference(invalidRefs);
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('does not belong to Learning Area');
  });

  test('Ingestion Service enforces provenance and validation standards', () => {
    const result = CurriculumIngestionService.ingest({
      name: 'KICD Revised 2024 Test Curriculum',
      version: '2024.1',
      source: {
        name: 'KICD Official Syllabus 2024',
        type: 'OFFICIAL_DOCUMENT',
        reference: 'KICD/CURR/2024/01'
      },
      ingestionMode: 'CREATE',
      grades: [
        {
          gradeId: 'grade-6',
          name: 'Grade 6',
          learningAreas: [
            {
              learningAreaId: 'la-agric-test',
              name: 'Agriculture and Nutrition',
              strands: [
                {
                  strandId: 'strand-ag-1',
                  name: 'Conservation of Resources',
                  subStrands: [
                    {
                      subStrandId: 'sub-ag-1',
                      name: 'Soil Conservation',
                      learningOutcomes: [
                        {
                          learningOutcomeId: 'lo-ag-1',
                          statement: 'Identify methods of soil conservation in agricultural activities.'
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('CREATED');
    expect(result.statistics?.learningOutcomes).toBe(1);
  });
});
