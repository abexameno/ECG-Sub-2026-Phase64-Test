export type LearningGroupPurpose =
  | 'REINFORCEMENT'
  | 'GUIDED_PRACTICE'
  | 'CORE_LEARNING'
  | 'REVIEW'
  | 'EXTENSION'
  | 'TARGETED_INSTRUCTION'
  | 'CUSTOM';

export type LearningGroupStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export type MembershipStatus = 'ACTIVE' | 'REMOVED' | 'COMPLETED';

export interface LearningGroup {
  id: string;
  schoolId: string;
  classGroupId: string;
  teacherId: string;
  academicYearId: string;
  learningAreaId: string;
  curriculumVersionId: string;
  name: string;
  purpose: LearningGroupPurpose;
  learningOutcomeIds: string[];
  objective: string;
  status: LearningGroupStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface LearningGroupMembership {
  id: string;
  schoolId: string;
  learningGroupId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  joinedAt: string;
  leftAt?: string;
  status: MembershipStatus;
  reason?: string;
  createdAt: string;
  createdBy: string;
}

export interface LearningGroupSuggestion {
  id: string;
  schoolId: string;
  classGroupId: string;
  learningOutcomeId: string;
  purpose: LearningGroupPurpose;
  suggestedName: string;
  rationale: string;
  learnerIds: string[];
  suggestedStrategy: string;
  createdAt: string;
}
