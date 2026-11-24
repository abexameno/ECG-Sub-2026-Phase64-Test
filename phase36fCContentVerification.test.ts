import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { CurriculumVerificationService } from './services/curriculumVerificationService.ts';
import { CurriculumAlignmentService } from './services/curriculumAlignmentService.ts';
import { TeachingPlanService } from './services/teachingPlanService.ts';
import { ContentArtifact } from './types/artifact.ts';

describe('Phase 36F-C: Authoritative KICD Curriculum Hydration Correction & Content-Level Verification', () => {

  describe('I. GRADE 6 CONTENT-LEVEL VERIFICATION (KICD Revised 2024)', () => {
    it('verifies exact Grade 6 strands, sub-strands, and lesson allocations (Total = 120)', () => {
      const report = CurriculumVerificationService.generateReportForGrade6();
      expect(report.verificationStatus).toBe('PASS');
      expect(report.mismatches.length).toBe(0);
      expect(report.obsoleteRecordsFound.length).toBe(0);
      expect(report.canonicalTotalLessons).toBe(120);
      expect(report.canonicalStrandCount).toBe(4);
      expect(report.canonicalSubStrandCount).toBe(10);
      expect(report.canonicalOutcomeCount).toBe(30);
    });

    it('verifies every Grade 6 sub-strand title and lesson count individually', () => {
      const g6Strands = CanonicalCurriculumService.getStrands('la-agric');
      const subStrands = g6Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));

      const expectedMap: Record<string, number> = {
        '1.1 Controlling Soil Erosion': 11,
        '1.2 Conserving Water: Seedbeds': 11,
        '1.3 Conserving wild animals: Using Physical Deterrents': 10,
        '2.1 Rearing Small Domestic Animals': 12,
        '2.2 Preserving Crop Products: Fruits and Vegetables': 11,
        '2.3 Stewing and Baking Food': 13,
        '3.1 Body Cleanliness': 9,
        '3.2 Laundry: Stain Removal': 12,
        '4.1 Crocheting of PPEs': 16,
        '4.2 Constructing Moist Bed Garden': 15,
      };

      for (const [title, expectedLessons] of Object.entries(expectedMap)) {
        const found = subStrands.find(ss => ss.title === title);
        expect(found).toBeDefined();
        expect(found?.suggestedLessonAllocation).toBe(expectedLessons);
      }
    });

    it('NEGATIVE TEST: fails if any obsolete Phase 36F Grade 6 sub-strand remains active', () => {
      const g6Strands = CanonicalCurriculumService.getStrands('la-agric');
      const subStrands = g6Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));

      const forbiddenTitles = [
        'Water Harvesting',
        'Conserving Food Nutrients',
        'Establishing Vegetable Crops',
        'Good Grooming Practices',
        'Cleaning Household Items',
        'Consumer Education',
        'Making Wise Consumer Choices',
        'Preserving Meat for Future Use'
      ];

      for (const forbidden of forbiddenTitles) {
        const found = subStrands.find(ss => ss.title.toLowerCase().includes(forbidden.toLowerCase()));
        expect(found).toBeUndefined();
      }
    });
  });

  describe('II. GRADE 8 CONTENT-LEVEL VERIFICATION (KICD Revised 2024)', () => {
    it('verifies exact Grade 8 strands, sub-strands, and lesson allocations (Total = 150)', () => {
      const report = CurriculumVerificationService.generateReportForGrade8();
      expect(report.verificationStatus).toBe('PASS');
      expect(report.mismatches.length).toBe(0);
      expect(report.obsoleteRecordsFound.length).toBe(0);
      expect(report.canonicalTotalLessons).toBe(150);
      expect(report.canonicalStrandCount).toBe(3);
      expect(report.canonicalSubStrandCount).toBe(8);
      expect(report.canonicalOutcomeCount).toBe(37);
    });

    it('verifies every Grade 8 sub-strand title and lesson count individually', () => {
      const g8Strands = CanonicalCurriculumService.getStrands('la-sci');
      const subStrands = g8Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));

      const expectedMap: Record<string, number> = {
        '1.1 Elements and Compounds': 18,
        '1.2 Physical and chemical changes': 22,
        '1.3 Classes of fire': 20,
        '2.1 The Cell': 20,
        '2.2 Movement of materials in and out of the cell': 16,
        '2.3 Reproduction in human beings': 18,
        '3.1 Transformation of Energy': 20,
        '3.2 Pressure': 16,
      };

      for (const [title, expectedLessons] of Object.entries(expectedMap)) {
        const found = subStrands.find(ss => ss.title === title);
        expect(found).toBeDefined();
        expect(found?.suggestedLessonAllocation).toBe(expectedLessons);
      }
    });

    it('NEGATIVE TEST: fails if any obsolete Phase 36F Grade 8 sub-strand remains active', () => {
      const g8Strands = CanonicalCurriculumService.getStrands('la-sci');
      const subStrands = g8Strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));

      const forbiddenTitles = [
        'Separating Mixtures',
        'Acids, Bases and Indicators',
        'Human Reproductive System',
        'Excretory System in Humans',
        'Electrical Energy',
        'Magnetism',
        'Work, Energy and Power'
      ];

      for (const forbidden of forbiddenTitles) {
        const found = subStrands.find(ss => ss.title.toLowerCase().includes(forbidden.toLowerCase()));
        expect(found).toBeUndefined();
      }
    });
  });

  describe('III. CURRICULUM ALIGNMENT & TEACHING PLAN INTEGRATION WITH CORRECTED RECORDS', () => {
    it('approves WELL_ALIGNED for corrected Grade 6 Controlling Soil Erosion reference', async () => {
      const artifact: ContentArtifact = {
        artifactId: 'art-g6-corr-1',
        schoolId: 'school-lwps',
        createdById: 'teacher-1',
        title: 'Grade 6 Controlling Soil Erosion Lesson Plan',
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

      const result = await CurriculumAlignmentService.performAlignmentCheck(artifact);
      expect(result.alignmentStatus).toBe('well_aligned');
    });

    it('generates deterministic teaching plans using corrected sub-strand allocations', () => {
      const g6Plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-6', 'la-agric', 'Term 1');
      expect(g6Plan.requiredLessonsCount).toBe(32); // 11 + 11 + 10 for Term 1 sub-strands

      const g8Plan = TeachingPlanService.generateTeachingPlan('school-lwps', 'grade-8', 'la-sci', 'Term 1');
      expect(g8Plan.requiredLessonsCount).toBe(60); // 18 + 22 + 20 for Term 1 sub-strands
    });

    it('enforces multi-school isolation and IDOR protection', () => {
      const plan = TeachingPlanService.createPlan({ id: 'plan-36f-c-1', schoolId: 'school-lwps', subject: 'Agriculture' });
      expect(() => TeachingPlanService.getPlan('plan-36f-c-1', 'school-attacker')).toThrow('Unauthorized cross-school access');
    });
  });

});
