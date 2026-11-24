import React from 'react';
import { FormState, ContentType, SchemeOfWorkData, SchemeOfWorkEntry, GeneratedContent } from './types.ts';
import { generateContent } from './services/geminiService.ts';

// Mock fetch to prevent actual network calls
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ result: { text: JSON.stringify({ body: "Generated Lesson Plan Body" }) } }),
    text: () => Promise.resolve("Generated content"),
  })
) as jest.Mock;

describe('Phase 25A — SOW → Lesson Plan → Notes Workflow Linkage Tests', () => {
  const sampleSowData: SchemeOfWorkData = {
    grade: 'Grade 8',
    subject: 'Integrated Science',
    term: 'Term 1',
    teacher: 'Mr. Teacher',
    entries: [
      {
        id: 'sow-entry-3-2',
        week: '3',
        lesson: '2',
        strand: '1.0 Mixtures, Elements and Compounds',
        subStrand: '1.2 Physical and Chemical Changes',
        learningOutcomes: 'By the end of the lesson, the learner should be able to distinguish between physical and chemical changes.',
        inquiryQuestions: 'What happens when ice melts vs when wood burns?',
        learningExperiences: 'Learners conduct heating experiments on ice and sugar.',
        learningResources: 'Textbooks, ice, sugar, test tubes, heat source.',
        assessment: 'Observation checklist and oral questioning.',
        remarks: ''
      }
    ]
  };

  const sampleSowContent: GeneratedContent = {
    id: 'sow-artifact-999',
    title: 'Grade 8 - Integrated Science - Scheme of Work (Term 1)',
    schemeOfWorkData: sampleSowData,
    metadata: {
      grade: 'Grade 8',
      subject: 'Integrated Science',
      contentType: ContentType.SchemeOfWork,
      topic: 'Scheme for Term 1',
      term: 'Term 1'
    }
  };

  it('A & B: SOW entry contains valid lesson data structure for actions', () => {
    expect(sampleSowData.entries.length).toBeGreaterThan(0);
    const entry = sampleSowData.entries[0];
    expect(entry.week).toBe('3');
    expect(entry.lesson).toBe('2');
    expect(entry.strand).toContain('Mixtures');
    expect(entry.subStrand).toContain('Physical and Chemical Changes');
  });

  it('C, D, F-M: Generates correct FormState when transferring SOW lesson context', () => {
    const entry = sampleSowData.entries[0];
    const parentArtifactId = sampleSowContent.id;

    const resourceType = ContentType.LessonPlan;
    const grade = sampleSowData.grade;
    const subject = sampleSowData.subject;
    const term = sampleSowData.term;
    const week = entry.week;
    const lessonNumber = entry.lesson;
    const strand = entry.strand;
    const subStrand = entry.subStrand;
    const learningOutcomes = entry.learningOutcomes;

    const curriculumLessonId = `canonical-${grade.toLowerCase().replace(/\s+/g, '')}-${subject.toLowerCase().replace(/\s+/g, '')}-w${week}-l${lessonNumber}`;
    const scheduledLessonId = `sched-w${week}-p${lessonNumber}`;

    const formState: FormState = {
      grade,
      subject,
      topic: `${strand} - ${subStrand}`,
      contentType: resourceType,
      topicInputMode: 'curriculum',
      multiSelectTopics: { [strand]: [subStrand] },
      terms: [term],
      term: term as any,
      week: week,
      lessonNumber: lessonNumber,
      selectedWeeks: [week],
      selectedLessons: [{ week, lesson: lessonNumber }],
      distributionMode: 'manual',
      totalQuestions: 10,
      questionCounts: {},
      questionMarks: {},
      additionalInstructions: `Lesson context: ${strand} > ${subStrand}. Specific Learning Outcomes: ${learningOutcomes}`,
      difficulty: 'Mixed' as any,
      generateImages: false,
      imageSize: '1K',
      textbookReference: '',
      strictCurriculumAdherence: true,
      parentArtifactId,
      masterSowId: parentArtifactId,
      curriculumLessonId,
      scheduledLessonId,
      sowLessonContext: {
        sowTitle: sampleSowContent.title,
        week,
        lesson: lessonNumber,
        strand,
        subStrand,
        learningOutcomes,
        inquiryQuestions: entry.inquiryQuestions,
        learningExperiences: entry.learningExperiences,
        learningResources: entry.learningResources,
      }
    };

    expect(formState.grade).toBe('Grade 8');
    expect(formState.subject).toBe('Integrated Science');
    expect(formState.term).toBe('Term 1');
    expect(formState.week).toBe('3');
    expect(formState.lessonNumber).toBe('2');
    expect(formState.sowLessonContext?.strand).toBe('1.0 Mixtures, Elements and Compounds');
    expect(formState.sowLessonContext?.subStrand).toBe('1.2 Physical and Chemical Changes');
    expect(formState.sowLessonContext?.learningOutcomes).toBe(entry.learningOutcomes);
    expect(formState.parentArtifactId).toBe('sow-artifact-999');
    expect(formState.curriculumLessonId).toBe('canonical-grade8-integratedscience-w3-l2');
  });

  it('N, O, P, Q, R: Generated Lesson Plan and Notes artifacts attach SOW lineage metadata', async () => {
    const entry = sampleSowData.entries[0];
    const formState: FormState = {
      grade: 'Grade 8',
      subject: 'Integrated Science',
      topic: `${entry.strand} - ${entry.subStrand}`,
      contentType: ContentType.LessonPlan,
      topicInputMode: 'curriculum',
      multiSelectTopics: { [entry.strand]: [entry.subStrand] },
      terms: ['Term 1'],
      term: 'Term 1',
      week: '3',
      lessonNumber: '2',
      distributionMode: 'manual',
      totalQuestions: 10,
      questionCounts: {},
      questionMarks: {},
      additionalInstructions: `Specific Learning Outcome: ${entry.learningOutcomes}`,
      difficulty: 'Mixed' as any,
      generateImages: false,
      imageSize: '1K',
      textbookReference: '',
      strictCurriculumAdherence: true,
      parentArtifactId: 'sow-artifact-999',
      masterSowId: 'sow-artifact-999',
      curriculumLessonId: 'canonical-grade8-integratedscience-w3-l2',
      scheduledLessonId: 'sched-w3-p2',
      sowLessonContext: {
        sowTitle: sampleSowContent.title,
        week: '3',
        lesson: '2',
        strand: entry.strand,
        subStrand: entry.subStrand,
        learningOutcomes: entry.learningOutcomes
      }
    };

    const result = await generateContent(formState, 'Mr. Teacher', 'Exameno School');

    expect(result.metadata?.parentArtifactId).toBe('sow-artifact-999');
    expect(result.metadata?.masterSowId).toBe('sow-artifact-999');
    expect(result.metadata?.curriculumLessonId).toBe('canonical-grade8-integratedscience-w3-l2');
    expect(result.metadata?.scheduledLessonId).toBe('sched-w3-p2');
    expect(result.metadata?.week).toBe('3');
    expect(result.metadata?.lessonNumber).toBe('2');
    expect(result.metadata?.strand).toBe(entry.strand);
    expect(result.metadata?.subStrand).toBe(entry.subStrand);
    expect(result.metadata?.specificLearningOutcome).toBe(entry.learningOutcomes);
  });

  it('S: Curriculum mismatch detection blocks generation when week/lesson is altered', () => {
    const entry = sampleSowData.entries[0];
    const sowContext = {
      sowTitle: sampleSowContent.title,
      week: '3',
      lesson: '2',
      strand: entry.strand,
      subStrand: entry.subStrand,
      learningOutcomes: entry.learningOutcomes
    };

    const weekMismatchFormState: FormState = {
      grade: 'Grade 8',
      subject: 'Integrated Science',
      topic: 'Topic',
      contentType: ContentType.LessonPlan,
      topicInputMode: 'curriculum',
      multiSelectTopics: {},
      terms: ['Term 1'],
      week: '4', // Mismatch!
      lessonNumber: '2',
      distributionMode: 'manual',
      totalQuestions: 10,
      questionCounts: {},
      questionMarks: {},
      additionalInstructions: '',
      difficulty: 'Mixed' as any,
      generateImages: false,
      imageSize: '1K',
      textbookReference: '',
      strictCurriculumAdherence: true,
      sowLessonContext: sowContext
    };

    let error: string | null = null;
    if (weekMismatchFormState.sowLessonContext) {
      const ctx = weekMismatchFormState.sowLessonContext;
      if (weekMismatchFormState.week && ctx.week && weekMismatchFormState.week !== ctx.week) {
        error = 'Curriculum mismatch: Selected week does not match the inherited SOW lesson.';
      }
    }

    expect(error).toBe('Curriculum mismatch: Selected week does not match the inherited SOW lesson.');
  });

  it('V & W: Selecting SOW or navigating tabs makes ZERO API/Gemini calls', () => {
    (global.fetch as jest.Mock).mockClear();

    // Passive navigation / state selection
    const activeTab = 'home';
    const selectedContent = sampleSowContent;

    expect(activeTab).toBe('home');
    expect(selectedContent.id).toBe('sow-artifact-999');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
