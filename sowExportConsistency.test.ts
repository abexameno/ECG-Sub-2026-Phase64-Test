import { buildSowWorkbook, formatAsCsv } from './services/exportService.ts';
import { ContentType } from './types.ts';

const fixture: any = {
  id: 'sow-export-order-test',
  title: 'Grade 7 Agriculture and Nutrition Scheme of Work',
  questions: [],
  metadata: {
    grade: 'Grade 7',
    subject: 'Agriculture and Nutrition',
    contentType: ContentType.SchemeOfWork,
    term: 'Term 2',
  },
  schemeOfWorkData: {
    grade: 'Grade 7',
    subject: 'Agriculture and Nutrition',
    term: 'Term 2',
    entries: [{
      week: '1',
      lesson: '1',
      strand: 'Food Production Processes',
      subStrand: 'Gapping',
      learningOutcomes: 'Outcome text',
      learningExperiences: 'Experience sentinel',
      inquiryQuestions: 'Inquiry sentinel',
      learningResources: 'Resource text',
      assessment: 'Assessment text',
      remarks: '',
    }],
  },
};

const expectedHeaders = [
  'Week',
  'Lesson',
  'Strand',
  'Sub-Strand',
  'Specific Learning Outcomes',
  'Learning Experiences',
  'Key Inquiry Questions',
  'Learning Resources',
  'Assessment Methods',
  'Remarks',
];

describe('SOW export consistency', () => {
  it('exports CSV columns in the approved PDF order and keeps experiences before inquiry questions', async () => {
    const csv = await formatAsCsv(fixture);
    expect(csv.split('\n')[0]).toBe(expectedHeaders.join(','));
    expect(csv).toContain('"Outcome text","Experience sentinel","Inquiry sentinel","Resource text"');
  });

  it('exports Excel columns in the approved PDF order without invented school or teacher metadata', () => {
    const workbookApi = {
      utils: {
        book_new: () => ({ SheetNames: [], Sheets: {} }),
        aoa_to_sheet: (rows: any[][]) => ({ rows }),
        book_append_sheet: (workbook: any, sheet: any, name: string) => {
          workbook.SheetNames.push(name);
          workbook.Sheets[name] = sheet;
        },
      },
    };

    const workbook = buildSowWorkbook(fixture, undefined, workbookApi);
    const rows = workbook.Sheets['Term 2'].rows;

    expect(rows[6]).toEqual(expectedHeaders);
    expect(rows[7].slice(4, 8)).toEqual([
      'Outcome text',
      'Experience sentinel',
      'Inquiry sentinel',
      'Resource text',
    ]);
    expect(rows[3][1]).toBe('');
    expect(rows[4][1]).toBe('');
    expect(rows[4][5]).toBe('');
  });
});
