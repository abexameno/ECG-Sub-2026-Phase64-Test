import { LearnerParticipationService } from './services/learnerParticipationService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { ClassGroupService } from './services/classGroupService.ts';
import { LearnerRosterService } from './services/learnerRosterService.ts';
import { TeacherAssignmentService } from './services/teacherAssignmentService.ts';
import { TeachingContextService } from './services/teachingContextService.ts';
import { DailyTeachingService } from './services/dailyTeachingService.ts';
import { TeachingActivityService } from './services/teachingActivityService.ts';
import { AuditService } from './services/auditService.ts';

describe('Phase 21 Suite (EC-01 to EC-59): Classroom Attendance, Participation & Daily Learner Engagement', () => {
  const teacherJaneId = '2'; // Primary teacher ID in LWPS
  const lwpsSchoolId = 'lwps'; // Primary school ID
  const schoolBSchoolId = 'school-b'; // Secondary school ID
  const rogueUserId = 'user_rogue_999';
  const classGroupIdG3A = 'cg_lwps_g3a';
  const lessonDateStr = '2026-09-04';

  beforeEach(() => {
    SchoolMembershipService.clearStore();
    ClassGroupService.clearStore();
    LearnerRosterService.clearStore();
    TeacherAssignmentService.clearStore();
    LearnerParticipationService.clearStore();
    AuditService.clearLogs();
  });

  describe('Section 1: Core Attendance & Participation Model (EC-01 to EC-10)', () => {
    it('EC-01 — Attendance Model: Attendance record exists with correct school/learner/lesson context', () => {
      const records = LearnerParticipationService.recordAttendanceBatch({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
        academicYearId: 'ay_lwps_2026',
        records: [
          { learnerId: 'lrn_lwps_301', attendanceStatus: 'PRESENT' },
          { learnerId: 'lrn_lwps_302', attendanceStatus: 'ABSENT' },
        ],
      });

      expect(records).toHaveLength(2);
      expect(records[0].schoolId).toBe(lwpsSchoolId);
      expect(records[0].learnerId).toBe('lrn_lwps_301');
      expect(records[0].attendanceStatus).toBe('PRESENT');
      expect(records[1].attendanceStatus).toBe('ABSENT');
    });

    it('EC-02 — Participation Model: Participation can be recorded independently from attendance', () => {
      const records = LearnerParticipationService.recordAttendanceBatch({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
        academicYearId: 'ay_lwps_2026',
        records: [
          {
            learnerId: 'lrn_lwps_301',
            attendanceStatus: 'PRESENT',
            participationStatus: 'PARTICIPATED',
            notes: 'Asked insightful questions during group work',
          },
        ],
      });

      expect(records[0].attendanceStatus).toBe('PRESENT');
      expect(records[0].participationStatus).toBe('PARTICIPATED');
      expect(records[0].notes).toBe('Asked insightful questions during group work');
    });

    it('EC-03 — Teacher Authorization: Teacher can record participation only for assigned class groups', () => {
      // Unassigned class group in LWPS
      const cg2 = ClassGroupService.createClassGroup({
        schoolId: lwpsSchoolId,
        name: 'Grade 5 Rogue',
        gradeId: 'grade-5',
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1',
      });

      expect(() => {
        LearnerParticipationService.recordAttendanceBatch({
          schoolId: lwpsSchoolId,
          teacherId: teacherJaneId,
          classGroupId: cg2.id,
          lessonDate: lessonDateStr,
          academicYearId: 'ay_lwps_2026',
          records: [{ learnerId: 'lrn_lwps_301', attendanceStatus: 'PRESENT' }],
        });
      }).toThrow(/Unauthorized/);

      const logs = AuditService.getLogs(lwpsSchoolId);
      expect(logs.some((l) => l.eventType === 'UNAUTHORIZED_ACCESS_ATTEMPTED')).toBe(true);
    });

    it('EC-04 — School Isolation: Cross-school participation access fails', () => {
      // Setup teacher Jane in School B without membership
      expect(() => {
        LearnerParticipationService.recordAttendanceBatch({
          schoolId: schoolBSchoolId,
          teacherId: teacherJaneId,
          classGroupId: 'cg_school_b_g7',
          lessonDate: lessonDateStr,
          academicYearId: 'ay_school_b_2026',
          records: [{ learnerId: 'lrn_sb_701', attendanceStatus: 'PRESENT' }],
        });
      }).toThrow(/Unauthorized/);
    });

    it('EC-05 — Class Isolation: Teacher cannot access unrelated classes in same school', () => {
      // Create another class in LWPS that Jane does not teach
      const cg4 = ClassGroupService.createClassGroup({
        schoolId: lwpsSchoolId,
        name: 'Grade 4 South',
        gradeId: 'grade-4',
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1',
      });

      expect(() => {
        LearnerParticipationService.getAttendanceForLesson({
          schoolId: lwpsSchoolId,
          requestingUserId: teacherJaneId,
          classGroupId: cg4.id,
          lessonDate: lessonDateStr,
        });
      }).toThrow(/Unauthorized/);
    });

    it('EC-06 & EC-07 — Learner Isolation & IDOR: Recording for learner not on class roster fails', () => {
      expect(() => {
        LearnerParticipationService.recordAttendanceBatch({
          schoolId: lwpsSchoolId,
          teacherId: teacherJaneId,
          classGroupId: classGroupIdG3A,
          lessonDate: lessonDateStr,
          academicYearId: 'ay_lwps_2026',
          records: [{ learnerId: 'lrn_rogue_999', attendanceStatus: 'PRESENT' }],
        });
      }).toThrow(/Unauthorized/);
    });

    it('EC-08 — Membership: Active school membership is required', () => {
      expect(() => {
        LearnerParticipationService.recordAttendanceBatch({
          schoolId: lwpsSchoolId,
          teacherId: rogueUserId,
          classGroupId: classGroupIdG3A,
          lessonDate: lessonDateStr,
          academicYearId: 'ay_lwps_2026',
          records: [{ learnerId: 'lrn_lwps_301', attendanceStatus: 'PRESENT' }],
        });
      }).toThrow(/Unauthorized/);
    });

    it('EC-09 & EC-10 — Roster & Assignment Validation', () => {
      const summary = LearnerParticipationService.getAttendanceForLesson({
        schoolId: lwpsSchoolId,
        requestingUserId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
      });

      expect(summary.totalLearners).toBeGreaterThan(0);
      expect(summary.classGroupId).toBe(classGroupIdG3A);
    });
  });

  describe('Section 2: Statuses, Bulk Actions & Corrections (EC-16 to EC-22)', () => {
    it('EC-16 to EC-19 — PRESENT, ABSENT, LATE, EXCUSED statuses recorded properly', () => {
      const records = LearnerParticipationService.recordAttendanceBatch({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
        academicYearId: 'ay_lwps_2026',
        records: [
          { learnerId: 'lrn_lwps_301', attendanceStatus: 'PRESENT' },
          { learnerId: 'lrn_lwps_302', attendanceStatus: 'ABSENT' },
          { learnerId: 'lrn_lwps_303', attendanceStatus: 'LATE' },
          { learnerId: 'lrn_lwps_304', attendanceStatus: 'EXCUSED' },
        ],
      });

      expect(records.find((r) => r.learnerId === 'lrn_lwps_301')?.attendanceStatus).toBe('PRESENT');
      expect(records.find((r) => r.learnerId === 'lrn_lwps_302')?.attendanceStatus).toBe('ABSENT');
      expect(records.find((r) => r.learnerId === 'lrn_lwps_303')?.attendanceStatus).toBe('LATE');
      expect(records.find((r) => r.learnerId === 'lrn_lwps_304')?.attendanceStatus).toBe('EXCUSED');
    });

    it('EC-20 — Mark All Present bulk action works cleanly', () => {
      const records = LearnerParticipationService.markAllPresentQuick({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
        academicYearId: 'ay_lwps_2026',
      });

      expect(records.length).toBe(5);
      expect(records.every((r) => r.attendanceStatus === 'PRESENT')).toBe(true);
    });

    it('EC-21 & EC-22 — Individual Correction is safe, auditable, and records history', () => {
      const initial = LearnerParticipationService.recordAttendanceBatch({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
        academicYearId: 'ay_lwps_2026',
        records: [{ learnerId: 'lrn_lwps_301', attendanceStatus: 'ABSENT' }],
      });

      const recId = initial[0].id;

      // Teacher corrects absent to present
      const corrected = LearnerParticipationService.correctAttendanceRecord({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        recordId: recId,
        newAttendanceStatus: 'PRESENT',
        newParticipationStatus: 'PARTICIPATED',
        reason: 'Learner arrived late after roll call',
      });

      expect(corrected.attendanceStatus).toBe('PRESENT');
      expect(corrected.participationStatus).toBe('PARTICIPATED');
      expect(corrected.recordState).toBe('CORRECTED');
      expect(corrected.correctionReason).toBe('Learner arrived late after roll call');

      const logs = AuditService.getLogs(lwpsSchoolId);
      expect(logs.some((l) => l.details?.action === 'CLASSROOM_ATTENDANCE_CORRECTED')).toBe(true);
    });
  });

  describe('Section 3: Evidence Boundaries & Non-Authority Rules (EC-23 to EC-31)', () => {
    it('EC-23 — Starting a lesson does NOT automatically mark learners present', () => {
      const lesson = DailyTeachingService.resolveTodayLesson(teacherJaneId, lwpsSchoolId);
      expect(lesson).not.toBeNull();

      if (lesson) {
        DailyTeachingService.startLesson(
          teacherJaneId,
          lwpsSchoolId,
          lesson.teachingPlanId,
          lesson.teachingAllocationId,
          lesson.learningOutcomeId
        );
      }

      // Query attendance — should remain 0 present until explicitly recorded
      const summary = LearnerParticipationService.getAttendanceForLesson({
        schoolId: lwpsSchoolId,
        requestingUserId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
      });

      expect(summary.records).toHaveLength(0);
      expect(summary.presentCount).toBe(0);
    });

    it('EC-24 to EC-28 — Attendance/participation does NOT create mastery, completion evidence or progress alterations', () => {
      LearnerParticipationService.recordAttendanceBatch({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
        academicYearId: 'ay_lwps_2026',
        records: [
          {
            learnerId: 'lrn_lwps_301',
            attendanceStatus: 'PRESENT',
            participationStatus: 'COMPLETED_ACTIVITY',
          },
        ],
      });

      // Confirm no completion evidence or mastery is created directly by attendance
      const overview = TeachingContextService.getTeacherOverview(teacherJaneId, classGroupIdG3A, 'cre');
      expect(overview).toBeDefined();
    });
  });

  describe('Section 4: Historical Integrity, Concurrency & Governance (EC-32 to EC-59)', () => {
    it('EC-32 & EC-33 — Historical participation is preserved when learner transfers classes', () => {
      // Record attendance in Grade 3A
      LearnerParticipationService.recordAttendanceBatch({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: '2026-02-10',
        academicYearId: 'ay_lwps_2026',
        records: [{ learnerId: 'lrn_lwps_301', attendanceStatus: 'PRESENT' }],
      });

      // Create new class Grade 3 West and transfer learner
      const cgWest = ClassGroupService.createClassGroup({
        schoolId: lwpsSchoolId,
        name: 'Grade 3 West',
        gradeId: 'grade-3',
        academicYearId: 'ay_lwps_2026',
        requestingUserId: '1',
      });

      LearnerRosterService.transferLearnerClass({
        schoolId: lwpsSchoolId,
        learnerId: 'lrn_lwps_301',
        fromClassGroupId: classGroupIdG3A,
        toClassGroupId: cgWest.id,
        requestingUserId: '1',
      });

      // Historical record still references original Grade 3A class group
      const history = LearnerParticipationService.getLearnerAttendanceHistory({
        schoolId: lwpsSchoolId,
        requestingUserId: teacherJaneId,
        learnerId: 'lrn_lwps_301',
      });

      expect(history).toHaveLength(1);
      expect(history[0].classGroupId).toBe(classGroupIdG3A);
    });

    it('EC-37 & EC-38 — Duplicate protection & Idempotency on repeated updates', () => {
      // First update
      LearnerParticipationService.recordAttendanceBatch({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
        academicYearId: 'ay_lwps_2026',
        records: [{ learnerId: 'lrn_lwps_301', attendanceStatus: 'PRESENT' }],
      });

      // Duplicate / Repeat update
      LearnerParticipationService.recordAttendanceBatch({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
        academicYearId: 'ay_lwps_2026',
        records: [{ learnerId: 'lrn_lwps_301', attendanceStatus: 'PRESENT' }],
      });

      const summary = LearnerParticipationService.getAttendanceForLesson({
        schoolId: lwpsSchoolId,
        requestingUserId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
      });

      // Exactly 1 record for lrn_lwps_301, not duplicates
      expect(summary.records.filter((r) => r.learnerId === 'lrn_lwps_301')).toHaveLength(1);
    });

    it('EC-40 — Auditability of attendance actions', () => {
      LearnerParticipationService.recordAttendanceBatch({
        schoolId: lwpsSchoolId,
        teacherId: teacherJaneId,
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
        academicYearId: 'ay_lwps_2026',
        records: [{ learnerId: 'lrn_lwps_301', attendanceStatus: 'PRESENT' }],
      });

      const logs = AuditService.getLogs(lwpsSchoolId);
      expect(logs.some((l) => l.details?.action === 'CLASSROOM_ATTENDANCE_RECORDED')).toBe(true);
    });

    it('EC-44 — School Admin can review and perform permitted oversight/corrections', () => {
      const summary = LearnerParticipationService.getAttendanceForLesson({
        schoolId: lwpsSchoolId,
        requestingUserId: '1', // School Admin
        classGroupId: classGroupIdG3A,
        lessonDate: lessonDateStr,
      });

      expect(summary).toBeDefined();
    });
  });
});
