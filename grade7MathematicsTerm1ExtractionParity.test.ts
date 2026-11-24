import { buildSowWorkbook, formatAsCsv } from './services/exportService.ts';

/**
 * Contract fixture for the user-confirmed Grade 7 Mathematics Term 1 2026
 * source schedule. It models the 58 teaching rows, two Week 8 half-term
 * markers, and Week 13 closing marker without embedding or modifying the
 * school's copyrighted source document.
 */
const teachingEntries = Array.from({ length: 58 }, (_, index) => ({
  week: String(index < 35 ? Math.floor(index / 5) + 1 : index < 38 ? 8 : 9 + Math.floor((index - 38) / 5)),
  lesson: String(index < 35 ? (index % 5) + 1 : index < 38 ? index - 34 : ((index - 38) % 5) + 1),
  strand: `Strand ${index + 1}`,
  subStrand: `Sub-strand ${index + 1}`,
  learningOutcomes: `SLO sentinel ${index + 1}`,
  learningExperiences: `Experience sentinel ${index + 1}`,
  inquiryQuestions: `Inquiry sentinel ${index + 1}`,
  learningResources: `Resource sentinel ${index + 1}`,
  assessment: `Assessment sentinel ${index + 1}`,
  remarks: `Remark sentinel ${index + 1}`,
}));

const scheduleEntries = [
  ...teachingEntries.slice(0, 38),
  { week: '8', lesson: '4', strand: '', subStrand: 'Half Term', learningOutcomes: '', learningExperiences: '', inquiryQuestions: '', learningResources: '', assessment: '', remarks: 'Half Term' },
  { week: '8', lesson: '5', strand: '', subStrand: 'Half Term', learningOutcomes: '', learningExperiences: '', inquiryQuestions: '', learningResources: '', assessment: '', remarks: 'Half Term' },
  ...teachingEntries.slice(38),
  { week: '13', lesson: '', strand: '', subStrand: 'End Term Assessment/Closing', learningOutcomes: '', learningExperiences: '', inquiryQuestions: '', learningResources: '', assessment: '', remarks: 'End Term Assessment/Closing' },
];

const content: any = {
  id: 'grade-7-mathematics-term-1-2026-parity-contract',
  title: 'Grade 7 Mathematics Term 1 2026',
  metadata: { grade: 'Grade 7', subject: 'Mathematics', contentType: 'SchemeOfWork', term: 'Term 1' },
  schemeOfWorkData: { grade: 'Grade 7', subject: 'Mathematics', term: 'Term 1', entries: scheduleEntries },
};

const headers = [
  'Week', 'Lesson', 'Strand', 'Sub-Strand', 'Specific Learning Outcomes',
  'Learning Experiences', 'Key Inquiry Questions', 'Learning Resources',
  'Assessment Methods', 'Remarks',
];

const mockXlsx = {
  utils: {
    book_new: () => ({ SheetNames: [] as string[], Sheets: {} as Record<string, any> }),
    aoa_to_sheet: (rows: any[][]) => ({ rows }),
    book_append_sheet: (workbook: any, sheet: any, name: string) => {
      workbook.SheetNames.push(name);
      workbook.Sheets[name] = sheet;
    },
  },
};

describe('Grade 7 Mathematics Term 1 source-to-export parity contract', () => {
  it('retains 58 teaching entries, both half-term markers and Week 13 closing in CSV', async () => {
    const csv = await formatAsCsv(content);
    const rows = csv.trimEnd().split('\n');

    expect(rows[0]).toBe(headers.join(','));
    expect(rows).toHaveLength(scheduleEntries.length + 1);
    expect(rows.filter(row => row.includes('Experience sentinel')).length).toBe(58);
    expect(rows.filter(row => row.includes('Half Term')).length).toBe(2);
    expect(rows.some(row => row.includes('End Term Assessment/Closing'))).toBe(true);
    expect(rows.some(row => row.includes('SLO sentinel 58'))).toBe(true);
  });

  it('keeps the same row order and field values in XLSX as CSV', async () => {
    const csvRows = (await formatAsCsv(content)).trimEnd().split('\n');
    const workbook = buildSowWorkbook(content, undefined, mockXlsx as any);
    const xlsxRows = workbook.Sheets['Term 1'].rows.slice(7, 7 + scheduleEntries.length);

    expect(workbook.Sheets['Term 1'].rows[6]).toEqual(headers);
    expect(xlsxRows).toHaveLength(scheduleEntries.length);

    scheduleEntries.forEach((entry, index) => {
      const csvCells = csvRows[index + 1].match(/"((?:[^"]|"")*)"(?:,|$)/g) || [];
      const decodedCsv = csvCells.map(cell => cell.slice(1, cell.endsWith(',') ? -2 : -1).replace(/""/g, '"'));
      expect(xlsxRows[index]).toEqual(decodedCsv);
      expect(xlsxRows[index]).toHaveLength(10);
      expect(xlsxRows[index][5]).toBe(entry.learningExperiences || '');
    });
  });
});
