import type { SchemeOfWorkData, SchemeOfWorkEntry } from '../types.ts';

export type SowImportField =
  | 'week' | 'lesson' | 'strand' | 'subStrand' | 'learningOutcomes'
  | 'inquiryQuestions' | 'learningExperiences' | 'learningResources'
  | 'assessment' | 'remarks';

export interface SowImportMetadata {
  grade?: string;
  subject?: string;
  term?: string;
  academicYear?: string;
  title?: string;
}

export interface SowExtractionQuality {
  /** Deterministic completeness indicator, not a measure of semantic correctness. */
  score: number;
  status: 'review' | 'insufficient';
  lessonCount: number;
  duplicateSlotCount: number;
  missingWeekCount: number;
  missingLessonCount: number;
  populatedFieldRatio: number;
  sourcePageCoverage: number;
  sequenceGapCount: number;
  sequenceGaps: string[];
  issues: string[];
}

export interface SowImportResult {
  metadata: SowImportMetadata;
  data: SchemeOfWorkData;
  entries: SchemeOfWorkEntry[];
  sourceText: string;
  warnings: string[];
  detectedColumns: SowImportField[];
  reviewRequired: true;
  quality: SowExtractionQuality;
}

const HEADER_ALIASES: Record<SowImportField, string[]> = {
  week: ['week', 'week no', 'week number', 'we ek', 'we ek no'],
  lesson: ['lesson', 'lesson no', 'lesson number', 'period', 'ls n', 'ls no', 'ls number'],
  strand: ['strand'],
  subStrand: ['sub strand', 'substrand', 'sub-strand', 'sub'],
  learningOutcomes: ['learning outcomes', 'specific learning outcomes', 'slo', 'learning outcome'],
  inquiryQuestions: ['key inquiry question', 'key inquiry questions', 'inquiry question', 'inquiry questions', 'key inquiry'],
  learningExperiences: ['learning experiences', 'suggested learning experiences', 'learning activities', 'activities'],
  learningResources: ['learning resources', 'resources', 'teaching learning resources', 'learning'],
  assessment: ['assessment', 'assessment methods', 'assessment method'],
  remarks: ['remarks', 'reflection', 'comments'],
};

