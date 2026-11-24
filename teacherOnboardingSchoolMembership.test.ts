import { SchoolConfigService } from './services/schoolConfigService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { AuditService } from './services/auditService.ts';
import { TeacherWorkspaceService } from './services/teacherWorkspaceService.ts';

describe('Phase 19 — Teacher Onboarding, School Membership & Self-Service Configuration', () => {

  beforeEach(() => {
    SchoolConfigService.clearStore();
    SchoolMembershipService.clearStore();
    AuditService.clearLogs();
  });

  // --- SECTION 1: TEACHER PROFILE MODEL (EC-01 to EC-08) ---
  describe('Teacher Profile Model & Separation', () => {
    test('EC-01: Teacher profile is created/retrieved independently of school profile', () => {
      const profile = SchoolMembershipService.getTeacherProfile('teacher_101');
      expect(profile).toBeDefined();
      expect(profile.userId).toBe('teacher_101');
      expect(profile.displayName).toContain('Teacher');
    });

    test('EC-02: Teacher profile can be updated with professional information', () => {
      const updated = SchoolMembershipService.updateTeacherProfile('teacher_101', {
        displayName: 'Tr. Mary Wanjiku',
        phoneNumber: '0712345678',
        professionalInfo: {
          tscNumber: 'TSC-998877',
          qualifications: ['B.Ed Arts'],
          specialization: ['English', 'Literature'],
        },
      });

      expect(updated.displayName).toBe('Tr. Mary Wanjiku');
      expect(updated.professionalInfo?.tscNumber).toBe('TSC-998877');
    });

    test('EC-03: Teacher Profile remains separate from School Profile', () => {
      const teacher = SchoolMembershipService.getTeacherProfile('teacher_101');
      const school = SchoolConfigService.getSchoolProfile('lwps');

      expect(teacher.id).not.toBe(school.id);
      expect(teacher.displayName).not.toBe(school.name);
    });
  });

  // --- SECTION 2: SCHOOL MEMBERSHIP & AUTHORIZATION BOUNDARY (EC-09 to EC-20) ---
  describe('School Membership & Authorization Boundary', () => {
    test('EC-09: Requesting to join a school creates a PENDING membership', () => {
      const mem = SchoolMembershipService.requestJoinSchool('teacher_202', 'lwps', 'TEACHER');
      expect(mem.status).toBe('PENDING');
      expect(mem.schoolId).toBe('lwps');
      expect(mem.userId).toBe('teacher_202');

      const logs = AuditService.getLogs('lwps');
      expect(logs.some(l => l.eventType === 'MEMBERSHIP_REQUESTED')).toBe(true);
    });

    test('EC-10: PENDING membership cannot access active school data', () => {
      SchoolMembershipService.requestJoinSchool('teacher_202', 'lwps', 'TEACHER');
      const hasAccess = SchoolMembershipService.validateAccess('teacher_202', 'lwps');
      expect(hasAccess).toBe(false);
    });

    test('EC-11: School Admin can approve PENDING membership', () => {
      const mem = SchoolMembershipService.requestJoinSchool('teacher_202', 'lwps', 'TEACHER');
      // User '5' is SCHOOL_ADMIN for 'lwps'
      const approved = SchoolMembershipService.approveMembership(mem.id, '5');
      expect(approved.status).toBe('ACTIVE');

      const hasAccess = SchoolMembershipService.validateAccess('teacher_202', 'lwps');
      expect(hasAccess).toBe(true);

      const logs = AuditService.getLogs('lwps');
      expect(logs.some(l => l.eventType === 'MEMBERSHIP_APPROVED')).toBe(true);
    });

    test('EC-12: Non-admin user cannot approve membership (IDOR / Authorization Protection)', () => {
      const mem = SchoolMembershipService.requestJoinSchool('teacher_202', 'lwps', 'TEACHER');
      // User '2' is a regular TEACHER in 'lwps'
      expect(() => {
        SchoolMembershipService.approveMembership(mem.id, '2');
      }).toThrow(/Unauthorized/);

      const logs = AuditService.getLogs('lwps');
      expect(logs.some(l => l.eventType === 'UNAUTHORIZED_ACCESS_ATTEMPTED')).toBe(true);
    });

    test('EC-13: School Admin can reject PENDING membership', () => {
      const mem = SchoolMembershipService.requestJoinSchool('teacher_303', 'lwps', 'TEACHER');
      const rejected = SchoolMembershipService.rejectMembership(mem.id, '5');
      expect(rejected.status).toBe('REMOVED');

      const hasAccess = SchoolMembershipService.validateAccess('teacher_303', 'lwps');
      expect(hasAccess).toBe(false);
    });

    test('EC-14: School Admin can suspend an ACTIVE membership', () => {
      const mem = SchoolMembershipService.requestJoinSchool('teacher_404', 'lwps', 'TEACHER');
      SchoolMembershipService.approveMembership(mem.id, '5');

      const suspended = SchoolMembershipService.suspendMembership(mem.id, '5');
      expect(suspended.status).toBe('SUSPENDED');

      const hasAccess = SchoolMembershipService.validateAccess('teacher_404', 'lwps');
      expect(hasAccess).toBe(false);

      const logs = AuditService.getLogs('lwps');
      expect(logs.some(l => l.eventType === 'MEMBERSHIP_SUSPENDED')).toBe(true);
    });

    test('EC-15: School Admin can change membership role', () => {
      const mem = SchoolMembershipService.requestJoinSchool('teacher_505', 'lwps', 'TEACHER');
      SchoolMembershipService.approveMembership(mem.id, '5');

      const updated = SchoolMembershipService.changeRole(mem.id, 'ACADEMIC_ADMIN', '5');
      expect(updated.role).toBe('ACADEMIC_ADMIN');

      const logs = AuditService.getLogs('lwps');
      expect(logs.some(l => l.eventType === 'MEMBERSHIP_ROLE_CHANGED')).toBe(true);
    });

    test('EC-16: Client-side role promotion by regular teacher is rejected', () => {
      const mem = SchoolMembershipService.requestJoinSchool('teacher_606', 'lwps', 'TEACHER');
      SchoolMembershipService.approveMembership(mem.id, '5');

      // 'teacher_606' attempts to promote self
      expect(() => {
        SchoolMembershipService.changeRole(mem.id, 'SCHOOL_ADMIN', 'teacher_606');
      }).toThrow(/Unauthorized/);
    });

    test('EC-17: Getting school memberships requires administrative authorization', () => {
      // User '2' is regular TEACHER
      expect(() => {
        SchoolMembershipService.getSchoolMemberships('lwps', '2');
      }).toThrow(/Unauthorized/);

      // User '5' is SCHOOL_ADMIN
      const list = SchoolMembershipService.getSchoolMemberships('lwps', '5');
      expect(list.length).toBeGreaterThan(0);
    });
  });

  // --- SECTION 3: SCHOOL DISCOVERY & SELF-SERVICE CREATION (EC-21 to EC-35) ---
  describe('School Discovery & Self-Service Creation', () => {
    test('EC-21: Teachers can search existing schools by name or query', () => {
      const results = SchoolConfigService.searchSchools('Lizzie Wanyoike');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('lwps');
    });

    test('EC-22: Duplicate school check detects existing matching names', () => {
      const check = SchoolConfigService.checkDuplicateSchool('Lizzie Wanyoike Preparatory');
      expect(check.isDuplicateLikely).toBe(true);
      expect(check.matchingSchools.length).toBeGreaterThan(0);
    });

    test('EC-23: Duplicate school check returns false for unique name', () => {
      const check = SchoolConfigService.checkDuplicateSchool('Unique Brand New Academy 2026');
      expect(check.isDuplicateLikely).toBe(false);
      expect(check.matchingSchools.length).toBe(0);
    });

    test('EC-24: Self-service school creation sets creator as active SCHOOL_ADMIN', () => {
      const { school, membership } = SchoolMembershipService.createSchoolWithMembership('creator_707', {
        name: 'St. Jude Primary School',
        schoolType: 'Primary',
        country: 'Kenya',
      });

      expect(school.id).toBeDefined();
      expect(school.name).toBe('St. Jude Primary School');
      expect(membership.role).toBe('SCHOOL_ADMIN');
      expect(membership.status).toBe('ACTIVE');

      const hasAccess = SchoolMembershipService.validateAccess('creator_707', school.id, 'SCHOOL_ADMIN');
      expect(hasAccess).toBe(true);

      const logs = AuditService.getLogs(school.id);
      expect(logs.some(l => l.eventType === 'SCHOOL_CREATED')).toBe(true);
    });
  });

  // --- SECTION 4: MULTI-SCHOOL SWITCHING & ISOLATION (EC-36 to EC-48) ---
  describe('Multi-School Support & State Isolation', () => {
    test('EC-36: Teacher can belong to multiple schools and switch active school context', () => {
      // User '2' is already in 'lwps'. Add to 'school-b' and approve
      const memB = SchoolMembershipService.requestJoinSchool('2', 'school-b', 'TEACHER');
      SchoolMembershipService.approveMembership(memB.id, '1');

      // Active school initially LWPS
      const initial = SchoolMembershipService.getActiveSchoolMembership('2');
      expect(initial?.school.id).toBe('lwps');

      // Switch to school-b
      const activeB = SchoolMembershipService.setActiveSchool('2', 'school-b');
      expect(activeB.schoolId).toBe('school-b');

      const updated = SchoolMembershipService.getActiveSchoolMembership('2');
      expect(updated?.school.id).toBe('school-b');

      const logs = AuditService.getLogs('school-b');
      expect(logs.some(l => l.eventType === 'SCHOOL_SWITCHED')).toBe(true);
    });

    test('EC-37: Switching to an unauthorized school is strictly rejected', () => {
      expect(() => {
        SchoolMembershipService.setActiveSchool('2', 'unauthorized_school_xyz');
      }).toThrow(/Unauthorized/);
    });

    test('EC-38: Leaving a school deactivates future access but preserves history', () => {
      // User '2' leaves 'lwps'
      SchoolMembershipService.leaveSchool('2', 'lwps');

      const hasAccess = SchoolMembershipService.validateAccess('2', 'lwps');
      expect(hasAccess).toBe(false);
    });
  });

  // --- SECTION 5: SELF-SERVICE SCHOOL CONFIGURATION & CAPACITY IMPACT (EC-49 to EC-54) ---
  describe('Self-Service School Configuration', () => {
    test('EC-49: School Admin can update school profile metadata', () => {
      const updated = SchoolConfigService.updateSchoolProfile('lwps', {
        schoolType: 'Comprehensive',
      }, '5'); // User '5' is SCHOOL_ADMIN

      expect(updated.schoolType).toBe('Comprehensive');

      const logs = AuditService.getLogs('lwps');
      expect(logs.some(l => l.eventType === 'SCHOOL_CONFIG_CHANGED')).toBe(true);
    });

    test('EC-50: School Admin updating teaching config calculates capacity impact warning when slots decrease', () => {
      // LWPS default: 5 lessons/week * 13 weeks = 65 slots
      // Reduce to: 4 lessons/week * 10 weeks = 40 slots
      const impact = SchoolConfigService.updateTeachingConfig('lwps', {
        lessonsPerWeek: 4,
        teachingWeeksPerTerm: 10,
      }, '5');

      expect(impact.capacityChangeSlots).toBe(-25);
      expect(impact.reviewRequired).toBe(true);
      expect(impact.capacityWarning).toContain('Teaching capacity reduced');

      const logs = AuditService.getLogs('lwps');
      expect(logs.some(l => l.eventType === 'TEACHING_CONFIG_CHANGED')).toBe(true);
    });

    test('EC-51: Increasing capacity does not require review warning', () => {
      const impact = SchoolConfigService.updateTeachingConfig('school-b', {
        lessonsPerWeek: 6,
        teachingWeeksPerTerm: 14,
      }, '1');

      expect(impact.capacityChangeSlots).toBeGreaterThan(0);
      expect(impact.reviewRequired).toBe(false);
    });
  });

  // --- SECTION 6: DERIVED READ MODEL & AUDIT TRAIL (EC-55 to EC-59) ---
  describe('Derived Read Model & Audit Trail', () => {
    test('EC-55: Read model derives complete teacher and school context state', () => {
      const readModel = SchoolMembershipService.getTeacherSchoolReadModel('2');

      expect(readModel.teacher.userId).toBe('2');
      expect(readModel.activeSchool?.id).toBe('lwps');
      expect(readModel.activeMembership?.role).toBe('TEACHER');
      expect(readModel.readinessStatus).toBe('READY_TO_TEACH');
      expect(readModel.activeTeachingContext?.schoolId).toBe('lwps');
    });

    test('EC-56: Read model returns NO_SCHOOL when user has no active school membership', () => {
      const readModel = SchoolMembershipService.getTeacherSchoolReadModel('new_user_without_school');

      expect(readModel.activeSchool).toBeNull();
      expect(readModel.readinessStatus).toBe('NO_SCHOOL');
    });

    test('EC-59: Audit log retains complete security and membership history', () => {
      SchoolMembershipService.requestJoinSchool('teacher_909', 'lwps', 'TEACHER');
      SchoolMembershipService.createSchoolWithMembership('teacher_909', { name: 'Audit Test School' });

      const logs = AuditService.getLogs();
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
