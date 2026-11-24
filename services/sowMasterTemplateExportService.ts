import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import type { GeneratedContent, ExportHeaderInfo, SchemeOfWorkEntry } from '../types.ts';

export const SOW_TEMPLATE_HEADERS = [
  'Week', 'Lesson', 'Strand', 'Sub-strand', 'Specific Learning Outcomes',
  'Learning Experiences', 'Key Inquiry Questions', 'Learning Resources',
  'Assessment Methods', 'Remarks'
] as const;

export interface SowTemplatePayload {
  grade: string;
  subject: string;
  term: string;
  year: string;
  teacher: string;
  tscSchool: string;
  rows: string[][];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    if ('text' in item) return text(item.text);
    if ('content' in item) return text(item.content);
    return Object.values(item).map(text).filter(Boolean).join('; ');
  }
  return String(value).trim();
}

function first(...values: unknown[]): unknown {
  return values.find(value => value !== undefined && value !== null && value !== '') ?? '';
}

export function buildSowTemplatePayload(content: GeneratedContent, headerInfo?: ExportHeaderInfo): SowTemplatePayload {
  const sow = content.schemeOfWorkData;
  if (!sow || !Array.isArray(sow.entries)) throw new Error('SOW_TEMPLATE_EXPORT_REQUIRES_ENTRIES');
  if (sow.entries.length === 0) throw new Error('SOW_TEMPLATE_EXPORT_EMPTY');
  const grade = text(first(headerInfo?.gradeLevel, sow.grade, content.metadata?.grade));
  const subject = text(first(headerInfo?.subject, sow.subject, content.metadata?.subject));
  const term = text(first(headerInfo?.term, sow.term, content.metadata?.term));
  const year = text(first(headerInfo?.academicYear, (content.metadata as any)?.academicYear, new Date().getFullYear()));
  const teacher = text(first(headerInfo?.teacherName, sow.teacher));
  const school = text(first(headerInfo?.schoolName, (content as any).schoolName));
  const tscSchool = [text(headerInfo?.tscNumber), school].filter(Boolean).join(' / ');
  const rows = sow.entries.map((entry: SchemeOfWorkEntry) => [
    text(entry.week),
    text(entry.lesson),
    text(first(entry.strand, (entry as any).strandTitle)),
    text(first(entry.subStrand, (entry as any).subStrandTitle)),
    text(first(entry.learningOutcomes, (entry as any).specificLearningOutcomes, (entry as any).learningOutcomesText)),
    text(first(entry.learningExperiences, (entry as any).content, (entry as any).learningExperience)),
    text(first(entry.inquiryQuestions, (entry as any).keyInquiryQuestions)),
    text(first(entry.learningResources, (entry as any).resources)),
    text(first(entry.assessment, (entry as any).assessmentMethods)),
    text(entry.remarks)
  ]);
  if (rows.some(row => row.length !== SOW_TEMPLATE_HEADERS.length)) {
    throw new Error('SOW_TEMPLATE_EXPORT_COLUMN_COUNT_MISMATCH');
  }
  return { grade, subject, term, year, teacher, tscSchool, rows };
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function setCellText(cell: string, value: string): string {
  const escaped = xmlEscape(value || ' ');
  if (/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/.test(cell)) {
    let replaced = false;
    return cell.replace(/<w:t(\s[^>]*)?>[\s\S]*?<\/w:t>/g, (_match, attrs = '') => {
      if (replaced) return '';
      replaced = true;
      const safeAttrs = String(attrs).replace(/\\s+xml:space=(["']).*?\\1/g, '');
      return `<w:t${safeAttrs} xml:space="preserve">${escaped}</w:t>`;
    });
  }
  return cell.replace(/<w:p(\s[^>]*)?>/, match => match)
    .replace('</w:p>', `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`);
}

function replaceRowCells(row: string, values: Array<string | null>): string {
  let cellIndex = 0;
  return row.replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, cell => {
    const value = values[cellIndex++];
    return value === null || value === undefined ? cell : setCellText(cell, value);
  });
}

function repeatHeader(row: string): string {
  if (/<w:tblHeader\b/.test(row)) return row;
  if (/<w:trPr\b[^>]*>/.test(row)) return row.replace(/<w:trPr\b[^>]*>/, match => match + '<w:tblHeader w:val="true"/>');
  return row.replace('<w:tr>', '<w:tr><w:trPr><w:tblHeader w:val="true"/></w:trPr>');
}

function keepRowTogether(row: string): string {
  if (/<w:cantSplit\b/.test(row)) return row;
  if (/<w:trPr\b[^>]*>/.test(row)) return row.replace(/<w:trPr\b[^>]*>/, match => match + '<w:cantSplit/>');
  return row.replace('<w:tr>', '<w:tr><w:trPr><w:cantSplit/></w:trPr>');
}

export function populateSowTemplateDocumentXml(documentXml: string, payload: SowTemplatePayload): string {
  const tables = [...documentXml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)];
  if (tables.length < 2) throw new Error('SOW_TEMPLATE_STRUCTURE_INVALID: expected metadata and lesson tables');
  let xml = documentXml;
  const metadataTable = tables[0][0];
  const metadataRows = [...metadataTable.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(match => match[0]);
  if (metadataRows.length < 3) throw new Error('SOW_TEMPLATE_METADATA_TABLE_INVALID');
  const metadataValues = [
    [null, payload.grade, null, payload.subject],
    [null, payload.term, null, payload.year],
    [null, payload.teacher, null, payload.tscSchool]
  ];
  let updatedMetadata = metadataTable;
  metadataRows.slice(0, 3).forEach((row, index) => {
    updatedMetadata = updatedMetadata.replace(row, replaceRowCells(row, metadataValues[index]));
  });
  xml = xml.replace(metadataTable, updatedMetadata);

  const lessonTableMatch = [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)][1];
  const lessonTable = lessonTableMatch?.[0];
  if (!lessonTable) throw new Error('SOW_TEMPLATE_LESSON_TABLE_MISSING');
  const lessonRows = [...lessonTable.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(match => match[0]);
  if (lessonRows.length < 2) throw new Error('SOW_TEMPLATE_LESSON_ROWS_MISSING');
  const headerRow = repeatHeader(lessonRows[0]);
  const prototypeRows = lessonRows.slice(1, 3);
  const populatedRows = payload.rows.map((values, index) => {
    const prototypeRow = prototypeRows[index % prototypeRows.length] || lessonRows[1];
    return keepRowTogether(replaceRowCells(prototypeRow, values));
  });
  const rebuiltTable = lessonTable.replace(/(<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>)[\s\S]*?(?=<\/w:tbl>)/, headerRow + populatedRows.join(''));
  xml = xml.replace(lessonTable, rebuiltTable);

  // Completed exports omit all reusable QA/instruction pages from the blank master.
  const qaMarker = 'MASTER TEMPLATE — COMPLETION AND QUALITY STANDARD';
  const qaIndex = xml.indexOf(qaMarker);
  if (qaIndex >= 0) {
    const sectionStart = xml.indexOf('<w:sectPr', qaIndex);
    if (sectionStart < 0) throw new Error('SOW_TEMPLATE_QA_SECTION_BOUNDARY_INVALID');
    // The master template deliberately starts its QA-only page with a page-break
    // paragraph. Cut from that exact paragraph so the completed SOW retains page 1.
    const precedingMarkup = xml.slice(0, qaIndex);
    const pageBreakMatches = [...precedingMarkup.matchAll(/<w:p(?:\s[^>]*)?>(?:(?!<\/w:p>)[\s\S])*?<w:br[^>]*w:type=["']page["'][^>]*>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g)];
    const pageBreak = pageBreakMatches[pageBreakMatches.length - 1];
    const qaParagraphStart = Math.max(xml.lastIndexOf('<w:p>', qaIndex), xml.lastIndexOf('<w:p ', qaIndex));
    const cutStart = pageBreak ? pageBreak.index! : qaParagraphStart;
    if (cutStart < 0 || cutStart >= sectionStart) throw new Error('SOW_TEMPLATE_QA_SECTION_BOUNDARY_INVALID');
    xml = xml.slice(0, cutStart) + xml.slice(sectionStart);
  }
  // The continuation note is an instruction for the blank master, not SOW content.
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?Continuation page — repeat the ten-column table header[\s\S]*?<\/w:p>/, '');
  const title = `${payload.grade} • ${payload.subject} • ${payload.term} • ${payload.year}`;
  xml = xml.replace('CBC / CBE CURRICULUM  •  EXAMENO MASTER TEMPLATE', xmlEscape(title));
  return xml;
}

export async function formatSowAsDocx(content: GeneratedContent, headerInfo?: ExportHeaderInfo): Promise<Blob> {
  const payload = buildSowTemplatePayload(content, headerInfo);
  const response = await fetch('/templates/Exameno_SOW_Master_Template_V2.docx', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`SOW_MASTER_TEMPLATE_UNAVAILABLE: HTTP ${response.status}`);
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const documentFile = archive['word/document.xml'];
  if (!documentFile) throw new Error('SOW_MASTER_TEMPLATE_DOCUMENT_XML_MISSING');
  archive['word/document.xml'] = strToU8(populateSowTemplateDocumentXml(strFromU8(documentFile), payload));
  const output = zipSync(archive, { level: 6 });
  const outputBuffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  return new Blob([outputBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
