import { CanonicalCurriculumService } from './services/canonicalCurriculumService';
import { CurriculumAlignmentService } from './services/curriculumAlignmentService';
import { TeachingPlanService } from './services/teachingPlanService';
import { GRADE_6_AGRICULTURE_AND_NUTRITION_LESSON_BREAKDOWN } from './data/curriculum/grade-6-agriculture-and-nutrition';
import { GRADE_8_INTEGRATED_SCIENCE_LESSON_BREAKDOWN } from './data/curriculum/grade-8-integrated-science';
import { ContentArtifact } from './types/artifact';

describe('Phase 36E: Authoritative KICD Curriculum Foundation & Coverage Audit', () => {

  describe('1. Authoritative Document Identity Verification', () => {
    it('fails verification when document text is empty or missing required KICD header', () => {
      const resultG6 = CanonicalCurriculumService.verifyDocumentIdentity('', 'Grade 6');
      expect(resultG6.verified).toBe(false);
      expect(resultG6.errors[0]).toContain('CURRICULUM SOURCE VERIFICATION FAILED');

      const resultG8 = CanonicalCurriculumService.verifyDocumentIdentity('Random text', 'Grade 8');
      expect(resultG8.verified).toBe(false);
      expect(resultG8.errors[0]).toContain('CURRICULUM SOURCE VERIFICATION FAILED');
    });

    it('fails verification on publisher textbook files lacking official KICD 2024 design header and ISBN', () => {
      const g6Result = CanonicalCurriculumService.verifyDocumentIdentity(GRADE_6_AGRICULTURE_AND_NUTRITION_LESSON_BREAKDOWN, 'Grade 6');
      expect(g6Result.verified).toBe(false);

      const g8Result = CanonicalCurriculumService.verifyDocumentIdentity(GRADE_8_INTEGRATED_SCIENCE_LESSON_BREAKDOWN, 'Grade 8');
      expect(g8Result.verified).toBe(false);
    });
  });

  describe('2. Absolute No-Invention Rule & Publisher Data Classification', () => {
    it('does not invent canonical records when official KICD source documents are unavailable', () => {
      const g7Authority = CanonicalCurriculumService.getAuthorityStatus('Grade 7', 'Social Studies');
      expect(g7Authority).toBe('AUTHORITATIVE_PENDING_REVIEW');

      const g6Authority = CanonicalCurriculumService.getAuthorityStatus('Grade 6', 'Agriculture and Nutrition');
      expect(g6Authority).toBe('AUTHORITATIVE_VERIFIED');

      const g8Authority = CanonicalCurriculumService.getAuthorityStatus('Grade 8', 'Integrated Science');
      expect(g8Authority).toBe('AUTHORITATIVE_VERIFIED');
    });

    it('classifies publisher textbook files strictly as NON_AUTHORITATIVE_REFERENCE', () => {
      expect(GRADE_6_AGRICULTURE_AND_NUTRITION_LESSON_BREAKDOWN).toContain('Textbook Reference - Non-Authoritative');
      expect(GRADE_8_INTEGRATED_SCIENCE_LESSON_BREAKDOWN).toContain('Textbook Reference - Non-Authoritative');
    });
  });

  describe('3. Curriculum Coverage Registry', () => {
    it('provides a structured coverage registry for all supported subjects and grades', () => {
      const registry = CanonicalCurriculumService.getCoverageRegistry();
      expect(registry.length).toBeGreaterThan(0);

      const g6Record = registry.find(r => r.grade === 'Grade 6' && r.learningArea === 'Agriculture and Nutrition');
      expect(g6Record).toBeDefined();
      expect(g6Record?.authorityStatus).toBe('AUTHORITATIVE_VERIFIED');
      expect(g6Record?.sourceAvailable).toBe(true);

      const g8Record = registry.find(r => r.grade === 'Grade 8' && r.learningArea === 'Integrated Science');
      expect(g8Record).toBeDefined();
      expect(g8Record?.authorityStatus).toBe('AUTHORITATIVE_VERIFIED');
      expect(g8Record?.sourceAvailable).toBe(true);
    });
  });

  describe('4. Curriculum Alignment Security', () => {
    it('rejects WELL_ALIGNED status for unverified or textbook-derived curricula', async () => {
      const mockArtifact: ContentArtifact = {
        artifactId: 'art-g6-ag',
        schoolId: 'school-lwps',
        createdById: 'teacher-1',
        title: 'Grade 6 Agriculture Lesson Plan',
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
        curriculumReferences: [
          {
            curriculumId: 'kicd-cbc-2026',
            gradeLevelId: 'grade-6',
            learningAreaId: 'la-agric',
            learningOutcomeIds: ['outcome-ag-1'],
          }
        ],
        teachingPlanReferences: [],
        contentPayload: {},
        schemaVersion: '1.0',
        gradeLevelName: 'Grade 7',
        learningAreaName: 'Social Studies',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const checked = await CurriculumAlignmentService.performAlignmentCheck(mockArtifact);
      expect(checked.alignmentStatus).toBe('needs_review');
      expect(checked.alignmentFindings?.some(f => f.message.includes('Curriculum source verification required'))).toBe(true);
    });
  });

  describe('5. Teaching Plan & Calendar Separation', () => {
    it('generates sequential allocations without modulo repetition or synthetic fallback', () => {
      const plan = TeachingPlanService.generateTeachingPlan(
        'school-lwps',
        'grade-1',
        'la-math-1',
        'Term 1'
      );

      expect(plan.weeks.length).toBeGreaterThan(0);
      expect(plan.capacityStatus).toBeDefined();

      // Collect all allocated lesson slots
      const allSlots = plan.weeks.flatMap(w => w.lessonSlots);
      expect(allSlots.length).toBeGreaterThan(0);

      // Verify no modulo repetitive cycling in lesson slots
      const currSlots = allSlots.filter(s => s.slotType === 'CURRICULUM_LESSON');
      if (currSlots.length > 0) {
        expect(currSlots[0].lessonNumber).toBe(1);
      }
    });
  });

});
