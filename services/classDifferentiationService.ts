import {
  LearningGroup,
  LearningGroupMembership,
  LearningGroupPurpose,
  LearningGroupStatus,
  MembershipStatus,
  LearningGroupSuggestion,
} from '../types/differentiation.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { LearnerRosterService } from './learnerRosterService.ts';
import { CanonicalCurriculumService } from './canonicalCurriculumService.ts';
import { LearnerDifferentiatedSupportService } from './learnerDifferentiatedSupportService.ts';
import { AdaptiveLearningPathwayService } from './adaptiveLearningPathwayService.ts';
import { TeachingActivityService } from './teachingActivityService.ts';
import { AuditService } from './auditService.ts';
import { AcademicOperationsService } from './academicOperationsService.ts';

const groupStore = new Map<string, LearningGroup>(); // key: groupId
const membershipStore = new Map<string, LearningGroupMembership>(); // key: membershipId
const suggestionStore = new Map<string, LearningGroupSuggestion>(); // key: suggestionId
const idempotencyStore = new Map<string, string>(); // key: idempotencyKey -> groupId

export const ClassDifferentiationService = {
  clearStore(): void {
    groupStore.clear();
    membershipStore.clear();
    suggestionStore.clear();
    idempotencyStore.clear();
  },

  authorizeTeacherForSchool(schoolId: string, teacherId: string): void {
    const hasAccess = SchoolMembershipService.validateAccess(teacherId, schoolId, 'TEACHER');
    if (!hasAccess) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        teacherId,
        action: 'DIFFERENTIATION_ACCESS',
        reason: 'Teacher not active in school membership',
      });
      throw new Error(`Unauthorized access: Teacher ${teacherId} is not an active member of school ${schoolId}`);
    }
  },

  authorizeTeacherForClassGroup(schoolId: string, teacherId: string, classGroupId: string): void {
    this.authorizeTeacherForSchool(schoolId, teacherId);

    const classGroup = ClassGroupService.getClassGroupById(classGroupId);
    if (!classGroup || classGroup.schoolId !== schoolId) {
      throw new Error(`Class group not found or belongs to another school: ${classGroupId}`);
    }

    const memberships = SchoolMembershipService.getMemberships(teacherId);
    const activeMem = memberships.find((m) => m.schoolId === schoolId && m.status === 'ACTIVE');
    if (activeMem && (activeMem.role === 'SCHOOL_ADMIN' || activeMem.role === 'SUPER_ADMIN' || activeMem.role === 'ACADEMIC_ADMIN')) {
      return;
    }

    const assignments = AcademicOperationsService.getTeacherAssignments(schoolId, teacherId);
    const isAssigned = assignments.some((a) => a.gradeId === classGroup.gradeId);

    if (!isAssigned) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        teacherId,
        classGroupId,
        action: 'CLASS_GROUP_AUTHORIZATION',
        reason: 'Teacher is not assigned to class group',
      });
      throw new Error(`Teacher ${teacherId} is not assigned to class group ${classGroupId}`);
    }
  },

  validateLearnersOnRoster(schoolId: string, classGroupId: string, learnerIds: string[]): void {
    for (const learnerId of learnerIds) {
      const learner = LearnerRosterService.getLearnerById(learnerId, schoolId);
      if (!learner) {
        throw new Error(`Learner ${learnerId} is not on the school roster`);
      }
      const classLearners = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
      if (!classLearners.some((l) => l.id === learnerId)) {
        throw new Error(`Learner ${learnerId} is not in class group ${classGroupId}`);
      }
    }
  },

  // 1. Group Creation & Management
  createLearningGroup(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    academicYearId: string;
    learningAreaId: string;
    curriculumVersionId: string;
    name: string;
    purpose: LearningGroupPurpose;
    learningOutcomeIds: string[];
    objective: string;
    learnerIds: string[];
    idempotencyKey?: string;
  }): { group: LearningGroup; memberships: LearningGroupMembership[] } {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);
    this.validateLearnersOnRoster(params.schoolId, params.classGroupId, params.learnerIds);

    if (params.idempotencyKey && idempotencyStore.has(params.idempotencyKey)) {
      const existingId = idempotencyStore.get(params.idempotencyKey)!;
      const group = groupStore.get(existingId)!;
      const memberships = this.getGroupMemberships(group.id, params.schoolId, params.teacherId);
      return { group, memberships };
    }

    const groupId = `grp_${params.schoolId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const group: LearningGroup = {
      id: groupId,
      schoolId: params.schoolId,
      classGroupId: params.classGroupId,
      teacherId: params.teacherId,
      academicYearId: params.academicYearId,
      learningAreaId: params.learningAreaId,
      curriculumVersionId: params.curriculumVersionId,
      name: params.name,
      purpose: params.purpose,
      learningOutcomeIds: params.learningOutcomeIds,
      objective: params.objective,
      status: 'ACTIVE',
      createdAt: now,
      createdBy: params.teacherId,
      updatedAt: now,
      updatedBy: params.teacherId,
    };

    groupStore.set(groupId, group);

    const memberships: LearningGroupMembership[] = [];
    for (const learnerId of params.learnerIds) {
      const membershipId = `mem_${groupId}_${learnerId}_${Date.now()}`;
      const membership: LearningGroupMembership = {
        id: membershipId,
        schoolId: params.schoolId,
        learningGroupId: groupId,
        learnerId,
        classGroupId: params.classGroupId,
        teacherId: params.teacherId,
        joinedAt: now,
        status: 'ACTIVE',
        createdAt: now,
        createdBy: params.teacherId,
      };
      membershipStore.set(membershipId, membership);
      memberships.push(membership);
    }

    if (params.idempotencyKey) {
      idempotencyStore.set(params.idempotencyKey, groupId);
    }

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'LEARNING_GROUP_CREATED',
      groupId,
      name: params.name,
      teacherId: params.teacherId,
      memberCount: params.learnerIds.length,
    });

    return { group, memberships };
  },

  getLearningGroup(groupId: string, schoolId: string, teacherId: string): LearningGroup {
    this.authorizeTeacherForSchool(schoolId, teacherId);
    const group = groupStore.get(groupId);
    if (!group || group.schoolId !== schoolId) {
      throw new Error(`Learning group not found or unauthorized: ${groupId}`);
    }
    return group;
  },

  getGroupsForClass(schoolId: string, teacherId: string, classGroupId: string): LearningGroup[] {
    this.authorizeTeacherForClassGroup(schoolId, teacherId, classGroupId);
    const list: LearningGroup[] = [];
    for (const group of groupStore.values()) {
      if (group.schoolId === schoolId && group.classGroupId === classGroupId) {
        list.push({ ...group });
      }
    }
    return list;
  },

  getGroupMemberships(groupId: string, schoolId: string, teacherId: string): LearningGroupMembership[] {
    this.getLearningGroup(groupId, schoolId, teacherId);
    const list: LearningGroupMembership[] = [];
    for (const mem of membershipStore.values()) {
      if (mem.schoolId === schoolId && mem.learningGroupId === groupId) {
        list.push({ ...mem });
      }
    }
    return list;
  },

  addLearnerToGroup(params: {
    schoolId: string;
    teacherId: string;
    groupId: string;
    learnerId: string;
    reason?: string;
  }): LearningGroupMembership {
    const group = this.getLearningGroup(params.groupId, params.schoolId, params.teacherId);
    this.validateLearnersOnRoster(params.schoolId, group.classGroupId, [params.learnerId]);

    // Check if already active
    for (const mem of membershipStore.values()) {
      if (mem.learningGroupId === params.groupId && mem.learnerId === params.learnerId && mem.status === 'ACTIVE') {
        throw new Error(`Learner ${params.learnerId} is already an active member of this group`);
      }
    }

    const membershipId = `mem_${params.groupId}_${params.learnerId}_${Date.now()}`;
    const now = new Date().toISOString();
    const membership: LearningGroupMembership = {
      id: membershipId,
      schoolId: params.schoolId,
      learningGroupId: params.groupId,
      learnerId: params.learnerId,
      classGroupId: group.classGroupId,
      teacherId: params.teacherId,
      joinedAt: now,
      status: 'ACTIVE',
      reason: params.reason,
      createdAt: now,
      createdBy: params.teacherId,
    };

    membershipStore.set(membershipId, membership);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LEARNER_ADDED_TO_GROUP',
      groupId: params.groupId,
      learnerId: params.learnerId,
      teacherId: params.teacherId,
    });

    return membership;
  },

  removeLearnerFromGroup(params: {
    schoolId: string;
    teacherId: string;
    groupId: string;
    learnerId: string;
    reason?: string;
  }): LearningGroupMembership {
    this.getLearningGroup(params.groupId, params.schoolId, params.teacherId);

    let targetMem: LearningGroupMembership | undefined;
    for (const mem of membershipStore.values()) {
      if (mem.learningGroupId === params.groupId && mem.learnerId === params.learnerId && mem.status === 'ACTIVE') {
        targetMem = mem;
        break;
      }
    }

    if (!targetMem) {
      throw new Error(`Active membership not found for learner ${params.learnerId} in group ${params.groupId}`);
    }

    targetMem.status = 'REMOVED';
    targetMem.leftAt = new Date().toISOString();
    if (params.reason) targetMem.reason = params.reason;

    membershipStore.set(targetMem.id, targetMem);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LEARNER_REMOVED_FROM_GROUP',
      groupId: params.groupId,
      learnerId: params.learnerId,
      teacherId: params.teacherId,
    });

    return targetMem;
  },

  updateGroupStatus(params: {
    schoolId: string;
    teacherId: string;
    groupId: string;
    status: LearningGroupStatus;
  }): LearningGroup {
    const group = this.getLearningGroup(params.groupId, params.schoolId, params.teacherId);
    group.status = params.status;
    group.updatedAt = new Date().toISOString();
    group.updatedBy = params.teacherId;

    groupStore.set(group.id, group);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LEARNING_GROUP_STATUS_UPDATED',
      groupId: group.id,
      status: params.status,
      teacherId: params.teacherId,
    });

    return group;
  },

  // 2. Deterministic Grouping Suggestion Engine
  generateSuggestions(params: {
    schoolId: string;
    teacherId: string;
    classGroupId: string;
    learningOutcomeId: string;
  }): LearningGroupSuggestion[] {
    this.authorizeTeacherForClassGroup(params.schoolId, params.teacherId, params.classGroupId);

    const learners = LearnerRosterService.getLearnersForClassGroup(params.classGroupId, params.schoolId);
    const developingLearners: string[] = [];
    const extensionLearners: string[] = [];
    const reinforcementLearners: string[] = [];

    for (const learner of learners) {
      try {
        const state = AdaptiveLearningPathwayService.deriveLearningState({
          schoolId: params.schoolId,
          teacherId: params.teacherId,
          learnerId: learner.id,
          classGroupId: params.classGroupId,
          learningOutcomeId: params.learningOutcomeId,
        });

        if (state.state === 'SUPPORT_RECOMMENDED') {
          developingLearners.push(learner.id);
        } else if (state.state === 'EXTENSION_OPPORTUNITY') {
          extensionLearners.push(learner.id);
        } else if (state.state === 'READY_FOR_REINFORCEMENT') {
          reinforcementLearners.push(learner.id);
        }
      } catch {
        // Skip learners without sufficient data
      }
    }

    const suggestions: LearningGroupSuggestion[] = [];
    const now = new Date().toISOString();

    if (developingLearners.length > 0) {
      const sugId = `sug_dev_${params.schoolId}_${Date.now()}`;
      const sug: LearningGroupSuggestion = {
        id: sugId,
        schoolId: params.schoolId,
        classGroupId: params.classGroupId,
        learningOutcomeId: params.learningOutcomeId,
        purpose: 'GUIDED_PRACTICE',
        suggestedName: 'Guided Practice Group',
        rationale: `${developingLearners.length} learner(s) show developing mastery and would benefit from guided practice.`,
        learnerIds: developingLearners,
        suggestedStrategy: 'GUIDED_PRACTICE',
        createdAt: now,
      };
      suggestionStore.set(sugId, sug);
      suggestions.push(sug);
    }

    if (extensionLearners.length > 0) {
      const sugId = `sug_ext_${params.schoolId}_${Date.now()}`;
      const sug: LearningGroupSuggestion = {
        id: sugId,
        schoolId: params.schoolId,
        classGroupId: params.classGroupId,
        learningOutcomeId: params.learningOutcomeId,
        purpose: 'EXTENSION',
        suggestedName: 'Extension Group',
        rationale: `${extensionLearners.length} learner(s) have demonstrated mastery and are ready for extension tasks.`,
        learnerIds: extensionLearners,
        suggestedStrategy: 'EXTENSION',
        createdAt: now,
      };
      suggestionStore.set(sugId, sug);
      suggestions.push(sug);
    }

    return suggestions;
  },

  // 3. Group Delivery via TeachingActivity
  deliverGroupInstruction(params: {
    schoolId: string;
    teacherId: string;
    groupId: string;
  }): LearningGroup {
    const group = this.getLearningGroup(params.groupId, params.schoolId, params.teacherId);

    TeachingActivityService.createTeachingActivity({
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      teachingPlanId: 'tp_default',
      teachingAllocationId: 'ta_default',
      curriculumVersionId: group.curriculumVersionId,
      learningOutcomeId: group.learningOutcomeIds[0],
      activityType: 'LESSON_DELIVERY',
    });

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LEARNING_GROUP_INSTRUCTION_DELIVERED',
      groupId: group.id,
      teacherId: params.teacherId,
    });

    return group;
  },
};
