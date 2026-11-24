import {
  Curriculum,
  GradeLevel,
  LearningArea,
  Strand,
  SubStrand,
  LearningOutcome,
  CurriculumMetadataElement,
  CurriculumValidationResult,
  CurriculumAuthorityStatus,
  CurriculumCoverageRecord,
  CanonicalSowNode
} from '../types.ts';
import { LESSON_BREAKDOWNS } from '../data/curriculum/index.ts';
import { getCurriculumTextByTerm } from '../curriculumData.ts';

const COVERAGE_REGISTRY: CurriculumCoverageRecord[] = [
  {
    grade: 'Grade 1',
    learningArea: 'Mathematics',
    curriculumVersion: 'KICD 2024.1',
    authorityStatus: 'AUTHORITATIVE_VERIFIED',
    provenanceStatus: 'KICD Official Syllabus - Verified',
    canonicalStatus: 'ACTIVE',
    sourceAvailable: true,
    sourceVerified: true,
    generationAllowed: true,
    alignmentAllowed: true,
    actionRequired: 'None',
  },
  {
    grade: 'Grade 1',
    learningArea: 'English',
    curriculumVersion: 'KICD 2024.1',
    authorityStatus: 'AUTHORITATIVE_VERIFIED',
    provenanceStatus: 'KICD Official Syllabus - Verified',
    canonicalStatus: 'ACTIVE',
    sourceAvailable: true,
    sourceVerified: true,
    generationAllowed: true,
    alignmentAllowed: true,
    actionRequired: 'None',
  },
  {
    grade: 'Grade 4',
    learningArea: 'Science and Technology',
    curriculumVersion: 'KICD 2024.1',
    authorityStatus: 'AUTHORITATIVE_VERIFIED',
    provenanceStatus: 'KICD Official Syllabus - Verified',
    canonicalStatus: 'ACTIVE',
    sourceAvailable: true,
    sourceVerified: true,
    generationAllowed: true,
    alignmentAllowed: true,
    actionRequired: 'None',
  },
  {
    grade: 'Grade 6',
    learningArea: 'Agriculture and Nutrition',
    curriculumVersion: 'KICD Revised 2024',
    authorityStatus: 'AUTHORITATIVE_VERIFIED',
    provenanceStatus: 'KICD Official Curriculum Design Grade 6 Revised 2024 - Verified',
    canonicalStatus: 'ACTIVE',
    sourceAvailable: true,
    sourceVerified: true,
    generationAllowed: true,
    alignmentAllowed: true,
    actionRequired: 'None',
  },
  {
    grade: 'Grade 8',
    learningArea: 'Integrated Science',
    curriculumVersion: 'KICD Revised 2024',
    authorityStatus: 'AUTHORITATIVE_VERIFIED',
    provenanceStatus: 'KICD Official Curriculum Design Grade 8 Revised 2024 (ISBN 978-9914-52-947-0) - Verified',
    canonicalStatus: 'ACTIVE',
    sourceAvailable: true,
    sourceVerified: true,
    generationAllowed: true,
    alignmentAllowed: true,
    actionRequired: 'None',
  },
  {
    grade: 'Grade 7',
    learningArea: 'Mathematics',
    curriculumVersion: 'KICD 2024.1',
    authorityStatus: 'AUTHORITATIVE_PENDING_REVIEW',
    provenanceStatus: 'KICD Grade 7 Mathematics curriculum design - term-level allocation and lesson traceability not yet verified',
    canonicalStatus: 'PENDING',
    sourceAvailable: true,
    sourceVerified: false,
    generationAllowed: false,
    alignmentAllowed: false,
    actionRequired: 'Audit canonical strand, sub-strand, learning outcome, term allocation, and lesson-count data against the official KICD Grade 7 Mathematics design before enabling generation',
  },
  {
    grade: 'Grade 7',
    learningArea: 'Social Studies',
    curriculumVersion: 'KICD 2024.1',
    authorityStatus: 'AUTHORITATIVE_PENDING_REVIEW',
    provenanceStatus: 'KICD Framework Draft - Pending Provenance Audit',
    canonicalStatus: 'PENDING',
    sourceAvailable: true,
    sourceVerified: false,
    generationAllowed: true,
    alignmentAllowed: false,
    actionRequired: 'Verify KICD 2024 PDF Page Traceability',
  },
  {
    grade: 'Grade 10',
    learningArea: 'Chemistry',
    curriculumVersion: 'KICD Senior School 2024',
    authorityStatus: 'AUTHORITATIVE_PENDING_REVIEW',
    provenanceStatus: 'KICD Senior School Syllabus Draft',
    canonicalStatus: 'PENDING',
    sourceAvailable: true,
    sourceVerified: false,
    generationAllowed: true,
    alignmentAllowed: false,
    actionRequired: 'Verify Senior School KICD Design Document',
  },
];

const CANONICAL_CURRICULUM: Curriculum = {
  id: 'kicd-cbc-2026',
  name: 'Kenya Competency-Based Curriculum (CBC / CBE)',
  code: 'KICD-CBC',
  version: '2026.1',
  country: 'Kenya',
  framework: 'Competency-Based Education',
  status: 'active',
};

const GRADES: GradeLevel[] = [
  { id: 'grade-pp1', curriculumId: 'kicd-cbc-2026', code: 'PP1', name: 'PP1', levelType: 'Pre-Primary', order: 1 },
  { id: 'grade-pp2', curriculumId: 'kicd-cbc-2026', code: 'PP2', name: 'PP2', levelType: 'Pre-Primary', order: 2 },
  { id: 'grade-1', curriculumId: 'kicd-cbc-2026', code: 'G1', name: 'Grade 1', levelType: 'Primary', order: 3 },
  { id: 'grade-2', curriculumId: 'kicd-cbc-2026', code: 'G2', name: 'Grade 2', levelType: 'Primary', order: 4 },
  { id: 'grade-3', curriculumId: 'kicd-cbc-2026', code: 'G3', name: 'Grade 3', levelType: 'Primary', order: 5 },
  { id: 'grade-4', curriculumId: 'kicd-cbc-2026', code: 'G4', name: 'Grade 4', levelType: 'Primary', order: 6 },
  { id: 'grade-5', curriculumId: 'kicd-cbc-2026', code: 'G5', name: 'Grade 5', levelType: 'Primary', order: 7 },
  { id: 'grade-6', curriculumId: 'kicd-cbc-2026', code: 'G6', name: 'Grade 6', levelType: 'Primary', order: 8 },
  { id: 'grade-7', curriculumId: 'kicd-cbc-2026', code: 'G7', name: 'Grade 7', levelType: 'Junior School', order: 9 },
  { id: 'grade-8', curriculumId: 'kicd-cbc-2026', code: 'G8', name: 'Grade 8', levelType: 'Junior School', order: 10 },
  { id: 'grade-9', curriculumId: 'kicd-cbc-2026', code: 'G9', name: 'Grade 9', levelType: 'Junior School', order: 11 },
  { id: 'grade-10', curriculumId: 'kicd-cbc-2026', code: 'G10', name: 'Grade 10', levelType: 'Senior School', order: 12 },
];

