import { ContentType } from './types.ts';
import { buildGenerationSystemInstruction, buildSowLessonScopePrompt } from './services/geminiService.ts';

const selectedLesson = {
  sowTitle: 'Grade 8 - Pre-technical Studies - Term 2',
  grade: 'Grade 8',
  subject: 'Pre-technical Studies',
  term: 'Term 2',
  week: '4',
  lesson: '2',
  strand: 'Materials',
  subStrand: 'Properties of materials',
  learningOutcomes: 'By the end of the lesson, learners should be able to classify materials by their properties.',
  inquiryQuestions: 'How do the properties of materials influence their use?',
  learningExperiences: 'Learners sort material samples and explain their classifications.',
  learningResources: 'Material samples, charts and learner book.',
  assessment: 'Observation and oral questioning.',
  remarks: 'Use locally available samples.',
  sourceSowId: 'approved-sow-123',
  sourceDocumentRef: 'sow-doc-original-123',
};

describe('SOW lesson generation scope', () => {
  it('uses the uploaded SOW as curriculum authority without weakening technical integrity checks', () => {
    const instruction = buildGenerationSystemInstruction(true);
    expect(instruction).toContain('selected uploaded Scheme of Work is an approved, KICD-derived source');
    expect(instruction).toContain('Do not perform a second KICD/canonical-curriculum alignment');
    expect(instruction).toContain('Do not block generation because a separate canonical curriculum record');
    expect(instruction).toContain('selected lesson identity, provenance, metadata consistency');
    expect(instruction).toContain('does not authorize generation of a new AI-created Scheme of Work');
    expect(instruction).not.toContain('Strictly align with KICD, CBC, and CBE standards for Grades 1-10');
  });

  it('retains canonical curriculum controls for non-uploaded-SOW generation', () => {
    const instruction = buildGenerationSystemInstruction(false);
    expect(instruction).toContain('Strictly align with KICD, CBC, and CBE standards for Grades 1-10');
    expect(instruction).not.toContain('Do not perform a second KICD/canonical-curriculum alignment');
  });

  it.each([
    ContentType.LessonPlan,
    ContentType.LessonNotes,
    ContentType.Assessment,
  ])('builds a strict single-lesson scope for %s', (contentType) => {
    const prompt = buildSowLessonScopePrompt(selectedLesson, contentType);

    expect(prompt).toContain('Use only this single selected lesson');
    expect(prompt).toContain('Week 4, Lesson 2');
    expect(prompt).toContain('Specific Learning Outcomes');
    expect(prompt).toContain(selectedLesson.learningOutcomes);
    expect(prompt).toContain(selectedLesson.inquiryQuestions);
    expect(prompt).toContain(selectedLesson.learningExperiences);
    expect(prompt).toContain(selectedLesson.learningResources);
    expect(prompt).toContain(selectedLesson.assessment);
    expect(prompt).toContain(selectedLesson.remarks);
    expect(prompt).toContain(selectedLesson.sowTitle);
  });

  it('does not manufacture absent SOW source fields', () => {
    const prompt = buildSowLessonScopePrompt({
      week: '1',
      lesson: '1',
      strand: 'Living things',
      subStrand: 'Plants',
      learningOutcomes: 'Identify parts of a plant.',
    }, ContentType.LessonNotes);

    expect(prompt).toContain('Week 1, Lesson 1');
    expect(prompt).not.toContain('Assessment Methods:');
    expect(prompt).not.toContain('Learning Resources:');
    expect(prompt).toContain('Do not invent missing curriculum fields');
  });
});
