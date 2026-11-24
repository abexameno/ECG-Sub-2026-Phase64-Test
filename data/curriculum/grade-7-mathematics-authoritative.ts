/**
 * Source-verified Grade 7 Mathematics sub-strand allocations.
 *
 * Source: Kenya Institute of Curriculum Development (KICD),
 * Mathematics Grade 7 Curriculum Design, Revised 2024, "Summary of Strands
 * and Sub-Strands", printed page xii.
 * Official source: https://kicd.ac.ke/wp-content/uploads/2024/06/Mathematics-Grade-7-Design-Formated-April-2024.pdf
 *
 * IMPORTANT: KICD gives full-grade suggested lesson allocations, but this
 * summary does not assign each sub-strand to Term 1, Term 2, or Term 3.
 * Do not infer term assignments from this list. Generation remains blocked
 * until a source that establishes term-level sequencing is verified.
 */
export type Grade7MathematicsSubStrandAllocation = {
  code: string;
  strand: string;
  subStrand: string;
  suggestedLessons: number;
};

export const GRADE_7_MATHEMATICS_SOURCE = {
  authority: 'Kenya Institute of Curriculum Development',
  curriculumTitle: 'Mathematics Grade 7 Curriculum Design',
  revision: 'Revised 2024',
  sourcePage: 'xii',
  sourceUrl: 'https://kicd.ac.ke/wp-content/uploads/2024/06/Mathematics-Grade-7-Design-Formated-April-2024.pdf',
  authorityStatus: 'AUTHORITATIVE_FULL_GRADE_ALLOCATION_VERIFIED',
  termAllocationStatus: 'UNVERIFIED',
  expectedFullGradeLessonTotal: 150,
} as const;

export const GRADE_7_MATHEMATICS_SUBSTRAND_ALLOCATIONS: Grade7MathematicsSubStrandAllocation[] = [
  { code: '1.1', strand: 'Numbers', subStrand: 'Whole Numbers', suggestedLessons: 20 },
  { code: '1.2', strand: 'Numbers', subStrand: 'Factors', suggestedLessons: 7 },
  { code: '1.3', strand: 'Numbers', subStrand: 'Fractions', suggestedLessons: 9 },
  { code: '1.4', strand: 'Numbers', subStrand: 'Decimals', suggestedLessons: 6 },
  { code: '1.5', strand: 'Numbers', subStrand: 'Squares and Square Roots', suggestedLessons: 5 },
  { code: '2.1', strand: 'Algebra', subStrand: 'Algebraic Expressions', suggestedLessons: 5 },
  { code: '2.2', strand: 'Algebra', subStrand: 'Linear Equations', suggestedLessons: 6 },
  { code: '2.3', strand: 'Algebra', subStrand: 'Linear Inequalities', suggestedLessons: 8 },
  { code: '3.1', strand: 'Measurements', subStrand: 'Pythagorean Relationship', suggestedLessons: 4 },
  { code: '3.2', strand: 'Measurements', subStrand: 'Length', suggestedLessons: 6 },
  { code: '3.3', strand: 'Measurements', subStrand: 'Area', suggestedLessons: 8 },
  { code: '3.4', strand: 'Measurements', subStrand: 'Volume and Capacity', suggestedLessons: 8 },
  { code: '3.5', strand: 'Measurements', subStrand: 'Time, Distance, and Speed', suggestedLessons: 8 },
  { code: '3.6', strand: 'Measurements', subStrand: 'Temperature', suggestedLessons: 6 },
  { code: '3.7', strand: 'Measurements', subStrand: 'Money', suggestedLessons: 14 },
  { code: '4.1', strand: 'Geometry', subStrand: 'Angles', suggestedLessons: 8 },
  { code: '4.2', strand: 'Geometry', subStrand: 'Geometrical Constructions', suggestedLessons: 12 },
  { code: '5.1', strand: 'Data Handling and Probability', subStrand: 'Data Handling', suggestedLessons: 10 },
];
