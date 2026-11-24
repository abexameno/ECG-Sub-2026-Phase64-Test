import {
  buildSowWorkbook,
  buildRowcWorkbook,
  buildAssessmentWorkbook,
  buildGeneralWorkbook,
  formatAsExcel,
  sanitizeSheetName
} from './services/exportService';
import { GeneratedContent, ContentType, AssessmentExportType } from './types';

// Standalone XLSX utility mock mimicking SheetJS / XLSX.full.min.js
const mockXLSX = {
  utils: {
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    aoa_to_sheet: (data: (string | number)[][]) => {
      const ws: any = { _data: data };
      data.forEach((row, rIdx) => {
        row.forEach((cellVal, cIdx) => {
          const colLetter = String.fromCharCode(65 + cIdx);
          const cellRef = `${colLetter}${rIdx + 1}`;
          ws[cellRef] = { v: cellVal, t: typeof cellVal === 'number' ? 'n' : 's' };
        });
      });
      return ws;
    },
    book_append_sheet: (wb: any, ws: any, name: string) => {
      wb.SheetNames.push(name);
      wb.Sheets[name] = ws;
    },
    sheet_to_json: (ws: any, opts?: any) => {
      if (opts?.header === 1 && ws._data) {
        return ws._data;
      }
      return ws._data || [];
    }
  },
  write: (wb: any, opts: any) => new Uint8Array([80, 75, 3, 4]) // Mock zip / xlsx binary
};

