import { SchoolProfile, TeachingConfig } from './school.ts';

export type MembershipRole = 'TEACHER' | 'ACADEMIC_ADMIN' | 'SCHOOL_ADMIN' | 'SUPER_ADMIN';

export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export interface TeacherProfile {
  id: string; // userId
  userId: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  professionalInfo?: {
    tscNumber?: string;
    qualifications?: string[];
    specialization?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface SchoolMembership {
  id: string;
  userId: string; // teacherId
  schoolId: string;
  role: MembershipRole;
  status: MembershipStatus;
  assignedClassGroupIds?: string[];
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherTeachingContext {
  schoolId: string;
  teacherId: string;
  gradeId: string;
  learningAreaId: string;
  termId: string;
  academicYearId?: string;
}

export interface SchoolSetupReadiness {
  isProfileComplete: boolean;
  isGradesConfigured: boolean;
  isLearningAreasConfigured: boolean;
  isTeachingConfigured: boolean;
  isCalendarConfigured: boolean;
  status: 'READY_TO_TEACH' | 'INCOMPLETE';
}

export interface TeacherSchoolReadModel {
  teacher: TeacherProfile;
  activeSchool: SchoolProfile | null;
  activeMembership: SchoolMembership | null;
  memberships: SchoolMembership[];
  authorizedTeachingContexts: TeacherTeachingContext[];
  activeTeachingContext: TeacherTeachingContext | null;
  todayLesson: any | null;
  readinessStatus: 'NO_SCHOOL' | 'NO_CONTEXT' | 'READY_TO_TEACH';
  schoolReadiness?: SchoolSetupReadiness;
}

export interface SchoolSearchQuery {
  name?: string;
  type?: string;
  country?: string;
}

export interface DuplicateSchoolCheckResult {
  isDuplicateLikely: boolean;
  matchingSchools: SchoolProfile[];
}

export interface SchoolConfigChangeImpact {
  schoolId: string;
  previousConfig: TeachingConfig;
  newConfig: TeachingConfig;
  capacityChangeSlots: number;
  capacityWarning?: string;
  reviewRequired: boolean;
}
