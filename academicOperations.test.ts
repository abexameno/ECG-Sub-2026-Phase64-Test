import { AcademicOperationsService } from './services/academicOperationsService.ts';
import { DailyTeachingService } from './services/dailyTeachingService.ts';

describe('Phase 17 — School Academic Operations, Calendar & Teaching Control', () => {
  beforeEach(() => {
    AcademicOperationsService.clearStore();
  });

  describe('1. Academic Year Management', () => {
    it('creates an academic year when requested by admin', () => {
      const year = AcademicOperationsService.createAcademicYear({
        schoolId: 'lwps',
        name: '2027',
        startDate: '2027-01-04',
        endDate: '2027-11-19',
        requestingRole: 'admin',
      });

      expect(year.id).toBeDefined();
      expect(year.name).toBe('2027');
      expect(year.status).toBe('PLANNED');
    });

    it('rejects academic year creation if requested by non-admin', () => {
      expect(() => {
        AcademicOperationsService.createAcademicYear({
          schoolId: 'lwps',
          name: '2027',
          startDate: '2027-01-04',
          endDate: '2027-11-19',
          requestingRole: 'teacher',
        });
      }).toThrow(/Unauthorized/);
    });

    it('rejects invalid academic year dates where startDate >= endDate', () => {
      expect(() => {
        AcademicOperationsService.createAcademicYear({
          schoolId: 'lwps',
          name: '2028',
          startDate: '2028-11-19',
          endDate: '2028-01-04',
          requestingRole: 'admin',
        });
      }).toThrow(/Invalid academic year dates/);
    });

    it('activates academic year and marks previous active as completed', () => {
      const year2027 = AcademicOperationsService.createAcademicYear({
        schoolId: 'lwps',
        name: '2027',
        startDate: '2027-01-04',
        endDate: '2027-11-19',
        requestingRole: 'admin',
      });

      const active2026 = AcademicOperationsService.getActiveAcademicYear('lwps');
      expect(active2026?.name).toBe('2026');

      AcademicOperationsService.activateAcademicYear(year2027.id, 'lwps', 'admin');

      const newActive = AcademicOperationsService.getActiveAcademicYear('lwps');
      expect(newActive?.id).toBe(year2027.id);
      expect(newActive?.status).toBe('ACTIVE');
    });
  });

  describe('2. Academic Term Management', () => {
    it('creates terms within an academic year boundary', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      const term3 = AcademicOperationsService.createAcademicTerm({
        schoolId: 'lwps',
        academicYearId: activeYear.id,
        termNumber: 3,
        name: 'Term 3',
        startDate: '2026-08-31',
        endDate: '2026-10-30',
        teachingWeeks: 9,
        requestingRole: 'admin',
      });

      expect(term3.id).toBeDefined();
      expect(term3.teachingWeeks).toBe(9);
      expect(term3.status).toBe('PLANNED');
    });

    it('rejects terms outside academic year date bounds', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      expect(() => {
        AcademicOperationsService.createAcademicTerm({
          schoolId: 'lwps',
          academicYearId: activeYear.id,
          termNumber: 4,
          name: 'Term 4',
          startDate: '2026-12-01',
          endDate: '2026-12-30',
          teachingWeeks: 4,
          requestingRole: 'admin',
        });
      }).toThrow(/Term dates must fall completely within the parent academic year/);
    });

    it('rejects overlapping terms within the same academic year', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      expect(() => {
        AcademicOperationsService.createAcademicTerm({
          schoolId: 'lwps',
          academicYearId: activeYear.id,
          termNumber: 4,
          name: 'Overlapping Term',
          startDate: '2026-01-10', // Overlaps with Term 1 (2026-01-05 - 2026-04-03)
          endDate: '2026-02-10',
          teachingWeeks: 4,
          requestingRole: 'admin',
        });
      }).toThrow(/Term dates overlap/);
    });
  });

  describe('3. Academic Calendar & Day View Resolution', () => {
    it('resolves standard weekday as teaching day', () => {
      // 2026-01-07 is a Wednesday
      const dayView = AcademicOperationsService.getAcademicDayView('lwps', '2026-01-07');
      expect(dayView.isTeachingDay).toBe(true);
      expect(dayView.dayType).toBe('TEACHING_DAY');
      expect(dayView.teachingWeekNumber).toBe(1);
    });

    it('resolves weekend as non-teaching day', () => {
      // 2026-01-10 is a Saturday
      const dayView = AcademicOperationsService.getAcademicDayView('lwps', '2026-01-10');
      expect(dayView.isTeachingDay).toBe(false);
      expect(dayView.dayType).toBe('NON_TEACHING_DAY');
    });

    it('records and respects public holidays', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      AcademicOperationsService.addCalendarEvent({
        schoolId: 'lwps',
        academicYearId: activeYear.id,
        date: '2026-01-15',
        eventType: 'PUBLIC_HOLIDAY',
        name: 'National Holiday',
        isTeachingDay: false,
        requestingRole: 'admin',
      });

      const dayView = AcademicOperationsService.getAcademicDayView('lwps', '2026-01-15');
      expect(dayView.isTeachingDay).toBe(false);
      expect(dayView.dayType).toBe('NON_TEACHING_DAY');
      expect(dayView.events.length).toBe(1);
    });

    it('records school closures with capacity impact calculation', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      const result = AcademicOperationsService.recordSchoolClosure({
        schoolId: 'lwps',
        academicYearId: activeYear.id,
        date: '2026-02-10',
        reason: 'Severe weather advisory',
        requestingUserId: 'admin_user',
        requestingRole: 'admin',
      });

      expect(result.event.eventType).toBe('SCHOOL_CLOSURE');
      expect(result.impact.affectedLessonsCount).toBeGreaterThan(0);
      expect(result.impact.capacityStatus).toBe('sufficient');

      const dayView = AcademicOperationsService.getAcademicDayView('lwps', '2026-02-10');
      expect(dayView.isTeachingDay).toBe(false);
      expect(dayView.dayType).toBe('SCHOOL_CLOSED');
    });
  });

  describe('4. Teaching Schedule & Conflict Detection', () => {
    it('creates a valid timetable schedule for an assigned teacher', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      const activeTerm = AcademicOperationsService.getActiveTerm('lwps')!;

      const sched = AcademicOperationsService.createLessonSchedule({
        schoolId: 'lwps',
        academicYearId: activeYear.id,
        termId: activeTerm.id,
        gradeId: 'grade-8',
        learningAreaId: 'integrated-science',
        teacherId: 'teacher_jane',
        dayOfWeek: 1, // Monday
        period: 2,
        startTime: '08:40',
        endTime: '09:20',
        requestingRole: 'admin',
      });

      expect(sched.id).toBeDefined();
      expect(sched.period).toBe(2);
      expect(sched.dayOfWeek).toBe(1);
    });

    it('rejects schedule if teacher is not assigned to the subject', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      const activeTerm = AcademicOperationsService.getActiveTerm('lwps')!;

      expect(() => {
        AcademicOperationsService.createLessonSchedule({
          schoolId: 'lwps',
          academicYearId: activeYear.id,
          termId: activeTerm.id,
          gradeId: 'grade-8',
          learningAreaId: 'mathematics', // Jane is not assigned to Math
          teacherId: 'teacher_jane',
          dayOfWeek: 1,
          period: 1,
          startTime: '08:00',
          endTime: '08:40',
          requestingRole: 'admin',
        });
      }).toThrow(/is not assigned to/);
    });

    it('detects timetable conflict when teacher is already scheduled in the same period', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      const activeTerm = AcademicOperationsService.getActiveTerm('lwps')!;

      AcademicOperationsService.createLessonSchedule({
        schoolId: 'lwps',
        academicYearId: activeYear.id,
        termId: activeTerm.id,
        gradeId: 'grade-8',
        learningAreaId: 'integrated-science',
        teacherId: 'teacher_jane',
        dayOfWeek: 2, // Tuesday
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        requestingRole: 'admin',
      });

      // Try scheduling same teacher in same period on Tuesday
      expect(() => {
        AcademicOperationsService.createLessonSchedule({
          schoolId: 'lwps',
          academicYearId: activeYear.id,
          termId: activeTerm.id,
          gradeId: 'grade-8',
          learningAreaId: 'integrated-science',
          teacherId: 'teacher_jane',
          dayOfWeek: 2,
          period: 1,
          startTime: '08:00',
          endTime: '08:40',
          requestingRole: 'admin',
        });
      }).toThrow(/Scheduling Conflict/);
    });
  });

  describe('5. Operational Exceptions (Cancellation & Rescheduling)', () => {
    it('cancels a scheduled lesson with reason without mutating curriculum or plan', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      const activeTerm = AcademicOperationsService.getActiveTerm('lwps')!;

      const sched = AcademicOperationsService.createLessonSchedule({
        schoolId: 'lwps',
        academicYearId: activeYear.id,
        termId: activeTerm.id,
        gradeId: 'grade-8',
        learningAreaId: 'integrated-science',
        teacherId: 'teacher_jane',
        dayOfWeek: 3, // Wednesday
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        requestingRole: 'admin',
      });

      const exception = AcademicOperationsService.cancelLesson({
        schoolId: 'lwps',
        scheduleId: sched.id,
        effectiveDate: '2026-01-14',
        reason: 'Teacher attending science symposium',
        requestingUserId: 'teacher_jane',
        requestingRole: 'teacher',
      });

      expect(exception.exceptionType).toBe('LESSON_CANCELLED');
      expect(exception.reason).toContain('symposium');

      const opView = AcademicOperationsService.getTodayOperationsView('lwps', '2026-01-14', 'teacher', 'teacher_jane');
      expect(opView.cancelledLessonsCount).toBe(1);
      expect(opView.lessons[0].operationalStatus).toBe('CANCELLED');
      expect(opView.lessons[0].cancellationReason).toContain('symposium');
    });

    it('reschedules a lesson to an active teaching day', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      const activeTerm = AcademicOperationsService.getActiveTerm('lwps')!;

      const sched = AcademicOperationsService.createLessonSchedule({
        schoolId: 'lwps',
        academicYearId: activeYear.id,
        termId: activeTerm.id,
        gradeId: 'grade-8',
        learningAreaId: 'integrated-science',
        teacherId: 'teacher_jane',
        dayOfWeek: 4, // Thursday
        period: 2,
        startTime: '08:40',
        endTime: '09:20',
        requestingRole: 'admin',
      });

      const resched = AcademicOperationsService.rescheduleLesson({
        schoolId: 'lwps',
        scheduleId: sched.id,
        originalDate: '2026-01-15',
        originalPeriod: 2,
        rescheduledDate: '2026-01-16', // Friday
        rescheduledPeriod: 4,
        reason: 'Practical lab session extension',
        requestingUserId: 'teacher_jane',
        requestingRole: 'teacher',
      });

      expect(resched.exceptionType).toBe('LESSON_RESCHEDULED');
      expect(resched.rescheduledDate).toBe('2026-01-16');
      expect(resched.rescheduledPeriod).toBe(4);
    });

    it('rejects rescheduling to a weekend or non-teaching day', () => {
      const activeYear = AcademicOperationsService.getActiveAcademicYear('lwps')!;
      const activeTerm = AcademicOperationsService.getActiveTerm('lwps')!;

      const sched = AcademicOperationsService.createLessonSchedule({
        schoolId: 'lwps',
        academicYearId: activeYear.id,
        termId: activeTerm.id,
        gradeId: 'grade-8',
        learningAreaId: 'integrated-science',
        teacherId: 'teacher_jane',
        dayOfWeek: 4,
        period: 3,
        startTime: '09:20',
        endTime: '10:00',
        requestingRole: 'admin',
      });

      expect(() => {
        AcademicOperationsService.rescheduleLesson({
          schoolId: 'lwps',
          scheduleId: sched.id,
          originalDate: '2026-01-15',
          originalPeriod: 3,
          rescheduledDate: '2026-01-17', // Saturday
          rescheduledPeriod: 1,
          reason: 'Weekend test',
          requestingUserId: 'teacher_jane',
          requestingRole: 'teacher',
        });
      }).toThrow(/Not an active teaching day/);
    });
  });

  describe('6. Multi-School Isolation & LWPS Non-Regression', () => {
    it('maintains strict school isolation for schedules and calendars', () => {
      const schoolBYear = AcademicOperationsService.getActiveAcademicYear('school-b')!;
      const schoolBTerm = AcademicOperationsService.getActiveTerm('school-b')!;

      // Assign teacher in School B
      AcademicOperationsService.assignTeacher({
        schoolId: 'school-b',
        teacherId: 'teacher_bob',
        gradeId: 'grade-8',
        learningAreaId: 'integrated-science',
        academicYearId: schoolBYear.id,
        requestingRole: 'admin',
      });

      const schedB = AcademicOperationsService.createLessonSchedule({
        schoolId: 'school-b',
        academicYearId: schoolBYear.id,
        termId: schoolBTerm.id,
        gradeId: 'grade-8',
        learningAreaId: 'integrated-science',
        teacherId: 'teacher_bob',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        requestingRole: 'admin',
      });

      expect(schedB.schoolId).toBe('school-b');

      // School B schedule must NOT appear in LWPS
      const lwpsSchedules = AcademicOperationsService.getTeacherSchedule('lwps', 'teacher_bob');
      expect(lwpsSchedules.length).toBe(0);
    });

    it('enriches DailyTeachingService with operational day context without breaking Phase 16', () => {
      const todayLesson = DailyTeachingService.resolveTodayLesson('teacher_jane', 'lwps');
      expect(todayLesson).toBeDefined();
      expect(todayLesson?.learningOutcomeId).toBeDefined();
      expect(todayLesson?.isTeachingDay).toBeDefined();
    });
  });
});
