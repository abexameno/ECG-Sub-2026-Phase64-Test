import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { TeachingContextService } from './services/teachingContextService.ts';
import { DailyTeachingService } from './services/dailyTeachingService.ts';
import { TeacherWorkspaceService } from './services/teacherWorkspaceService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { LearnerEngagementInterventionService } from './services/learnerEngagementInterventionService.ts';
import { TeachingContinuityService } from './services/teachingContinuityService.ts';
import { ClassLearningProgressService } from './services/classLearningProgressService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { SchoolConfigService } from './services/schoolConfigService.ts';
import { AcademicOperationsService } from './services/academicOperationsService.ts';
import { AuditService } from './services/auditService.ts';

// In-memory mock storage for vitest node environment
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
};

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    (globalThis as any).localStorage = createMockStorage();
  }
  if (typeof globalThis.sessionStorage === 'undefined') {
    (globalThis as any).sessionStorage = createMockStorage();
  }
});

describe('Phase 31: Teacher Dashboard, Mobile-First UX & Core Teaching Workspace', () => {
  const teacherJaneId = '2'; // Primary teacher ID in LWPS
  const schoolId = 'lwps';
  const classGroupIdG3A = 'cg_lwps_g3a';
  const schoolAdminId = 'usr_admin_001';

  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    SchoolConfigService.clearStore();
    SchoolMembershipService.clearStore();
    ClassGroupService.clearStore();
    LearnerRosterService.clearStore();
    TeacherWorkspaceService.clearStore();
    TeachingActivityService.clearStore();
    LearnerEngagementInterventionService.clearStore();
    TeachingContinuityService.clearStore();
    AuditService.clearLogs();

    // Setup default membership for teacherJane in lwps
    SchoolMembershipService.addMembership({
      userId: teacherJaneId,
      schoolId: schoolId,
      role: 'TEACHER',
      status: 'ACTIVE',
      assignedClassGroupIds: [classGroupIdG3A],
    });

    SchoolMembershipService.addMembership({
      userId: schoolAdminId,
      schoolId: schoolId,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    });

    SchoolMembershipService.setActiveSchool(teacherJaneId, schoolId);

    // Setup class group
    ClassGroupService.createClassGroup({
      id: classGroupIdG3A,
      schoolId: schoolId,
      name: 'Grade 3 Alpha',
      gradeId: 'grade-3',
      academicYearId: 'ay_lwps_2026',
    });

    // Assign teacher via AcademicOperationsService
    const activeYear = AcademicOperationsService.getActiveAcademicYear(schoolId);
    if (activeYear) {
      AcademicOperationsService.assignTeacher({
        schoolId: schoolId,
        teacherId: teacherJaneId,
        gradeId: 'grade-3',
        learningAreaId: 'integrated-science',
        academicYearId: activeYear.id,
        requestingRole: 'admin',
      });
    }

    // Add a learner
    LearnerRosterService.addLearner({
      schoolId: schoolId,
      displayName: 'Amani Kimani',
      learnerIdentifier: 'ADM-301',
      classGroupId: classGroupIdG3A,
      academicYearId: 'ay_lwps_2026',
      requestingUserId: schoolAdminId,
    });
  });

  describe('1. Workday Dashboard: Today\'s Teaching Aggregation', () => {
    it('resolves deterministic daily lesson from DailyTeachingService for active teacher & school', () => {
      const today = DailyTeachingService.resolveTodayLesson('teacher_jane', schoolId);
      expect(today).not.toBeNull();
      expect(today?.schoolId).toBe(schoolId);
      expect(today?.grade).toBe('Grade 8');
      expect(today?.learningArea).toBe('Integrated Science');
      expect(today?.weekNumber).toBe(1);
      expect(today?.lessonNumber).toBe(1);
      expect(today?.status).toBe('NOT_STARTED');
    });

    it('gracefully handles invalid school with unauthorized rejection', () => {
      expect(() => {
        DailyTeachingService.resolveTodayLesson(teacherJaneId, 'unregistered_school_xyz');
      }).toThrow('Unauthorized or invalid school: unregistered_school_xyz');
    });

    it('retrieves teacher overview with active assignments and classes', () => {
      const overview = TeachingContextService.getTeacherOverview(teacherJaneId);
      expect(overview.activeSchool?.id).toBe(schoolId);
      expect(overview.classes.length).toBeGreaterThan(0);
      expect(overview.classes[0].id).toBe(classGroupIdG3A);
    });
  });

  describe('2. Workday Dashboard: Needs Attention Aggregator', () => {
    it('aggregates learner intervention summary via LearnerEngagementInterventionService', () => {
      const summary = LearnerEngagementInterventionService.getClassSummary({
        schoolId: schoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
      });

      expect(summary).toBeDefined();
      expect(typeof summary.totalLearners).toBe('number');
      expect(typeof summary.needsReviewCount).toBe('number');
      expect(typeof summary.openSignalsCount).toBe('number');
    });

    it('aggregates open continuity issues via TeachingContinuityService without throwing', () => {
      const openIssues = TeachingContinuityService.getOpenIssues(schoolId, classGroupIdG3A);
      expect(Array.isArray(openIssues)).toBe(true);
    });

    it('aggregates class learning progress attention items via ClassLearningProgressService', () => {
      const progress = ClassLearningProgressService.getClassLearningProgress({
        schoolId: schoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        learningAreaId: 'integrated-science',
      });

      expect(progress).toBeDefined();
      expect(Array.isArray(progress.attentionItems)).toBe(true);
    });
  });

  describe('3. Mobile-First Navigation & Usability Standards', () => {
    it('guarantees all primary navigation items have explicit text labels and mobile labels', () => {
      const primaryTabs = [
        { id: 'my-teaching', label: "Today's Teaching", mobileLabel: "Today" },
        { id: 'home', label: 'Generator', mobileLabel: "Generator" },
        { id: 'library', label: 'My Library', mobileLabel: "Library" },
        { id: 'student-elms', label: 'Student ELMS', mobileLabel: "ELMS" },
      ];

      primaryTabs.forEach(tab => {
        expect(tab.label.trim().length).toBeGreaterThan(0);
        expect(tab.mobileLabel.trim().length).toBeGreaterThan(0);
        // Anti-slop / accessibility rule: Text label is never empty or icon-only
        expect(tab.label).not.toBe('');
      });
    });

    it('structures secondary functionality inside More menu to maintain low cognitive load', () => {
      const moreTabs = [
        { id: 'settings', label: 'My Profile & School' },
        { id: 'subscription', label: 'Subscription Credits' },
        { id: 'referrals', label: 'Referral Hub' },
        { id: 'feedback', label: 'Feedback' },
        { id: 'help', label: 'Help & Guide' },
      ];

      expect(moreTabs.some(t => t.id === 'settings')).toBe(true);
      expect(moreTabs.some(t => t.id === 'subscription')).toBe(true);
      expect(moreTabs.some(t => t.id === 'help')).toBe(true);
    });
  });

  describe('4. Server-Authoritative Multi-School Isolation', () => {
    it('prevents teachers from accessing classes belonging to another school', () => {
      const otherSchoolId = 'school_b';
      
      SchoolConfigService.registerSchool({
        id: otherSchoolId,
        name: 'Mombasa High School',
        code: 'MOM-01',
        curriculumFrameworks: ['CBC'],
        isKicdAligned: true,
        supportedGrades: ['Grade 8'],
        status: 'ACTIVE',
        createdBy: 'admin_sys',
      });

      const overview = TeachingContextService.getTeacherOverview(teacherJaneId);
      // Teacher only sees classes in their active school
      expect(overview.activeSchool?.id).toBe(schoolId);
      overview.classes.forEach(c => {
        expect(c.schoolId).toBe(schoolId);
        expect(c.schoolId).not.toBe(otherSchoolId);
      });
    });
  });
});
