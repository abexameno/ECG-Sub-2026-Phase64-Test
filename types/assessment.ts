import { ContentType, QuestionType, QuestionDifficulty } from './content';

export enum ExportFormat {
  PDF = 'PDF (.pdf)',
  Word = 'Word (.docx)',
  Excel = 'Excel (.xlsx)',
  CSV = 'CSV (.csv)',
  PowerPoint = 'PowerPoint (.pptx)',
  MoodleXML = 'Moodle XML (.xml)',
}

export enum AssessmentExportType {
  QuestionsOnly = 'Questions Only - Students Copy',
  QuestionsAndAnswers = 'Questions & Answers - Teachers Marking Guide',
}

export interface ROWCLessonEntry {
  id: string;
  date: string;
  grade: string;
  subject: string;
  term: string;
  strand: string;
  subStrand: string;
  strandInputMode?: 'curriculum' | 'manual';
  subStrandInputMode?: 'curriculum' | 'manual';
  lessonTitle: string;
  learningActivities: string;
  resources: string;
  assessment: string;
  remarks: string;
}

export interface ROWCFormData {
  weekRange: string;
  lessons: ROWCLessonEntry[];
  reflection: string;
}

export interface SchemeOfWorkEntry {
    id: string;
    week: string;
    lesson: string;
    strand: string;
    subStrand: string;
    learningOutcomes: string;
    inquiryQuestions: string;
    learningExperiences: string;
    learningResources: string;
    assessment: string;
    remarks: string;
}

export interface SchemeOfWorkData {
    grade: string;
    subject: string;
    term: string;
    teacher: string;
    entries: SchemeOfWorkEntry[];
}

export interface FormState {
  grade: string;
  subject: string;
  topic: string;
  topicInputMode: 'curriculum' | 'manual';
  multiSelectTopics: { [strand: string]: string[] };
  contentType: ContentType;
  term?: 'Term 1' | 'Term 2' | 'Term 3';
  terms: string[];
  week?: string;
  lessonNumber?: string;
  selectedLessons?: { week: string, lesson: string }[];
  selectedWeeks?: string[];
  distributionMode: 'auto' | 'manual';
  totalQuestions: number;
  questionCounts: { [key in QuestionType]?: number };
  questionMarks: { [key in QuestionType]?: number };
  additionalInstructions: string;
  documentFile?: File;
  documentText?: string;
  documentImageBase64?: string;
  documentImageMimeType?: string;
  startPage?: number;
  endPage?: number;
  generateImages: boolean;
  imageSize: '1K' | '2K' | '4K';
  imageAspectRatio?: string;
  difficulty: QuestionDifficulty;
  textbookReference: string;
  rowcData?: ROWCFormData;
  schemeOfWorkData?: SchemeOfWorkData;
  strictCurriculumAdherence: boolean;
}

export interface ExportHeaderInfo {
    includeHeader: boolean;
    schoolName: string;
    teacherName: string;
    gradeLevel: string;
    subject: string;
    contentType: string;
    term: string;
    fontFamily: string;
    layoutColumns: 'one' | 'two';
    spacing: 'compact' | 'normal' | 'spacious';
    tableStyle: 'grid' | 'lightHorizontalLines' | 'noBorders';
    pageMargins: 'normal' | 'narrow' | 'wide';
    includeAudit?: boolean;
    includeSummary?: boolean;
    includeRubric?: boolean;
    includeBody?: boolean;
}
