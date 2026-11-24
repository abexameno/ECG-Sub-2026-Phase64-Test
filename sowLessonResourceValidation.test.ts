import { validateSowLessonResource } from './services/sowLessonResourceValidation';

const scope = {
  sourceSowId: 'sow-123',
  sourceSowEntryId: 'entry-4-2',
  sourceDocumentRef: 'original-doc-123',
  grade: 'Grade 8',
  subject: 'Pre-technical Studies',
  term: 'Term 2',
  week: '4',
  lesson: '2',
  strand: 'Materials',
  subStrand: 'Properties of materials',
  learningOutcomes: 'Classify materials by their properties.',
};

const resource = {
  title: 'Lesson Plan',
  body: 'Learners classify material samples.',
  metadata: {
    sourceSowId: 'sow-123',
    sourceSowEntryId: 'entry-4-2',
    grade: 'Grade 8',
    subject: 'Pre-technical Studies',
    term: 'Term 2',
    week: '4',
    lessonNumber: '2',
    strand: 'Materials',
    subStrand: 'Properties of materials',
  },
};

describe('SOW lesson resource validation', () => {
  it('accepts matching source and selected-lesson identity', () => {
    const result = validateSowLessonResource(scope, resource);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('rejects missing source provenance', () => {
    const result = validateSowLessonResource({ ...scope, sourceSowId: undefined }, resource);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing selected SOW Source SOW record ID.');
  });

  it('rejects a different selected lesson', () => {
    const result = validateSowLessonResource(scope, {
      ...resource,
      metadata: { ...resource.metadata, lessonNumber: '3' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('Lesson mismatch'))).toBe(true);
  });

  it('rejects a resource that omits SOW lineage metadata', () => {
    const result = validateSowLessonResource(scope, {
      ...resource,
      metadata: { ...resource.metadata, sourceSowEntryId: undefined },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes('SOW lesson entry ID'))).toBe(true);
  });

  it('does not claim semantic alignment from metadata alone', () => {
    const result = validateSowLessonResource(scope, resource);
    expect(result.warnings[0]).toContain('meaningfully addresses every selected SOW learning outcome');
  });
});
