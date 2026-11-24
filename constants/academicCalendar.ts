/**
 * Default Academic Term Calendar Configuration for Kenya ECG Platform.
 * Note: These term boundary dates represent standard default application configuration
 * values requiring school leadership confirmation for local academic calendar adjustments.
 */

export interface AcademicTermConfig {
  id: 'term_1' | 'term_2' | 'term_3';
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  year: number;
}

export const ACADEMIC_TERMS_2026: AcademicTermConfig[] = [
  {
    id: 'term_1',
    name: 'Term 1 (2026)',
    startDate: '2026-01-06',
    endDate: '2026-04-10',
    year: 2026
  },
  {
    id: 'term_2',
    name: 'Term 2 (2026)',
    startDate: '2026-05-04',
    endDate: '2026-08-07',
    year: 2026
  },
  {
    id: 'term_3',
    name: 'Term 3 (2026)',
    startDate: '2026-08-31',
    endDate: '2026-11-20',
    year: 2026
  }
];

export function getTermById(termId: string): AcademicTermConfig | undefined {
  return ACADEMIC_TERMS_2026.find(t => t.id === termId);
}
