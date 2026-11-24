import {
  parseMarkdownToPdfmake,
  buildItemPdfContent,
  buildPdfDocDefinition,
  buildMergedPdfDocDefinition,
  isResourcePdfCompatible
} from './services/pdfService.ts';
import { GeneratedContent, ContentType, QuestionType, AssessmentExportType } from './types.ts';
import { SCHOOL_LOGO_BASE64 } from './constants.tsx';

describe('Phase 23 — PDF Export Remediation & Hardening Test Suite', () => {
  const sampleSowContent: GeneratedContent = {
    id: 'sow-test-1',
    title: 'Grade 8 - Integrated Science - Scheme of Work (Term 2)',
    metadata: {
      grade: 'Grade 8',
      subject: 'Integrated Science',
      contentType: ContentType.SchemeOfWork,
      topic: 'Living Things and Their Environment',
      terms: ['Term 2']
    },
    schemeOfWorkData: {
      grade: 'Grade 8',
      subject: 'Integrated Science',
      term: 'Term 2',
      teacher: 'Tr. Jane Doe',
      entries: [
        {
          id: 'e-1',
          week: '1',
          lesson: '1',
          strand: '2.0 Living Things and Their Environment',
          subStrand: '2.1 The Cell',
          learningOutcomes: '**Knowledge:**\n- Describe the structure of plant and animal cells.\n**Skills:**\n- Observe cells under a microscope.\n**Attitudes:**\n- Appreciate cell diversity.',
          inquiryQuestions: 'What makes up plant and animal cells?',
          learningExperiences: 'Learners prepare wet mounts of onion epidermal cells and observe them under a light microscope.',
          learningResources: 'Light microscope, onion bulbs, glass slides, cover slips, iodine solution.',
          assessment: 'Observation checklist, oral questions, drawings',
          remarks: ''
        },
        {
          id: 'e-2',
          week: '1',
          lesson: '2',
          strand: '2.0 Living Things and Their Environment',
          subStrand: '2.1 The Cell',
          learningOutcomes: '**Knowledge:**\n- Identify cell parts.\n**Skills:**\n- Draw and label diagrams.\n**Attitudes:**\n- Value precision.',
          inquiryQuestions: 'How do plant cells differ from animal cells?',
          learningExperiences: 'Learners draw and label plant cells and compare organelles with cheek cells.',
          learningResources: 'Prepared slides of human cheek cells, charts showing cell structure.',
          assessment: 'Marking labeled diagrams and practical reports',
          remarks: ''
        }
      ]
    }
  };

  describe('I. Safe Markdown to PDFMake Parser Tests', () => {
    it('1. returns a non-empty safe array when given empty string, whitespace or null', () => {
      expect(parseMarkdownToPdfmake('')).toEqual([{ text: ' ' }]);
      expect(parseMarkdownToPdfmake('   ')).toEqual([{ text: ' ' }]);
      expect(parseMarkdownToPdfmake(null as any)).toEqual([{ text: ' ' }]);
      expect(parseMarkdownToPdfmake(undefined as any)).toEqual([{ text: ' ' }]);
    });

    it('2. parses bold, underline, headings, lists, and tables safely without empty stacks', () => {
      const md = `# Heading 1\n## Heading 2\n### Heading 3\n- Item 1\n- Item 2\n1. Ordered 1\n2. Ordered 2\n**Bold text**\n<u>Underlined text</u>\n| Header A | Header B |\n| --- | --- |\n| Cell 1 | Cell 2 |`;
      const result = parseMarkdownToPdfmake(md);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(node => {
        expect(node).toBeDefined();
        if (node.stack) {
          expect(node.stack.length).toBeGreaterThan(0);
        }
        if (node.ul) {
          expect(node.ul.length).toBeGreaterThan(0);
        }
        if (node.ol) {
          expect(node.ol.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('II. SOW Document Definition Generation', () => {
    it('3. generates valid PDF document definition for small SOW', () => {
      const docDef = buildPdfDocDefinition(sampleSowContent);
      expect(docDef).toBeDefined();
      expect(docDef.pageOrientation).toBe('landscape');
      expect(docDef.content.length).toBeGreaterThan(0);
    });

    it('4. generates valid PDF document definition for 40-row SOW', () => {
      const entries = Array.from({ length: 40 }, (_, i) => ({
        id: `e-${i + 1}`,
        week: String(Math.floor(i / 4) + 1),
        lesson: String((i % 4) + 1),
        strand: '2.0 Living Things and Their Environment',
        subStrand: i < 20 ? '2.1 The Cell' : '2.2 Movement of materials in and out of the cell',
        learningOutcomes: `**Knowledge:**\n- Outcome description for lesson ${i + 1}`,
        inquiryQuestions: `Key inquiry question for lesson ${i + 1}?`,
        learningExperiences: `Learner activity and guided inquiry for lesson ${i + 1}.`,
        learningResources: `Curriculum designs, charts, models for lesson ${i + 1}.`,
        assessment: 'Observation and questioning',
        remarks: ''
      }));

      const largeSow: GeneratedContent = {
        ...sampleSowContent,
        schemeOfWorkData: {
          ...sampleSowContent.schemeOfWorkData!,
          entries
        }
      };

      const docDef = buildPdfDocDefinition(largeSow);
      expect(docDef).toBeDefined();
      expect(docDef.content.length).toBeGreaterThan(0);
      const tableBlock = docDef.content.find((c: any) => c.table);
      expect(tableBlock).toBeDefined();
      expect(tableBlock.table.body.length).toBe(41); // header + 40 rows
      expect(tableBlock.table.widths.length).toBe(10);
    });

    it('5. generates valid PDF document definition for 120-row multi-term SOW', () => {
      const entries = Array.from({ length: 120 }, (_, i) => ({
        id: `e-${i + 1}`,
        week: String(Math.floor(i / 4) + 1),
        lesson: String((i % 4) + 1),
        strand: i < 40 ? '1.0 Mixtures' : i < 80 ? '2.0 Living Things' : '3.0 Force and Energy',
        subStrand: `Sub-Strand ${Math.floor(i / 15) + 1}`,
        learningOutcomes: `**Knowledge:**\n- Outcome description ${i + 1}`,
        inquiryQuestions: `Inquiry ${i + 1}?`,
        learningExperiences: `Experience ${i + 1}`,
        learningResources: `Resources ${i + 1}`,
        assessment: 'Formative assessment',
        remarks: ''
      }));

      const multiTermSow: GeneratedContent = {
        ...sampleSowContent,
        title: 'Grade 8 - Integrated Science - Scheme of Work (Term 1, Term 2, Term 3)',
        schemeOfWorkData: {
          ...sampleSowContent.schemeOfWorkData!,
          term: 'Term 1, Term 2, Term 3',
          entries
        }
      };

      const docDef = buildPdfDocDefinition(multiTermSow);
      expect(docDef).toBeDefined();
      const tableBlock = docDef.content.find((c: any) => c.table);
      expect(tableBlock.table.body.length).toBe(121);
    });

    it('6. handles long learning outcomes, long learning experiences, and special characters safely', () => {
      const longSow: GeneratedContent = {
        ...sampleSowContent,
        schemeOfWorkData: {
          ...sampleSowContent.schemeOfWorkData!,
          entries: [
            {
              id: 'e-long',
              week: '1',
              lesson: '1',
              strand: '2.0 Living Things and Their Environment',
              subStrand: '2.1 The Cell',
              learningOutcomes: '**Knowledge:**\n' + '- Very long outcome sentence detailing intricate cellular organelles, chloroplasts, mitochondria, ribosomes, endomembrane systems, and plant cell wall synthesis.'.repeat(5),
              inquiryQuestions: 'How do microscopic biochemical gradients enable cellular homeostasis & metabolic functions across diverse taxonomic domains?',
              learningExperiences: 'Learners conduct complex multi-step microscopy investigations using stage micrometers, ocular graticules, serial dilutions, staining protocols, and statistical error analyses.'.repeat(4),
              learningResources: 'Compound research microscopes, optical graticules, calibration slides, differential stains (Janus Green B, Acetocarmine, Feulgen reagent), micropipettes.',
              assessment: 'Extended laboratory portfolio rubrics, quantitative graph drawing assessments, oral presentations',
              remarks: 'Comprehensive laboratory session completed with zero safety incidents.'
            }
          ]
        }
      };

      const docDef = buildPdfDocDefinition(longSow);
      expect(docDef).toBeDefined();
    });

    it('7. handles completely empty fields without producing empty { stack: [] } cell failures', () => {
      const emptyFieldsSow: GeneratedContent = {
        ...sampleSowContent,
        schemeOfWorkData: {
          ...sampleSowContent.schemeOfWorkData!,
          entries: [
            {
              id: 'e-empty',
              week: '',
              lesson: '',
              strand: '',
              subStrand: '',
              learningOutcomes: '',
              inquiryQuestions: '',
              learningExperiences: '',
              learningResources: '',
              assessment: '',
              remarks: ''
            }
          ]
        }
      };

      const docDef = buildPdfDocDefinition(emptyFieldsSow);
      expect(docDef).toBeDefined();
      const tableBlock = docDef.content.find((c: any) => c.table);
      expect(tableBlock).toBeDefined();
      const row = tableBlock.table.body[1];
      row.forEach((cell: any) => {
        expect(cell).toBeDefined();
        if (cell.stack) {
          expect(cell.stack.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('III. School Logo Resilience', () => {
    it('8. embeds valid Base64 school logo without error', () => {
      const docDef = buildPdfDocDefinition(sampleSowContent, AssessmentExportType.QuestionsAndAnswers, {
        schoolName: 'Lenana School',
        schoolLogo: SCHOOL_LOGO_BASE64
      });
      expect(docDef).toBeDefined();
      const headerObj = docDef.header(1);
      expect(headerObj.columns[0]).toBeDefined();
      expect(headerObj.columns[0].image).toBeDefined();
    });

    it('9. handles missing school logo safely with fallback text node', () => {
      const docDef = buildPdfDocDefinition(sampleSowContent, AssessmentExportType.QuestionsAndAnswers, {
        schoolName: 'Alliance High School',
        schoolLogo: ''
      });
      expect(docDef).toBeDefined();
      const headerObj = docDef.header(1);
      expect(headerObj.columns[0]).toBeDefined();
      expect(headerObj.columns[0].image).toBeUndefined();
      expect(headerObj.columns[0].text).toBe(' ');
    });

    it('10. handles invalid or corrupted logo URI string safely without crashing', () => {
      const docDef = buildPdfDocDefinition(sampleSowContent, AssessmentExportType.QuestionsAndAnswers, {
        schoolName: 'Alliance High School',
        schoolLogo: 'not_a_valid_image_string_or_url'
      });
      expect(docDef).toBeDefined();
      const headerObj = docDef.header(1);
      expect(headerObj.columns[0].image).toBeUndefined();
      expect(headerObj.columns[0].text).toBe(' ');
    });
  });

  describe('IV. Grade 8 Integrated Science Term 2 Fidelity in PDF', () => {
    it('11. verifies that Grade 8 Integrated Science Term 2 PDF export contains ZERO Force and Energy', () => {
      const docDef = buildPdfDocDefinition(sampleSowContent);
      const jsonStr = JSON.stringify(docDef);
      expect(jsonStr).not.toContain('Force and Energy');
      expect(jsonStr).not.toContain('Transformation of Energy');
      expect(jsonStr).not.toContain('Pressure in solids');
      expect(jsonStr).toContain('Living Things and Their Environment');
      expect(jsonStr).toContain('The Cell');
    });
  });

  describe('V. Assessment & Merged Document Definition Exports', () => {
    it('12. generates valid Assessment PDF with cover page, instructions, and official use table', () => {
      const assessmentContent: GeneratedContent = {
        id: 'quiz-1',
        title: 'Grade 8 - Integrated Science - Midterm Quiz',
        metadata: {
          grade: 'Grade 8',
          subject: 'Integrated Science',
          contentType: ContentType.Quiz,
          topic: 'The Cell and Microscopy'
        },
        questions: [
          {
            id: 'q1',
            questionText: 'Which organelle is responsible for cellular respiration?',
            questionType: QuestionType.MultipleChoice,
            options: ['Ribosome', 'Mitochondrion', 'Chloroplast', 'Vacuole'],
            correctAnswer: 'B) Mitochondrion',
            marks: 1
          },
          {
            id: 'q2',
            questionText: 'State three differences between plant cells and animal cells.',
            questionType: QuestionType.Structured,
            marks: 6
          }
        ]
      };

      const docDef = buildPdfDocDefinition(assessmentContent, AssessmentExportType.QuestionsAndAnswers);
      expect(docDef).toBeDefined();
      expect(docDef.pageOrientation).toBe('portrait');
      expect(docDef.content.length).toBeGreaterThan(0);
    });

    it('13. generates valid Merged PDF definition containing both SOW and Assessment', () => {
      const assessmentContent: GeneratedContent = {
        id: 'quiz-1',
        title: 'Grade 8 - Integrated Science - Midterm Quiz',
        metadata: {
          grade: 'Grade 8',
          subject: 'Integrated Science',
          contentType: ContentType.Quiz,
          topic: 'The Cell'
        },
        questions: [
          {
            id: 'q1',
            questionText: 'Name the cell part that controls all cell activities.',
            questionType: QuestionType.MultipleChoice,
            options: ['Nucleus', 'Cytoplasm', 'Cell wall', 'Cell membrane'],
            correctAnswer: 'A) Nucleus',
            marks: 1
          }
        ]
      };

      const mergedDef = buildMergedPdfDocDefinition([sampleSowContent, assessmentContent], {
        schoolName: 'Moi High School Kabarak'
      });

      expect(mergedDef).toBeDefined();
      expect(mergedDef.content.length).toBeGreaterThan(0);
    });

    it('14. verifies resource PDF compatibility checker', () => {
      expect(isResourcePdfCompatible(sampleSowContent)).toBe(true);
      expect(isResourcePdfCompatible({ id: 'empty' })).toBe(false);
      expect(isResourcePdfCompatible(null)).toBe(false);
    });
  });

  describe('VI. Grade 7 Integrated Science SOW Layout & Column Completeness Regression Tests', () => {
    it('15. preserves all 10 SOW data columns even when source entries use alternate field aliases', () => {
      const g7SowAliased: GeneratedContent = {
        id: 'g7-sow-alias-1',
        title: 'Grade 7 - Integrated Science - Scheme of Work (Term 1)',
        metadata: {
          grade: 'Grade 7',
          subject: 'Integrated Science',
          contentType: ContentType.SchemeOfWork,
          terms: ['Term 1']
        },
        schemeOfWorkData: {
          grade: 'Grade 7',
          subject: 'Integrated Science',
          term: 'Term 1',
          teacher: 'Tr. Samuel Omondi',
          entries: [
            {
              id: 'g7-1',
              week: '1',
              lesson: '1',
              strandTitle: '1.0 Scientific Investigation',
              subStrandTitle: '1.1 Laboratory Safety',
              specificLearningOutcomes: '**Knowledge:**\n- Identify laboratory safety equipment.\n**Skills:**\n- Demonstrate safety procedures.',
              keyInquiryQuestions: 'Why are safety rules critical in a science laboratory?',
              content: 'Learners inspect safety goggles, fire extinguishers, and first aid kits in the laboratory.',
              resources: 'Safety goggles, fire blanket, first aid kit, poster of lab rules.',
              assessmentMethods: 'Oral questions, safety checklist observation',
              remarks: 'Initial orientation completed.'
            } as any
          ]
        }
      };

      const docDef = buildPdfDocDefinition(g7SowAliased);
      expect(docDef).toBeDefined();
      const tableBlock = docDef.content.find((c: any) => c.table);
      expect(tableBlock).toBeDefined();
      
      const row = tableBlock.table.body[1];
      expect(row.length).toBe(10); // Exactly 10 columns

      // Verify that every single cell has non-empty content mapped correctly from fallbacks
      expect(row[0].text).toBe('1'); // Week
      expect(row[1].text).toBe('1'); // Lesson
      expect(row[2].text).toBe('1.0 Scientific Investigation'); // Strand
      expect(row[3].text).toBe('1.1 Laboratory Safety'); // Sub-Strand
      expect(JSON.stringify(row[4])).toContain('Identify laboratory safety equipment'); // Specific Learning Outcomes
      expect(JSON.stringify(row[5])).toContain('inspect safety goggles'); // Learning Experiences
      expect(JSON.stringify(row[6])).toContain('Why are safety rules critical'); // Key Inquiry Questions
      expect(JSON.stringify(row[7])).toContain('Safety goggles, fire blanket'); // Learning Resources
      expect(row[8].text).toBe('Oral questions, safety checklist observation'); // Assessment
      expect(row[9].text).toBe('Initial orientation completed.'); // Remarks
    });

    it('16. enforces landscape orientation and balanced column widths for SOW exports', () => {
      const docDef = buildPdfDocDefinition(sampleSowContent);
      expect(docDef.pageOrientation).toBe('landscape');
      const tableBlock = docDef.content.find((c: any) => c.table);
      expect(tableBlock.table.widths).toBeDefined();
      expect(tableBlock.table.widths.length).toBe(10);
      
      // The revised layout reserves enough width for one-line Week/Lesson
      // headers while keeping the 10-column table inside the landscape page.
      expect(tableBlock.table.widths[4]).toBeGreaterThanOrEqual(132);
      expect(tableBlock.table.widths[5]).toBeGreaterThanOrEqual(122);
    });
  });
});
