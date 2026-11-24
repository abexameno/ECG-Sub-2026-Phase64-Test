



import { ContentType, QuestionType, QuestionDifficulty } from './types/content';

export * from './types/content';
export * from './types/user';
export * from './types/assessment';
export * from './types/window';
export * from './types/school';
export * from './types/curriculum';
export * from './types/teachingPlan';
export * from './types/generation';
export * from './types/artifact';
export * from './types/academicOperations';
export * from './types/notification';

export type Theme = 'light' | 'dark';

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
    /** Physical page in the uploaded source document, when determinable. */
    sourcePage?: number;
    // Phase 25B ROWC Completion fields
    isTaught?: boolean;
    actualTeachingDate?: string;
    taughtStatus?: 'PENDING' | 'COMPLETED';
}

export interface SchemeOfWorkData {
    grade: string;
    subject: string;
    term: string;
    teacher: string;
    entries: SchemeOfWorkEntry[];
}

export interface FormState {
  schoolId?: string;
  grade: string;
  subject: string;
  topic: string;
  topicInputMode: 'curriculum' | 'manual';
  multiSelectTopics: { [strand: string]: string[] }; // { "Strand Name": ["Sub-strand 1", "Sub-strand 2"] }
  contentType: ContentType;
  term?: 'Term 1' | 'Term 2' | 'Term 3' | 'All Terms';
  terms: string[];
  week?: string;
  lessonNumber?: string;
  selectedLessons?: { week: string, lesson: string }[];
  selectedWeeks?: string[];
  distributionMode: 'auto' | 'manual';
  totalQuestions: number;
  questionCounts: { [key in QuestionType]?: number };
  questionMarks: { [key in QuestionType]?: number }; // Optional: Custom marks per type
  additionalInformation?: string; // For context like "Class has visual learners"
  additionalInstructions: string; // Specific AI commands
  documentFile?: File;
  documentText?: string;
  documentImageBase64?: string;
  documentImageMimeType?: string;
  startPage?: number;
  endPage?: number;
  generateImages: boolean;
  imageSize: '1K' | '2K' | '4K';
  imageAspectRatio?: string;
  markingSchemeFile?: File;
  markingSchemeText?: string;
  markingSchemeImageBase64?: string;
  markingSchemeImageMimeType?: string;
  difficulty: QuestionDifficulty;
  textbookReference: string;
  showMarksAdjustment?: boolean;
  rowcData?: ROWCFormData;
  schemeOfWorkData?: SchemeOfWorkData;
  additionalSowInfo?: string;
  teachingWeeks?: number;
  lessonsPerWeek?: number;
  strictCurriculumAdherence: boolean;
  // SOW -> Lesson Plan -> Notes Workflow Linkage (Phase 25A)
  parentArtifactId?: string;
  masterSowId?: string;
  curriculumLessonId?: string;
  scheduledLessonId?: string;
  // Phase 30 & 31 Teacher Action -> Resource & Follow-Up Linkage
  teacherActionId?: string;
  sourceTeacherActionId?: string;
  sourceInterpretationId?: string;
  ecgArtifactId?: string;
  originalEcgArtifactId?: string;
  originalAssessmentId?: string;
  supportingResourceId?: string;
  isFollowUpAssessment?: boolean;
  teacherActionContext?: {
    actionId: string;
    actionType: string;
    scope: 'WHOLE_CLASS' | 'SELECTED_LEARNERS' | 'INDIVIDUAL_LEARNER';
    focusArea: string;
    teacherNotes?: string;
    classGroupId?: string;
    learnerId?: string;
    selectedLearnerIds?: string[];
    sourceInterpretationId?: string;
    ecgArtifactId: string;
    originalEcgArtifactId?: string;
    originalAssessmentId?: string;
    supportingResourceId?: string;
    isFollowUpAssessment?: boolean;
    grade?: string;
    subject?: string;
    term?: string;
    week?: string;
    lesson?: string;
    strand?: string;
    subStrand?: string;
    specificLearningOutcome?: string;
    learningOutcomes?: string;
  };
  sowLessonContext?: {
    sowTitle?: string;
    week: string;
    lesson: string;
    strand: string;
    subStrand: string;
    learningOutcomes: string;
    inquiryQuestions?: string;
    learningExperiences?: string;
    learningResources?: string;
    assessment?: string;
    remarks?: string;
    grade?: string;
    subject?: string;
    term?: string;
    sourceSowId?: string;
    sourceSowEntryId?: string;
    sourceDocumentRef?: string;
  };
}

export interface GeneratedQuestion {
  id?: string;
  questionType: QuestionType;
  questionText: string;
  options?: string[]; // For Multiple Choice
  correctOption?: string; // 'A', 'B', 'C', or 'D'
  correctAnswer: string; // Full text answer
  explanation?: string;
  imageDescription?: string; // Prompt for image generation
  imageUrl?: string; // Generated image URL (base64)
  isGeneratingImage?: boolean;
  requiresImage?: boolean; // Flag from AI if visual is needed
  marks?: number;
  bloomsTaxonomyLevel?: string;
}

