export interface TextbookReference {
  subject: string;
  grade: string;
  textbookName: string;
  publisher?: string;
}

export interface AcademicTermConfig {
  termName: string;
  teachingWeeks: number;
  startDate?: string;
  endDate?: string;
}

export interface AcademicCalendar {
  term1?: AcademicTermConfig;
  term2?: AcademicTermConfig;
  term3?: AcademicTermConfig;
}

export interface TeachingConfig {
  lessonsPerWeek: number;
  lessonDurationMinutes: number;
  teachingWeeksPerTerm: number;
  revisionWeeks: number;
  assessmentWeeks: number;
}

export interface SchoolProfile {
  id: string;
  name: string;
  logo?: string; // Added logo property
  schoolType?: string;
  country?: string;
  county?: string;
  schoolCode?: string;
  gradesOffered?: string[];
  learningAreasOffered?: string[];
  curriculumSystem?: string;
  academicYear?: string;
  academicCalendar?: AcademicCalendar;
  teachingConfig: TeachingConfig;
  contentPreferences?: {
    defaultTextbooks?: TextbookReference[];
    sowStyle?: string;
    lessonPlanStyle?: string;
  };
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  // Phase 49 School Administration & Duplicate Resolution
  status?: 'active' | 'deactivated' | 'merged' | 'archived';
  isAuthoritative?: boolean;
  canonicalSchoolId?: string;
  aliases?: string[];
  mergedAt?: string;
  mergedBy?: string;
  mergeNotes?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivationReason?: string;
}

export interface SchoolDuplicateCandidate {
  id: string;
  schoolA: SchoolProfile;
  schoolB: SchoolProfile;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  recommendedCanonicalId: string;
  evidence: string[];
}

export interface SchoolMergeRequest {
  sourceSchoolId: string;
  targetSchoolId: string;
  mergedByUserId: string;
  notes?: string;
}

export interface SchoolMergeResult {
  success: boolean;
  sourceSchoolId: string;
  targetSchoolId: string;
  message: string;
  mergedAt: string;
  migratedMembershipsCount?: number;
  auditLogId?: string;
}
