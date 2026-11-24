import { SchoolProfile } from './school.ts';
import { TeacherProfile, TeacherTeachingContext } from './teacherOnboarding.ts';

export type EntityStatus = 'ACTIVE' | 'INACTIVE';

export interface Learner {
  id: string;
  schoolId: string;
  displayName: string;
  learnerIdentifier?: string; // School-scoped stable identifier
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ClassGroup {
  id: string;
  schoolId: string;
  name: string; // e.g. "Grade 3A", "Grade 3 East", or "Grade 3"
  gradeId: string; // e.g. "grade-3"
  stream?: string;
  learnerCount?: number;
  academicYearId: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ClassRoster {
  id: string;
  schoolId: string;
  classGroupId: string;
  learnerId: string;
  academicYearId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherTeachingAssignment {
  id: string;
  schoolId: string;
  teacherId: string;
  gradeId: string;
  classGroupId?: string;
  learningAreaId: string;
  academicYearId: string;
  termId?: string;
  status: EntityStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassPerformanceSummary {
  classGroupId: string;
  learningAreaId: string;
  totalLearners: number;
  evidenceCount: number;
  strongCount: number;
  developingCount: number;
  emergingCount: number;
  insufficientCount: number;
  attentionRequiredCount: number;
}

export interface TeacherTeachingOverview {
  teacher: TeacherProfile;
  activeSchool: SchoolProfile | null;
  assignments: TeacherTeachingAssignment[];
  classes: ClassGroup[];
  activeAssignment: TeacherTeachingAssignment | null;
  activeClassGroup: ClassGroup | null;
  activeLearners: Learner[];
  activeTeachingContext: TeacherTeachingContext | null;
  todayLesson: any | null;
  performanceSummary?: ClassPerformanceSummary;
}
