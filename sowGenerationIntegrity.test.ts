import { CanonicalCurriculumService } from './services/canonicalCurriculumService.ts';
import { buildPdfDocDefinition } from './services/pdfService.ts';
import { ContentType, CanonicalSowNode } from './types.ts';

describe('Scheme of Work generation integrity', () => {
  it('blocks Grade 7 Mathematics generation until canonical curriculum allocations are verified', async () => {
    const { generateContent } = await import('./services/geminiService.ts');
    const formState: any = {
      grade: 'Grade 7',
      subject: 'Mathematics',
      topic: '',
      topicInputMode: 'curriculum',
      multiSelectTopics: {},
      contentType: ContentType.SchemeOfWork,
      terms: ['Term 1'],
      distributionMode: 'auto',
      totalQuestions: 5,
      questionCounts: {},
      questionMarks: {},
      additionalInstructions: '',
      generateImages: false,
      imageSize: '1K',
      difficulty: 'Medium',
      textbookReference: '',
      strictCurriculumAdherence: true,
      teachingWeeks: 13,
      lessonsPerWeek: 5,
    };

    await expect(generateContent(formState)).rejects.toThrow(
      /Scheme of Work generation is blocked for Grade 7 Mathematics.*Audit canonical strand/
    );
  });

  it('preserves every canonical Grade 7 Mathematics Term 1 lesson through PDF document construction', () => {
    const canonicalNodes = CanonicalCurriculumService.resolveCanonicalSowNodes(
      'Grade 7',
      'Mathematics',
      ['Term 1'],
      { teachingWeeksPerTerm: 12, lessonsPerWeek: 5 }
    );

    expect(canonicalNodes.length).toBeGreaterThan(0);

    const expectedKeys = canonicalNodes.map(
      (node: CanonicalSowNode) => `${node.week}-${node.lesson}`
    );
    expect(new Set(expectedKeys).size).toBe(canonicalNodes.length);

    const entries = canonicalNodes.map((node: CanonicalSowNode) => ({
      id: `test-${node.week}-${node.lesson}`,
      week: String(node.week),
      lesson: String(node.lesson),
      strand: node.strandTitle,
      subStrand: node.subStrandTitle,
      learningOutcomes: node.learningOutcomesText,
      inquiryQuestions: (node.keyInquiryQuestions || []).join('; '),
      learningExperiences: 'Learners complete a guided practice activity.',
      learningResources: 'Approved learner book and teacher-prepared materials.',
      assessment: 'Observation and oral questioning.',
      remarks: '',
    }));

    // Every canonical curriculum slot must have a complete exportable row.
    expect(entries).toHaveLength(canonicalNodes.length);
    entries.forEach((entry, index) => {
      expect(entry.week).toBe(String(canonicalNodes[index].week));
      expect(entry.lesson).toBe(String(canonicalNodes[index].lesson));
      expect(entry.strand.trim()).not.toBe('');
      expect(entry.subStrand.trim()).not.toBe('');
      expect(entry.learningOutcomes.trim()).not.toBe('');
      expect(entry.inquiryQuestions.trim()).not.toBe('');
      expect(entry.learningExperiences.trim()).not.toBe('');
      expect(entry.learningResources.trim()).not.toBe('');
      expect(entry.assessment.trim()).not.toBe('');
    });

    const doc = buildPdfDocDefinition({
      id: 'grade-7-mathematics-term-1-integrity',
      title: 'Grade 7 Mathematics Scheme of Work',
      questions: [],
      metadata: {
        grade: 'Grade 7',
        subject: 'Mathematics',
        contentType: ContentType.SchemeOfWork,
        topic: 'Term 1',
      },
      schemeOfWorkData: {
        grade: 'Grade 7',
        subject: 'Mathematics',
        term: 'Term 1',
        entries,
      },
    } as any);

    const table = doc.content.find(
      (item: any) => item?.table?.body?.[0]?.length === 10
    );
    expect(table).toBeDefined();
    expect(table.table.body).toHaveLength(canonicalNodes.length + 1);
    expect(table.table.body.slice(1).map((row: any[]) => `${row[0].text}-${row[1].text}`))
      .toEqual(expectedKeys);
    expect(String(table.table.body[table.table.body.length - 1][9].text).trim()).toBe('');
  });


  it('preserves the eight Grade 7 Social Studies Term 1 source lessons in their original order', () => {
    const sourceNodes = CanonicalCurriculumService.getFallbackNodes(
      'Grade 7',
      'Social Studies',
      ['Term 1']
    );

    expect(sourceNodes).toHaveLength(8);
    expect(sourceNodes.map(node => `${node.week}-${node.lesson}`)).toEqual([
      '2-1', '2-2', '2-3', '2-4',
      '3-1', '3-2', '3-3', '3-4',
    ]);
    expect(sourceNodes.map(node => node.subStrandTitle)).toEqual([
      'Africa',
      'Africa',
      'Physical features',
      'Climate',
      'Human origin',
      'Human origin',
      'Language groups',
      'Socialization',
    ]);
  });

  it('routes Grade 7 Social Studies Term 1 through canonical resolution and PDF construction without losing its eight lessons', () => {
    const masterNodes = CanonicalCurriculumService.getMasterCurriculumSowNodes(
      'Grade 7',
      'Social Studies',
      ['Term 1']
    );
    expect(masterNodes).toHaveLength(8);
    expect(masterNodes.map(node => `${node.week}-${node.lesson}`)).toEqual([
      '2-1', '2-2', '2-3', '2-4',
      '3-1', '3-2', '3-3', '3-4',
    ]);

    const resolvedNodes = CanonicalCurriculumService.resolveCanonicalSowNodes(
      'Grade 7',
      'Social Studies',
      ['Term 1'],
      { teachingWeeksPerTerm: 12, lessonsPerWeek: 4 }
    );
    expect(resolvedNodes).toHaveLength(8);
    expect(resolvedNodes.map(node => `${node.week}-${node.lesson}`)).toEqual([
      '2-1', '2-2', '2-3', '2-4',
      '3-1', '3-2', '3-3', '3-4',
    ]);
    expect(resolvedNodes.map(node => node.subStrandTitle)).toEqual([
      'Africa',
      'Africa',
      'Physical features',
      'Climate',
      'Human origin',
      'Human origin',
      'Language groups',
      'Socialization',
    ]);

    const entries = resolvedNodes.map(node => ({
      id: `grade-7-social-studies-${node.week}-${node.lesson}`,
      week: String(node.week),
      lesson: String(node.lesson),
      strand: node.strandTitle,
      subStrand: node.subStrandTitle,
      learningOutcomes: node.learningOutcomesText,
      inquiryQuestions: (node.keyInquiryQuestions || []).join('; '),
      learningExperiences: 'Learners examine maps and discuss the topic.',
      learningResources: 'Approved learner book and map.',
      assessment: 'Oral questions and observation.',
      remarks: '',
    }));

    const doc = buildPdfDocDefinition({
      id: 'grade-7-social-studies-term-1-integrity',
      title: 'Grade 7 Social Studies Scheme of Work',
      questions: [],
      metadata: {
        grade: 'Grade 7',
        subject: 'Social Studies',
        contentType: ContentType.SchemeOfWork,
        topic: 'Term 1',
      },
      schemeOfWorkData: {
        grade: 'Grade 7',
        subject: 'Social Studies',
        term: 'Term 1',
        entries,
      },
    } as any);

    const table = doc.content.find(
      (item: any) => item?.table?.body?.[0]?.length === 10
    );
    expect(table).toBeDefined();
    expect(table.table.body).toHaveLength(9);
    expect(table.table.body.slice(1).map((row: any[]) => `${row[0].text}-${row[1].text}`)).toEqual([
      '2-1', '2-2', '2-3', '2-4', '3-1', '3-2', '3-3', '3-4',
    ]);
    expect(table.table.body.slice(1).map((row: any[]) => row[3].text)).toEqual([
      'Africa',
      'Africa',
      'Physical features',
      'Climate',
      'Human origin',
      'Human origin',
      'Language groups',
      'Socialization',
    ]);
  });

  it('blocks SOW finalization when AI enrichment fields are missing instead of inserting generic fallback text', async () => {
    const { validateAndRepairSow } = await import('./services/geminiService.ts');
    const nodes = CanonicalCurriculumService.getFallbackNodes(
      'Grade 7',
      'Social Studies',
      ['Term 1']
    ).slice(0, 1);
    const node = nodes[0];
    const formState: any = {
      grade: 'Grade 7',
      subject: 'Social Studies',
      terms: ['Term 1'],
    };
    const incompleteEntry: any = {
      week: String(node.week),
      lesson: String(node.lesson),
      inquiryQuestions: '',
      learningExperiences: '',
      learningResources: 'A relevant map and learner textbook.',
      assessment: 'Oral questioning.',
      remarks: '',
    };

    await expect(validateAndRepairSow(
      { entries: [incompleteEntry] } as any,
      formState,
      '',
      {},
      nodes
    )).rejects.toThrow(/missing learningExperiences/);
  });

  it('uses canonical inquiry questions while preserving valid AI-enriched SOW fields', async () => {
    const { validateAndRepairSow } = await import('./services/geminiService.ts');
    const nodes = CanonicalCurriculumService.getFallbackNodes(
      'Grade 7',
      'Social Studies',
      ['Term 1']
    ).slice(0, 1);
    const node = nodes[0];
    const formState: any = {
      grade: 'Grade 7',
      subject: 'Social Studies',
      terms: ['Term 1'],
    };
    const generated = {
      learningExperiences: 'Learners compare Africa locations using a labelled world map.',
      learningResources: 'A labelled world map and approved learner textbook.',
      assessment: 'Learners identify Africa on the map and explain its location.',
    };
    const result = await validateAndRepairSow(
      { entries: [{ week: String(node.week), lesson: String(node.lesson), inquiryQuestions: '', ...generated, remarks: '' }] } as any,
      formState,
      '',
      {},
      nodes
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].week).toBe(String(node.week));
    expect(result.entries[0].lesson).toBe(String(node.lesson));
    expect(result.entries[0].strand).toBe(node.strandTitle);
    expect(result.entries[0].subStrand).toBe(node.subStrandTitle);
    expect(result.entries[0].inquiryQuestions).toBe(node.keyInquiryQuestions.join('; '));
    expect(result.entries[0].learningExperiences).toBe(generated.learningExperiences);
    expect(result.entries[0].learningResources).toBe(generated.learningResources);
    expect(result.entries[0].assessment).toBe(generated.assessment);
  });

});