const normalize = (value: string) => value.toLowerCase().replace(/[\r\n]+/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function detectMetadata(text: string): SowImportMetadata {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const joined = lines.slice(0, 35).join('\n');
  const capture = (pattern: RegExp) => joined.match(pattern)?.[1]?.trim();
  const grade = capture(/\b(?:grade|class)\s*[:\-]?\s*(\d{1,2})\b/i);
  const labelledSubject = capture(/\b(?:subject|learning area)\s*[:\-]?\s*([^\n|,;]+)/i);
  // Many school SOW cover pages print the learning area as a standalone heading
  // (for example MATHEMATICS) instead of using a "Subject:" label. Only inspect
  // the few lines immediately following an explicitly detected grade, and retain
  // the source heading verbatim rather than deriving a subject from curriculum data.
  const gradeLineIndex = grade ? lines.findIndex(line => new RegExp(`\\b(?:grade|class)\\s*[:\\-]?\\s*${grade}\\b`, 'i').test(line)) : -1;
  const adjacentSubject = !labelledSubject && gradeLineIndex >= 0
    ? [...lines.slice(Math.max(0, gradeLineIndex - 2), gradeLineIndex), ...lines.slice(gradeLineIndex + 1, gradeLineIndex + 4)].find(line =>
        /^[A-Z][A-Z0-9 &()'’/-]{2,45}$/.test(line) &&
        !/^(?:TERM|GRADE|CLASS|SCHEME|RATIONALISED|SCHEMES? OF WORK)\b/.test(line)
      )
    : undefined;
  const subject = labelledSubject || adjacentSubject;
  const term = capture(/\bterm\s*[:\-]?\s*(term\s*[1-3]|[1-3])\b/i);
  const labelledAcademicYear = capture(/\b(?:academic year|year)\s*[:\-]?\s*((?:20)?\d{2}(?:\s*[-/]\s*(?:20)?\d{2})?)\b/i);
  // Many school SOW cover headings state the year inline (for example, "TERM 1 2026")
  // without an Academic Year label. Preserve that explicit source value rather than
  // allowing downstream exports to substitute the current computer year.
  const termHeadingYear = joined.match(/\bterm\s*[1-3]\s+(20\d{2})\b/i)?.[1];
  const academicYear = labelledAcademicYear || termHeadingYear;
  const title = lines.find(line => /scheme\s+of\s+work/i.test(line));
  return {
    ...(grade ? { grade: `Grade ${grade}` } : {}),
    ...(subject ? { subject: subject.replace(/\s+/g, ' ').trim() } : {}),
    ...(term ? { term: /^\d$/.test(term) ? `Term ${term}` : term.replace(/\s+/g, ' ') } : {}),
    ...(academicYear ? { academicYear } : {}),
    ...(title ? { title } : {}),
  };
}

function splitTableLine(line: string): string[] | undefined {
  // Do not call trim() before splitting tab-delimited PDF rows: leading tabs
  // represent intentionally empty Week/Lesson/Strand cells on wrapped lines.
  const withoutTrailingSpaces = line.replace(/[ ]+$/g, '');
  if (withoutTrailingSpaces.includes('\t')) return withoutTrailingSpaces.split('\t').map(v => v.trim());
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes('|')) return trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map(v => v.trim());
  return undefined;
}

function detectHeader(rows: string[][]): { index: number; fields: (SowImportField | undefined)[]; consumedRows: number } | undefined {
  const identify = (cells: string[]) => cells.map(cell => {
    const normalized = normalize(cell);
    const exact = (Object.keys(HEADER_ALIASES) as SowImportField[]).find(field => HEADER_ALIASES[field].includes(normalized));
    if (exact) return exact;
    // PDF headers can be visually split across cells or fragments. These
    // constrained signatures are only used in the header-detection window.
    if (/^we(?:ek)?$/.test(normalized) || normalized === 'we ek') return 'week' as SowImportField;
    if (/^(?:ls|ls n)$/.test(normalized)) return 'lesson' as SowImportField;
    if (normalized.includes('sub') && normalized.includes('strand')) return 'subStrand' as SowImportField;
    if (normalized.includes('key') && normalized.includes('inquiry')) return 'inquiryQuestions' as SowImportField;
    if (normalized.includes('specific') && normalized.includes('outcomes')) return 'learningOutcomes' as SowImportField;
    if (normalized.includes('learning') && normalized.includes('experiences')) return 'learningExperiences' as SowImportField;
    if (normalized.includes('resources')) return 'learningResources' as SowImportField;
    if (normalized.includes('assessment')) return 'assessment' as SowImportField;
    return undefined;
  });

  for (let index = 0; index < Math.min(rows.length, 80); index++) {
    // Some school templates wrap a single heading across two physical lines while
    // retaining the same table columns. Try the original row and two-row merges.
    for (const depth of [2, 1]) {
      const windowRows = rows.slice(index, index + depth);
      if (windowRows.length !== depth) continue;
      const width = Math.max(...windowRows.map(row => row.length));
      const merged = Array.from({ length: width }, (_, column) =>
        windowRows.map(row => row[column] ?? '').filter(Boolean).join(' ')
      );
      const fields = identify(merged);
      const recognized = fields.filter(Boolean).length;
      if (recognized >= 4 && fields.includes('week') && fields.includes('lesson')) {
        return { index, fields, consumedRows: depth };
      }
    }
  }
  return undefined;
}

/**
 * Parses an uploaded SOW as its own source of truth. This is an extraction/review
 * helper only: it never consults canonical curriculum data or assigns missing values.
 */
export function parseUploadedSowText(sourceText: string, teacher = ''): SowImportResult {
  const text = sourceText.replace(/\u0000/g, '').trim();
  if (!text) throw new Error('The uploaded document contains no extractable text.');

  let currentSourcePage: number | undefined;
  const tableRows: Array<{ cells: string[]; sourcePage?: number }> = [];
  text.split(/\r?\n/).forEach(line => {
    const pageMarker = line.match(/^\s*---\s*(?:(?:OCR|Source)\s+)?Page\s+(\d+)\s*---\s*$/i);
    if (pageMarker) { currentSourcePage = Number(pageMarker[1]); return; }
    const cells = splitTableLine(line);
    if (cells) tableRows.push({ cells, sourcePage: currentSourcePage });
  });
  const header = detectHeader(tableRows.map(row => row.cells));
  const metadata = detectMetadata(text);
  const warnings: string[] = [];
  let entries: SchemeOfWorkEntry[] = [];
  let detectedColumns: SowImportField[] = [];

  if (!header) {
    warnings.push('A structured lesson table could not be identified. The source text has been retained for manual review; no lesson rows were invented.');
  } else {
    detectedColumns = header.fields.filter((field): field is SowImportField => Boolean(field));
    const rows = tableRows.slice(header.index + header.consumedRows);
    const fieldToEntryKey: Partial<Record<SowImportField, keyof SchemeOfWorkEntry>> = {
      strand: 'strand', subStrand: 'subStrand', learningOutcomes: 'learningOutcomes',
      inquiryQuestions: 'inquiryQuestions', learningExperiences: 'learningExperiences',
      learningResources: 'learningResources', assessment: 'assessment', remarks: 'remarks',
    };
    entries = [];
    rows.forEach(({ cells, sourcePage }, rowIndex) => {
      if (cells.every(cell => !cell.trim()) || /^[-: ]+$/.test(cells.join(''))) return;
      const record: Partial<Record<SowImportField, string>> = {};
      header.fields.forEach((field, columnIndex) => {
        if (field) record[field] = (cells[columnIndex] ?? '').trim();
      });
      // Repeated page headers are structural noise, not lesson content.
      if (normalize(record.week ?? '') === 'week' || normalize(record.lesson ?? '') === 'lesson') return;
      let week = record.week ?? '';
      const lesson = record.lesson ?? '';
      const isSourceSlot = (value: string) => /^(?:\d{1,2}|week\s*\d{1,2}|w\s*\d{1,2})$/i.test(value.trim());
      // School SOWs often vertically merge the Week cell across several lesson
      // rows. Carry forward only when the source has a numeric lesson slot and
      // the immediately preceding source lesson supplies the merged week value.
      if (!week && isSourceSlot(lesson) && entries.length && isSourceSlot(entries[entries.length - 1].week)) {
        week = entries[entries.length - 1].week;
        if (!warnings.includes('Blank Week cells were carried forward from the preceding source row to represent a merged Week cell.')) {
          warnings.push('Blank Week cells were carried forward from the preceding source row to represent a merged Week cell.');
        }
      }
      if (!isSourceSlot(week) || !isSourceSlot(lesson)) {
        // PDF text extraction can emit wrapped table lines with no week/lesson
        // identifiers. They belong to the preceding lesson, never to a new row.
        const previous = entries[entries.length - 1];
        if (previous) {
          header.fields.forEach((field, columnIndex) => {
            const key = field ? fieldToEntryKey[field] : undefined;
            const continuation = (cells[columnIndex] ?? '').trim();
            if (key && continuation) {
              const existing = String(previous[key] ?? '');
              (previous as any)[key] = [existing, continuation].filter(Boolean).join(' ');
            }
          });
        }
        return;
      }
      entries.push({
        id: `import-row-${rowIndex + 1}`,
        week,
        lesson,
        strand: record.strand ?? '',
        subStrand: record.subStrand ?? '',
        learningOutcomes: record.learningOutcomes ?? '',
        inquiryQuestions: record.inquiryQuestions ?? '',
        learningExperiences: record.learningExperiences ?? '',
        learningResources: record.learningResources ?? '',
        assessment: record.assessment ?? '',
        remarks: record.remarks ?? '',
        ...(sourcePage ? { sourcePage } : {}),
      });
    });
    if (!entries.length) warnings.push('A lesson table was detected, but no rows with source week or lesson values were extracted.');
    if (!detectedColumns.includes('strand')) warnings.push('The source table does not expose a Strand column.');
    if (!detectedColumns.includes('subStrand')) warnings.push('The source table does not expose a Sub-strand column.');
    if (!detectedColumns.includes('learningOutcomes')) warnings.push('The source table does not expose a Learning Outcomes column.');
    const seenSlots = new Set<string>();
    entries.forEach(entry => {
      const slot = `${normalize(entry.week)}::${normalize(entry.lesson)}`;
      if (seenSlots.has(slot)) warnings.push(`Duplicate source lesson slot detected: Week ${entry.week}, Lesson ${entry.lesson}.`);
      seenSlots.add(slot);
    });
  }

  for (const field of ['grade', 'subject', 'term'] as const) {
    if (!metadata[field]) warnings.push(`Could not automatically detect ${field}; enter it during review.`);
  }

  const data: SchemeOfWorkData = {
    grade: metadata.grade ?? '',
    subject: metadata.subject ?? '',
    term: metadata.term ?? '',
    teacher,
    entries,
  };

  const duplicateSlots = new Set<string>();
  const seen = new Set<string>();
  entries.forEach(entry => {
    const slot = `${normalize(entry.week)}::${normalize(entry.lesson)}`;
    if (seen.has(slot)) duplicateSlots.add(slot);
    seen.add(slot);
  });
  const missingWeekCount = entries.filter(entry => !String(entry.week ?? '').trim()).length;
  const missingLessonCount = entries.filter(entry => !String(entry.lesson ?? '').trim()).length;
  const contentFields: Array<keyof SchemeOfWorkEntry> = [
    'strand', 'subStrand', 'learningOutcomes', 'inquiryQuestions',
    'learningExperiences', 'learningResources', 'assessment', 'remarks',
  ];
  const populated = entries.reduce((total, entry) => total + contentFields.filter(field => String(entry[field] ?? '').trim()).length, 0);
  const populatedFieldRatio = entries.length ? populated / (entries.length * contentFields.length) : 0;
  const sourcePageCoverage = entries.length ? entries.filter(entry => Number.isInteger(entry.sourcePage) && Number(entry.sourcePage) > 0).length / entries.length : 0;
  const lessonsByWeek = new Map<string, number[]>();
  entries.forEach(entry => {
    const weekKey = normalize(entry.week);
    const lessonNumber = Number(String(entry.lesson).match(/\d+/)?.[0]);
    if (!weekKey || !Number.isFinite(lessonNumber)) return;
    const values = lessonsByWeek.get(weekKey) ?? [];
    values.push(lessonNumber);
    lessonsByWeek.set(weekKey, values);
  });
  const sequenceGaps: string[] = [];
  lessonsByWeek.forEach((values, weekKey) => {
    const unique = [...new Set(values)].sort((a, b) => a - b);
    for (let expected = unique[0]; expected < unique[unique.length - 1]; expected++) {
      if (!unique.includes(expected + 1)) sequenceGaps.push(`Week ${weekKey}: lesson ${expected + 1} is absent between observed lessons.`);
    }
  });
  const qualityIssues: string[] = [];
  if (!entries.length) qualityIssues.push('No lesson rows were extracted.');
  if (duplicateSlots.size) qualityIssues.push(`${duplicateSlots.size} duplicate week/lesson slot(s) require review.`);
  if (missingWeekCount || missingLessonCount) qualityIssues.push('Some extracted rows are missing week or lesson identifiers.');
  if (!metadata.grade || !metadata.subject || !metadata.term) qualityIssues.push('Grade, subject or term metadata is incomplete.');
  if (!detectedColumns.includes('learningOutcomes')) qualityIssues.push('Learning Outcomes column was not detected.');
  if (sequenceGaps.length) qualityIssues.push(`${sequenceGaps.length} possible lesson-sequence gap(s) were found within observed weeks; verify against the uploaded schedule.`);
  if (populatedFieldRatio < 0.80 && entries.length) qualityIssues.push('Some lesson content fields are empty; merged source cells or extraction gaps may require teacher review.');
  // This is a structural completeness score only. It must never be interpreted as
  // curriculum correctness or an automatic approval decision.
  const metadataRatio = (['grade', 'subject', 'term'] as const).filter(key => Boolean(metadata[key])).length / 3;
  const score = Math.round(100 * (
    (entries.length ? 0.25 : 0) +
    metadataRatio * 0.15 +
    (detectedColumns.length / 10) * 0.15 +
    populatedFieldRatio * 0.35 +
    (duplicateSlots.size === 0 && missingWeekCount === 0 && missingLessonCount === 0 && sequenceGaps.length === 0 ? 0.10 : 0)
  ));
  const quality: SowExtractionQuality = {
    score: Math.min(100, score),
    status: entries.length ? 'review' : 'insufficient',
    lessonCount: entries.length,
    duplicateSlotCount: duplicateSlots.size,
    missingWeekCount,
    missingLessonCount,
    populatedFieldRatio: Number(populatedFieldRatio.toFixed(3)),
    sourcePageCoverage: Number(sourcePageCoverage.toFixed(3)),
    sequenceGapCount: sequenceGaps.length,
    sequenceGaps,
    issues: qualityIssues,
  };

  return { metadata, data, entries, sourceText: text, warnings, detectedColumns, reviewRequired: true, quality };
}
