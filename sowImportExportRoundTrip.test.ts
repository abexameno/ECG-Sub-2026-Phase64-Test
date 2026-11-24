import { parseUploadedSowText } from './services/sowImportService';
import { buildSowWorkbook, formatAsCsv, generateFilename } from './services/exportService.ts';
import { buildPdfDocDefinition } from './services/pdfService.ts';
import { ContentType } from './types.ts';

const source = `RATIONALISED SCHEMES OF WORK
MATHEMATICS
GRADE 7
TERM 1 2025
--- Page 2 ---
Week | Lesson | Strand | Sub-strand | Specific Learning Outcomes | Key Inquiry Questions | Learning Experiences | Learning Resources | Assessment Methods | Remarks
1 | 1 | Numbers | Place Value | Learners identify place value | Why place value? | Use place value cards | Cards | Oral questions | Source remark`;

const xlsxMock = {
  utils: {
    book_new: () => ({ SheetNames: [] as string[], Sheets: {} as Record<string, any> }),
    aoa_to_sheet: (rows: any[][]) => ({ rows }),
    book_append_sheet: (workbook: any, sheet: any, name: string) => {
      workbook.SheetNames.push(name);
      workbook.Sheets[name] = sheet;
    },
  },
};

describe('Phase 64 — uploaded SOW import-to-export integrity', () => {
  const parsed = parseUploadedSowText(source);
  const content: any = {
    id: 'phase64-source-sow',
    title: 'Grade 7 - MATHEMATICS - Term 1',
    body: 'Imported source SOW',
    questions: [],
    schemeOfWorkData: { ...parsed.data, entries: parsed.entries },
    metadata: {
      grade: parsed.metadata.grade,
      subject: parsed.metadata.subject,
      term: parsed.metadata.term,
      academicYear: parsed.metadata.academicYear,
      contentType: ContentType.SchemeOfWork,
      sowAuthority: 'UPLOADED_SOURCE',
      sourceDocumentRef: 'users/test/sow-source-documents/original.pdf',
    },
  };

  it('preserves uploaded source metadata, lesson values, and page provenance through CSV export', async () => {
    expect(parsed.metadata).toMatchObject({ grade: 'Grade 7', subject: 'MATHEMATICS', term: 'Term 1', academicYear: '2025' });
    expect(parsed.entries[0]).toMatchObject({ week: '1', lesson: '1', strand: 'Numbers', sourcePage: 2 });
    const csv = await formatAsCsv(content);
    expect(csv).toContain('"1","1","Numbers","Place Value","Learners identify place value"');
    expect(csv).toContain('"Cards","Oral questions","Source remark"');
    // The export keeps the established ten-column SOW schema; page provenance remains on the source record.
    expect(csv.split('\n')[0].split(',')).toHaveLength(10);
  });

  it('uses the uploaded academic year and avoids a false KICD/TSC alignment claim in Excel', () => {
    const workbook = buildSowWorkbook(content, undefined, xlsxMock);
    const rows = workbook.Sheets['Term 1'].rows;
    expect(rows[1][0]).toBe('UPLOADED SOURCE SCHEME OF WORK — SOURCE CONTENT PRESERVED');
    expect(rows[4][7]).toBe('Term 1 / 2025');
    expect(rows[7]).toContain('Learners identify place value');
  });

  it('uses the uploaded academic year and source-authority notice in PDF export', () => {
    const definition = buildPdfDocDefinition(content);
    const header = definition.header(2, 2);
    const headerText = JSON.stringify(header);
    const contentText = JSON.stringify(definition.content);
    expect(headerText).toContain('Academic Year: 2025');
    expect(contentText).toContain('Uploaded school Scheme of Work');
    expect(contentText).toContain('no independent canonical curriculum validation is implied');
  });

  it('uses the uploaded academic year in the exported filename', () => {
    expect(generateFilename(content, 'xlsx')).toContain('2025.xlsx');
  });
});
