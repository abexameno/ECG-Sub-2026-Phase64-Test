/**
 * Deterministic integrity checks for resources generated from one selected SOW lesson.
 * This validates identity and scope metadata, not semantic correctness of generated prose.
 */
export type SowLessonScope = {
  sourceSowId?: string;
  sourceSowEntryId?: string;
  sourceDocumentRef?: string;
  grade?: string;
  subject?: string;
  term?: string;
  week: string;
  lesson: string;
  strand: string;
  subStrand: string;
  learningOutcomes: string;
};

export type SowScopedResource = {
  title?: string;
  body?: string;
  questions?: unknown[];
  metadata?: {
    grade?: string;
    subject?: string;
    term?: string;
    week?: string;
    lessonNumber?: string;
    strand?: string;
    subStrand?: string;
    sourceSowId?: string;
    sourceSowEntryId?: string;
  };
};

export type SowScopeValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

const normalise = (value: unknown): string =>
  String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export function validateSowLessonResource(
  scope: SowLessonScope,
  resource: SowScopedResource,
): SowScopeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredScope: Array<[keyof SowLessonScope, string]> = [
    ['sourceSowId', 'Source SOW record ID'],
    ['sourceSowEntryId', 'Selected SOW lesson entry ID'],
    ['grade', 'Grade'],
    ['subject', 'Subject'],
    ['term', 'Term'],
    ['week', 'Week'],
    ['lesson', 'Lesson'],
    ['strand', 'Strand'],
    ['subStrand', 'Sub-strand'],
    ['learningOutcomes', 'Specific Learning Outcomes'],
  ];

  for (const [key, label] of requiredScope) {
    if (!normalise(scope[key])) errors.push(`Missing selected SOW ${label}.`);
  }

  const metadata = resource.metadata || {};
  const identityChecks: Array<[string, unknown, unknown]> = [
    ['SOW record ID', metadata.sourceSowId, scope.sourceSowId],
    ['SOW lesson entry ID', metadata.sourceSowEntryId, scope.sourceSowEntryId],
    ['Grade', metadata.grade, scope.grade],
    ['Subject', metadata.subject, scope.subject],
    ['Term', metadata.term, scope.term],
    ['Week', metadata.week, scope.week],
    ['Lesson', metadata.lessonNumber, scope.lesson],
    ['Strand', metadata.strand, scope.strand],
    ['Sub-strand', metadata.subStrand, scope.subStrand],
  ];

  for (const [label, actual, expected] of identityChecks) {
    if (!normalise(expected)) continue;
    if (!normalise(actual)) errors.push(`Generated resource is missing ${label} metadata.`);
    else if (normalise(actual) !== normalise(expected)) {
      errors.push(`${label} mismatch: expected "${String(expected)}", received "${String(actual)}".`);
    }
  }

  if (!normalise(resource.body) && !(resource.questions && resource.questions.length)) {
    errors.push('Generated resource has no body content or assessment questions.');
  }

  // Semantic coverage cannot be safely proven with substring matching. It remains a teacher-review item.
  warnings.push('Review the generated content to confirm that it meaningfully addresses every selected SOW learning outcome.');
  return { valid: errors.length === 0, errors, warnings };
}
