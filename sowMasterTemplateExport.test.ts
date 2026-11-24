import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { buildSowTemplatePayload, populateSowTemplateDocumentXml, SOW_TEMPLATE_HEADERS } from './services/sowMasterTemplateExportService.ts';
import { ContentType } from './types.ts';

const source = {
  title: 'Grade 7 Mathematics Scheme of Work',
  metadata: { grade: 'Grade 7', subject: 'Mathematics', contentType: ContentType.SchemeOfWork, term: 'Term 1', academicYear: 2026 },
  schemeOfWorkData: {
    grade: 'Grade 7', subject: 'Mathematics', term: 'Term 1', teacher: 'A. Teacher',
    entries: [{
      id: 'lesson-1', week: '1', lesson: '1', strand: 'NUMBERS', subStrand: 'Whole Numbers',
      learningOutcomes: 'Read and write whole numbers', inquiryQuestions: 'How are numbers used?',
      learningExperiences: 'Learners explore C# and 2*3 examples', learningResources: 'Number cards',
      assessment: 'Oral questions', remarks: 'Reviewed'
    }]
  }
} as any;

describe('Exameno SOW master-template export', () => {
  it('maps metadata and all ten columns without dropping source lesson values', () => {
    const payload = buildSowTemplatePayload(source, { schoolName: 'Exameno School', teacherName: 'A. Teacher', tscNumber: 'TSC-123' } as any);
    expect(payload).toMatchObject({ grade: 'Grade 7', subject: 'Mathematics', term: 'Term 1', year: '2026', teacher: 'A. Teacher', tscSchool: 'TSC-123 / Exameno School' });
    expect(SOW_TEMPLATE_HEADERS).toHaveLength(10);
    expect(payload.rows[0]).toEqual(['1', '1', 'NUMBERS', 'Whole Numbers', 'Read and write whole numbers', 'Learners explore C# and 2*3 examples', 'How are numbers used?', 'Number cards', 'Oral questions', 'Reviewed']);
  });

  it('populates the uploaded template tables and excludes the reusable quality-standard page', () => {
    const payload = buildSowTemplatePayload(source);
    const cell = (value = '') => `<w:tc><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`;
    const row = (values: string[]) => `<w:tr>${values.map(cell).join('')}</w:tr>`;
    const metadata = `<w:tbl>${row(['Grade:', '___', 'Subject:', '___'])}${row(['Term:', '___', 'Year:', '___'])}${row(['Teacher:', '___', 'TSC / School:', '___'])}</w:tbl>`;
    const lesson = `<w:tbl>${row([...SOW_TEMPLATE_HEADERS])}${row(Array(10).fill(''))}${row(Array(10).fill(''))}</w:tbl>`;
    const xml = `<w:document><w:body><w:p><w:t>SCHEME OF WORK</w:t></w:p><w:p><w:t>CBC / CBE CURRICULUM  •  EXAMENO MASTER TEMPLATE</w:t></w:p>${metadata}${lesson}<w:p><w:t>Continuation page — repeat the ten-column table header and continue the original week / lesson sequence.</w:t></w:p><w:p><w:t>MASTER TEMPLATE — COMPLETION AND QUALITY STANDARD</w:t></w:p><w:p><w:t>QA ONLY</w:t></w:p><w:sectPr/></w:body></w:document>`;
    const result = populateSowTemplateDocumentXml(xml, payload);
    expect(result).toContain('Grade 7');
    expect(result).toContain('Mathematics');
    expect(result).toContain('Learners explore C# and 2*3 examples');
    expect(result).not.toContain('MASTER TEMPLATE — COMPLETION AND QUALITY STANDARD');
    expect(result).not.toContain('QA ONLY');
    expect(result).not.toContain('Continuation page');
    expect((result.match(/<w:tr>/g) || []).length).toBe(5);
    expect(result).toContain('<w:tblHeader w:val="true"/>');
  });
  it('uses the checked-in master DOCX itself and removes its template-only page break and QA section', () => {
    const templatePath = path.join(process.cwd(), 'public/templates/Exameno_SOW_Master_Template_V2.docx');
    const archive = unzipSync(new Uint8Array(fs.readFileSync(templatePath)));
    const sourceXml = strFromU8(archive['word/document.xml']);
    const payload = buildSowTemplatePayload(source);
    const result = populateSowTemplateDocumentXml(sourceXml, payload);
    expect(result).toContain('Grade 7');
    expect(result).toContain('Mathematics');
    expect(result).not.toContain('MASTER TEMPLATE — COMPLETION AND QUALITY STANDARD');
    expect(result).not.toContain('Continuation page');
    expect(result).not.toContain('<w:br w:type="page"/>');
    expect((result.match(/<w:tr(?:\\s[^>]*)?>/g) || []).length).toBe(payload.rows.length + 4);
  });

});
