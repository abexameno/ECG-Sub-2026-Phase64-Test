export interface Curriculum {
  id: string;
  name: string;
  code: string;
  version: string;
  country: string;
  framework: string;
  status: 'draft' | 'active' | 'archived';
}

export interface GradeLevel {
  id: string;
  curriculumId: string;
  code: string;
  name: string; // e.g. "Grade 7", "Grade 8"
  levelType: 'Pre-Primary' | 'Primary' | 'Junior School' | 'Senior School';
  order: number;
}

export interface LearningArea {
  id: string;
  curriculumId: string;
  code: string;
  name: string; // e.g. "Mathematics", "English", "Creative Arts and Sports"
  gradeIds: string[];
}

export interface Strand {
  id: string;
  learningAreaId: string;
  code: string;
  title: string;
  description?: string;
}

export interface SubStrand {
  id: string;
  strandId: string;
  code: string;
  title: string;
  suggestedTerms?: string[];
  suggestedLessonAllocation?: number;
  keyInquiryQuestions?: string[];
}

export interface LearningOutcome {
  id: string;
  subStrandId: string;
  code: string;
  statement: string;
  taxonomyLevel: 'Knowledge' | 'Skills' | 'Attitudes' | 'Comprehensive';
}

export interface CurriculumMetadataElement {
  id: string;
  type: 'Competency' | 'Value' | 'PCI'; // Pertinent and Contemporary Issue
  name: string;
  description?: string;
}

export interface CurriculumValidationResult {
  valid: boolean;
  errors: string[];
}

export type CurriculumAuthorityStatus =
  | 'AUTHORITATIVE_VERIFIED'
  | 'AUTHORITATIVE_PENDING_REVIEW'
  | 'SOURCE_REQUIRED'
  | 'NON_AUTHORITATIVE_REFERENCE'
  | 'NOT_SUPPORTED';

export interface CurriculumCoverageRecord {
  grade: string;
  learningArea: string;
  curriculumVersion: string;
  authorityStatus: CurriculumAuthorityStatus;
  provenanceStatus: string;
  canonicalStatus: 'ACTIVE' | 'PENDING' | 'NON_AUTHORITATIVE' | 'INACTIVE';
  sourceAvailable: boolean;
  sourceVerified: boolean;
  generationAllowed: boolean;
  alignmentAllowed: boolean;
  actionRequired: string;
}

export interface CanonicalSowNode {
  week: number;
  lesson: number;
  term: string;
  strandId: string;
  strandCode?: string;
  strandTitle: string;
  subStrandId: string;
  subStrandCode?: string;
  subStrandTitle: string;
  learningOutcomeIds: string[];
  learningOutcomesText: string;
  keyInquiryQuestions: string[];
}

export interface SchoolSowSchedule {
  teachingWeeks: number;
  lessonsPerWeek: number;
}

export type SowCapacityStatus = 'EXACT_MATCH' | 'EXCESS_CAPACITY' | 'INSUFFICIENT_CAPACITY';

export interface SowCapacityEvaluation {
  grade: string;
  subject: string;
  terms: string[];
  canonicalLessonCount: number;
  teachingWeeks: number;
  lessonsPerWeek: number;
  totalAvailablePeriods: number;
  status: SowCapacityStatus;
  canGenerate: boolean;
  unscheduledLessons: number;
  unusedCapacity: number;
  message: string;
}

export interface CanonicalCurriculumLesson {
  curriculumLessonId: string;
  grade: string;
  subject: string;
  term: string;
  strand: string;
  subStrand: string;
  lessonNumber: number;
  specificLearningOutcome: string;
  keyInquiryQuestion?: string;
  suggestedLessonAllocation?: number;
}

export interface ScheduledCurriculumLesson {
  curriculumLessonId: string;
  schoolWeek: number;
  lessonPeriod: number;
  term: string;
  canonicalLesson: CanonicalCurriculumLesson;
}

