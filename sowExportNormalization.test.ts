import { buildSowWorkbook, cleanText, formatAsCsv } from './services/exportService.ts';

describe('SOW export value normalization', () => {
  it('normalizes primitive, array, object, null, and circular values safely', () => {
    expect(cleanText(' **Learning** #Outcome_1 ')).toBe('Learning #Outcome_1');
    expect(cleanText('### Heading with **bold**, _italic_, and ~~removed~~ markers')).toBe('Heading with bold, italic, and removed markers');
    expect(cleanText('C# uses 2*3 and foo_bar as literal content')).toBe('C# uses 2*3 and foo_bar as literal content');
    expect(cleanText(['**Outcome A**', null, 0, false, { text: 'Outcome B' }])).toBe('Outcome A; 0; false; Outcome B');
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(0)).toBe('0');
    expect(cleanText(false)).toBe('false');
    expect(cleanText({ label: 'Strand A', count: 3 })).toBe('Strand A; 3');

    const circular: any = { label: 'Circular-safe' };
    circular.self = circular;
    expect(cleanText(circular)).toBe('Circular-safe');
  });

  const makeSowContent = () => ({
    id: 'sow-export-normalization',
    title: 'Grade 7 Social Studies Scheme of Work',
    metadata: { grade: 'Grade 7', subject: 'Social Studies', contentType: 'SchemeOfWork' },
    schemeOfWorkData: {
      grade: 'Grade 7',
      subject: 'Social Studies',
      term: 'Term 1',
      entries: [{
        week: 0,
        lesson: false,
        strand: { text: '**Environment**' },
        subStrand: ['Africa', 2],
        learningOutcomes: ['**Identify Africa**', 0, false],
        inquiryQuestions: null,
        keyInquiryQuestions: ['How is Africa located?'],
        learningExperiences: { text: '**Use maps**' },
        learningResources: ['Atlas', 'Globe'],
        assessment: null,
        assessmentMethods: 5,
        remarks: false
      }]
    }
  } as any);

  it('preserves values and aliases in CSV export', async () => {
    const csv = await formatAsCsv(makeSowContent());
    expect(csv).toContain('"0","false","Environment","Africa; 2","Identify Africa; 0; false","Use maps","How is Africa located?","Atlas; Globe","5","false"');
  });

  it('preserves the same normalized SOW values in the Excel workbook rows', () => {
    const mockXlsx = {
      utils: {
        book_new: () => ({ SheetNames: [] as string[], Sheets: {} as Record<string, any> }),
        aoa_to_sheet: (rows: any[][]) => ({ rows }),
        book_append_sheet: (workbook: any, sheet: any, name: string) => {
          workbook.SheetNames.push(name);
          workbook.Sheets[name] = sheet;
        }
      }
    };
    const workbook = buildSowWorkbook(makeSowContent(), undefined, mockXlsx as any);
    const worksheet = workbook.Sheets['Term 1'];
    expect(worksheet.rows[7]).toEqual([
      '0',
      'false',
      'Environment',
      'Africa; 2',
      'Identify Africa; 0; false',
      'Use maps',
      'How is Africa located?',
      'Atlas; Globe',
      '5',
      'false'
    ]);
  });
});
