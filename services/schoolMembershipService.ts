import {
  TeacherProfile,
  SchoolMembership,
  MembershipRole,
  MembershipStatus,
  TeacherTeachingContext,
  TeacherSchoolReadModel,
  SchoolSetupReadiness,
} from '../types/teacherOnboarding.ts';
import { SchoolProfile, TeachingConfig } from '../types/school.ts';
import { SchoolConfigService } from './schoolConfigService.ts';
import { TeacherWorkspaceService } from './teacherWorkspaceService.ts';
import { DailyTeachingService } from './dailyTeachingService.ts';
import { AuditService } from './auditService.ts';
import { AcademicOperationsService } from './academicOperationsService.ts';
import { PersistentStateService } from './persistentStateService.ts';

// In-Memory Data Stores for Multi-School Memberships and Contexts
const teacherProfilesStore: Map<string, TeacherProfile> = new Map();
const membershipsStore: Map<string, SchoolMembership> = new Map();
const activeSchoolByUserId: Map<string, string> = new Map();
const activeContextByUserId: Map<string, TeacherTeachingContext> = new Map();

function initSeedData() {
  if (teacherProfilesStore.size > 0) return;

  const now = new Date().toISOString();

  // 1. Seed Teacher Profiles
  const adminProfile: TeacherProfile = {
    id: '1',
    userId: '1',
    displayName: 'Admin User',
    email: 'admin@exameno.com',
    phoneNumber: '0712345678',
    createdAt: now,
    updatedAt: now,
  };

  const janeProfile: TeacherProfile = {
    id: '2',
    userId: '2',
    displayName: 'Jane Doe',
    email: 'jane.doe@school.ac.ke',
    phoneNumber: '0722123456',
    professionalInfo: {
      tscNumber: 'TSC-123456',
      qualifications: ['B.Ed Science'],
      specialization: ['Integrated Science', 'Biology'],
    },
    createdAt: now,
    updatedAt: now,
  };

  const davidProfile: TeacherProfile = {
    id: '5',
    userId: '5',
    displayName: 'David Kimani',
    email: 'david.kimani@school.ac.ke',
    phoneNumber: '0733987654',
    createdAt: now,
    updatedAt: now,
  };

  const peterProfile: TeacherProfile = {
    id: '4',
    userId: '4',
    displayName: 'Peter Jones',
    email: 'peter.jones@school.ac.ke',
    phoneNumber: '0711222333',
    createdAt: now,
    updatedAt: now,
  };

  teacherProfilesStore.set('1', adminProfile);
  teacherProfilesStore.set('2', janeProfile);
  teacherProfilesStore.set('5', davidProfile);
  teacherProfilesStore.set('4', peterProfile);

  // 2. Seed School Memberships
  const janeLwpsMem: SchoolMembership = {
    id: 'mem_jane_lwps',
    userId: '2',
    schoolId: 'lwps',
    role: 'TEACHER',
    status: 'ACTIVE',
    assignedClassGroupIds: ['cg_lwps_g3a'],
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const davidLwpsMem: SchoolMembership = {
    id: 'mem_david_lwps',
    userId: '5',
    schoolId: 'lwps',
    role: 'SCHOOL_ADMIN',
    status: 'ACTIVE',
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const adminLwpsMem: SchoolMembership = {
    id: 'mem_admin_lwps',
    userId: '1',
    schoolId: 'lwps',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const peterSchoolBMem: SchoolMembership = {
    id: 'mem_peter_schoolb',
    userId: '4',
    schoolId: 'school-b',
    role: 'TEACHER',
    status: 'ACTIVE',
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const adminSchoolBMem: SchoolMembership = {
    id: 'mem_admin_schoolb',
    userId: '1',
    schoolId: 'school-b',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  membershipsStore.set(janeLwpsMem.id, janeLwpsMem);
  membershipsStore.set(davidLwpsMem.id, davidLwpsMem);
  membershipsStore.set(adminLwpsMem.id, adminLwpsMem);
  membershipsStore.set(peterSchoolBMem.id, peterSchoolBMem);
  membershipsStore.set(adminSchoolBMem.id, adminSchoolBMem);

  activeSchoolByUserId.set('1', 'lwps');
  activeSchoolByUserId.set('2', 'lwps');
  activeSchoolByUserId.set('5', 'lwps');
  activeSchoolByUserId.set('4', 'school-b');
}

// Role hierarchy rank helper
function getRoleRank(role: MembershipRole): number {
  switch (role) {
    case 'SUPER_ADMIN': return 4;
    case 'SCHOOL_ADMIN': return 3;
    case 'ACADEMIC_ADMIN': return 2;
    case 'TEACHER': return 1;
    default: return 0;
  }
}

export const SchoolMembershipService = {
  // 1. TEACHER PROFILE MANAGEMENT
  getTeacherProfile(userId: string): TeacherProfile {
    initSeedData();
    let profile = teacherProfilesStore.get(userId);
    if (!profile) {
      const now = new Date().toISOString();
      profile = {
        id: userId,
        userId,
        displayName: `Teacher ${userId.substring(0, 4)}`,
        email: `${userId}@exameno.com`,
        createdAt: now,
        updatedAt: now,
      };
      teacherProfilesStore.set(userId, profile);
    }
    return profile;
  },

  updateTeacherProfile(userId: string, updates: Partial<TeacherProfile>): TeacherProfile {
    const existing = this.getTeacherProfile(userId);
    const updated: TeacherProfile = {
      ...existing,
      ...updates,
      id: userId,
      userId,
      updatedAt: new Date().toISOString(),
    };
    teacherProfilesStore.set(userId, updated);
    PersistentStateService.persistTeacherProfileState({ userId, profile: updated });
    return updated;
  },

  // 2. AUTHORIZATION SECURITY BOUNDARY
  validateAccess(userId: string, schoolId: string, requiredRole?: MembershipRole): boolean {
    initSeedData();
    const memberships = Array.from(membershipsStore.values()).filter(
      m => m.userId === userId && m.schoolId === schoolId && m.status === 'ACTIVE'
    );

    if (memberships.length === 0) {
      return false;
    }

    if (!requiredRole) {
      return true;
    }

    const maxRoleRank = Math.max(...memberships.map(m => getRoleRank(m.role)));
    const requiredRank = getRoleRank(requiredRole);

    return maxRoleRank >= requiredRank;
  },

  // 3. MEMBERSHIP QUERYING & IDOR-PROTECTED ACCESS
  getMemberships(userId: string): SchoolMembership[] {
    initSeedData();
    return Array.from(membershipsStore.values()).filter(
      m => m.userId === userId && m.status !== 'REMOVED'
    );
  },

  getMembership(userId: string, schoolId: string): SchoolMembership | undefined {
    initSeedData();
    return Array.from(membershipsStore.values()).find(
      m => m.userId === userId && m.schoolId === schoolId && m.status === 'ACTIVE'
    );
  },

  addTeacherMembership(params: {
    userId: string;
    schoolId: string;
    role?: MembershipRole;
    status?: MembershipStatus;
    assignedClassGroupIds?: string[];
  }): SchoolMembership {
    initSeedData();
    const now = new Date().toISOString();
    const existing = Array.from(membershipsStore.values()).find(
      (m) => m.userId === params.userId && m.schoolId === params.schoolId
    );
    if (existing) {
      if (params.role) existing.role = params.role;
      if (params.status) existing.status = params.status;
      if (params.assignedClassGroupIds !== undefined) {
        existing.assignedClassGroupIds = params.assignedClassGroupIds;
      }
      existing.updatedAt = now;
      PersistentStateService.persistSchoolMembership(existing);
      return existing;
    }

    const membership: SchoolMembership = {
      id: `mem_${params.userId}_${params.schoolId}_${Date.now()}`,
      userId: params.userId,
      schoolId: params.schoolId,
      role: params.role || 'TEACHER',
      status: params.status || 'ACTIVE',
      assignedClassGroupIds: params.assignedClassGroupIds,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    membershipsStore.set(membership.id, membership);
    PersistentStateService.persistSchoolMembership(membership);
    return membership;
  },

  addMembership(params: {
    userId: string;
    schoolId: string;
    role?: MembershipRole;
    status?: MembershipStatus;
    assignedClassGroupIds?: string[];
  }): SchoolMembership {
    return this.addTeacherMembership(params);
  },

  getSchoolMemberships(schoolId: string, requestingUserId: string): SchoolMembership[] {
    initSeedData();
    // Validate that requesting user is at least ACADEMIC_ADMIN or SCHOOL_ADMIN or SUPER_ADMIN
    const isAuthorized = this.validateAccess(requestingUserId, schoolId, 'ACADEMIC_ADMIN');
    if (!isAuthorized) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        requestingUserId,
        action: 'getSchoolMemberships',
      });
      throw new Error(`Unauthorized: User ${requestingUserId} does not have administrative rights for school ${schoolId}`);
    }

    return Array.from(membershipsStore.values()).filter(
      m => m.schoolId === schoolId && m.status !== 'REMOVED'
    );
  },

  // 4. MEMBERSHIP WORKFLOWS (JOIN, APPROVE, REJECT, SUSPEND, REMOVE, ROLE CHANGE)
  requestJoinSchool(userId: string, schoolId: string, role: MembershipRole = 'TEACHER'): SchoolMembership {
    initSeedData();
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`School not found: ${schoolId}`);
    }

    // Check for existing active or pending membership
    const existing = Array.from(membershipsStore.values()).find(
      m => m.userId === userId && m.schoolId === schoolId && m.status !== 'REMOVED'
    );

    if (existing) {
      return existing; // Idempotent handling
    }

    const now = new Date().toISOString();
    const membership: SchoolMembership = {
      id: `mem_${userId}_${schoolId}_${Date.now()}`,
      userId,
      schoolId,
      role,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    membershipsStore.set(membership.id, membership);
    PersistentStateService.persistSchoolMembership(membership);

    AuditService.log('MEMBERSHIP_REQUESTED', schoolId, {
      userId,
      role,
      membershipId: membership.id,
    });

    return membership;
  },

  approveMembership(membershipId: string, approverUserId: string): SchoolMembership {
    initSeedData();
    const membership = membershipsStore.get(membershipId);
    if (!membership) {
      throw new Error(`Membership not found: ${membershipId}`);
    }

    const isAuthorized = this.validateAccess(approverUserId, membership.schoolId, 'SCHOOL_ADMIN');
    if (!isAuthorized) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', membership.schoolId, {
        approverUserId,
        membershipId,
        action: 'approveMembership',
      });
      throw new Error('Unauthorized: Only School Admins can approve memberships');
    }

    membership.status = 'ACTIVE';
    membership.joinedAt = new Date().toISOString();
    membership.updatedAt = new Date().toISOString();
    membershipsStore.set(membership.id, membership);
    PersistentStateService.persistSchoolMembership(membership);

    AuditService.log('MEMBERSHIP_APPROVED', membership.schoolId, {
      membershipId,
      userId: membership.userId,
      approvedBy: approverUserId,
    });

    return membership;
  },

  rejectMembership(membershipId: string, approverUserId: string): SchoolMembership {
    initSeedData();
    const membership = membershipsStore.get(membershipId);
    if (!membership) {
      throw new Error(`Membership not found: ${membershipId}`);
    }

    const isAuthorized = this.validateAccess(approverUserId, membership.schoolId, 'SCHOOL_ADMIN');
    if (!isAuthorized) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', membership.schoolId, {
        approverUserId,
        membershipId,
        action: 'rejectMembership',
      });
      throw new Error('Unauthorized: Only School Admins can reject memberships');
    }

    membership.status = 'REMOVED';
    membership.updatedAt = new Date().toISOString();
    membershipsStore.set(membership.id, membership);
    PersistentStateService.persistSchoolMembership(membership);

    AuditService.log('MEMBERSHIP_REJECTED', membership.schoolId, {
      membershipId,
      userId: membership.userId,
      rejectedBy: approverUserId,
    });

    return membership;
  },

  suspendMembership(membershipId: string, adminUserId: string): SchoolMembership {
    initSeedData();
    const membership = membershipsStore.get(membershipId);
    if (!membership) {
      throw new Error(`Membership not found: ${membershipId}`);
    }

    const isAuthorized = this.validateAccess(adminUserId, membership.schoolId, 'SCHOOL_ADMIN');
    if (!isAuthorized) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', membership.schoolId, {
        adminUserId,
        membershipId,
        action: 'suspendMembership',
      });
      throw new Error('Unauthorized: Only School Admins can suspend memberships');
    }

    membership.status = 'SUSPENDED';
    membership.updatedAt = new Date().toISOString();
    membershipsStore.set(membership.id, membership);
    PersistentStateService.persistSchoolMembership(membership);

    AuditService.log('MEMBERSHIP_SUSPENDED', membership.schoolId, {
      membershipId,
      userId: membership.userId,
      suspendedBy: adminUserId,
    });

    return membership;
  },

  removeMembership(membershipId: string, adminUserId: string): SchoolMembership {
    initSeedData();
    const membership = membershipsStore.get(membershipId);
    if (!membership) {
      throw new Error(`Membership not found: ${membershipId}`);
    }

    const isAuthorized = this.validateAccess(adminUserId, membership.schoolId, 'SCHOOL_ADMIN');
    if (!isAuthorized) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', membership.schoolId, {
        adminUserId,
        membershipId,
        action: 'removeMembership',
      });
      throw new Error('Unauthorized: Only School Admins can remove memberships');
    }

    membership.status = 'REMOVED';
    membership.updatedAt = new Date().toISOString();
    membershipsStore.set(membership.id, membership);
    PersistentStateService.persistSchoolMembership(membership);

    AuditService.log('MEMBERSHIP_REMOVED', membership.schoolId, {
      membershipId,
      userId: membership.userId,
      removedBy: adminUserId,
    });

    return membership;
  },

  changeRole(membershipId: string, newRole: MembershipRole, adminUserId: string): SchoolMembership {
    initSeedData();
    const membership = membershipsStore.get(membershipId);
    if (!membership) {
      throw new Error(`Membership not found: ${membershipId}`);
    }

    const isAuthorized = this.validateAccess(adminUserId, membership.schoolId, 'SCHOOL_ADMIN');
    if (!isAuthorized) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', membership.schoolId, {
        adminUserId,
        membershipId,
        action: 'changeRole',
      });
      throw new Error('Unauthorized: Client-side role elevation is rejected');
    }

    const oldRole = membership.role;
    membership.role = newRole;
    membership.updatedAt = new Date().toISOString();
    membershipsStore.set(membership.id, membership);
    PersistentStateService.persistSchoolMembership(membership);

    AuditService.log('MEMBERSHIP_ROLE_CHANGED', membership.schoolId, {
      membershipId,
      userId: membership.userId,
      oldRole,
      newRole,
      changedBy: adminUserId,
    });

    return membership;
  },

  leaveSchool(userId: string, schoolId: string): void {
    initSeedData();
    const membership = Array.from(membershipsStore.values()).find(
      m => m.userId === userId && m.schoolId === schoolId && m.status === 'ACTIVE'
    );
    if (membership) {
      membership.status = 'REMOVED';
      membership.updatedAt = new Date().toISOString();
      membershipsStore.set(membership.id, membership);
      PersistentStateService.persistSchoolMembership(membership);

      AuditService.log('MEMBERSHIP_REMOVED', schoolId, {
        userId,
        action: 'SELF_LEAVE',
      });
    }

    // If active school was left, clear active school selection
    if (activeSchoolByUserId.get(userId) === schoolId) {
      activeSchoolByUserId.delete(userId);
    }
  },

  // 4b. SAFE SCHOOL MERGE MEMBERSHIP MIGRATION
  migrateSchoolMemberships(sourceSchoolId: string, targetSchoolId: string, migratedByUserId: string): { count: number; userIds: string[] } {
    initSeedData();
    let migratedCount = 0;
    const affectedUserIds: string[] = [];
    const now = new Date().toISOString();

    for (const [id, membership] of membershipsStore.entries()) {
      if (membership.schoolId === sourceSchoolId) {
        membership.schoolId = targetSchoolId;
        membership.updatedAt = now;
        membershipsStore.set(id, membership);
        PersistentStateService.persistSchoolMembership(membership);
        migratedCount++;
        if (membership.userId) affectedUserIds.push(membership.userId);
      }
    }
    for (const [userId, activeSchoolId] of activeSchoolByUserId.entries()) {
      if (activeSchoolId === sourceSchoolId) {
        activeSchoolByUserId.set(userId, targetSchoolId);
      }
    }
    AuditService.log('MEMBERSHIPS_MIGRATED', targetSchoolId, {
      sourceSchoolId,
      targetSchoolId,
      migratedCount,
      migratedBy: migratedByUserId,
    });
    return { count: migratedCount, userIds: affectedUserIds };
  },

  // 5. SELF-SERVICE SCHOOL CREATION & IMMEDIATE MEMBERSHIP
  createSchoolWithMembership(
    userId: string,
    schoolData: Partial<SchoolProfile>,
    teachingConfig?: Partial<TeachingConfig>
  ): { school: SchoolProfile; membership: SchoolMembership } {
    initSeedData();
    this.getTeacherProfile(userId);

    // Create school
    const school = SchoolConfigService.createSchool({
      ...schoolData,
      teachingConfig: teachingConfig ? { ...schoolData.teachingConfig, ...teachingConfig } as any : undefined,
    }, userId);

    const now = new Date().toISOString();
    const membership: SchoolMembership = {
      id: `mem_${userId}_${school.id}_creator`,
      userId,
      schoolId: school.id,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    membershipsStore.set(membership.id, membership);
    activeSchoolByUserId.set(userId, school.id);
    PersistentStateService.persistSchoolMembership(membership);
    PersistentStateService.persistTeacherProfileState({ userId, activeSchoolId: school.id });

    return { school, membership };
  },

  // 6. MULTI-SCHOOL ACTIVE SCHOOL SWITCHING & CONTEXT ISOLATION
  setActiveSchool(userId: string, schoolId: string): SchoolMembership {
    initSeedData();
    const hasAccess = this.validateAccess(userId, schoolId);
    if (!hasAccess) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        userId,
        action: 'setActiveSchool',
      });
      throw new Error(`Unauthorized: User ${userId} does not have an active membership in school ${schoolId}`);
    }

    const previousSchoolId = activeSchoolByUserId.get(userId);
    activeSchoolByUserId.set(userId, schoolId);
    PersistentStateService.persistTeacherProfileState({ userId, activeSchoolId: schoolId });

    // Clear / reset cached context in TeacherWorkspaceService when switching schools
    const currentContext = TeacherWorkspaceService.getTeacherContext(userId, schoolId);
    if (currentContext.schoolId !== schoolId) {
      const activeTerm = AcademicOperationsService.getActiveTerm(schoolId);
      TeacherWorkspaceService.setTeacherContext(userId, {
        schoolId,
        gradeId: 'grade-8',
        learningAreaId: 'la-sci',
        academicYear: 2026,
        termId: activeTerm?.name || 'Term 1',
      });
    }

    AuditService.log('SCHOOL_SWITCHED', schoolId, {
      userId,
      previousSchoolId,
      newSchoolId: schoolId,
    });

    const activeMembership = Array.from(membershipsStore.values()).find(
      m => m.userId === userId && m.schoolId === schoolId && m.status === 'ACTIVE'
    )!;

    return activeMembership;
  },

  getActiveSchoolMembership(userId: string): { school: SchoolProfile; membership: SchoolMembership } | null {
    initSeedData();
    let schoolId = activeSchoolByUserId.get(userId);
    let membership: SchoolMembership | undefined;

    if (schoolId) {
      membership = Array.from(membershipsStore.values()).find(
        m => m.userId === userId && m.schoolId === schoolId && m.status === 'ACTIVE'
      );
    }

    if (!membership) {
      // Fallback to first active membership
      membership = Array.from(membershipsStore.values()).find(
        m => m.userId === userId && m.status === 'ACTIVE'
      );
      if (membership) {
        schoolId = membership.schoolId;
        activeSchoolByUserId.set(userId, schoolId);
      }
    }

    if (!membership || !schoolId) {
      return null;
    }

    const school = SchoolConfigService.getSchoolProfile(schoolId);
    return { school, membership };
  },

  // 7. TEACHING CONTEXT MANAGEMENT
  getTeachingContext(userId: string, schoolId?: string): TeacherTeachingContext {
    initSeedData();
    const activeInfo = this.getActiveSchoolMembership(userId);
    const targetSchoolId = schoolId || activeInfo?.school.id || 'lwps';

    if (!this.validateAccess(userId, targetSchoolId)) {
      throw new Error(`Unauthorized access to school ${targetSchoolId}`);
    }

    const stored = activeContextByUserId.get(`${userId}_${targetSchoolId}`);
    if (stored) {
      return stored;
    }

    // Default or resolved from Phase 17 Teacher Assignments
    const assignments = AcademicOperationsService.getTeacherAssignments(targetSchoolId, userId);
    let defaultGrade = 'grade-8';
    let defaultLA = 'la-sci';

    if (assignments.length > 0) {
      defaultGrade = assignments[0].gradeId;
      defaultLA = assignments[0].learningAreaId;
    }

    const activeTerm = AcademicOperationsService.getActiveTerm(targetSchoolId);
    const context: TeacherTeachingContext = {
      schoolId: targetSchoolId,
      teacherId: userId,
      gradeId: defaultGrade,
      learningAreaId: defaultLA,
      termId: activeTerm?.name || 'Term 1',
      academicYearId: activeTerm?.academicYearId || 'ay_lwps_2026',
    };

    activeContextByUserId.set(`${userId}_${targetSchoolId}`, context);
    return context;
  },

  setTeachingContext(userId: string, context: TeacherTeachingContext): TeacherTeachingContext {
    initSeedData();
    if (!this.validateAccess(userId, context.schoolId)) {
      throw new Error(`Unauthorized: Cannot set context for unauthorized school ${context.schoolId}`);
    }

    activeContextByUserId.set(`${userId}_${context.schoolId}`, context);
    PersistentStateService.persistTeacherProfileState({ userId, teachingContext: context });

    // Sync with TeacherWorkspaceService
    TeacherWorkspaceService.setTeacherContext(userId, {
      schoolId: context.schoolId,
      gradeId: context.gradeId,
      learningAreaId: context.learningAreaId,
      academicYear: 2026,
      termId: context.termId,
    });

    return context;
  },

  // 8. READ MODEL DERIVATION
  getTeacherSchoolReadModel(userId: string): TeacherSchoolReadModel {
    initSeedData();
    const teacher = this.getTeacherProfile(userId);
    const memberships = this.getMemberships(userId);
    const activeInfo = this.getActiveSchoolMembership(userId);

    if (!activeInfo) {
      return {
        teacher,
        activeSchool: null,
        activeMembership: null,
        memberships,
        authorizedTeachingContexts: [],
        activeTeachingContext: null,
        todayLesson: null,
        readinessStatus: 'NO_SCHOOL',
      };
    }

    const { school: activeSchool, membership: activeMembership } = activeInfo;

    // Resolve Context
    const activeTeachingContext = this.getTeachingContext(userId, activeSchool.id);

    const activeTerm = AcademicOperationsService.getActiveTerm(activeSchool.id);
    // Resolve Authorized Contexts
    const assignments = AcademicOperationsService.getTeacherAssignments(activeSchool.id, userId);
    let authorizedContexts: TeacherTeachingContext[] = assignments.map(a => ({
      schoolId: activeSchool.id,
      teacherId: userId,
      gradeId: a.gradeId,
      learningAreaId: a.learningAreaId,
      termId: activeTerm?.name || 'Term 1',
    }));

    if (authorizedContexts.length === 0) {
      authorizedContexts = [activeTeachingContext];
    }

    // Today's Lesson
    let todayLesson = null;
    try {
      todayLesson = DailyTeachingService.resolveTodayLesson(userId, activeSchool.id);
    } catch {
      todayLesson = TeacherWorkspaceService.getTodayLesson(
        {
          schoolId: activeSchool.id,
          gradeId: activeTeachingContext.gradeId,
          learningAreaId: activeTeachingContext.learningAreaId,
          academicYear: 2026,
          termId: activeTeachingContext.termId,
        },
        userId
      );
    }

    const schoolReadiness = SchoolConfigService.getSchoolReadiness(activeSchool.id);

    return {
      teacher,
      activeSchool,
      activeMembership,
      memberships,
      authorizedTeachingContexts: authorizedContexts,
      activeTeachingContext,
      todayLesson,
      readinessStatus: 'READY_TO_TEACH',
      schoolReadiness,
    };
  },

  // 9. DURABLE FIRESTORE HYDRATION BRIDGE
  ingestMembership(membership: SchoolMembership): void {
    initSeedData();
    if (!membership || !membership.id || !membership.userId || !membership.schoolId) return;
    for (const [key, existing] of membershipsStore.entries()) {
      if (
        existing.userId === membership.userId &&
        existing.schoolId === membership.schoolId &&
        key !== membership.id
      ) {
        membershipsStore.delete(key);
      }
    }
    membershipsStore.set(membership.id, membership);
  },

  ingestMemberships(memberships: SchoolMembership[]): void {
    initSeedData();
    for (const m of memberships) {
      this.ingestMembership(m);
    }
  },

  async syncUserMembershipsFromFirestore(userId: string): Promise<SchoolMembership[]> {
    initSeedData();
    const persisted = await PersistentStateService.hydrateMembershipsForUser(userId);
    if (persisted.length > 0) {
      this.ingestMemberships(persisted);
    }
    return this.getMemberships(userId);
  },

  async syncSchoolMembershipsFromFirestore(schoolId: string): Promise<SchoolMembership[]> {
    initSeedData();
    const persisted = await PersistentStateService.hydrateMembershipsForSchool(schoolId);
    if (persisted.length > 0) {
      this.ingestMemberships(persisted);
    }
    return Array.from(membershipsStore.values()).filter(
      (m) => m.schoolId === schoolId && m.status !== 'REMOVED'
    );
  },

  clearStore(): void {
    teacherProfilesStore.clear();
    membershipsStore.clear();
    activeSchoolByUserId.clear();
    activeContextByUserId.clear();
    initSeedData();
  }
};

PersistentStateService.registerDomainService('SchoolMembershipService', {
  clearInMemoryOnly: () => {
    SchoolMembershipService.clearStore();
  },
  ingestState: (data: {
    memberships?: SchoolMembership[];
    teacherProfileDoc?: Record<string, any> | null;
  }) => {
    if (Array.isArray(data?.memberships)) {
      SchoolMembershipService.ingestMemberships(data.memberships);
    }
    if (data?.teacherProfileDoc && data.teacherProfileDoc.userId) {
      const uid = data.teacherProfileDoc.userId;
      if (data.teacherProfileDoc.profile) {
        teacherProfilesStore.set(uid, data.teacherProfileDoc.profile);
      }
      if (data.teacherProfileDoc.activeSchoolId) {
        activeSchoolByUserId.set(uid, data.teacherProfileDoc.activeSchoolId);
      }
      for (const [key, val] of Object.entries(data.teacherProfileDoc)) {
        if (key.startsWith('context_') && val && typeof val === 'object') {
          const ctx = val as TeacherTeachingContext;
          if (ctx.schoolId) {
            activeContextByUserId.set(`${uid}_${ctx.schoolId}`, ctx);
          }
        }
      }
    }
  },
});
