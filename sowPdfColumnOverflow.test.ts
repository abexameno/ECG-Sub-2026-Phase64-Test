import { buildPdfDocDefinition } from './services/pdfService.ts';
import { ContentType } from './types.ts';

describe('Scheme of Work PDF column overflow', () => {
  it('preserves all ten columns and supplied lesson rows', () => {
    const content = {
      id: 'sow-layout-test',
      title: 'Grade 7 Mathematics Scheme of Work',
      questions: [],
      metadata: {
        grade: 'Grade 7',
        subject: 'Mathematics',
        contentType: ContentType.SchemeOfWork,
        topic: 'Term 1',
      },
      schemeOfWorkData: {
        term: 'Term 1',
        entries: Array.from({ length: 26 }, (_, index) => ({
          week: String(Math.floor(index / 5) + 1),
          lesson: String((index % 5) + 1),
          strand: `Strand ${index + 1}`,
          subStrand: `Sub-strand ${index + 1}`,
          learningOutcomes: index === 0 ? 'Use C# examples and calculate 2*3 accurately.' : `Learning outcome ${index + 1}`,
          inquiryQuestions: `Inquiry question ${index + 1}`,
          learningExperiences: `Learning experience ${index + 1}`,
          learningResources: `Resource ${index + 1}`,
          assessment: `Assessment ${index + 1}`,
          remarks: index === 25 ? 'Final lesson completed.' : `Remark ${index + 1}`,
        })),
      },
    } as any;

    const doc = buildPdfDocDefinition(content);
    const table = doc.content.find(
      (item: any) =>
        item?.table?.body?.[0]?.length === 10
    );

    expect(doc.pageOrientation).toBe('landscape');
    expect(table).toBeDefined();
    expect(table.table.widths).toEqual([
      40, 40, 45, 50, 132, 122, 60, 60, 50, 86,
    ]);
    expect(
      table.table.widths.reduce(
        (total: number, width: number) => total + width,
        0
      )
    ).toBe(685);

    expect(table.table.body[0].map((cell: any) => cell.text)).toEqual([
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
    ]);

    expect(table.table.widths[0]).toBeGreaterThanOrEqual(32); // Week header must not split mid-word.
    expect(table.table.widths[1]).toBeGreaterThanOrEqual(32); // Lesson header must not split mid-word.
    expect(table.table.keepWithHeaderRows).toBe(1);
    expect(table.layout.paddingLeft()).toBe(3);
    expect(table.layout.paddingRight()).toBe(3);
    // Declared widths plus horizontal cell padding must fit inside the
    // 751.89pt landscape A4 content width (841.89pt page minus 90pt margins).
    const effectiveWidth =
      table.table.widths.reduce((total: number, width: number) => total + width, 0) +
      table.table.widths.length * (table.layout.paddingLeft() + table.layout.paddingRight());
    expect(effectiveWidth).toBeLessThanOrEqual(752);

    expect(table.table.body).toHaveLength(27); // Header plus all 26 lessons across six weeks.
    expect(table.table.body.slice(1)).toHaveLength(26);
    expect(table.table.body[1]).toHaveLength(10);
    expect(table.table.body[1][0].text).toBe('1');
    expect(table.table.body[1][1].text).toBe('1');
    expect(table.table.body[1][2].text).toBe('Strand 1');
    expect(table.table.body[1][4].stack[0].text[0].text).toContain('C# examples and calculate 2*3');
    expect(table.table.body[26][0].text).toBe('6');
    expect(table.table.body[26][1].text).toBe('1');
    expect(table.table.body[26][2].text).toBe('Strand 26');
    expect(table.table.body[26][9].text).toBe('Final lesson completed.');
  });
});
