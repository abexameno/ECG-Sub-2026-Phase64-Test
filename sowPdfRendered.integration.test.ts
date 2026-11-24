import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildPdfDocDefinition } from './services/pdfService.ts';
import { ContentType } from './types.ts';

const nodeRequire = createRequire(process.cwd() + '/sowPdfRendered.integration.test.ts');
const PdfPrinter = nodeRequire('pdfmake') as new (fonts: Record<string, any>) => {
  createPdfKitDocument: (definition: any) => any;
};
const pdfjs = nodeRequire('pdfjs-dist/legacy/build/pdf.js');

describe('Rendered Scheme of Work PDF integration', () => {

  it('normalizes mixed-type SOW cell values before PDF rendering', () => {
    const definition = buildPdfDocDefinition({
      id: 'sow-mixed-cell-values',
      title: 'Grade 7 Agriculture and Nutrition Scheme of Work',
      questions: [],
      metadata: {
        grade: 'Grade 7',
        subject: 'Agriculture and Nutrition',
        contentType: ContentType.SchemeOfWork,
        topic: 'Term 2',
      },
      schemeOfWorkData: {
        grade: 'Grade 7',
        subject: 'Agriculture and Nutrition',
        term: 'Term 2',
        entries: [{
          week: 7,
          lesson: 3,
          strand: { name: 'Cooking' },
          subStrand: ['Describing steaming as a method of cooking'],
          learningOutcomes: [{ text: 'Describe methods of cooking different types of foods.' }],
          inquiryQuestions: true,
          learningExperiences: ['Use steaming method to prepare foods.', 'Observe safety.'],
          learningResources: { content: 'Cooking equipment and foodstuff.' },
          assessment: 3,
          remarks: false,
        }],
      },
    } as any);

    const table = definition.content.find((item: any) =>
      item?.table?.body?.[0]?.some((cell: any) => cell?.text === 'Remarks')
    );
    expect(table).toBeDefined();
    expect(table.table.dontBreakRows).toBe(true);
    expect(table.table.body[1][0].text).toBe('7');
    expect(table.table.body[1][1].text).toBe('3');
    expect(table.table.body[1][2].text).toBe('Cooking');
    expect(table.table.body[1][3].text).toBe('Describing steaming as a method of cooking');
    expect(table.table.body[1][4].stack[0].text[0].text).toBe('Describe methods of cooking different types of foods.');
    expect(table.table.body[1][5].stack[0].text[0].text).toBe('Use steaming method to prepare foods.; Observe safety.');
    expect(table.table.body[1][6].stack[0].text[0].text).toBe('true');
    expect(table.table.body[1][7].stack[0].text[0].text).toBe('Cooking equipment and foodstuff.');
    expect(table.table.body[1][8].text).toBe('3');
    expect(table.table.body[1][9].text).toBe('false');
    const metadata = definition.content.find((item: any) =>
      Array.isArray(item?.text) && item.text.some((part: any) => part?.text === 'Grade: ')
    );
    expect(metadata).toBeDefined();
    const metadataText = metadata.text.map((part: any) => part?.text || '').join('');
    expect(metadataText).toContain('Grade: Grade 7');
    expect(metadataText).toContain('Subject: Agriculture and Nutrition');
    expect(metadataText).toContain('Term: Term 2');
    expect(definition.styles.sowTableHeader.fillColor).toBe('#54258A');
  });

  it('renders all supplied rows and rightmost-column content into a readable PDF', async () => {
    const entries = Array.from({ length: 65 }, (_, index) => ({
      week: String(Math.floor(index / 5) + 1),
      lesson: String((index % 5) + 1),
      strand: `Strand ${index + 1}`,
      subStrand: `Sub-strand ${index + 1}`,
      learningOutcomes: `Learning outcome ${index + 1} with a longer description to exercise wrapping in the PDF cell.`,
      inquiryQuestions: `Inquiry question ${index + 1}`,
      learningExperiences: `Learning experience ${index + 1}`,
      learningResources: `Resource ${index + 1}`,
      assessment: `Assessment ${index + 1}`,
      remarks: index === 64 ? 'FINAL RIGHTMOST COLUMN SENTINEL' : `Remark ${index + 1}`,
    }));

    const definition = buildPdfDocDefinition({
      id: 'sow-rendered-pdf-test',
      title: 'Grade 7 Mathematics Scheme of Work',
      questions: [],
      metadata: {
        grade: 'Grade 7',
        subject: 'Mathematics',
        contentType: ContentType.SchemeOfWork,
        topic: 'Term 1',
      },
      schemeOfWorkData: { grade: 'Grade 7', subject: 'Mathematics', term: 'Term 1', entries },
    } as any);

    // pdfmake 0.2.x ships Roboto as base64 entries in vfs_fonts.js rather than
    // as node_modules/pdfmake/fonts/Roboto/*.ttf files. Materialize only the
    // four required font files in an isolated temporary directory for PDFKit.
    const sowTable = definition.content.find((item: any) =>
      item.table?.body?.[0]?.some((cell: any) => cell?.text === 'Remarks')
    );
    expect(sowTable).toBeDefined();
    expect(sowTable.table.body[65][9].text).toBe('FINAL RIGHTMOST COLUMN SENTINEL');

    // A4 landscape is 841.89pt wide. Account for page margins and the
    // configured left/right cell padding before rendering the table.
    const printableWidth = 841.89 - 45 - 45;
    const horizontalCellPadding = sowTable.table.body[0].length * 6;
    const declaredTableWidth = sowTable.table.widths.reduce(
      (total: number, width: number) => total + width, 0
    );
    expect(declaredTableWidth + horizontalCellPadding).toBeLessThanOrEqual(printableWidth);

    const fontsPath = nodeRequire.resolve('pdfmake/build/vfs_fonts.js');
    const vfsModule = nodeRequire(fontsPath);
    const vfs = vfsModule.pdfMake?.vfs || vfsModule.vfs || vfsModule.default || vfsModule;
    expect(vfs).toBeDefined();

    const fontDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'exameno-sow-pdf-fonts-'));
    const fontNames = {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    };
    const fonts: Record<string, any> = { Roboto: {} };

    try {
      for (const [style, fileName] of Object.entries(fontNames)) {
        const encodedFont = vfs[fileName];
        if (typeof encodedFont !== 'string' || !encodedFont.length) {
          throw new Error(`PDFMAKE_FONT_MISSING: bundled virtual font "${fileName}" was not found.`);
        }
        const fontPath = path.join(fontDirectory, fileName);
        fs.writeFileSync(fontPath, Buffer.from(encodedFont, 'base64'));
        fonts.Roboto[style] = fontPath;
      }

      const printer = new PdfPrinter(fonts);
      const pdfBytes: Buffer = await new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const pdf = printer.createPdfKitDocument(definition);
        pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdf.on('end', () => resolve(Buffer.concat(chunks)));
        pdf.on('error', reject);
        pdf.end();
      });

      expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');

      // CI may retain this representative multi-page PDF for visual review.
      // Local test runs remain isolated and do not create repository artifacts.
      const pdfArtifactPath = process.env.SOW_PDF_ARTIFACT_PATH;
      if (pdfArtifactPath) {
        fs.mkdirSync(path.dirname(pdfArtifactPath), { recursive: true });
        fs.writeFileSync(pdfArtifactPath, pdfBytes);
      }
      const parsed = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
      expect(parsed.numPages).toBeGreaterThan(1);
      const allText: string[] = [];
      for (let pageNumber = 1; pageNumber <= parsed.numPages; pageNumber += 1) {
        const page = await parsed.getPage(pageNumber);
        const textContent = await page.getTextContent();
        allText.push(...textContent.items.map((item: any) => item.str));
      }
      const renderedText = allText.join(' ').replace(/\s+/g, ' ').trim();
      expect(renderedText).toContain('Specific Learning Outcomes');
      // PDF text extraction may split wrapped cell text across separate text
      // runs or lines. Compare the complete sentinel independent of spacing.
      const compactRenderedText = renderedText.replace(/\s+/g, '').toUpperCase();
      expect(compactRenderedText).toContain('FINALRIGHTMOSTCOLUMNSENTINEL');
      expect(renderedText).toContain('Learning outcome 65');
    } finally {
      fs.rmSync(fontDirectory, { recursive: true, force: true });
    }
  });
});