describe('Phase 21.0: KICD/TSC-Aligned SOW & ROWC Excel Workbook Export Engine', () => {

  beforeAll(() => {
    // Attach to global window for browser/test compatibility
    (global as any).window = (global as any).window || {};
    (global as any).window.XLSX = mockXLSX;
  });

  // Sample Canonical SOW Data
  const sampleCanonicalSowEntries = [
    {
      id: 'sow-1',
      week: '1',
      lesson: '1',
      strand: 'Numbers',
      subStrand: 'Whole Numbers up to 10,000',
      learningOutcomes: 'By the end of the lesson, the learner should be able to identify place value of digits up to thousands.',
      inquiryQuestions: 'How does place value help us read large numbers?',
      learningExperiences: 'Learners work in groups with place value charts and counters to represent four-digit numbers.',
      learningResources: 'KICD Mathematics Learner Book Grade 4 pg 2-4, abacus, number cards.',
      assessment: 'Written exercise, oral questioning',
      remarks: 'Lesson delivered successfully; 85% demonstrated mastery of place value.'
    },
    {
      id: 'sow-2',
      week: '1',
      lesson: '2',
      strand: 'Numbers',
      subStrand: 'Whole Numbers up to 10,000',
      learningOutcomes: 'By the end of the lesson, the learner should be able to read and write numbers in words up to 10,000.',
      inquiryQuestions: 'Why is it important to write numbers in words accurately?',
      learningExperiences: 'Learners practice writing cheques and receipts in pairs.',
      learningResources: 'Sample bank deposit slips, flash cards, charts.',
      assessment: 'Observation, peer assessment',
      remarks: 'Target achieved; need extra support for learners with spelling difficulties.'
    }
  ];

  // Sample Multi-Term SOW Entries
  const sampleMultiTermSowEntries = [
    {
      ...sampleCanonicalSowEntries[0],
      id: 'sow-t1-1',
      term: 'Term 1'
    },
    {
      ...sampleCanonicalSowEntries[1],
      id: 'sow-t1-2',
      term: 'Term 1'
    },
    {
      id: 'sow-t2-1',
      week: '1',
      lesson: '1',
      term: 'Term 2',
      strand: 'Measurement',
      subStrand: 'Length and Perimeter',
      learningOutcomes: 'Estimate and measure lengths in metres and centimetres.',
      inquiryQuestions: 'Which tool is most suitable for measuring a classroom?',
      learningExperiences: 'Learners measure perimeter of school desks and classroom floor using tape measures.',
      learningResources: 'Metre rules, tape measures, strings.',
      assessment: 'Practical demonstration',
      remarks: 'Satisfactory participation.'
    },
    {
      id: 'sow-t3-1',
      week: '1',
      lesson: '1',
      term: 'Term 3',
      strand: 'Geometry',
      subStrand: '2D Shapes and Angles',
      learningOutcomes: 'Identify and construct acute, right, and obtuse angles.',
      inquiryQuestions: 'Where do we see angles in our daily environment?',
      learningExperiences: 'Learners fold paper and use clock hands to make different angles.',
      learningResources: 'Geoboards, paper cutouts, analogue clocks.',
      assessment: 'Portfolio task, quiz',
      remarks: 'High learner engagement.'
    }
  ];

  // Sample Canonical ROWC Data
  const sampleCanonicalRowcLessons = [
    {
      id: 'rowc-1',
      date: '2026-01-12',
      grade: 'Grade 4',
      subject: 'Mathematics',
      term: 'Term 1',
      strand: 'Numbers',
      subStrand: 'Whole Numbers',
      lessonTitle: 'Place Value up to 10,000',
      learningActivities: 'Learners grouped to model 4-digit numbers using abacus and number charts.',
      resources: 'Learner Book pg 2-4, abacus',
      assessment: 'Written exercise',
      remarks: 'Objectives achieved; all learners completed task.'
    },
    {
      id: 'rowc-2',
      date: '2026-01-13',
      grade: 'Grade 4',
      subject: 'Mathematics',
      term: 'Term 1',
      strand: 'Numbers',
      subStrand: 'Whole Numbers',
      lessonTitle: 'Writing Numbers in Words',
      learningActivities: 'Pair activity writing mock banking deposit slips.',
      resources: 'Deposit slips, flash cards',
      assessment: 'Peer assessment',
      remarks: 'Remedial session scheduled for 3 learners.'
    }
  ];

  describe('1. SOW Workbook Creation & Structure', () => {
    it('creates a professional SOW workbook with correct sheet and header block', () => {
      const content: GeneratedContent = {
        title: 'Grade 4 Mathematics Scheme of Work',
        schemeOfWorkData: {
          grade: 'Grade 4',
          subject: 'Mathematics',
          term: 'Term 1',
          teacher: 'Mr. J. Mwangi',
          entries: sampleCanonicalSowEntries
        },
        metadata: {
          grade: 'Grade 4',
          subject: 'Mathematics',
          topic: 'Numbers',
          contentType: ContentType.SchemeOfWork,
          term: 'Term 1'
        }
      };

      const headerInfo = {
        includeHeader: true,
        schoolName: 'Moi Forces Academy',
        teacherName: 'Mr. J. Mwangi',
        tscNumber: 'TSC/489201',
        gradeLevel: 'Grade 4',
        subject: 'Mathematics',
        term: 'Term 1',
        academicYear: '2026',
        fontFamily: 'Arial',
        layoutColumns: 'one' as const,
        spacing: 'normal' as const,
        tableStyle: 'lightHorizontalLines' as const,
        pageMargins: 'normal' as const,
        contentType: 'Scheme of Work'
      };

      const wb = buildSowWorkbook(content, headerInfo, mockXLSX);

      expect(wb.SheetNames).toContain('Term 1');
      const ws = wb.Sheets['Term 1'];
      expect(ws).toBeDefined();

      const sheetData = mockXLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

      // Row 1: Title
      expect(sheetData[0][0]).toContain('EXAMENO CBE CONTENT GENERATOR — SCHEME OF WORK');
      // Row 2: Subtitle
      expect(sheetData[1][0]).toContain('KICD/TSC-ALIGNED PROFESSIONAL WORKBOOK FORMAT');
      // Row 4: Metadata Row 1
      expect(sheetData[3][0]).toBe('School:');
      expect(sheetData[3][1]).toBe('Moi Forces Academy');
      expect(sheetData[3][4]).toBe('Grade / Level:');
      expect(sheetData[3][5]).toBe('Grade 4');
      // Row 5: Metadata Row 2
      expect(sheetData[4][0]).toBe('Teacher:');
      expect(sheetData[4][1]).toBe('Mr. J. Mwangi');
      expect(sheetData[4][4]).toBe('TSC Number:');
      expect(sheetData[4][5]).toBe('TSC/489201');
      expect(sheetData[4][6]).toBe('Term / Year:');
      expect(sheetData[4][7]).toBe('Term 1 / 2026');

      // Table Header row (Row 7, index 6)
      expect(sheetData[6]).toEqual([
        'Week',
        'Lesson',
        'Strand',
        'Sub-Strand',
        'Specific Learning Outcomes',
        'Learning Experiences',
        'Key Inquiry Questions',
        'Learning Resources',
        'Assessment Methods',
        'Remarks'
      ]);
    });
  });

  describe('2. Multi-Term SOW Workbook Organization', () => {
    it('creates separate sheets for Term 1, Term 2, and Term 3 when multi-term data is present', () => {
      const content: GeneratedContent = {
        title: 'Full Year Grade 4 Mathematics Scheme of Work',
        schemeOfWorkData: {
          grade: 'Grade 4',
          subject: 'Mathematics',
          teacher: 'Ms. A. Wanjiku',
          entries: sampleMultiTermSowEntries
        },
        metadata: {
          grade: 'Grade 4',
          subject: 'Mathematics',
          topic: 'Multi-Term',
          contentType: ContentType.SchemeOfWork,
          terms: ['Term 1', 'Term 2', 'Term 3']
        }
      };

      const wb = buildSowWorkbook(content, { schoolName: 'Nairobi Primary School' } as any, mockXLSX);

      expect(wb.SheetNames).toEqual(['Term 1', 'Term 2', 'Term 3']);
      expect(wb.SheetNames.length).toBe(3);

      // Verify Term 1 sheet has 2 entries
      const ws1 = wb.Sheets['Term 1'];
      const data1 = mockXLSX.utils.sheet_to_json(ws1, { header: 1 }) as string[][];
      expect(data1[7][4]).toContain('place value of digits up to thousands');
      expect(data1[8][4]).toContain('read and write numbers in words');

      // Verify Term 2 sheet has Measurement
      const ws2 = wb.Sheets['Term 2'];
      const data2 = mockXLSX.utils.sheet_to_json(ws2, { header: 1 }) as string[][];
      expect(data2[7][2]).toBe('Measurement');
      expect(data2[7][3]).toBe('Length and Perimeter');

      // Verify Term 3 sheet has Geometry
      const ws3 = wb.Sheets['Term 3'];
      const data3 = mockXLSX.utils.sheet_to_json(ws3, { header: 1 }) as string[][];
      expect(data3[7][2]).toBe('Geometry');
      expect(data3[7][3]).toBe('2D Shapes and Angles');
    });

    it('does NOT create sheets for terms absent from the dataset', () => {
      const partialEntries = [
        { ...sampleCanonicalSowEntries[0], term: 'Term 1' },
        { ...sampleCanonicalSowEntries[1], term: 'Term 1' }
      ];

      const content: GeneratedContent = {
        title: 'Term 1 Only Scheme of Work',
        schemeOfWorkData: {
          grade: 'Grade 5',
          subject: 'Science and Technology',
          entries: partialEntries
        }
      };

      const wb = buildSowWorkbook(content, undefined, mockXLSX);
      expect(wb.SheetNames).toEqual(['Term 1']);
      expect(wb.SheetNames).not.toContain('Term 2');
      expect(wb.SheetNames).not.toContain('Term 3');
    });
  });

  describe('3. Curriculum Data Integrity Verification', () => {
    it('verifies that substantive curriculum values are 100% identical between input and exported cells', () => {
      const content: GeneratedContent = {
        title: 'Integrity Check Scheme of Work',
        schemeOfWorkData: {
          grade: 'Grade 6',
          subject: 'Social Studies',
          term: 'Term 1',
          entries: sampleCanonicalSowEntries
        }
      };

      const wb = buildSowWorkbook(content, undefined, mockXLSX);
      const ws = wb.Sheets['Term 1'];
      const rows = mockXLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

      sampleCanonicalSowEntries.forEach((inputEntry, idx) => {
        const rowIdx = 7 + idx; // Data starts at index 7
        const exportedRow = rows[rowIdx];

        expect(exportedRow[0]).toBe(inputEntry.week);
        expect(exportedRow[1]).toBe(inputEntry.lesson);
        expect(exportedRow[2]).toBe(inputEntry.strand);
        expect(exportedRow[3]).toBe(inputEntry.subStrand);
        expect(exportedRow[4]).toBe(inputEntry.learningOutcomes);
        expect(exportedRow[5]).toBe(inputEntry.learningExperiences);
        expect(exportedRow[6]).toBe(inputEntry.inquiryQuestions);
        expect(exportedRow[7]).toBe(inputEntry.learningResources);
        expect(exportedRow[8]).toBe(inputEntry.assessment);
        expect(exportedRow[9]).toBe(inputEntry.remarks);
      });
    });
  });

  describe('4. ROWC Workbook Creation & Sign-Off Blocks', () => {
    it('creates a professional ROWC workbook with reflection and sign-off blocks', () => {
      const content: GeneratedContent = {
        title: 'Grade 4 Mathematics ROWC',
        rowcData: {
          weekRange: 'Week 1 - 2',
          reflection: 'Learners showed great enthusiasm during hands-on activities with physical abacus manipulatives.',
          lessons: sampleCanonicalRowcLessons
        },
        metadata: {
          grade: 'Grade 4',
          subject: 'Mathematics',
          topic: 'Numbers',
          contentType: ContentType.RecordOfWorkCovered,
          term: 'Term 1'
        }
      };

      const headerInfo = {
        includeHeader: true,
        schoolName: 'Alliance Primary School',
        teacherName: 'Mrs. E. Kariuki',
        gradeLevel: 'Grade 4',
        subject: 'Mathematics',
        term: 'Term 1',
        fontFamily: 'Arial',
        layoutColumns: 'one' as const,
        spacing: 'normal' as const,
        tableStyle: 'lightHorizontalLines' as const,
        pageMargins: 'normal' as const,
        contentType: 'Record of Work Covered'
      };

      const wb = buildRowcWorkbook(content, headerInfo, mockXLSX);

      expect(wb.SheetNames.length).toBeGreaterThan(0);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const sheetData = mockXLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

      expect(sheetData[0][0]).toContain('RECORD OF WORK COVERED');
      expect(sheetData[1][0]).toContain('KICD/TSC-ALIGNED PROFESSIONAL WORKBOOK FORMAT');
      expect(sheetData[3][1]).toBe('Alliance Primary School');
      expect(sheetData[4][1]).toBe('Mrs. E. Kariuki');

      // ROWC table header (Row 7, index 6)
      expect(sheetData[6]).toEqual([
        'Date / Wk',
        'Grade',
        'Subject',
        'Strand / Sub-Strand',
        'Lesson Title',
        'Learning Activities / Content Covered',
        'Learning Resources',
        'Assessment & Remarks'
      ]);

      // Verify Reflection
      const hasReflection = sheetData.some(r => r[0] && r[0].includes('TEACHER PEDAGOGICAL REFLECTION & NOTES'));
      expect(hasReflection).toBe(true);

      // Verify Sign-off
      const hasSignOff = sheetData.some(r => r[0] && r[0].includes('INSTITUTIONAL REVIEW & ADMINISTRATIVE SIGN-OFF'));
      const hasTeacherSig = sheetData.some(r => r[0] && r[0].includes('Teacher Signature:'));
      const hasHodSig = sheetData.some(r => r[0] && r[0].includes('HOD / Subject Head Signature:'));
      const hasStamp = sheetData.some(r => (r[4] && r[4].includes('Official School Stamp')) || (r[0] && r[0].includes('Official School Stamp')));

      expect(hasSignOff).toBe(true);
      expect(hasTeacherSig).toBe(true);
      expect(hasHodSig).toBe(true);
      expect(hasStamp).toBe(true);
    });
  });

  describe('5. Formatting, Sizing & Page Setup', () => {
    it('configures column widths, row heights, merges, autofilter, and landscape A4 page setup', () => {
      const content: GeneratedContent = {
        title: 'Formatting Test SOW',
        schemeOfWorkData: {
          grade: 'Grade 7',
          subject: 'Integrated Science',
          entries: sampleCanonicalSowEntries
        }
      };

      const wb = buildSowWorkbook(content, undefined, mockXLSX);
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Check column widths
      expect(ws['!cols']).toBeDefined();
      expect(ws['!cols']!.length).toBe(10);
      expect(ws['!cols']![0].wch).toBe(6);  // Wk
      expect(ws['!cols']![1].wch).toBe(6);  // Lsn
      expect(ws['!cols']![4].wch).toBe(38); // Specific Learning Outcomes

      // Check cell merges
      expect(ws['!merges']).toBeDefined();
      expect(ws['!merges']!.length).toBeGreaterThanOrEqual(6);

      // Check page setup
      expect(ws['!pageSetup']).toBeDefined();
      expect(ws['!pageSetup'].orientation).toBe('landscape');
      expect(ws['!pageSetup'].paperSize).toBe(9); // A4
      expect(ws['!margins']).toBeDefined();
      expect(ws['!margins'].left).toBe(0.5);

      // Check autofilter
      expect(ws['!autofilter']).toBeDefined();
      expect(ws['!autofilter'].ref).toContain('A7:J');
    });
  });

  describe('6. Assessment & General Workbook Fallback', () => {
    it('creates a structured assessment workbook with item numbers, question types, and marking rubric', () => {
      const content: GeneratedContent = {
        title: 'Grade 8 Social Studies Assessment',
        questions: [
          {
            id: 'q1',
            questionType: 'Multiple Choice' as any,
            questionText: 'Which physical feature in Eastern Africa was formed through faulting?',
            marks: 2,
            correctAnswer: 'The Great Rift Valley',
            explanation: 'The Great Rift Valley was formed through tensional and compressional forces causing faulting.'
          }
        ],
        metadata: {
          grade: 'Grade 8',
          subject: 'Social Studies',
          topic: 'Physical Environment',
          contentType: ContentType.Assessment
        }
      };

      const wb = buildAssessmentWorkbook(content, AssessmentExportType.QuestionsAndAnswers, undefined, mockXLSX);
      expect(wb.SheetNames).toContain('Assessment');

      const ws = wb.Sheets['Assessment'];
      const sheetData = mockXLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

      expect(sheetData[0][0]).toContain('ASSESSMENT & MARKING SCHEME');
      expect(sheetData[6]).toEqual([
        'Item #',
        'Question Type',
        'Question Text',
        'Marks',
        'Correct Answer / Scoring Key',
        'Explanation / Marking Rubric'
      ]);
      expect(sheetData[7][0]).toBe(1);
      expect(sheetData[7][2]).toContain('Which physical feature');
      expect(sheetData[7][4]).toBe('The Great Rift Valley');
    });

    it('creates a clean general fallback workbook for generic content', () => {
      const content: GeneratedContent = {
        title: 'Grade 5 English Lesson Plan',
        body: '## Lesson Plan\nIntroduction to Nouns\nActivity 1: Identifying proper nouns in sentences.'
      };

      const wb = buildGeneralWorkbook(content, undefined, mockXLSX);
      expect(wb.SheetNames).toContain('Content');
      const ws = wb.Sheets['Content'];
      expect(ws).toBeDefined();
    });
  });

  describe('7. End-to-End formatAsExcel & Edge Cases', () => {
    it('generates a valid Blob with correct MIME type for SOW', async () => {
      const content: GeneratedContent = {
        title: 'Integration Test SOW',
        schemeOfWorkData: {
          grade: 'Grade 9',
          subject: 'Pre-Technical Studies',
          entries: sampleCanonicalSowEntries
        }
      };

      const blob = await formatAsExcel(content, AssessmentExportType.QuestionsAndAnswers);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('handles empty entries safely without crashing', async () => {
      const content: GeneratedContent = {
        title: 'Empty SOW',
        schemeOfWorkData: {
          grade: 'Grade 3',
          subject: 'Creative Arts',
          entries: []
        }
      };

      const blob = await formatAsExcel(content, AssessmentExportType.QuestionsAndAnswers);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('sanitizes sheet names containing invalid characters and limits length to 31 characters', () => {
      expect(sanitizeSheetName('Term 1/2*?[Special]:Name')).toBe('Term 1_2___Special__Name');
      expect(sanitizeSheetName('A Very Very Long Term Name That Exceeds Thirty One Characters')).toHaveLength(31);
      expect(sanitizeSheetName('')).toBe('Sheet 1');
    });
  });
});
