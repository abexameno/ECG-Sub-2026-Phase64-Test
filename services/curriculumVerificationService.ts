import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';

export interface CurriculumSourceVerificationReport {
  timestamp: string;
  grade: string;
  learningArea: string;
  sourceDocument: string;
  sourceVersion: string;
  isbn?: string;
  authorityStatus: string;
  expectedTotalLessons: number;
  canonicalTotalLessons: number;
  expectedStrandCount: number;
  canonicalStrandCount: number;
  expectedSubStrandCount: number;
  canonicalSubStrandCount: number;
  expectedOutcomeCount: number;
  canonicalOutcomeCount: number;
  expectedSubStrands: { title: string; lessons: number }[];
  canonicalSubStrands: { title: string; lessons: number }[];
  mismatches: string[];
  obsoleteRecordsFound: string[];
  orphanRecords: string[];
  duplicateRecords: string[];
  verificationStatus: 'PASS' | 'FAIL';
}

export const CurriculumVerificationService = {
  generateReportForGrade6(): CurriculumSourceVerificationReport {
    const strands = CanonicalCurriculumService.getStrands('la-agric');
    const subStrands = strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));
    const outcomes = subStrands.flatMap(ss => CanonicalCurriculumService.getLearningOutcomes(ss.id));
    const totalLessons = subStrands.reduce((sum, ss) => sum + (ss.suggestedLessonAllocation || 0), 0);

    const expectedSubStrands = [
      { title: '1.1 Controlling Soil Erosion', lessons: 11 },
      { title: '1.2 Conserving Water: Seedbeds', lessons: 11 },
      { title: '1.3 Conserving wild animals: Using Physical Deterrents', lessons: 10 },
      { title: '2.1 Rearing Small Domestic Animals', lessons: 12 },
      { title: '2.2 Preserving Crop Products: Fruits and Vegetables', lessons: 11 },
      { title: '2.3 Stewing and Baking Food', lessons: 13 },
      { title: '3.1 Body Cleanliness', lessons: 9 },
      { title: '3.2 Laundry: Stain Removal', lessons: 12 },
      { title: '4.1 Crocheting of PPEs', lessons: 16 },
      { title: '4.2 Constructing Moist Bed Garden', lessons: 15 },
    ];

    const obsoleteTitles = [
      'Water Harvesting',
      'Conserving Food Nutrients',
      'Establishing Vegetable Crops',
      'Good Grooming Practices',
      'Cleaning Household Items',
      'Consumer Education',
      'Making Wise Consumer Choices',
      'Preserving Meat for Future Use'
    ];

    const mismatches: string[] = [];
    const obsoleteFound: string[] = [];

    // Check for obsolete titles in subStrands
    for (const ss of subStrands) {
      if (obsoleteTitles.some(obs => ss.title.toLowerCase().includes(obs.toLowerCase()))) {
        obsoleteFound.push(ss.title);
      }
    }

    // Compare expected vs canonical subStrands
    expectedSubStrands.forEach(exp => {
      const match = subStrands.find(ss => ss.title.toLowerCase().includes(exp.title.toLowerCase()));
      if (!match) {
        mismatches.push(`Missing expected sub-strand: ${exp.title}`);
      } else if (match.suggestedLessonAllocation !== exp.lessons) {
        mismatches.push(`Lesson mismatch for ${exp.title}: expected ${exp.lessons}, found ${match.suggestedLessonAllocation}`);
      }
    });

    const isPass = mismatches.length === 0 && obsoleteFound.length === 0 && totalLessons === 120 && outcomes.length === 30;

    return {
      timestamp: new Date().toISOString(),
      grade: 'Grade 6',
      learningArea: 'Agriculture and Nutrition',
      sourceDocument: 'GRADE-6-AGRICULTURE-NUTRITION.pdf',
      sourceVersion: 'KICD Revised 2024',
      authorityStatus: 'AUTHORITATIVE_VERIFIED',
      expectedTotalLessons: 120,
      canonicalTotalLessons: totalLessons,
      expectedStrandCount: 4,
      canonicalStrandCount: strands.length,
      expectedSubStrandCount: 10,
      canonicalSubStrandCount: subStrands.length,
      expectedOutcomeCount: 30,
      canonicalOutcomeCount: outcomes.length,
      expectedSubStrands,
      canonicalSubStrands: subStrands.map(ss => ({ title: ss.title, lessons: ss.suggestedLessonAllocation || 0 })),
      mismatches,
      obsoleteRecordsFound: obsoleteFound,
      orphanRecords: [],
      duplicateRecords: [],
      verificationStatus: isPass ? 'PASS' : 'FAIL',
    };
  },

  generateReportForGrade8(): CurriculumSourceVerificationReport {
    const strands = CanonicalCurriculumService.getStrands('la-sci');
    const subStrands = strands.flatMap(s => CanonicalCurriculumService.getSubStrands(s.id));
    const outcomes = subStrands.flatMap(ss => CanonicalCurriculumService.getLearningOutcomes(ss.id));
    const totalLessons = subStrands.reduce((sum, ss) => sum + (ss.suggestedLessonAllocation || 0), 0);

    const expectedSubStrands = [
      { title: '1.1 Elements and Compounds', lessons: 18 },
      { title: '1.2 Physical and chemical changes', lessons: 22 },
      { title: '1.3 Classes of fire', lessons: 20 },
      { title: '2.1 The Cell', lessons: 20 },
      { title: '2.2 Movement of materials in and out of the cell', lessons: 16 },
      { title: '2.3 Reproduction in human beings', lessons: 18 },
      { title: '3.1 Transformation of Energy', lessons: 20 },
      { title: '3.2 Pressure', lessons: 16 },
    ];

    const obsoleteTitles = [
      'Separating Mixtures',
      'Acids, Bases and Indicators',
      'Human Reproductive System',
      'Excretory System in Humans',
      'Electrical Energy',
      'Magnetism',
      'Work, Energy and Power'
    ];

    const mismatches: string[] = [];
    const obsoleteFound: string[] = [];

    for (const ss of subStrands) {
      if (obsoleteTitles.some(obs => ss.title.toLowerCase().includes(obs.toLowerCase()))) {
        obsoleteFound.push(ss.title);
      }
    }

    expectedSubStrands.forEach(exp => {
      const match = subStrands.find(ss => ss.title.toLowerCase().includes(exp.title.toLowerCase()));
      if (!match) {
        mismatches.push(`Missing expected sub-strand: ${exp.title}`);
      } else if (match.suggestedLessonAllocation !== exp.lessons) {
        mismatches.push(`Lesson mismatch for ${exp.title}: expected ${exp.lessons}, found ${match.suggestedLessonAllocation}`);
      }
    });

    const isPass = mismatches.length === 0 && obsoleteFound.length === 0 && totalLessons === 150 && outcomes.length === 37;

    return {
      timestamp: new Date().toISOString(),
      grade: 'Grade 8',
      learningArea: 'Integrated Science',
      sourceDocument: 'Integrated-Science-Grade-8-Design-Formatted-April-2024.pdf',
      sourceVersion: 'KICD Revised 2024',
      isbn: '978-9914-52-947-0',
      authorityStatus: 'AUTHORITATIVE_VERIFIED',
      expectedTotalLessons: 150,
      canonicalTotalLessons: totalLessons,
      expectedStrandCount: 3,
      canonicalStrandCount: strands.length,
      expectedSubStrandCount: 8,
      canonicalSubStrandCount: subStrands.length,
      expectedOutcomeCount: 37,
      canonicalOutcomeCount: outcomes.length,
      expectedSubStrands,
      canonicalSubStrands: subStrands.map(ss => ({ title: ss.title, lessons: ss.suggestedLessonAllocation || 0 })),
      mismatches,
      obsoleteRecordsFound: obsoleteFound,
      orphanRecords: [],
      duplicateRecords: [],
      verificationStatus: isPass ? 'PASS' : 'FAIL',
    };
  }
};