export interface GeneratedContent {
  id?: string; // UUID for saving
  ownerId?: string; // Teacher or user who owns this content
  title: string;
  body?: string; // Markdown content for Lesson Plans, Notes, etc.
  questions?: GeneratedQuestion[]; // For Assessments
  schemeOfWorkData?: SchemeOfWorkData;
  rowcData?: ROWCFormData;
  imagePrompts?: { placeholder: string; prompt: string }[]; // For body images
  auditReport?: string; // Persistent AI audit
  summary?: string; // Persistent AI summary
  rubric?: string; // Persistent AI rubric
  metadata?: {
      schoolId?: string;
      grade: string;
      subject: string;
      topic: string;
      contentType: ContentType;
      term?: string;
      terms?: string[];
      imageSize?: '1K' | '2K' | '4K';
      parentArtifactId?: string;
      masterSowId?: string;
      sourceSowId?: string;
      sourceSowEntryId?: string;
      sourceDocumentRef?: string;
      sowScopeValidation?: {
        status: 'passed';
        validatedAt: string;
        warnings: string[];
      };
      curriculumLessonId?: string;
      scheduledLessonId?: string;
      teacherActionId?: string;
      sourceTeacherActionId?: string;
      sourceInterpretationId?: string;
      ecgArtifactId?: string;
      originalEcgArtifactId?: string;
      originalAssessmentId?: string;
      supportingResourceId?: string;
      isFollowUpAssessment?: boolean;
      difficulty?: QuestionDifficulty;
      teacherActionContext?: FormState['teacherActionContext'];
      elmsPublicationStatus?: string;
      elmsAssessmentId?: string;
      publishedAt?: string;
      classGroupId?: string;
      actionScope?: 'WHOLE_CLASS' | 'SELECTED_LEARNERS' | 'INDIVIDUAL_LEARNER';
      selectedLearnerIds?: string[];
      targetLearnerId?: string;
      week?: string;
      lessonNumber?: string;
      strand?: string;
      subStrand?: string;
      specificLearningOutcome?: string;
      elmsPublication?: {
        publicationId: string;
        elmsResourceId: string;
        publishedAt: string;
        status: 'PUBLISHED' | 'UPDATED' | 'WITHDRAWN' | 'FAILED' | 'NOT_PUBLISHED';
        schoolId: string;
        publishedBy?: string;
        errorDetails?: string;
      };
  };
  versions?: GeneratedContent[]; // History of changes
  savedAt?: string; // Timestamp for versioning
}

export interface UsageLog {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  contentType: ContentType;
  grade: string;
  subject: string;
  topic: string;
  questionCount?: number;
  featuresUsed: string[]; // e.g., ['Image Generation', 'Document Upload']
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
    includeAudit?: boolean; // Toggle for export
    includeSummary?: boolean; // Toggle for export
    includeRubric?: boolean; // Toggle for export
    includeBody?: boolean; // Toggle for main content body
    schoolLogo?: string;
    tscNumber?: string;
    academicYear?: string | number;
}

export interface RawMCQ {
  questionType: string;
  questionText: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
  imageDescription?: string;
  bloomsTaxonomyLevel?: string;
  imageRequired?: boolean;
}

export interface RawShortAnswer {
    questionType: string;
    questionText: string;
    correctAnswer: string;
    explanation?: string;
    imageDescription?: string;
    bloomsTaxonomyLevel?: string;
    imageRequired?: boolean;
}

export interface RawTrueFalse {
    questionType: string;
    questionText: string;
    correctAnswer: string;
    explanation?: string;
    imageDescription?: string;
    bloomsTaxonomyLevel?: string;
    imageRequired?: boolean;
}

export interface RawEssay {
    questionType: string;
    questionText: string;
    correctAnswer: string;
    explanation?: string;
    imageDescription?: string;
    bloomsTaxonomyLevel?: string;
    imageRequired?: boolean;
}

export interface RawDiscussion {
    questionType: string;
    questionText: string;
    correctAnswer: string;
    explanation?: string;
    imageDescription?: string;
    bloomsTaxonomyLevel?: string;
    imageRequired?: boolean;
}


export interface Referral {
    id: string; // The referral code
    inviterId: string;
    inviteeEmail: string;
    inviteeId?: string; // Set when they register
    status: 'pending' | 'completed';
    createdAt: string;
    completedAt?: string;
}

export type NotificationType =
  | 'info'
  | 'poll'
  | 'announcement'
  | 'credit_change'
  | 'credit_purchase'
  | 'transaction_status'
  | 'payment_verified'
  | 'account_update'
  | 'system_alert';

export interface AppNotification {
    id: string;
    userId: string | 'all';
    recipientUserId?: string;
    schoolId?: string;
    schoolName?: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    type?: NotificationType;
    pollOptions?: string[];
    pollId?: string;
    metadata?: {
      transactionId?: string;
      transactionNumber?: string;
      amount?: number;
      creditAmount?: number;
      creditsAwarded?: number;
      newBalance?: number;
      previousBalance?: number;
      updatedBy?: string;
      reason?: string;
      link?: string;
    };
    actionUrl?: string;
    readAt?: string;
}

export type RawQuestion = RawMCQ | RawShortAnswer | RawTrueFalse | RawEssay | RawDiscussion;