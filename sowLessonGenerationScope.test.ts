import { ContentType } from './types.ts';
import { buildGenerationSystemInstruction, buildSowLessonScopePrompt, buildSowScopedResourcePrompt } from './services/geminiService.ts';

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
    expect(instruction).toContain('selected uploaded Scheme of Work is the authoritative source');
    expect(instruction).toContain('do not assume or claim that its KICD alignment has been independently verified');
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

  it('keeps Study Guides generated from an uploaded SOW confined to the selected lesson', () => {
    const prompt = buildSowScopedResourcePrompt(selectedLesson, ContentType.StudyGuide);
    expect(prompt).toContain('Create a learner-friendly study guide for this selected lesson only');
    expect(prompt).toContain('Week 4, Lesson 2');
    expect(prompt).toContain(selectedLesson.learningOutcomes);
    expect(prompt).toContain(selectedLesson.learningExperiences);
    expect(prompt).toContain('Do not introduce content from other lessons or weeks');
    expect(prompt).not.toContain('Continue with more lessons and weeks');
  });

  it('keeps generic SOW-bound resources within the selected lesson', () => {
    const prompt = buildSowScopedResourcePrompt(selectedLesson, ContentType.LessonPlan);
    expect(prompt).toContain('Create the requested Lesson Plan for the selected SOW lesson only');
    expect(prompt).toContain('Week 4, Lesson 2');
    expect(prompt).toContain(selectedLesson.learningOutcomes);
    expect(prompt).toContain('Do not include adjacent lessons, other weeks');
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