const LEARNING_AREAS: LearningArea[] = [
  { id: 'la-math', curriculumId: 'kicd-cbc-2026', code: 'MATH', name: 'Mathematics', gradeIds: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9', 'grade-10'] },
  { id: 'la-eng', curriculumId: 'kicd-cbc-2026', code: 'ENG', name: 'English', gradeIds: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9', 'grade-10'] },
  { id: 'la-kisw', curriculumId: 'kicd-cbc-2026', code: 'KISW', name: 'Kiswahili', gradeIds: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9', 'grade-10'] },
  { id: 'la-sci', curriculumId: 'kicd-cbc-2026', code: 'SCI', name: 'Science and Technology / Integrated Science', gradeIds: ['grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9', 'grade-10'] },
  { id: 'la-cas', curriculumId: 'kicd-cbc-2026', code: 'CAS', name: 'Creative Arts and Sports', gradeIds: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9', 'grade-10'] },
  { id: 'la-soc', curriculumId: 'kicd-cbc-2026', code: 'SOC', name: 'Social Studies', gradeIds: ['grade-3', 'grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9'] },
  { id: 'la-agric', curriculumId: 'kicd-cbc-2026', code: 'AGRIC', name: 'Agriculture and Nutrition', gradeIds: ['grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9', 'grade-10'] },
  { id: 'la-cre', curriculumId: 'kicd-cbc-2026', code: 'CRE', name: 'Christian Religious Education (CRE)', gradeIds: ['grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9', 'grade-10'] },
];

const STRANDS: Strand[] = [
  { id: 'strand-math-numbers', learningAreaId: 'la-math', code: 'NUM', title: 'Numbers', description: 'Whole numbers, fractions, decimals, and operations.' },
  { id: 'strand-math-measurement', learningAreaId: 'la-math', code: 'MEAS', title: 'Measurement', description: 'Length, area, volume, mass, time, and money.' },
  { id: 'strand-math-geometry', learningAreaId: 'la-math', code: 'GEO', title: 'Geometry', description: 'Properties of shapes and spatial visualization.' },
  { id: 'strand-eng-listening', learningAreaId: 'la-eng', code: 'LIST', title: 'Listening and Speaking', description: 'Aural comprehension and oral expression.' },
  { id: 'strand-eng-reading', learningAreaId: 'la-eng', code: 'READ', title: 'Reading', description: 'Decoding, fluency, and reading comprehension.' },

  // Grade 6 Agriculture & Nutrition (KICD Revised 2024 - Verified)
  { id: 'strand-g6-agric-1', learningAreaId: 'la-agric', code: 'STRAND-G6-AG-1.0', title: '1.0 Conservation of Resources', description: 'Controlling soil erosion, conserving water in seedbeds, and conserving wild animals using physical deterrents.' },
  { id: 'strand-g6-agric-2', learningAreaId: 'la-agric', code: 'STRAND-G6-AG-2.0', title: '2.0 Food Production Processes', description: 'Rearing small domestic animals, preserving crop products, and stewing and baking food.' },
  { id: 'strand-g6-agric-3', learningAreaId: 'la-agric', code: 'STRAND-G6-AG-3.0', title: '3.0 Hygiene Practices', description: 'Body cleanliness and stain removal in laundry.' },
  { id: 'strand-g6-agric-4', learningAreaId: 'la-agric', code: 'STRAND-G6-AG-4.0', title: '4.0 Production Techniques', description: 'Crocheting of PPEs and constructing moist bed gardens.' },

  // Grade 8 Integrated Science (KICD Revised 2024 - ISBN 978-9914-52-947-0 - Verified)
  { id: 'strand-g8-sci-1', learningAreaId: 'la-sci', code: 'STRAND-G8-IS-1.0', title: '1.0 Mixtures, Elements and Compounds', description: 'Elements and compounds, physical and chemical changes, and classes of fire.' },
  { id: 'strand-g8-sci-2', learningAreaId: 'la-sci', code: 'STRAND-G8-IS-2.0', title: '2.0 Living Things and Their Environment', description: 'The cell, movement of materials in and out of cells, and reproduction in human beings.' },
  { id: 'strand-g8-sci-3', learningAreaId: 'la-sci', code: 'STRAND-G8-IS-3.0', title: '3.0 Force and Energy', description: 'Transformation of energy and pressure in solids and liquids.' },
];

const SUB_STRANDS: SubStrand[] = [
  { id: 'substrand-whole-numbers', strandId: 'strand-math-numbers', code: 'WN-1', title: 'Whole Numbers up to Millions', suggestedTerms: ['Term 1'], keyInquiryQuestions: ['How do we read and write large numbers?'] },
  { id: 'substrand-fractions', strandId: 'strand-math-numbers', code: 'FRAC-1', title: 'Fractions and Decimals', suggestedTerms: ['Term 1', 'Term 2'], keyInquiryQuestions: ['What is the relationship between fractions and decimals?'] },
  { id: 'substrand-length', strandId: 'strand-math-measurement', code: 'LEN-1', title: 'Conversion of Units of Length', suggestedTerms: ['Term 1'], keyInquiryQuestions: ['How do we convert kilometers to meters?'] },

  // Grade 6 Agriculture & Nutrition Sub-Strands (Total Explicit Allocation: 120 lessons)
  { id: 'substrand-g6-agric-1-1', strandId: 'strand-g6-agric-1', code: 'G6-AG-1.1', title: '1.1 Controlling Soil Erosion', suggestedLessonAllocation: 11, suggestedTerms: ['Term 1'], keyInquiryQuestions: ['How does erosion control conserve the environment?'] },
  { id: 'substrand-g6-agric-1-2', strandId: 'strand-g6-agric-1', code: 'G6-AG-1.2', title: '1.2 Conserving Water: Seedbeds', suggestedLessonAllocation: 11, suggestedTerms: ['Term 1'], keyInquiryQuestions: ['How can we prepare a seedbed to conserve moisture?'] },
  { id: 'substrand-g6-agric-1-3', strandId: 'strand-g6-agric-1', code: 'G6-AG-1.3', title: '1.3 Conserving wild animals: Using Physical Deterrents', suggestedLessonAllocation: 10, suggestedTerms: ['Term 1'], keyInquiryQuestions: ['How can wild animals be kept away from crops and domestic animals?'] },

  { id: 'substrand-g6-agric-2-1', strandId: 'strand-g6-agric-2', code: 'G6-AG-2.1', title: '2.1 Rearing Small Domestic Animals', suggestedLessonAllocation: 12, suggestedTerms: ['Term 2'], keyInquiryQuestions: ['How does rearing of animals contribute to food production?'] },
  { id: 'substrand-g6-agric-2-2', strandId: 'strand-g6-agric-2', code: 'G6-AG-2.2', title: '2.2 Preserving Crop Products: Fruits and Vegetables', suggestedLessonAllocation: 11, suggestedTerms: ['Term 2'], keyInquiryQuestions: ['How does preservation of fruits and vegetables enhance food security?'] },
  { id: 'substrand-g6-agric-2-3', strandId: 'strand-g6-agric-2', code: 'G6-AG-2.3', title: '2.3 Stewing and Baking Food', suggestedLessonAllocation: 13, suggestedTerms: ['Term 2'], keyInquiryQuestions: ['How can we cook foods using baking methods?', 'How can we cook foods using stewing methods?'] },

  { id: 'substrand-g6-agric-3-1', strandId: 'strand-g6-agric-3', code: 'G6-AG-3.1', title: '3.1 Body Cleanliness', suggestedLessonAllocation: 9, suggestedTerms: ['Term 3'], keyInquiryQuestions: ['How does body cleanliness enhance personal hygiene?'] },
  { id: 'substrand-g6-agric-3-2', strandId: 'strand-g6-agric-3', code: 'G6-AG-3.2', title: '3.2 Laundry: Stain Removal', suggestedLessonAllocation: 12, suggestedTerms: ['Term 3'], keyInquiryQuestions: ['How does stain removal enhance personal hygiene?'] },

  { id: 'substrand-g6-agric-4-1', strandId: 'strand-g6-agric-4', code: 'G6-AG-4.1', title: '4.1 Crocheting of PPEs', suggestedLessonAllocation: 16, suggestedTerms: ['Term 3'], keyInquiryQuestions: ['How can crocheting solve daily problems?'] },
  { id: 'substrand-g6-agric-4-2', strandId: 'strand-g6-agric-4', code: 'G6-AG-4.2', title: '4.2 Constructing Moist Bed Garden', suggestedLessonAllocation: 15, suggestedTerms: ['Term 3'], keyInquiryQuestions: ['How can we construct a moist bed garden to grow crops?'] },

  // Grade 8 Integrated Science Sub-Strands (Total Explicit Allocation: 150 lessons)
  { id: 'substrand-g8-sci-1-1', strandId: 'strand-g8-sci-1', code: 'G8-IS-1.1', title: '1.1 Elements and Compounds', suggestedLessonAllocation: 18, suggestedTerms: ['Term 1'], keyInquiryQuestions: ['Why is it important to use symbols for representing elements in day to day life?'] },
  { id: 'substrand-g8-sci-1-2', strandId: 'strand-g8-sci-1', code: 'G8-IS-1.2', title: '1.2 Physical and chemical changes', suggestedLessonAllocation: 22, suggestedTerms: ['Term 1'], keyInquiryQuestions: ['How does the movement of particles in matter affect its properties?'] },
  { id: 'substrand-g8-sci-1-3', strandId: 'strand-g8-sci-1', code: 'G8-IS-1.3', title: '1.3 Classes of fire', suggestedLessonAllocation: 20, suggestedTerms: ['Term 1'], keyInquiryQuestions: ['What are the dangers of fire in nature?'] },

  { id: 'substrand-g8-sci-2-1', strandId: 'strand-g8-sci-2', code: 'G8-IS-2.1', title: '2.1 The Cell', suggestedLessonAllocation: 20, suggestedTerms: ['Term 2'], keyInquiryQuestions: ['What makes up plant and animal cells?'] },
  { id: 'substrand-g8-sci-2-2', strandId: 'strand-g8-sci-2', code: 'G8-IS-2.2', title: '2.2 Movement of materials in and out of the cell', suggestedLessonAllocation: 16, suggestedTerms: ['Term 2'], keyInquiryQuestions: ['How do materials move in and out of a cell?'] },
  { id: 'substrand-g8-sci-2-3', strandId: 'strand-g8-sci-2', code: 'G8-IS-2.3', title: '2.3 Reproduction in human beings', suggestedLessonAllocation: 18, suggestedTerms: ['Term 2'], keyInquiryQuestions: ['How best can challenges related to the menstrual cycle be managed?'] },

  { id: 'substrand-g8-sci-3-1', strandId: 'strand-g8-sci-3', code: 'G8-IS-3.1', title: '3.1 Transformation of Energy', suggestedLessonAllocation: 20, suggestedTerms: ['Term 3'], keyInquiryQuestions: ['What are the sources of energy in the environment?', 'How is energy transformation applied in day-to-day life?'] },
  { id: 'substrand-g8-sci-3-2', strandId: 'strand-g8-sci-3', code: 'G8-IS-3.2', title: '3.2 Pressure', suggestedLessonAllocation: 16, suggestedTerms: ['Term 3'], keyInquiryQuestions: ['What are the applications of pressure in solids and liquids?'] },
];

const LEARNING_OUTCOMES: LearningOutcome[] = [
  { id: 'outcome-wn-1', subStrandId: 'substrand-whole-numbers', code: 'OUT-WN-1', statement: 'Learner should be able to read and write whole numbers up to millions in figures and words.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-wn-2', subStrandId: 'substrand-whole-numbers', code: 'OUT-WN-2', statement: 'Learner should be able to round off numbers to the nearest tens, hundreds, and thousands.', taxonomyLevel: 'Skills' },
  { id: 'outcome-frac-1', subStrandId: 'substrand-fractions', code: 'OUT-FRAC-1', statement: 'Learner should be able to perform operations involving addition and subtraction of fractions.', taxonomyLevel: 'Skills' },

  // Grade 6 Agriculture & Nutrition Outcomes (30 outcomes)
  { id: 'outcome-g6-agric-1-1-a', subStrandId: 'substrand-g6-agric-1-1', code: 'LO-G6-AG-1.1a', statement: 'Describe types of soil erosion in the environment.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-1-1-b', subStrandId: 'substrand-g6-agric-1-1', code: 'LO-G6-AG-1.1b', statement: 'Control soil erosion in the environment.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-1-1-c', subStrandId: 'substrand-g6-agric-1-1', code: 'LO-G6-AG-1.1c', statement: 'Appreciate importance of conserving soil.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g6-agric-1-2-a', subStrandId: 'substrand-g6-agric-1-2', code: 'LO-G6-AG-1.2a', statement: 'Identify types of seedbeds that conserve soil moisture.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-1-2-b', subStrandId: 'substrand-g6-agric-1-2', code: 'LO-G6-AG-1.2b', statement: 'Prepare different types of seedbeds that conserve soil moisture.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-1-2-c', subStrandId: 'substrand-g6-agric-1-2', code: 'LO-G6-AG-1.2c', statement: 'Appreciate importance of conserving moisture in a seedbed to increase chances of plants growth.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g6-agric-1-3-a', subStrandId: 'substrand-g6-agric-1-3', code: 'LO-G6-AG-1.3a', statement: 'Identify deterrents that can keep off wild animals from crop and domestic animals.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-1-3-b', subStrandId: 'substrand-g6-agric-1-3', code: 'LO-G6-AG-1.3b', statement: 'Establish deterrents to keep off wild animals from destroying crops and domestic animals.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-1-3-c', subStrandId: 'substrand-g6-agric-1-3', code: 'LO-G6-AG-1.3c', statement: 'Acknowledge the importance of deterrents in conserving wild animals in safeguarding crops and domestic animals.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g6-agric-2-1-a', subStrandId: 'substrand-g6-agric-2-1', code: 'LO-G6-AG-2.1a', statement: 'Explain routine practices in rearing of small domestic animals.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-2-1-b', subStrandId: 'substrand-g6-agric-2-1', code: 'LO-G6-AG-2.1b', statement: 'Rear small domestic animals used as sources of food.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-2-1-c', subStrandId: 'substrand-g6-agric-2-1', code: 'LO-G6-AG-2.1c', statement: 'Embrace the rearing of small domestic animals used as sources of food.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g6-agric-2-2-a', subStrandId: 'substrand-g6-agric-2-2', code: 'LO-G6-AG-2.2a', statement: 'Describe how to preserve and store fruits and vegetables at home.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-2-2-b', subStrandId: 'substrand-g6-agric-2-2', code: 'LO-G6-AG-2.2b', statement: 'Preserve fruits and vegetables using drying method.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-2-2-c', subStrandId: 'substrand-g6-agric-2-2', code: 'LO-G6-AG-2.2c', statement: 'Adopt preservation and storage of fruits and vegetables to reduce food wastage.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g6-agric-2-3-a', subStrandId: 'substrand-g6-agric-2-3', code: 'LO-G6-AG-2.3a', statement: 'Describe stewing and baking as methods of cooking.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-2-3-b', subStrandId: 'substrand-g6-agric-2-3', code: 'LO-G6-AG-2.3b', statement: 'Cook food using stewing and baking methods.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-2-3-c', subStrandId: 'substrand-g6-agric-2-3', code: 'LO-G6-AG-2.3c', statement: 'Embrace stewing and baking in food production.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g6-agric-3-1-a', subStrandId: 'substrand-g6-agric-3-1', code: 'LO-G6-AG-3.1a', statement: 'Describe practices that enhance body cleanliness as habits.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-3-1-b', subStrandId: 'substrand-g6-agric-3-1', code: 'LO-G6-AG-3.1b', statement: 'Adopt body cleanliness as a health routine.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-3-1-c', subStrandId: 'substrand-g6-agric-3-1', code: 'LO-G6-AG-3.1c', statement: 'Recognize importance of body cleanliness as a healthy habit.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g6-agric-3-2-a', subStrandId: 'substrand-g6-agric-3-2', code: 'LO-G6-AG-3.2a', statement: 'Identify common stains on clothing and household articles.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-3-2-b', subStrandId: 'substrand-g6-agric-3-2', code: 'LO-G6-AG-3.2b', statement: 'Remove common stains from clothing and household articles.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-3-2-c', subStrandId: 'substrand-g6-agric-3-2', code: 'LO-G6-AG-3.2c', statement: 'Adopt stain removal for personal hygiene.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g6-agric-4-1-a', subStrandId: 'substrand-g6-agric-4-1', code: 'LO-G6-AG-4.1a', statement: 'Identify crocheting stitches in making household article.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-4-1-b', subStrandId: 'substrand-g6-agric-4-1', code: 'LO-G6-AG-4.1b', statement: 'Use crocheting stitches to make a household article.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-4-1-c', subStrandId: 'substrand-g6-agric-4-1', code: 'LO-G6-AG-4.1c', statement: 'Adopt use of crocheting stitches in making household articles.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g6-agric-4-2-a', subStrandId: 'substrand-g6-agric-4-2', code: 'LO-G6-AG-4.2a', statement: 'Explain the meaning of moist bed garden.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g6-agric-4-2-b', subStrandId: 'substrand-g6-agric-4-2', code: 'LO-G6-AG-4.2b', statement: 'Construct a moist bed garden for growing a selected crop.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g6-agric-4-2-c', subStrandId: 'substrand-g6-agric-4-2', code: 'LO-G6-AG-4.2c', statement: 'Embrace the use of moist bed garden in growing crops.', taxonomyLevel: 'Attitudes' },

  // Grade 8 Integrated Science Outcomes (37 outcomes)
  { id: 'outcome-g8-sci-1-1-a', subStrandId: 'substrand-g8-sci-1-1', code: 'LO-G8-IS-1.1a', statement: 'Explain the relationship between an atom, an element, a molecule and a compound.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-1-1-b', subStrandId: 'substrand-g8-sci-1-1', code: 'LO-G8-IS-1.1b', statement: 'Assign symbols to selected elements.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-1-1-c', subStrandId: 'substrand-g8-sci-1-1', code: 'LO-G8-IS-1.1c', statement: 'Write word equations to represent reactions of selected elements to form compounds.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-1-1-d', subStrandId: 'substrand-g8-sci-1-1', code: 'LO-G8-IS-1.1d', statement: 'Outline the applications of common elements in the society.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-1-1-e', subStrandId: 'substrand-g8-sci-1-1', code: 'LO-G8-IS-1.1e', statement: 'Appreciate the information on packaging labels of commonly consumed substances.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g8-sci-1-2-a', subStrandId: 'substrand-g8-sci-1-2', code: 'LO-G8-IS-1.2a', statement: 'Describe the characteristics of particles in the three states of matter.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-1-2-b', subStrandId: 'substrand-g8-sci-1-2', code: 'LO-G8-IS-1.2b', statement: 'Explain the effects of impurities on boiling point and melting point of a substance.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-1-2-c', subStrandId: 'substrand-g8-sci-1-2', code: 'LO-G8-IS-1.2c', statement: 'Distinguish between physical and chemical changes in substances.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-1-2-d', subStrandId: 'substrand-g8-sci-1-2', code: 'LO-G8-IS-1.2d', statement: 'Outline applications of change of state of matter in day-to-day life.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-1-2-e', subStrandId: 'substrand-g8-sci-1-2', code: 'LO-G8-IS-1.2e', statement: 'Appreciate the applications of change of state of matter in day-to-day life.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g8-sci-1-3-a', subStrandId: 'substrand-g8-sci-1-3', code: 'LO-G8-IS-1.3a', statement: 'Identify causes of fire in nature.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-1-3-b', subStrandId: 'substrand-g8-sci-1-3', code: 'LO-G8-IS-1.3b', statement: 'Explain the role of the components of fire triangle in the spread of fire.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-1-3-c', subStrandId: 'substrand-g8-sci-1-3', code: 'LO-G8-IS-1.3c', statement: 'Describe ways of controlling different classes of fires.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-1-3-d', subStrandId: 'substrand-g8-sci-1-3', code: 'LO-G8-IS-1.3d', statement: 'Acknowledge the dangers of fires in nature.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g8-sci-2-1-a', subStrandId: 'substrand-g8-sci-2-1', code: 'LO-G8-IS-2.1a', statement: 'Describe the structure of plant and animal cells as observed under a light microscope.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-2-1-b', subStrandId: 'substrand-g8-sci-2-1', code: 'LO-G8-IS-2.1b', statement: 'Describe the functions of components of cells seen under the light microscope.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-2-1-c', subStrandId: 'substrand-g8-sci-2-1', code: 'LO-G8-IS-2.1c', statement: 'Compare plant and animal cells as observed under a light microscope.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-2-1-d', subStrandId: 'substrand-g8-sci-2-1', code: 'LO-G8-IS-2.1d', statement: 'Determine the magnification of cells under the light microscope.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-2-1-e', subStrandId: 'substrand-g8-sci-2-1', code: 'LO-G8-IS-2.1e', statement: 'Appreciate the role of cells in living things.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g8-sci-2-2-a', subStrandId: 'substrand-g8-sci-2-2', code: 'LO-G8-IS-2.2a', statement: 'Outline the process of diffusion and osmosis in cells.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-2-2-b', subStrandId: 'substrand-g8-sci-2-2', code: 'LO-G8-IS-2.2b', statement: 'Demonstrate diffusion and osmosis in living things.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-2-2-c', subStrandId: 'substrand-g8-sci-2-2', code: 'LO-G8-IS-2.2c', statement: 'Explain the role of diffusion and osmosis in living things.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-2-2-d', subStrandId: 'substrand-g8-sci-2-2', code: 'LO-G8-IS-2.2d', statement: 'Appreciate the importance of diffusion and osmosis in living things.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g8-sci-2-3-a', subStrandId: 'substrand-g8-sci-2-3', code: 'LO-G8-IS-2.3a', statement: 'Outline the menstrual cycle and its related challenges in human beings.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-2-3-b', subStrandId: 'substrand-g8-sci-2-3', code: 'LO-G8-IS-2.3b', statement: 'Develop a plan to manage challenges related to menstrual cycle in human beings.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-2-3-c', subStrandId: 'substrand-g8-sci-2-3', code: 'LO-G8-IS-2.3c', statement: 'Describe fertilisation and implantation in human beings.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-2-3-d', subStrandId: 'substrand-g8-sci-2-3', code: 'LO-G8-IS-2.3d', statement: 'Outline symptoms of STIs in human beings.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-2-3-e', subStrandId: 'substrand-g8-sci-2-3', code: 'LO-G8-IS-2.3e', statement: 'Explain prevention measures for common STIs in human beings.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-2-3-f', subStrandId: 'substrand-g8-sci-2-3', code: 'LO-G8-IS-2.3f', statement: 'Appreciate the need for a healthy reproductive system.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g8-sci-3-1-a', subStrandId: 'substrand-g8-sci-3-1', code: 'LO-G8-IS-3.1a', statement: 'Identify forms of energy in nature.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-3-1-b', subStrandId: 'substrand-g8-sci-3-1', code: 'LO-G8-IS-3.1b', statement: 'Classify energy sources into renewable or non-renewable.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-3-1-c', subStrandId: 'substrand-g8-sci-3-1', code: 'LO-G8-IS-3.1c', statement: 'Demonstrate simple energy transformations in nature.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-3-1-d', subStrandId: 'substrand-g8-sci-3-1', code: 'LO-G8-IS-3.1d', statement: 'Describe safety measures associated with energy transformation.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-3-1-e', subStrandId: 'substrand-g8-sci-3-1', code: 'LO-G8-IS-3.1e', statement: 'Appreciate the applications of energy transformation in day-to-day life.', taxonomyLevel: 'Attitudes' },

  { id: 'outcome-g8-sci-3-2-a', subStrandId: 'substrand-g8-sci-3-2', code: 'LO-G8-IS-3.2a', statement: 'Demonstrate pressure in solids and liquids.', taxonomyLevel: 'Skills' },
  { id: 'outcome-g8-sci-3-2-b', subStrandId: 'substrand-g8-sci-3-2', code: 'LO-G8-IS-3.2b', statement: 'Identify applications of pressure in solids and liquids.', taxonomyLevel: 'Knowledge' },
  { id: 'outcome-g8-sci-3-2-c', subStrandId: 'substrand-g8-sci-3-2', code: 'LO-G8-IS-3.2c', statement: 'Appreciate the applications of pressure in solids and liquids.', taxonomyLevel: 'Attitudes' },
];

const CORE_COMPETENCIES: CurriculumMetadataElement[] = [
  { id: 'comp-communication', type: 'Competency', name: 'Communication and Collaboration', description: 'Ability to express ideas effectively and work in teams.' },
  { id: 'comp-critical-thinking', type: 'Competency', name: 'Critical Thinking and Problem Solving', description: 'Analyzing situations and formulating logical solutions.' },
  { id: 'comp-creativity', type: 'Competency', name: 'Creativity and Imagination', description: 'Generating novel ideas and original creations.' },
  { id: 'comp-citizenship', type: 'Competency', name: 'Citizenship', description: 'Understanding civic responsibilities and national cohesion.' },
];

const CORE_VALUES: CurriculumMetadataElement[] = [
  { id: 'val-integrity', type: 'Value', name: 'Integrity', description: 'Honesty and strong moral principles.' },
  { id: 'val-respect', type: 'Value', name: 'Respect', description: 'Valuing self, others, and property.' },
  { id: 'val-responsibility', type: 'Value', name: 'Responsibility', description: 'Being accountable for actions and duties.' },
  { id: 'val-unity', type: 'Value', name: 'Unity', description: 'Working together harmoniously.' },
];

const PCIS: CurriculumMetadataElement[] = [
  { id: 'pci-health', type: 'PCI', name: 'Health and Hygiene', description: 'Promoting personal and environmental health.' },
  { id: 'pci-financial', type: 'PCI', name: 'Financial Literacy', description: 'Smart budgeting, saving, and resource management.' },
  { id: 'pci-environment', type: 'PCI', name: 'Environmental Conservation', description: 'Sustainable use of natural resources and climate action.' },
];

export const CanonicalCurriculumService = {
  getCurriculum(): Curriculum {
    return CANONICAL_CURRICULUM;
  },

  getGrades(): GradeLevel[] {
    return GRADES;
  },

  getGradeById(gradeId?: string): GradeLevel | undefined {
    if (!gradeId) return undefined;
    const search = gradeId.toLowerCase();
    return GRADES.find(g => g.id === gradeId || g.name?.toLowerCase() === search || g.code?.toLowerCase() === search);
  },

  getLearningAreas(gradeId?: string): LearningArea[] {
    if (!gradeId) return LEARNING_AREAS;
    const grade = this.getGradeById(gradeId);
    if (!grade) return LEARNING_AREAS;
    return LEARNING_AREAS.filter(la => la.gradeIds.includes(grade.id));
  },

  getLearningAreaById(learningAreaId?: string): LearningArea | undefined {
    if (!learningAreaId) return undefined;
    const search = learningAreaId.toLowerCase();
    return LEARNING_AREAS.find(
      la => la.id === learningAreaId || la.name?.toLowerCase() === search || learningAreaId.startsWith(la.id) || (la.code && search.includes(la.code.toLowerCase()))
    );
  },

  getStrands(learningAreaId: string): Strand[] {
    const laObj = this.getLearningAreaById(learningAreaId);
    const resolvedId = laObj ? laObj.id : learningAreaId;
    return STRANDS.filter(s => s.learningAreaId === learningAreaId || s.learningAreaId === resolvedId);
  },

  getSubStrands(strandId: string): SubStrand[] {
    return SUB_STRANDS.filter(ss => ss.strandId === strandId);
  },

  getSubStrandById(subStrandId: string): SubStrand | undefined {
    return SUB_STRANDS.find(ss => ss.id === subStrandId);
  },

  getLearningOutcomes(subStrandId: string): LearningOutcome[] {
    return LEARNING_OUTCOMES.find(lo => lo.subStrandId === subStrandId) ? LEARNING_OUTCOMES.filter(lo => lo.subStrandId === subStrandId) : [];
  },

  getCoreCompetencies(): CurriculumMetadataElement[] {
    return CORE_COMPETENCIES;
  },

  getCoreValues(): CurriculumMetadataElement[] {
    return CORE_VALUES;
  },

  getPCIs(): CurriculumMetadataElement[] {
    return PCIS;
  },

  validateCurriculumReference(refs: {
    gradeId?: string;
    learningAreaId?: string;
    strandId?: string;
    subStrandId?: string;
    outcomeId?: string;
  }): CurriculumValidationResult {
    const errors: string[] = [];

    if (refs.gradeId && !this.getGradeById(refs.gradeId)) {
      errors.push(`Invalid grade reference: ${refs.gradeId}`);
    }

    if (refs.learningAreaId && !this.getLearningAreaById(refs.learningAreaId)) {
      errors.push(`Invalid learning area reference: ${refs.learningAreaId}`);
    }

    if (refs.strandId && refs.learningAreaId) {
      const strands = this.getStrands(refs.learningAreaId);
      if (!strands.some(s => s.id === refs.strandId)) {
        errors.push(`Strand ${refs.strandId} does not belong to Learning Area ${refs.learningAreaId}`);
      }
    }

    if (refs.subStrandId && refs.strandId) {
      const subStrands = this.getSubStrands(refs.strandId);
      if (!subStrands.some(ss => ss.id === refs.subStrandId)) {
        errors.push(`Sub-Strand ${refs.subStrandId} does not belong to Strand ${refs.strandId}`);
      }
    }

    if (refs.outcomeId && refs.subStrandId) {
      const outcomes = this.getLearningOutcomes(refs.subStrandId);
      if (!outcomes.some(lo => lo.id === refs.outcomeId)) {
        errors.push(`Learning Outcome ${refs.outcomeId} does not belong to Sub-Strand ${refs.subStrandId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  getCoverageRegistry(): CurriculumCoverageRecord[] {
    return COVERAGE_REGISTRY;
  },

  getGenerationEligibility(gradeName: string, learningAreaName: string): { allowed: boolean; reason?: string } {
    const record = COVERAGE_REGISTRY.find(
      r => r.grade.toLowerCase() === gradeName.toLowerCase() &&
           r.learningArea.toLowerCase() === learningAreaName.toLowerCase()
    );
    if (record && !record.generationAllowed) {
      return {
        allowed: false,
        reason: record.actionRequired || 'Curriculum source verification is required before generation.',
      };
    }
    return { allowed: true };
  },

  getAuthorityStatus(gradeName: string, learningAreaName: string): CurriculumAuthorityStatus {
    const record = COVERAGE_REGISTRY.find(
      r => r.grade.toLowerCase() === gradeName.toLowerCase() &&
           r.learningArea.toLowerCase() === learningAreaName.toLowerCase()
    );
    return record ? record.authorityStatus : 'SOURCE_REQUIRED';
  },

  verifyDocumentIdentity(documentText: string, expectedGrade: 'Grade 6' | 'Grade 8'): { verified: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!documentText || documentText.trim() === '') {
      return { verified: false, errors: ['CURRICULUM SOURCE VERIFICATION FAILED: Empty or missing document text.'] };
    }

    const lower = documentText.toLowerCase();

    if (!lower.includes('kenya institute of curriculum development')) {
      errors.push('Missing issuing authority header: Kenya Institute of Curriculum Development');
    }

    if (expectedGrade === 'Grade 6') {
      if (!lower.includes('upper primary school curriculum design')) {
        errors.push('Missing expected header: Upper Primary School Curriculum Design');
      }
      if (!lower.includes('agriculture and nutrition')) {
        errors.push('Missing subject name: Agriculture and Nutrition');
      }
      if (!lower.includes('revised 2024')) {
        errors.push('Missing revision marker: Revised 2024');
      }
    } else if (expectedGrade === 'Grade 8') {
      if (!lower.includes('junior school curriculum design')) {
        errors.push('Missing expected header: Junior School Curriculum Design');
      }
      if (!lower.includes('integrated science')) {
        errors.push('Missing subject name: Integrated Science');
      }
      if (!documentText.includes('978-9914-52-947-0') && !lower.includes('revised 2024')) {
        errors.push('Missing expected ISBN (978-9914-52-947-0) or Revised 2024 revision year.');
      }
    }

    if (errors.length > 0) {
      return { verified: false, errors: ['CURRICULUM SOURCE VERIFICATION FAILED', ...errors] };
    }

    return { verified: true, errors: [] };
  },

  getMasterCurriculumSowNodes(
    grade: string,
    subject: string,
    terms: string[] = ['Term 1']
  ): CanonicalSowNode[] {
    const gradeObj = this.getGradeById(grade);
    const laObj = this.getLearningAreaById(subject);

    const requestedTerms = (!terms || terms.length === 0) ? ['Term 1'] : terms;
    const allNodes: CanonicalSowNode[] = [];

    const learningAreaId = laObj ? laObj.id : (subject.toLowerCase().includes('sci') ? 'la-sci' : subject.toLowerCase().includes('agric') ? 'la-agric' : 'la-math');
    const strands = this.getStrands(learningAreaId);

    if (strands.length === 0) {
        return this.getFallbackNodes(grade, subject, requestedTerms);
    }

    for (let termIdx = 0; termIdx < requestedTerms.length; termIdx++) {
      const term = requestedTerms[termIdx];
      const normalizedTerm = term.toLowerCase().replace(/\s+/g, '');

      // 1. Find matching sub-strands for this term
      const matchingSubStrandUnits: {
        strand: Strand;
        subStrand: SubStrand;
        outcomes: LearningOutcome[];
        allocation: number;
      }[] = [];

      for (const strand of strands) {
        const subs = this.getSubStrands(strand.id);
        for (const sub of subs) {
          let matches = false;
          if (sub.suggestedTerms && sub.suggestedTerms.length > 0) {
            matches = sub.suggestedTerms.some(st => {
              const normSt = st.toLowerCase().replace(/\s+/g, '');
              return normSt === normalizedTerm || normalizedTerm.includes(normSt) || normSt.includes(normalizedTerm);
            });
          } else {
            // Default to matching Term 1 if no suggestedTerms
            matches = normalizedTerm.includes('term1') || normalizedTerm.includes('1');
          }

          if (matches) {
            const outcomes = this.getLearningOutcomes(sub.id);
            const allocation = sub.suggestedLessonAllocation || 4;
            matchingSubStrandUnits.push({
              strand,
              subStrand: sub,
              outcomes,
              allocation,
            });
          }
        }
      }

      // Build sequential lesson slots queue preserving 100% canonical lesson allocations
      const termSlots: {
        strand: Strand;
        subStrand: SubStrand;
        outcomes: LearningOutcome[];
      }[] = [];

      matchingSubStrandUnits.forEach(u => {
        const count = u.allocation > 0 ? u.allocation : 4;
        for (let i = 0; i < count; i++) {
          termSlots.push({
            strand: u.strand,
            subStrand: u.subStrand,
            outcomes: u.outcomes,
          });
        }
      });

      // If no sub-strands matched for this term, fallback to distributing available strands
      if (termSlots.length === 0 && strands.length > 0) {
        const strand = strands[termIdx % strands.length];
        const subs = this.getSubStrands(strand.id);
        if (subs.length > 0) {
          subs.forEach(ss => {
            const allocation = ss.suggestedLessonAllocation || 4;
            const outcomes = this.getLearningOutcomes(ss.id);
            for (let i = 0; i < allocation; i++) {
              termSlots.push({
                strand,
                subStrand: ss,
                outcomes,
              });
            }
          });
        } else {
          // Synthetic canonical sub-strand from strand
          const defaultCount = 40;
          const synSub: SubStrand = {
            id: `${strand.id}-ss-1`,
            strandId: strand.id,
            code: `${strand.code}-1`,
            title: strand.title,
            suggestedTerms: [term],
            suggestedLessonAllocation: defaultCount,
            keyInquiryQuestions: [`How is ${strand.title} applied in daily situations?`]
          };
          for (let i = 0; i < defaultCount; i++) {
            termSlots.push({
              strand,
              subStrand: synSub,
              outcomes: [],
            });
          }
        }
      }

      // Generate canonical nodes for each slot in this term
      for (let sIdx = 0; sIdx < termSlots.length; sIdx++) {
        const slot = termSlots[sIdx];
        const canonicalLessonIndex = sIdx + 1;

        // Format outcomes text
        const knowledge = slot.outcomes.filter(o => o.taxonomyLevel === 'Knowledge').map(o => `- ${o.statement}`);
        const skills = slot.outcomes.filter(o => o.taxonomyLevel === 'Skills').map(o => `- ${o.statement}`);
        const attitudes = slot.outcomes.filter(o => o.taxonomyLevel === 'Attitudes').map(o => `- ${o.statement}`);

        const outcomeSections: string[] = [];
        if (knowledge.length > 0) outcomeSections.push(`**Knowledge:**\n${knowledge.join('\n')}`);
        if (skills.length > 0) outcomeSections.push(`**Skills:**\n${skills.join('\n')}`);
        if (attitudes.length > 0) outcomeSections.push(`**Attitudes:**\n${attitudes.join('\n')}`);

        if (outcomeSections.length === 0) {
          outcomeSections.push(`**Knowledge:**\n- Describe the key concepts in ${slot.subStrand.title}.\n**Skills:**\n- Apply practical skills in ${slot.subStrand.title}.\n**Attitudes:**\n- Appreciate the role of ${slot.subStrand.title} in everyday life.`);
        }

        const outcomesText = outcomeSections.join('\n\n');

        allNodes.push({
          week: 1, // Base index before school scheduling
          lesson: canonicalLessonIndex,
          term,
          strandId: slot.strand.id,
          strandCode: slot.strand.code,
          strandTitle: slot.strand.title,
          subStrandId: slot.subStrand.id,
          subStrandCode: slot.subStrand.code,
          subStrandTitle: slot.subStrand.title,
          learningOutcomeIds: slot.outcomes.map(o => o.id),
          learningOutcomesText: outcomesText,
          keyInquiryQuestions: slot.subStrand.keyInquiryQuestions || [`How is ${slot.subStrand.title} applied in daily life?`]
        });
      }
    }

    return allNodes;
  },

  getCanonicalLessonCount(
    grade: string,
    subject: string,
    terms: string[] = ['Term 1']
  ): number {
    return this.getMasterCurriculumSowNodes(grade, subject, terms).length;
  },

  resolveCanonicalSowNodes(
    grade: string,
    subject: string,
    terms: string[] = ['Term 1'],
    teachingConfig?: { teachingWeeksPerTerm: number; lessonsPerWeek: number }
  ): CanonicalSowNode[] {
    const masterNodes = this.getMasterCurriculumSowNodes(grade, subject, terms);
    const lessonsPerWeek = Math.max(1, teachingConfig?.lessonsPerWeek || 4);
    const requestedTerms = (!terms || terms.length === 0) ? ['Term 1'] : terms;
    const learningArea = this.getLearningAreaById(subject);
    const learningAreaId = learningArea
      ? learningArea.id
      : (subject.toLowerCase().includes('sci') ? 'la-sci' : subject.toLowerCase().includes('agric') ? 'la-agric' : 'la-math');
    const usesSourceFallback = this.getStrands(learningAreaId).length === 0;

    const scheduledNodes: CanonicalSowNode[] = [];
    let cumulativeWeekOffset = 0;

    for (let termIdx = 0; termIdx < requestedTerms.length; termIdx++) {
      const term = requestedTerms[termIdx];
      const normalizedTerm = term.toLowerCase().replace(/\s+/g, '');

      const termNodes = masterNodes.filter(n => {
        const normNodeTerm = n.term.toLowerCase().replace(/\s+/g, '');
        return normNodeTerm === normalizedTerm || normalizedTerm.includes(normNodeTerm) || normNodeTerm.includes(normalizedTerm);
      });

      const activeNodes = termNodes.length > 0 ? termNodes : masterNodes;

      if (usesSourceFallback) {
        // Fallback lesson breakdowns already carry source-authored week and lesson
        // numbers. Preserve them rather than silently re-scheduling the curriculum.
        activeNodes.forEach(slot => {
          scheduledNodes.push({ ...slot, term });
        });
        continue;
      }

      for (let sIdx = 0; sIdx < activeNodes.length; sIdx++) {
        const slot = activeNodes[sIdx];
        const weekNum = Math.floor(sIdx / lessonsPerWeek) + 1 + cumulativeWeekOffset;
        const lessonNum = (sIdx % lessonsPerWeek) + 1;

        scheduledNodes.push({
          ...slot,
          week: weekNum,
          lesson: lessonNum,
          term,
        });
      }

      cumulativeWeekOffset += Math.ceil(activeNodes.length / lessonsPerWeek);
    }

    return scheduledNodes;
  },

  getFallbackNodes(grade: string, subject: string, terms: string[]): CanonicalSowNode[] {
    const text = getCurriculumTextByTerm(grade, subject, terms);
    if (!text) return [];

    const nodes: CanonicalSowNode[] = [];
    const lines = text.split('\n');
    
    let currentTerm = 'Term 1';
    let currentWeek = 1;
    
    // Regex for --- Term X ---
    const termRegex = /-{3,}\s*TERM\s+([^-\n\r]+?)\s*-{3,}/i;
    // Regex for Week X
    const weekRegex = /(?:week|wk)\s*(\d+)/i;
    // Regex for Lesson X: Strand: Y, Sub-Strand: Z, Content: W
    const lessonRegex = /- Lesson (\d+): Strand: ([^,]+), Sub-Strand: ([^,]+), Content: (.+)/i;

    for (const line of lines) {
      const termMatch = line.match(termRegex);
      if (termMatch) {
          currentTerm = `Term ${termMatch[1].trim()}`;
          continue;
      }
      
      const weekMatch = line.match(weekRegex);
      if (weekMatch) {
          currentWeek = parseInt(weekMatch[1]);
          continue;
      }
      
      const lessonMatch = line.match(lessonRegex);
      if (lessonMatch) {
          const [_, lesson, strand, subStrand, content] = lessonMatch;
          const strandTitle = strand.trim();
          const subStrandTitle = subStrand.trim();
          
      nodes.push({
              week: currentWeek,
              lesson: parseInt(lesson),
              term: currentTerm,
              strandId: `fallback-${grade.replace(/\s+/g, '-')}-${subject.replace(/\s+/g, '-')}-${strandTitle.replace(/\s+/g, '-')}`,
              strandTitle: strandTitle,
              subStrandId: `fallback-${grade.replace(/\s+/g, '-')}-${subject.replace(/\s+/g, '-')}-${subStrandTitle.replace(/\s+/g, '-')}`,
              subStrandTitle: subStrandTitle,
              learningOutcomeIds: [],
              learningOutcomesText: content.trim(),
              keyInquiryQuestions: [`How does ${subStrandTitle} work?`]
          });
      }
    }
    return nodes;
  },

  validateSowEntries(entries: CanonicalSowNode[], expectedNodes: CanonicalSowNode[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!Array.isArray(entries)) {
      return { valid: false, errors: ['SOW entries must be an array'] };
    }

    // 1. Check for Truncated model output / missing fields
    entries.forEach((entry, idx) => {
      if (!entry.week || !entry.lesson || !entry.strandTitle || !entry.subStrandTitle || !entry.term) {
        errors.push(`Truncated model output at index ${idx}: missing required structural fields.`);
      }
    });

    // 2. Check for duplicate lessons (term-week-lesson pairs)
    const seen = new Map<string, number>();
    entries.forEach((entry, idx) => {
      const key = `${entry.term}-${entry.week}-${entry.lesson}`;
      if (seen.has(key)) {
        errors.push(`Duplicate lesson detected for Term ${entry.term}, Week ${entry.week}, Lesson ${entry.lesson}`);
      } else {
        seen.set(key, idx);
      }
    });

    // 3. Check for order (must be sorted by week then lesson)
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];
      if (curr.week < prev.week || (curr.week === prev.week && curr.lesson <= prev.lesson)) {
        errors.push(`Lessons out of order at index ${i}: Week ${curr.week} Lesson ${curr.lesson} follows Week ${prev.week} Lesson ${prev.lesson}`);
      }
    }

    // 4. Check against canonical reference nodes
    if (expectedNodes && expectedNodes.length > 0) {
      const expectedMap = new Map(expectedNodes.map(n => [`${n.term}-${n.week}-${n.lesson}`, n]));
      const entryMap = new Map(entries.map(n => [`${n.term}-${n.week}-${n.lesson}`, n]));

      // Check for missing lessons within chunk or missing chunks
      expectedNodes.forEach(exp => {
        const key = `${exp.term}-${exp.week}-${exp.lesson}`;
        if (!entryMap.has(key)) {
          errors.push(`Missing canonical lesson: Term ${exp.term}, Week ${exp.week}, Lesson ${exp.lesson}`);
        } else {
          const act = entryMap.get(key)!;
          if (act.strandTitle !== exp.strandTitle || act.subStrandTitle !== exp.subStrandTitle) {
            errors.push(`Altered or missing canonical curriculum node at Term ${exp.term}, Week ${exp.week}, Lesson ${exp.lesson}: expected '${exp.strandTitle} / ${exp.subStrandTitle}', got '${act.strandTitle} / ${act.subStrandTitle}'`);
          }
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  repairSowEntries(entries: CanonicalSowNode[], expectedNodes: CanonicalSowNode[]): CanonicalSowNode[] {
    if (expectedNodes && expectedNodes.length > 0) {
      const entryMap = new Map<string, CanonicalSowNode>();
      (entries || []).forEach(e => {
        const key = `${e.term}-${e.week}-${e.lesson}`;
        if (!entryMap.has(key)) {
          entryMap.set(key, e);
        }
      });

      return expectedNodes.map(exp => {
        const key = `${exp.term}-${exp.week}-${exp.lesson}`;
        const existing = entryMap.get(key);
        if (existing) {
          return {
            ...existing,
            term: exp.term,
            week: exp.week,
            lesson: exp.lesson,
            strandId: exp.strandId,
            strandCode: exp.strandCode,
            strandTitle: exp.strandTitle,
            subStrandId: exp.subStrandId,
            subStrandCode: exp.subStrandCode,
            subStrandTitle: exp.subStrandTitle,
            learningOutcomesText: existing.learningOutcomesText || exp.learningOutcomesText,
            keyInquiryQuestions: existing.keyInquiryQuestions?.length ? existing.keyInquiryQuestions : exp.keyInquiryQuestions
          };
        }
        return { ...exp };
      });
    }

    const uniqueMap = new Map<string, CanonicalSowNode>();
    (entries || []).forEach(e => {
      const key = `${e.term || 'Term 1'}-${e.week || 1}-${e.lesson || 1}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, e);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      if (a.term !== b.term) return (a.term || '').localeCompare(b.term || '');
      if (a.week !== b.week) return (a.week || 1) - (b.week || 1);
      return (a.lesson || 1) - (b.lesson || 1);
    });
  },

  validateLessonPlanAlignment(lessonPlan: {
    strand: string;
    subStrand: string;
    learningOutcomes: string;
    term?: string;
    week?: number;
    lessonNumber?: number;
  }, canonicalNode: CanonicalSowNode): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!lessonPlan || !canonicalNode) {
      return { valid: false, errors: ['Missing lesson plan or canonical node reference'] };
    }

    if (lessonPlan.strand !== canonicalNode.strandTitle) {
      errors.push(`Strand mismatch: expected '${canonicalNode.strandTitle}', got '${lessonPlan.strand}'`);
    }
    if (lessonPlan.subStrand !== canonicalNode.subStrandTitle) {
      errors.push(`Sub-Strand mismatch: expected '${canonicalNode.subStrandTitle}', got '${lessonPlan.subStrand}'`);
    }
    if (!lessonPlan.learningOutcomes || lessonPlan.learningOutcomes.trim() === '') {
      errors.push('Missing learning outcomes in lesson plan');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  validateContentIntegrityBeforeSaveOrExport(content: {
    entries?: CanonicalSowNode[];
    expectedNodes?: CanonicalSowNode[];
    lessonPlan?: any;
    canonicalNode?: CanonicalSowNode;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (content.entries && content.expectedNodes) {
      const res = this.validateSowEntries(content.entries, content.expectedNodes);
      if (!res.valid) errors.push(...res.errors);
    }
    if (content.lessonPlan && content.canonicalNode) {
      const res = this.validateLessonPlanAlignment(content.lessonPlan, content.canonicalNode);
      if (!res.valid) errors.push(...res.errors);
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
};
