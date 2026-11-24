export enum ContentType {
  SchemeOfWork = 'Schemes of Work',
  LessonPlan = 'Lesson Plan',
  LessonNotes = 'Lesson Notes',
  StudyGuide = 'Learner Study Guide',
  Quiz = 'Short Quiz',
  TopicExam = 'Topic Exam',
  TermExam = 'Comprehensive Term Exam',
  Assessment = 'Competency-Based Assessment',
  RecordOfWorkCovered = 'Record of Work Covered (ROWC)',
}

export enum QuestionType {
  MultipleChoice = 'Multiple Choice',
  ShortAnswer = 'Short Answer',
  TrueFalse = 'True/False',
  Discussion = 'Discussion',
  Essay = 'Essay',
}

export enum QuestionDifficulty {
  Mixed = 'Mixed difficulties',
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
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
  schemeOfWorkData?: any; // To be defined
  rowcData?: any; // To be defined
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
  };
  versions?: GeneratedContent[]; // History of changes
  savedAt?: string; // Timestamp for versioning
}

export enum AISuggestionType {
  BloomsTaxonomy = 'BLOOMS_TAXONOMY',
  LearningOutcomes = 'LEARNING_OUTCOMES',
  GradingRubric = 'GRADING_RUBRIC',
  ImproveQuestions = 'IMPROVE_QUESTIONS',
  GenerateLessonPlan = 'GENERATE_LESSON_PLAN',
}

export type RawQuestion = any;
