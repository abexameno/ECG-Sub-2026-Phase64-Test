import { parseUploadedSowText } from './services/sowImportService';

describe('parseUploadedSowText', () => {
  it('extracts source metadata and table values without canonical substitutions', () => {
    const source = `SCHEME OF WORK\nGrade: 7\nSubject: Integrated Science\nTerm: 2\nAcademic Year: 2026\nWeek | Lesson | Strand | Sub-strand | Specific Learning Outcomes | Key Inquiry Questions | Learning Experiences | Resources | Assessment | Remarks\n1 | 1 | Mixtures | Separation | Learners separate mixtures | How can mixtures be separated? | Observe and classify | Beakers | Observation |`;
    const result = parseUploadedSowText(source);
    expect(result.metadata).toMatchObject({ grade: 'Grade 7', subject: 'Integrated Science', term: 'Term 2', academicYear: '2026' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ week: '1', lesson: '1', strand: 'Mixtures', subStrand: 'Separation', learningOutcomes: 'Learners separate mixtures' });
    expect(result.reviewRequired).toBe(true);
  });

  it('retains source text and warns instead of inventing rows when no table is detected', () => {
    const source = 'Grade 8 Integrated Science Term 1\nA narrative document without a detectable table.';
    const result = parseUploadedSowText(source);
    expect(result.entries).toHaveLength(0);
    expect(result.sourceText).toBe(source);
    expect(result.warnings.some(warning => warning.includes('no lesson rows were invented'))).toBe(true);
  });

  it('preserves missing source fields as empty values for human review', () => {
    const source = `Grade: 4\nSubject: English\nTerm: 1\nWeek | Lesson | Strand | Sub-strand\n2 | 3 | Reading |`;
    const result = parseUploadedSowText(source);
    expect(result.entries[0].subStrand).toBe('');
    expect(result.entries[0].learningOutcomes).toBe('');
    expect(result.warnings).toContain('The source table does not expose a Learning Outcomes column.');
  });

  it('joins wrapped multi-line column headings before identifying the source table', () => {
    const source = `Grade: 6\nSubject: English\nTerm: 1\n| Week | Lesson | Strand | Sub-strand | Specific Learning | Assessment |\n| | | | | Outcomes | |\n| 1 | 1 | Reading | Comprehension | Learners infer meaning | Oral questions |`;
    const result = parseUploadedSowText(source);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].learningOutcomes).toBe('Learners infer meaning');
    expect(result.detectedColumns).toContain('learningOutcomes');
  });

  it('appends wrapped lesson-cell continuation rows to the preceding source lesson', () => {
    const source = `Grade: 6\nSubject: English\nTerm: 1\n| Week | Lesson | Strand | Sub-strand | Specific Learning Outcomes | Assessment |\n| 1 | 1 | Reading | Comprehension | Learners identify the main idea | Oral questions |\n| | | | | and supporting details | Written exercise |\n| 1 | 2 | Reading | Vocabulary | Learners infer word meaning | Observation |`;
    const result = parseUploadedSowText(source);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].learningOutcomes).toBe('Learners identify the main idea and supporting details');
    expect(result.entries[0].assessment).toBe('Oral questions Written exercise');
    expect(result.entries[1].lesson).toBe('2');
  });
  it('retains OCR source-page references on extracted lesson rows', () => {
    const source = `Grade: 8\nSubject: English\nTerm: 2\n--- OCR Page 3 ---\nWeek | Lesson | Strand | Sub-strand | Specific Learning Outcomes | Assessment\n1 | 2 | Reading | Comprehension | Learners interpret a passage | Oral questions\n--- OCR Page 4 ---\n2 | 1 | Writing | Paragraphs | Learners organise ideas | Written task`;
    const result = parseUploadedSowText(source);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].sourcePage).toBe(3);
    expect(result.entries[1].sourcePage).toBe(4);
  });

  it('recognizes split PDF column labels found in the Grade 7 Mathematics source layout', () => {
    const source = `RATIONALISED SCHEMES OF WORK\nMATHEMATICS\nGRADE 7\nTERM 1 2026\n--- Page 2 ---\nWe ek\tLS N\tstrand\tSub-strand\tSpecific Learning Outcomes\tKey Inquiry Question(s)\tLearning Experiences\tLearning Resources\tAssessment Methods\tRef l\n1\t1\tNUMBERS\tWhole Numbers Place Value\tBy the end of the lesson the learner should be able to: Discuss the place value chart. Prepare a place value chart.\tWhy do we write numbers in words and/or symbols?\tThe learner is guided to identify and write place value of digits using place value apparatus.\tPlace value apparatus, Number charts, Number cards\tClass activities; Class written tests\t21-23`;
    const result = parseUploadedSowText(source);
    expect(result.metadata).toMatchObject({ grade: 'Grade 7', subject: 'MATHEMATICS', term: 'Term 1' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ week: '1', lesson: '1', strand: 'NUMBERS', subStrand: 'Whole Numbers Place Value' });
    expect(result.entries[0].sourcePage).toBe(2);
    expect(result.quality.lessonCount).toBe(1);
    expect(result.quality.status).toBe('review');
    expect(result.quality.score).toBeGreaterThan(0);
  });

  it('detects an academic year printed inline in a Term heading', () => {
    const source = `RATIONALISED SCHEMES OF WORK\nMATHEMATICS\nGRADE 7\nTERM 1 2026\nWeek | Lesson | Strand | Sub-strand | Specific Learning Outcomes\n1 | 1 | Numbers | Place Value | Learners identify place value`;
    const result = parseUploadedSowText(source);
    expect(result.metadata.academicYear).toBe('2026');
  });

  it('reports duplicate slots and missing source content without approving the import', () => {
    const source = `Grade: 5\nSubject: CRE\nTerm: 1\nWeek | Lesson | Strand | Sub-strand | Specific Learning Outcomes\n1 | 1 | Worship | Prayer | Learners participate\n1 | 1 | Worship | Prayer |`;
    const result = parseUploadedSowText(source);
    expect(result.quality.duplicateSlotCount).toBe(1);
    expect(result.quality.status).toBe('review');
    expect(result.reviewRequired).toBe(true);
    expect(result.quality.issues.some(issue => issue.includes('duplicate'))).toBe(true);
  });

  it('flags missing lesson numbers within the source-declared week without inventing them', () => {
    const source = `Grade: 7\nSubject: Mathematics\nTerm: 1\nWeek | Lesson | Strand | Sub-strand | Specific Learning Outcomes\n1 | 1 | Numbers | Place Value | Learners identify place value\n1 | 3 | Numbers | Total Value | Learners explain total value`;
    const result = parseUploadedSowText(source);
    expect(result.entries).toHaveLength(2);
    expect(result.quality.sequenceGapCount).toBe(1);
    expect(result.quality.sequenceGaps[0]).toContain('lesson 2 is absent');
    expect(result.quality.status).toBe('review');
  });

});
