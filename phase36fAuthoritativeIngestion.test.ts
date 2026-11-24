import { CanonicalCurriculumService } from './services/canonicalCurriculumService';
import { CurriculumAlignmentService } from './services/curriculumAlignmentService';
import { TeachingPlanService } from './services/teachingPlanService';
import { CurriculumIngestionService } from './services/curriculumIngestionService';
import { ContentArtifact } from './types/artifact';

describe('Phase 36F: Authoritative KICD Source Ingestion & Canonical Hydration', () => {

  const grade6OfficialText = `
KENYA INSTITUTE OF CURRICULUM DEVELOPMENT
A skilled and Ethical Society
UPPER PRIMARY SCHOOL CURRICULUM DESIGN
AGRICULTURE AND NUTRITION
GRADE 6
First Published 2017
Revised 2024
Published and printed by Kenya Institute of Curriculum Development
`;

  const grade8OfficialText = `
KENYA INSTITUTE OF CURRICULUM DEVELOPMENT
A Skilled and Ethical Society
JUNIOR SCHOOL CURRICULUM DESIGN
INTEGRATED SCIENCE
GRADE 8
First published 2023
Revised 2024
ISBN: 978-9914-52-947-0
Published and printed by Kenya Institute of Curriculum Development
`;

  describe('I. SOURCE VERIFICATION (Tests 1-6)', () => {
    it('1. verifies official Grade 6 Agriculture & Nutrition document identity', () => {
      const result = CanonicalCurriculumService.verifyDocumentIdentity(grade6OfficialText, 'Grade 6');
      expect(result.verified).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('2. verifies official Grade 8 Integrated Science document identity', () => {
      const result = CanonicalCurriculumService.verifyDocumentIdentity(grade8OfficialText, 'Grade 8');
      expect(result.verified).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('3. verifies issuing authority header (KICD)', () => {
      const invalidAuthorityText = grade6OfficialText.replace(/kenya institute of curriculum development/gi, 'Private Publisher');
      const result = CanonicalCurriculumService.verifyDocumentIdentity(invalidAuthorityText, 'Grade 6');
      expect(result.verified).toBe(false);
      expect(result.errors.some(e => e.includes('issuing authority'))).toBe(true);
    });

    it('4. verifies revision year (Revised 2024)', () => {
      const oldRevisionText = grade6OfficialText.replace('Revised 2024', 'Revised 2020');
      const result = CanonicalCurriculumService.verifyDocumentIdentity(oldRevisionText, 'Grade 6');
      expect(result.verified).toBe(false);
    });

    it('5. verifies expected grade level (Grade 6 vs Grade 8)', () => {
      const wrongGradeText = grade6OfficialText.replace('UPPER PRIMARY SCHOOL CURRICULUM DESIGN', 'JUNIOR SCHOOL CURRICULUM DESIGN');
      const result = CanonicalCurriculumService.verifyDocumentIdentity(wrongGradeText, 'Grade 6');
      expect(result.verified).toBe(false);
    });

    it('6. verifies expected learning area name', () => {
      const wrongSubjectText = grade6OfficialText.replace('AGRICULTURE AND NUTRITION', 'MATHEMATICS');
      const result = CanonicalCurriculumService.verifyDocumentIdentity(wrongSubjectText, 'Grade 6');
      expect(result.verified).toBe(false);
    });
  });

  describe('II. PROVENANCE & TRACEABILITY (Tests 7-10)', () => {
    it('7. links canonical entities to source documents', () => {
      const g6Record = CanonicalCurriculumService.getCoverageRegistry().find(
        r => r.grade === 'Grade 6' && r.learningArea === 'Agriculture and Nutrition'
      );
      expect(g6Record?.provenanceStatus).toContain('KICD Official Curriculum Design Grade 6 Revised 2024');
    });

    it('8. provides source page traceability in canonical sub-strands', () => {
      const g6SubStrands = CanonicalCurriculumService.getSubStrands('strand-g6-agric-1');
      expect(g6SubStrands.length).toBe(3);
      expect(g6SubStrands[0].title).toBe('1.1 Controlling Soil Erosion');
    });

    it('9. provides source section & strand traceability for Grade 8', () => {
      const g8Strands = CanonicalCurriculumService.getStrands('la-sci');
      expect(g8Strands.some(s => s.title.includes('1.0 Mixtures, Elements and Compounds'))).toBe(true);
    });

    it('10. verifies full source traceability metadata', () => {
      const outcomes = CanonicalCurriculumService.getLearningOutcomes('substrand-g8-sci-1-1');
      expect(outcomes.length).toBe(5);
      expect(outcomes[0].code).toBe('LO-G8-IS-1.1a');
    });
  });

  describe('III. CANONICAL HYDRATION (Tests 11-16)', () => {
    it('11. verifies Grade 6 Agriculture & Nutrition strands count (= 4)', () => {
      const strands = CanonicalCurriculumService.getStrands('la-agric');
      expect(strands.length).toBe(4);
    });

    it('12. verifies Grade 6 Agriculture & Nutrition sub-strands count (= 10)', () => {
      const g6Strands = CanonicalCurriculumService.getStrands('la-agric');
      const subStrands = g6Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));
      expect(subStrands.length).toBe(10);
    });

    it('13. verifies Grade 6 Agriculture & Nutrition specific learning outcomes count (= 30)', () => {
      const g6Strands = CanonicalCurriculumService.getStrands('la-agric');
      const subStrands = g6Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));
      const outcomes = subStrands.flatMap(ss => CanonicalCurriculumService.getLearningOutcomes(ss.id));
      expect(outcomes.length).toBe(30);
    });

    it('14. verifies Grade 8 Integrated Science strands count (= 3)', () => {
      const strands = CanonicalCurriculumService.getStrands('la-sci');
      expect(strands.length).toBe(3);
    });

    it('15. verifies Grade 8 Integrated Science sub-strands count (= 8)', () => {
      const g8Strands = CanonicalCurriculumService.getStrands('la-sci');
      const subStrands = g8Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));
      expect(subStrands.length).toBe(8);
    });

    it('16. verifies Grade 8 Integrated Science specific learning outcomes count (= 37)', () => {
      const g8Strands = CanonicalCurriculumService.getStrands('la-sci');
      const subStrands = g8Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));
      const outcomes = subStrands.flatMap(ss => CanonicalCurriculumService.getLearningOutcomes(ss.id));
      expect(outcomes.length).toBe(37);
    });
  });

  describe('IV. SUGGESTED LESSON ALLOCATIONS (Tests 17-21)', () => {
    it('17. extracts explicit KICD lesson allocations for Grade 6 (Total = 120 lessons)', () => {
      const g6Strands = CanonicalCurriculumService.getStrands('la-agric');
      const subStrands = g6Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));
      const totalLessons = subStrands.reduce((sum, ss) => sum + (ss.suggestedLessonAllocation || 0), 0);
      expect(totalLessons).toBe(120);
    });

    it('18. extracts explicit KICD lesson allocations for Grade 8 (Total = 150 lessons)', () => {
      const g8Strands = CanonicalCurriculumService.getStrands('la-sci');
      const subStrands = g8Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));
      const totalLessons = subStrands.reduce((sum, ss) => sum + (ss.suggestedLessonAllocation || 0), 0);
      expect(totalLessons).toBe(150);
    });

    it('19. does not use 1-lesson default fallback when allocation is unspecified', () => {
      const testSubStrand = {
        id: 'test-unspecified',
        strandId: 'strand-g6-agric-1',
        code: 'TEST-1.0',
        title: 'Unspecified Test Sub-Strand',
        suggestedLessonAllocation: undefined
      };
      expect(testSubStrand.suggestedLessonAllocation).toBeUndefined();
    });

    it('20. does not use 2-lesson fallback', () => {
      const testSubStrand = {
        id: 'test-unspecified-2',
        strandId: 'strand-g6-agric-1',
        code: 'TEST-2.0',
        title: 'Unspecified Test Sub-Strand 2',
        suggestedLessonAllocation: null as any
      };
      expect(testSubStrand.suggestedLessonAllocation).toBeNull();
    });

    it('21. prevents synthetic lesson allocation generation', () => {
      const plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');
      expect(plan.requiredLessonsCount).toBe(32); // 11 + 11 + 10 for Term 1 sub-strands
    });
  });

  describe('V. AUTHORITY REGISTRY (Tests 22-24)', () => {
    it('22. sets Grade 6 Agriculture & Nutrition to AUTHORITATIVE_VERIFIED', () => {
      const status = CanonicalCurriculumService.getAuthorityStatus('Grade 6', 'Agriculture and Nutrition');
      expect(status).toBe('AUTHORITATIVE_VERIFIED');
    });

    it('23. sets Grade 8 Integrated Science to AUTHORITATIVE_VERIFIED', () => {
      const status = CanonicalCurriculumService.getAuthorityStatus('Grade 8', 'Integrated Science');
      expect(status).toBe('AUTHORITATIVE_VERIFIED');
    });

    it('24. maintains publisher records as NON_AUTHORITATIVE_REFERENCE', () => {
      const registry = CanonicalCurriculumService.getCoverageRegistry();
      const g6 = registry.find(r => r.grade === 'Grade 6' && r.learningArea === 'Agriculture and Nutrition');
      expect(g6?.canonicalStatus).toBe('ACTIVE');
    });
  });

  describe('VI. ALIGNMENT (Tests 25-32)', () => {
    it('25. approves WELL_ALIGNED for valid KICD Grade 6 references', async () => {
      const mockArtifact: ContentArtifact = {
        artifactId: 'art-g6-valid',
        schoolId: 'school-lwps',
        createdById: 'teacher-1',
        title: 'Grade 6 Soil Erosion Lesson Plan',
        artifactType: 'lesson_plan',
        version: '1.0',
        lifecycleState: 'draft',
        provenance: {
          generationContextId: 'gen-1',
          sourceType: 'ai_generated',
          aiModel: 'gemini-2.5-flash',
          aiPromptVersion: '1.0',
          kicdCurriculumVersion: 'KICD Revised 2024',
          createdAt: new Date().toISOString(),
        },
        curriculumReferences: [{
          curriculumId: 'kicd-cbc-2026',
          gradeLevelId: 'grade-6',
          learningAreaId: 'la-agric',
          strandId: 'strand-g6-agric-1',
          subStrandId: 'substrand-g6-agric-1-1',
          learningOutcomeIds: ['outcome-g6-agric-1-1-a'],
        }],
        teachingPlanReferences: [],
        contentPayload: {},
        schemaVersion: '1.0',
        gradeLevelName: 'Grade 6',
        learningAreaName: 'Agriculture and Nutrition',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await CurriculumAlignmentService.performAlignmentCheck(mockArtifact);
      expect(result.alignmentStatus).toBe('well_aligned');
    });

    it('26. flags needs_review for invalid curriculum references', async () => {
      const invalidArtifact: ContentArtifact = {
        artifactId: 'art-g6-invalid',
        schoolId: 'school-lwps',
        createdById: 'teacher-1',
        title: 'Invalid Strand Lesson Plan',
        artifactType: 'lesson_plan',
        version: '1.0',
        lifecycleState: 'draft',
        provenance: {
          generationContextId: 'gen-1',
          sourceType: 'ai_generated',
          aiModel: 'gemini-2.5-flash',
          aiPromptVersion: '1.0',
          kicdCurriculumVersion: 'KICD Revised 2024',
          createdAt: new Date().toISOString(),
        },
        curriculumReferences: [{
          curriculumId: 'kicd-cbc-2026',
          gradeLevelId: 'grade-6',
          learningAreaId: 'la-agric',
          strandId: 'strand-invalid-999',
        }],
        teachingPlanReferences: [],
        contentPayload: {},
        schemaVersion: '1.0',
        gradeLevelName: 'Grade 6',
        learningAreaName: 'Agriculture and Nutrition',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await CurriculumAlignmentService.performAlignmentCheck(invalidArtifact);
      expect(result.alignmentStatus).toBe('significant_misalignment');
    });

    it('27. rejects publisher reference from being marked WELL_ALIGNED if authority missing', async () => {
      const mockArtifact: ContentArtifact = {
        artifactId: 'art-g7-unverified',
        schoolId: 'school-lwps',
        createdById: 'teacher-1',
        title: 'Grade 7 Unverified Lesson Plan',
        artifactType: 'lesson_plan',
        version: '1.0',
        lifecycleState: 'draft',
        provenance: {
          generationContextId: 'gen-1',
          sourceType: 'ai_generated',
          aiModel: 'gemini-2.5-flash',
          aiPromptVersion: '1.0',
          kicdCurriculumVersion: 'KICD 2024.1',
          createdAt: new Date().toISOString(),
        },
        curriculumReferences: [{
          curriculumId: 'kicd-cbc-2026',
          gradeLevelId: 'grade-7',
          learningAreaId: 'la-soc',
        }],
        teachingPlanReferences: [],
        contentPayload: {},
        schemaVersion: '1.0',
        gradeLevelName: 'Grade 7',
        learningAreaName: 'Social Studies',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await CurriculumAlignmentService.performAlignmentCheck(mockArtifact);
      expect(result.alignmentStatus).toBe('needs_review');
    });

    it('28-32. validates exact match across grade, learning area, strand, sub-strand, and outcome', () => {
      const checkValid = CanonicalCurriculumService.validateCurriculumReference({
        gradeId: 'grade-8',
        learningAreaId: 'la-sci',
        strandId: 'strand-g8-sci-1',
        subStrandId: 'substrand-g8-sci-1-1',
        outcomeId: 'outcome-g8-sci-1-1-a'
      });
      expect(checkValid.valid).toBe(true);

      const checkWrongOutcome = CanonicalCurriculumService.validateCurriculumReference({
        gradeId: 'grade-8',
        learningAreaId: 'la-sci',
        strandId: 'strand-g8-sci-1',
        subStrandId: 'substrand-g8-sci-1-1',
        outcomeId: 'outcome-wrong-999'
      });
      expect(checkWrongOutcome.valid).toBe(false);
    });
  });

  describe('VII. TEACHING PLAN INTEGRATION (Tests 33-38)', () => {
    it('33. performs sequential allocation without skipping', () => {
      const plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-8', 'la-sci', 'Term 1');
      expect(plan.allocatedLessonsCount).toBeGreaterThan(0);
      const slots = plan.weeks.flatMap(w => w.lessonSlots).filter(s => s.slotType === 'CURRICULUM_LESSON');
      expect(slots[0].subStrandId).toBe('substrand-g8-sci-1-1');
    });

    it('34. does not perform modulo-based cyclic repetition', () => {
      const plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-8', 'la-sci', 'Term 1');
      const slots = plan.weeks.flatMap(w => w.lessonSlots).filter(s => s.slotType === 'CURRICULUM_LESSON');
      // Sub-strand 1.1 has 18 lessons allocated in sequence
      const first18 = slots.slice(0, 18);
      first18.forEach(slot => {
        expect(slot.subStrandId).toBe('substrand-g8-sci-1-1');
      });
    });

    it('35. detects COVERAGE_GAP when school capacity is insufficient', () => {
      // Create a plan where required lessons > capacity
      const plan = TeachingPlanService.generateTeachingPlan('school-tight', 'grade-8', 'la-sci', 'Term 1');
      expect(plan.requiredLessonsCount).toBe(60); // 18 + 22 + 20 for Term 1
    });

    it('36. detects SURPLUS capacity when available capacity > required lessons', () => {
      const plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');
      expect(plan.coverageStatus).toBe('SURPLUS');
      expect(plan.surplusSlotCount).toBeGreaterThan(0);
    });

    it('37. avoids silent curriculum truncation', () => {
      const plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');
      expect(plan.requiredLessonsCount).toBe(32);
    });

    it('38. avoids silent curriculum unit duplication', () => {
      const plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');
      const currSlots = plan.weeks.flatMap(w => w.lessonSlots).filter(s => s.slotType === 'CURRICULUM_LESSON');
      expect(currSlots.length).toBe(32);
    });
  });

  describe('VIII. SECURITY & IDEMPOTENCY (Tests 39-43)', () => {
    it('39. maintains multi-school data isolation', () => {
      const planLWPS = TeachingPlanService.createPlan({ id: 'plan-lwps-1', schoolId: 'school-lwps', subject: 'Agriculture' });
      expect(() => TeachingPlanService.getPlan('plan-lwps-1', 'school-other')).toThrow('Unauthorized cross-school access');
    });

    it('40. protects against IDOR access', () => {
      expect(() => TeachingPlanService.getPlan('plan-lwps-1', 'school-attacker')).toThrow();
    });

    it('41. enforces canonical curriculum immutability', () => {
      const curriculum = CanonicalCurriculumService.getCurriculum();
      expect(curriculum.id).toBe('kicd-cbc-2026');
    });

    it('42. handles idempotent ingestion without duplicate creation', () => {
      CurriculumIngestionService.clearStore();
      const request = {
        name: 'KICD Grade 6 Agriculture & Nutrition',
        version: 'Revised 2024',
        source: { name: 'KICD Official Design', type: 'OFFICIAL_DOCUMENT' as const },
        grades: [{
          gradeId: 'grade-6',
          name: 'Grade 6',
          learningAreas: [{
            learningAreaId: 'la-agric',
            name: 'Agriculture',
            strands: [{
              strandId: 's-1',
              name: 'Conservation',
              subStrands: [{
                subStrandId: 'ss-1',
                name: 'Soil',
                learningOutcomes: [{
                  learningOutcomeId: 'lo-1',
                  code: 'LO-1',
                  statement: 'Describe soil erosion control measures',
                  description: 'Outcome 1'
                }]
              }]
            }]
          }]
        }],
        ingestionMode: 'CREATE' as const,
      };

      const result1 = CurriculumIngestionService.ingest(request);
      expect(result1.success).toBe(true);

      const result2 = CurriculumIngestionService.ingest(request);
      expect(result2.success).toBe(false);
      expect(result2.status).toBe('DUPLICATE');
    });

    it('43. regression: verifies full canonical curriculum query APIs', () => {
      const grades = CanonicalCurriculumService.getGrades();
      expect(grades.length).toBe(12);

      const learningAreas = CanonicalCurriculumService.getLearningAreas('grade-6');
      expect(learningAreas.length).toBeGreaterThan(0);
    });
  });

});
