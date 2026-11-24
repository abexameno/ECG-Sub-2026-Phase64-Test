import { TeacherTeachingAssignment } from '../types/teachingAssignment.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { LearnerRosterService } from './learnerRosterService.ts';
import { AuditService } from './auditService.ts';

const teacherAssignmentsStore: Map<string, TeacherTeachingAssignment> = new Map();

function initSeedAssignments() {
  if (teacherAssignmentsStore.size > 0) return;

  // Default seed assignment for LWPS: User '2' (Teacher Jane) -> Grade 3A -> CRE
  const lwpsJaneCRE: TeacherTeachingAssignment = {
    id: 'assign_lwps_g3a_cre',
    schoolId: 'lwps',
    teacherId: '2', // User ID 2
    gradeId: 'grade-3',
    classGroupId: 'cg_lwps_g3a',
    learningAreaId: 'cre',
    academicYearId: 'ay_lwps_2026',
    status: 'ACTIVE',
    effectiveFrom: '2026-01-05',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  teacherAssignmentsStore.set(lwpsJaneCRE.id, lwpsJaneCRE);

  // User '2' also assigned to Grade 3A -> Mathematics
  const lwpsJaneMath: TeacherTeachingAssignment = {
    id: 'assign_lwps_g3a_math',
    schoolId: 'lwps',
    teacherId: '2',
    gradeId: 'grade-3',
    classGroupId: 'cg_lwps_g3a',
    learningAreaId: 'mathematics',
    academicYearId: 'ay_lwps_2026',
    status: 'ACTIVE',
    effectiveFrom: '2026-01-05',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  teacherAssignmentsStore.set(lwpsJaneMath.id, lwpsJaneMath);

  // User '2' in School B -> Grade 7 -> Agriculture
  const schoolBJaneAgri: TeacherTeachingAssignment = {
    id: 'assign_sb_g7_agri',
    schoolId: 'school-b',
    teacherId: '2',
    gradeId: 'grade-7',
    classGroupId: 'cg_school-b_g7',
    learningAreaId: 'agriculture',
    academicYearId: 'ay_school-b_2026',
    status: 'ACTIVE',
    effectiveFrom: '2026-01-12',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  teacherAssignmentsStore.set(schoolBJaneAgri.id, schoolBJaneAgri);
}

initSeedAssignments();

export const TeacherAssignmentService = {
  clearStore(): void {
    teacherAssignmentsStore.clear();
    initSeedAssignments();
  },

  assignTeacher(params: {
    schoolId: string;
    teacherId: string;
    gradeId: string;
    classGroupId?: string;
    learningAreaId: string;
    academicYearId: string;
    termId?: string;
    requestingUserId: string;
  }): TeacherTeachingAssignment {
    // Validate request authorization: requestingUserId must be SCHOOL_ADMIN or ACADEMIC_ADMIN in schoolId
    const isAuth = SchoolMembershipService.validateAccess(params.requestingUserId, params.schoolId, 'ACADEMIC_ADMIN');
    if (!isAuth) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', params.schoolId, {
        userId: params.requestingUserId,
        action: 'CREATE_TEACHER_ASSIGNMENT',
        targetTeacherId: params.teacherId,
      });
      throw new Error(`Unauthorized: User ${params.requestingUserId} cannot create teacher assignments in school ${params.schoolId}`);
    }

    // Verify target teacher has active membership in schoolId
    const targetHasMembership = SchoolMembershipService.validateAccess(params.teacherId, params.schoolId, 'TEACHER');
    if (!targetHasMembership) {
      throw new Error(`Teacher ${params.teacherId} does not have an active membership in school ${params.schoolId}`);
    }

    // Check duplicate active assignment
    for (const existing of teacherAssignmentsStore.values()) {
      if (
        existing.schoolId === params.schoolId &&
        existing.teacherId === params.teacherId &&
        existing.gradeId === params.gradeId &&
        existing.learningAreaId === params.learningAreaId &&
        existing.classGroupId === params.classGroupId &&
        existing.academicYearId === params.academicYearId &&
        existing.status === 'ACTIVE'
      ) {
        return existing; // Idempotent return
      }
    }

    const assignment: TeacherTeachingAssignment = {
      id: `assign_${params.schoolId}_${params.teacherId}_${params.gradeId}_${params.learningAreaId}_${Date.now()}`,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      gradeId: params.gradeId,
      classGroupId: params.classGroupId,
      learningAreaId: params.learningAreaId,
      academicYearId: params.academicYearId,
      termId: params.termId,
      status: 'ACTIVE',
      effectiveFrom: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    teacherAssignmentsStore.set(assignment.id, assignment);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'TEACHER_ASSIGNMENT_CREATED',
      assignmentId: assignment.id,
      teacherId: params.teacherId,
      gradeId: params.gradeId,
      learningAreaId: params.learningAreaId,
      assignedBy: params.requestingUserId,
    });

    return assignment;
  },

  getTeacherAssignments(teacherId: string, schoolId: string): TeacherTeachingAssignment[] {
    // Validate membership
    const hasMembership = SchoolMembershipService.validateAccess(teacherId, schoolId, 'TEACHER');
    if (!hasMembership) return [];

    return Array.from(teacherAssignmentsStore.values()).filter(
      (a) => a.teacherId === teacherId && a.schoolId === schoolId && a.status === 'ACTIVE'
    );
  },

  deactivateAssignment(assignmentId: string, requestingUserId: string): void {
    const assign = teacherAssignmentsStore.get(assignmentId);
    if (!assign) throw new Error(`Assignment ${assignmentId} not found.`);

    const isAuth = SchoolMembershipService.validateAccess(requestingUserId, assign.schoolId, 'ACADEMIC_ADMIN');
    if (!isAuth) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', assign.schoolId, {
        userId: requestingUserId,
        action: 'DEACTIVATE_TEACHER_ASSIGNMENT',
        assignmentId,
      });
      throw new Error(`Unauthorized: User ${requestingUserId} cannot modify assignments.`);
    }

    assign.status = 'INACTIVE';
    assign.effectiveTo = new Date().toISOString().split('T')[0];
    assign.updatedAt = new Date().toISOString();

    teacherAssignmentsStore.set(assign.id, assign);

    AuditService.log('ARTIFACT_UPDATED', assign.schoolId, {
      action: 'TEACHER_ASSIGNMENT_DEACTIVATED',
      assignmentId: assign.id,
      deactivatedBy: requestingUserId,
    });
  },

  /**
   * CRITICAL SECURITY BOUNDARY:
   * Validates if a teacher is authorized to access a learner's context.
   * Chain:
   *  1. Authenticated User / Teacher must have ACTIVE membership in schoolId.
   *  2. Teacher must have an ACTIVE teaching assignment for the classGroup/grade.
   *  3. Learner must belong to schoolId and be enrolled in the active ClassRoster of that classGroup.
   */
  validateLearnerAccess(teacherId: string, schoolId: string, learnerId: string, classGroupId?: string): boolean {
    // 1. Validate active school membership
    const hasSchoolMembership = SchoolMembershipService.validateAccess(teacherId, schoolId, 'TEACHER');
    if (!hasSchoolMembership) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        userId: teacherId,
        action: 'VALIDATE_LEARNER_ACCESS_NO_SCHOOL_MEMBERSHIP',
        targetLearnerId: learnerId,
      });
      return false;
    }

    // 2. Validate learner belongs to schoolId
    const learner = LearnerRosterService.getLearnerById(learnerId, schoolId);
    if (!learner) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        userId: teacherId,
        action: 'VALIDATE_LEARNER_ACCESS_LEARNER_NOT_IN_SCHOOL',
        targetLearnerId: learnerId,
      });
      return false;
    }

    // 3. Find teacher's active assignments in schoolId
    const teacherAssignments = this.getTeacherAssignments(teacherId, schoolId);
    if (teacherAssignments.length === 0) {
      return false;
    }

    // 4. Check if learner is in any class group assigned to the teacher
    const assignedClassGroupIds = new Set(
      teacherAssignments.map((a) => a.classGroupId).filter(Boolean) as string[]
    );

    if (classGroupId) {
      if (!assignedClassGroupIds.has(classGroupId)) {
        return false;
      }
      const learnersInClass = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
      return learnersInClass.some((l) => l.id === learnerId);
    }

    // Check all assigned class groups
    for (const cgId of assignedClassGroupIds) {
      const learnersInClass = LearnerRosterService.getLearnersForClassGroup(cgId, schoolId);
      if (learnersInClass.some((l) => l.id === learnerId)) {
        return true;
      }
    }

    return false;
  },
};
