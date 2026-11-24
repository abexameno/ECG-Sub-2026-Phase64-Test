export type TeacherResourceType = 'SCHEME_OF_WORK' | 'LESSON_PLAN' | 'LESSON_NOTES' | 'ASSESSMENT';

export type TeacherResourceStatus = 'CREATING' | 'READY' | 'NEEDS_REVIEW' | 'FAILED' | 'ARCHIVED';

export interface TeacherContext {
  schoolId: string;
  gradeId: string;
  learningAreaId: string;
  academicYear: number;
  termId: string;
}

export interface AdvancedResourceOptions {
  lessonDurationMinutes?: number;
  difficultyLevel?: 'STANDARD' | 'SIMPLIFIED' | 'EXTENDED';
  teachingApproach?: 'INQUIRY_BASED' | 'DIRECT_INSTRUCTION' | 'PROJECT_BASED' | 'COLLABORATIVE';
  differentiationLevel?: 'NONE' | 'SUPPORT_AND_EXTENSION';
  languagePreference?: 'BRITISH_ENGLISH';
}

export interface TeacherResourceSelection {
  schemeOfWork: boolean;
  lessonPlans: boolean;
  lessonNotes: boolean;
  assessments: boolean;
  advancedOptions?: AdvancedResourceOptions;
}

export interface TeacherResourceItem {
  id: string;
  type: TeacherResourceType;
  title: string;
  status: TeacherResourceStatus;
  artifactId?: string;
  artifactVersion?: number;
  assessmentId?: string;
  content?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingPackage {
  packageId: string;
  schoolId: string;
  teacherId: string;
  context: TeacherContext;
  status: TeacherResourceStatus;
  resources: TeacherResourceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TodayLessonSummary {
  grade: string;
  learningArea: string;
  term: string;
  week: number;
  lessonNumber: number;
  strand: string;
  subStrand: string;
  topicTitle: string;
  learningOutcome: string;
  lessonPlanArtifactId?: string;
  lessonNotesArtifactId?: string;
  assessmentId?: string;
}
