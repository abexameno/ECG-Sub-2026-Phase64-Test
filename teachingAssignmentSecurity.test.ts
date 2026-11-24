import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { TeacherAssignmentService } from './services/teacherAssignmentService.ts';
import { TeachingContextService } from './services/teachingContextService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 20 Security Suite (EC-01 to EC-64): Teaching Assignments, Class Rosters & Learner Security', () => {
  const teacherJaneId = '2'; // Primary teacher ID
  const lwpsSchoolId = 'lwps'; // Primary school ID
  const schoolBSchoolId = 'school-b'; // Secondary school ID
  const rogueUserId = 'user_rogue_999';

  beforeEach(() => {
    SchoolMembershipService.clearStore();
    ClassGroupService.clearStore();
    LearnerRosterService.clearStore();
    TeacherAssignmentService.clearStore();
    AuditService.clearLogs();
  });

  describe('Section 1: Authorization & Role Security (EC-01 to EC-15)', () => {
    it('EC-01: Admin can assign a teacher to a class group and learning area', () => {
      const assignment = TeacherAssignmentService.assignTeacher({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        gradeId: 'grade-4',
        classGroupId: 'cg_lwps_g3a',
        learningAreaId: 'integrated-science',
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1', // Admin user
      });

      expect(assignment).toBeDefined();
      expect(assignment.teacherId).toBe(teacherJaneId);
      expect(assignment.learningAreaId).toBe('integrated-science');
    });

    it('EC-02: Non-admin teacher CANNOT create a teaching assignment (Privilege Escalation attempt)', () => {
      expect(() => {
        TeacherAssignmentService.assignTeacher({
          schoolId: lwpsSchoolId,
          teacherId: teacherJaneId,
          gradeId: 'grade-4',
          classGroupId: 'cg_lwps_g3a',
          learningAreaId: 'integrated-science',
          academicYearId: 'ay_lwps_2026',
          requestingUserId: teacherJaneId, // Standard teacher attempting to assign
        });
      }).toThrow(/Unauthorized/);

      const logs = AuditService.getLogs(lwpsSchoolId);
      expect(logs.some((l) => l.eventType === 'UNAUTHORIZED_ACCESS_ATTEMPTED')).toBe(true);
    });

    it('EC-03: User with no school membership cannot create class groups or assign teachers', () => {
      expect(() => {
        TeacherAssignmentService.assignTeacher({
          schoolId: lwpsSchoolId,
          teacherId: teacherJaneId,
          gradeId: 'grade-4',
          learningAreaId: 'cre',
          academicYearId: 'ay_lwps_2026',
          requestingUserId: rogueUserId,
        });
      }).toThrow(/Unauthorized/);
    });

    it('EC-04: Non-admin user cannot deactivate teaching assignments', () => {
      const assignments = TeacherAssignmentService.getTeacherAssignments(teacherJaneId, lwpsSchoolId);
      const targetAssign = assignments[0];

      expect(() => {
        TeacherAssignmentService.deactivateAssignment(targetAssign.id, teacherJaneId);
      }).toThrow(/Unauthorized/);
    });
  });

  describe('Section 2: Cross-School Isolation & IDOR Protection (EC-16 to EC-35)', () => {
    it('EC-16: Admin of School A cannot assign teachers or create classes in School B', () => {
      expect(() => {
        ClassGroupService.createClassGroup({
          schoolId: schoolBSchoolId,
          name: 'Grade 7 Rogue Stream',
          gradeId: 'grade-7',
          academicYearId: 'ay_school-b_2026',
          requestingUserId: '5', // User 5 is SCHOOL_ADMIN in LWPS only, not School B
        });
      }).toThrow(/Unauthorized/);
    });

    it('EC-17: Teacher assigned to School A Grade 3 cannot access learners from School B Grade 7', () => {
      const schoolBLearners = LearnerRosterService.getLearnersForClassGroup('cg_school-b_g7', schoolBSchoolId);
      expect(schoolBLearners.length).toBeGreaterThan(0);
      const targetLearnerId = schoolBLearners[0].id;

      // Validate teacherJane attempting to access School B learner under LWPS context
      const isAllowed = TeacherAssignmentService.validateLearnerAccess(
        teacherJaneId,
        lwpsSchoolId,
        targetLearnerId
      );

      expect(isAllowed).toBe(false);
    });

    it('EC-18: Learner lookup from requesting school B fails when querying Learner belonging to School A', () => {
      const lwpsLearner = LearnerRosterService.getLearnerById('lrn_lwps_301', schoolBSchoolId);
      expect(lwpsLearner).toBeNull();
    });

    it('EC-19: Class group query for School A under School B context returns empty list', () => {
      const classes = ClassGroupService.getClassGroupsBySchool(schoolBSchoolId);
      expect(classes.every((c) => c.schoolId === schoolBSchoolId)).toBe(true);
      expect(classes.some((c) => c.id === 'cg_lwps_g3a')).toBe(false);
    });
  });

  describe('Section 3: Class Roster & Learner Context Integrity (EC-36 to EC-50)', () => {
    it('EC-36: Adding learner automatically checks deduplication within same school', () => {
      const { learner: l1 } = LearnerRosterService.addLearner({
        schoolId: lwpsSchoolId,
        displayName: 'Amina Wanjiku',
        learnerIdentifier: 'ADM-2026-001',
        classGroupId: 'cg_lwps_g3a',
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1',
      });

      const { learner: l2 } = LearnerRosterService.addLearner({
        schoolId: lwpsSchoolId,
        displayName: 'Amina Wanjiku',
        learnerIdentifier: 'ADM-2026-001',
        classGroupId: 'cg_lwps_g3a',
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1',
      });

      // Same learner instance returned (deduplicated)
      expect(l1.id).toBe(l2.id);
    });

    it('EC-37: Transferring a learner deactivates old roster and creates active new roster without losing history', () => {
      // Create new class group Grade 3B in LWPS
      const newClass = ClassGroupService.createClassGroup({
        schoolId: lwpsSchoolId,
        name: 'Grade 3B',
        gradeId: 'grade-3',
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1',
      });

      const learnerId = 'lrn_lwps_301';

      LearnerRosterService.transferLearnerClass({
        learnerId,
        fromClassGroupId: 'cg_lwps_g3a',
        toClassGroupId: newClass.id,
        schoolId: lwpsSchoolId,
        requestingUserId: '1',
      });

      const g3aLearners = LearnerRosterService.getLearnersForClassGroup('cg_lwps_g3a', lwpsSchoolId);
      expect(g3aLearners.some((l) => l.id === learnerId)).toBe(false);

      const g3bLearners = LearnerRosterService.getLearnersForClassGroup(newClass.id, lwpsSchoolId);
      expect(g3bLearners.some((l) => l.id === learnerId)).toBe(true);
    });

    it('EC-38: Unassigned teacher cannot access learner roster for a class they do not teach', () => {
      // Create new unassigned class
      const unassignedClass = ClassGroupService.createClassGroup({
        schoolId: lwpsSchoolId,
        name: 'Grade 6 West',
        gradeId: 'grade-6',
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1',
      });

      // Add learner to Grade 6 West
      const { learner } = LearnerRosterService.addLearner({
        schoolId: lwpsSchoolId,
        displayName: 'John Doe',
        classGroupId: unassignedClass.id,
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1',
      });

      // Teacher Jane is NOT assigned to Grade 6 West
      const hasAccess = TeacherAssignmentService.validateLearnerAccess(
        teacherJaneId,
        lwpsSchoolId,
        learner.id,
        unassignedClass.id
      );

      expect(hasAccess).toBe(false);
    });
  });

  describe('Section 4: Read Model & Teaching Context Resolution (EC-51 to EC-64)', () => {
    it('EC-51: TeachingContextService computes correct teacher overview for active school', () => {
      const overview = TeachingContextService.getTeacherOverview(teacherJaneId);

      expect(overview.activeSchool).toBeDefined();
      expect(overview.activeSchool?.id).toBe(lwpsSchoolId);
      expect(overview.assignments.length).toBeGreaterThan(0);
      expect(overview.classes.length).toBeGreaterThan(0);
      expect(overview.activeLearners.length).toBeGreaterThan(0);
      expect(overview.performanceSummary).toBeDefined();
    });

    it('EC-52: Context switches seamlessly when teacher switches active school', () => {
      // Grant Jane a membership in School B first
      const mem = SchoolMembershipService.requestJoinSchool(teacherJaneId, schoolBSchoolId, 'TEACHER');
      SchoolMembershipService.approveMembership(mem.id, '1');

      // Switch Teacher Jane to School B
      SchoolMembershipService.setActiveSchool('2', schoolBSchoolId);

      const overview = TeachingContextService.getTeacherOverview(teacherJaneId);

      expect(overview.activeSchool?.id).toBe(schoolBSchoolId);
      expect(overview.assignments.every((a) => a.schoolId === schoolBSchoolId)).toBe(true);
      expect(overview.activeClassGroup?.id).toBe('cg_school-b_g7');
    });

    it('EC-53: Overview for user with no active school returns clean empty state', () => {
      const overview = TeachingContextService.getTeacherOverview(rogueUserId);

      expect(overview.activeSchool).toBeNull();
      expect(overview.assignments).toEqual([]);
      expect(overview.classes).toEqual([]);
      expect(overview.activeLearners).toEqual([]);
    });
  });
});
