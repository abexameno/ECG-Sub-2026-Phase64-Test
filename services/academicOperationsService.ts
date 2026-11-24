import {
  AcademicYear,
  AcademicTerm,
  AcademicCalendarEvent,
  LessonSchedule,
  TeacherAssignment,
  OperationalException,
  AcademicDayView,
  TodayTeachingOperationsView,
  ScheduledLessonOperationItem,
  CalendarImpactSummary,
  TeachingWeekView,
  AcademicDayType,
  LessonOperationalStatus,
} from '../types/academicOperations.ts';
import { SchoolConfigService } from './schoolConfigService.ts';
import { TeachingPlanService } from './teachingPlanService.ts';
import { TeachingActivityService } from './teachingActivityService.ts';
import { AuditService } from './auditService.ts';
import { CapacityStatus } from '../types/teachingPlan.ts';

// In-Memory Data Stores for Multi-School Operations
const academicYearsStore: Map<string, AcademicYear> = new Map();
const academicTermsStore: Map<string, AcademicTerm> = new Map();
const calendarEventsStore: Map<string, AcademicCalendarEvent> = new Map();
const lessonSchedulesStore: Map<string, LessonSchedule> = new Map();
const teacherAssignmentsStore: Map<string, TeacherAssignment> = new Map();
const operationalExceptionsStore: Map<string, OperationalException> = new Map();

function initDefaultSeedData() {
  if (academicYearsStore.size > 0) return;

  // School A (LWPS) Default 2026 Setup -> Term 1 Active
  const schoolAYear: AcademicYear = {
    id: 'ay_school-a_2026',
    schoolId: 'school-a',
    name: '2026',
    startDate: '2026-01-05',
    endDate: '2026-11-20',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  academicYearsStore.set(schoolAYear.id, schoolAYear);

  const schoolATerm1: AcademicTerm = {
    id: 'term_school-a_2026_1',
    schoolId: 'school-a',
    academicYearId: schoolAYear.id,
    termNumber: 1,
    name: 'Term 1',
    startDate: '2026-01-05',
    endDate: '2026-04-03',
    teachingWeeks: 13,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  academicTermsStore.set(schoolATerm1.id, schoolATerm1);

  // School B -> Term 2 Active
  const schoolBYear: AcademicYear = {
    id: 'ay_school-b_2026',
    schoolId: 'school-b',
    name: '2026',
    startDate: '2026-01-12',
    endDate: '2026-11-13',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  academicYearsStore.set(schoolBYear.id, schoolBYear);

  const schoolBTerm2: AcademicTerm = {
    id: 'term_school-b_2026_2',
    schoolId: 'school-b',
    academicYearId: schoolBYear.id,
    termNumber: 2,
    name: 'Term 2',
    startDate: '2026-05-04',
    endDate: '2026-07-31',
    teachingWeeks: 13,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  academicTermsStore.set(schoolBTerm2.id, schoolBTerm2);

  // School C -> Term 3 Active
  const schoolCYear: AcademicYear = {
    id: 'ay_school-c_2026',
    schoolId: 'school-c',
    name: '2026',
    startDate: '2026-01-12',
    endDate: '2026-11-13',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  academicYearsStore.set(schoolCYear.id, schoolCYear);

  const schoolCTerm3: AcademicTerm = {
    id: 'term_school-c_2026_3',
    schoolId: 'school-c',
    academicYearId: schoolCYear.id,
    termNumber: 3,
    name: 'Term 3',
    startDate: '2026-08-31',
    endDate: '2026-11-13',
    teachingWeeks: 12,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  academicTermsStore.set(schoolCTerm3.id, schoolCTerm3);

  // Keep original LWPS for backward compatibility in tests
  const lwpsYear: AcademicYear = {
    id: 'ay_lwps_2026',
    schoolId: 'lwps',
    name: '2026',
    startDate: '2026-01-05',
    endDate: '2026-11-20',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  academicYearsStore.set(lwpsYear.id, lwpsYear);

  const lwpsTerm1: AcademicTerm = {
    id: 'term_lwps_2026_1',
    schoolId: 'lwps',
    academicYearId: lwpsYear.id,
    termNumber: 1,
    name: 'Term 1',
    startDate: '2026-01-05',
    endDate: '2026-04-03',
    teachingWeeks: 13,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  academicTermsStore.set(lwpsTerm1.id, lwpsTerm1);

  // Default Teacher Assignment: teacher_jane -> Grade 8 Integrated Science
  const assignJane: TeacherAssignment = {
    id: 'assign_lwps_jane_sci',
    schoolId: 'lwps',
    teacherId: 'teacher_jane',
    gradeId: 'grade-8',
    learningAreaId: 'integrated-science',
    academicYearId: lwpsYear.id,
    active: true,
    assignedAt: '2026-01-02T00:00:00.000Z',
  };
  teacherAssignmentsStore.set(assignJane.id, assignJane);
}

// Initial invocation
initDefaultSeedData();

export const AcademicOperationsService = {
  clearStore(): void {
    academicYearsStore.clear();
    academicTermsStore.clear();
    calendarEventsStore.clear();
    lessonSchedulesStore.clear();
    teacherAssignmentsStore.clear();
    operationalExceptionsStore.clear();
    initDefaultSeedData();
  },

  // ----------------------------------------------------
  // 1. ACADEMIC YEAR MANAGEMENT
  // ----------------------------------------------------
  createAcademicYear(params: {
    schoolId: string;
    name: string;
    startDate: string;
    endDate: string;
    requestingRole: string;
  }): AcademicYear {
    if (params.requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can manage academic years.');
    }

    const school = SchoolConfigService.getSchoolProfile(params.schoolId);
    if (!school) {
      throw new Error(`School not found: ${params.schoolId}`);
    }

    if (new Date(params.startDate) >= new Date(params.endDate)) {
      throw new Error('Invalid academic year dates: startDate must precede endDate.');
    }

    // Check existing year with same name in same school
    for (const year of academicYearsStore.values()) {
      if (year.schoolId === params.schoolId && year.name === params.name) {
        throw new Error(`Academic year with name ${params.name} already exists for school ${params.schoolId}`);
      }
    }

    const year: AcademicYear = {
      id: `ay_${params.schoolId}_${params.name.replace(/\s+/g, '_')}_${Date.now()}`,
      schoolId: params.schoolId,
      name: params.name,
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'PLANNED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    academicYearsStore.set(year.id, year);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ACADEMIC_YEAR_CREATED',
      yearId: year.id,
      yearName: year.name,
    });

    return year;
  },

  activateAcademicYear(yearId: string, schoolId: string, requestingRole: string): AcademicYear {
    if (requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can activate academic years.');
    }

    const year = academicYearsStore.get(yearId);
    if (!year || year.schoolId !== schoolId) {
      throw new Error(`Academic year ${yearId} not found for school ${schoolId}`);
    }

    // Deactivate any currently active year for this school
    for (const y of academicYearsStore.values()) {
      if (y.schoolId === schoolId && y.status === 'ACTIVE' && y.id !== yearId) {
        y.status = 'COMPLETED';
        y.updatedAt = new Date().toISOString();
      }
    }

    year.status = 'ACTIVE';
    year.updatedAt = new Date().toISOString();

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ACADEMIC_YEAR_ACTIVATED',
      yearId: year.id,
    });

    return year;
  },

  completeAcademicYear(yearId: string, schoolId: string, requestingRole: string): AcademicYear {
    if (requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can complete academic years.');
    }

    const year = academicYearsStore.get(yearId);
    if (!year || year.schoolId !== schoolId) {
      throw new Error(`Academic year ${yearId} not found for school ${schoolId}`);
    }

    year.status = 'COMPLETED';
    year.updatedAt = new Date().toISOString();
    return year;
  },

  archiveAcademicYear(yearId: string, schoolId: string, requestingRole: string): AcademicYear {
    if (requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can archive academic years.');
    }

    const year = academicYearsStore.get(yearId);
    if (!year || year.schoolId !== schoolId) {
      throw new Error(`Academic year ${yearId} not found for school ${schoolId}`);
    }

    year.status = 'ARCHIVED';
    year.updatedAt = new Date().toISOString();
    return year;
  },

  getActiveAcademicYear(schoolId: string): AcademicYear | null {
    for (const year of academicYearsStore.values()) {
      if (year.schoolId === schoolId && year.status === 'ACTIVE') {
        return year;
      }
    }
    return null;
  },

  listAcademicYears(schoolId: string): AcademicYear[] {
    return Array.from(academicYearsStore.values()).filter(y => y.schoolId === schoolId);
  },

  // ----------------------------------------------------
  // 2. ACADEMIC TERMS MANAGEMENT
  // ----------------------------------------------------
  createAcademicTerm(params: {
    schoolId: string;
    academicYearId: string;
    termNumber: number;
    name: string;
    startDate: string;
    endDate: string;
    teachingWeeks: number;
    requestingRole: string;
  }): AcademicTerm {
    if (params.requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can create academic terms.');
    }

    const year = academicYearsStore.get(params.academicYearId);
    if (!year || year.schoolId !== params.schoolId) {
      throw new Error(`Academic year ${params.academicYearId} not found for school ${params.schoolId}`);
    }

    if (new Date(params.startDate) >= new Date(params.endDate)) {
      throw new Error('Invalid term dates: startDate must precede endDate.');
    }

    if (
      new Date(params.startDate) < new Date(year.startDate) ||
      new Date(params.endDate) > new Date(year.endDate)
    ) {
      throw new Error('Term dates must fall completely within the parent academic year.');
    }

    // Check for overlapping terms within the same academic year
    for (const t of academicTermsStore.values()) {
      if (t.schoolId === params.schoolId && t.academicYearId === params.academicYearId) {
        if (t.termNumber === params.termNumber) {
          throw new Error(`Term number ${params.termNumber} already exists in academic year ${params.academicYearId}`);
        }
        // Date overlap check
        const tStart = new Date(t.startDate).getTime();
        const tEnd = new Date(t.endDate).getTime();
        const nStart = new Date(params.startDate).getTime();
        const nEnd = new Date(params.endDate).getTime();

        if (nStart < tEnd && nEnd > tStart) {
          throw new Error(`Term dates overlap with existing term "${t.name}" (${t.startDate} - ${t.endDate})`);
        }
      }
    }

    const term: AcademicTerm = {
      id: `term_${params.schoolId}_${params.academicYearId}_${params.termNumber}_${Date.now()}`,
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      termNumber: params.termNumber,
      name: params.name,
      startDate: params.startDate,
      endDate: params.endDate,
      teachingWeeks: params.teachingWeeks,
      status: 'PLANNED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    academicTermsStore.set(term.id, term);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'ACADEMIC_TERM_CREATED',
      termId: term.id,
      name: term.name,
    });

    return term;
  },

  activateAcademicTerm(termId: string, schoolId: string, requestingRole: string): AcademicTerm {
    if (requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can activate academic terms.');
    }

    const term = academicTermsStore.get(termId);
    if (!term || term.schoolId !== schoolId) {
      throw new Error(`Academic term ${termId} not found for school ${schoolId}`);
    }

    for (const t of academicTermsStore.values()) {
      if (t.schoolId === schoolId && t.academicYearId === term.academicYearId && t.id !== termId && t.status === 'ACTIVE') {
        t.status = 'COMPLETED';
        t.updatedAt = new Date().toISOString();
      }
    }

    term.status = 'ACTIVE';
    term.updatedAt = new Date().toISOString();

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'ACADEMIC_TERM_ACTIVATED',
      termId: term.id,
    });

    return term;
  },

  completeAcademicTerm(termId: string, schoolId: string, requestingRole: string): AcademicTerm {
    if (requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can complete academic terms.');
    }

    const term = academicTermsStore.get(termId);
    if (!term || term.schoolId !== schoolId) {
      throw new Error(`Academic term ${termId} not found for school ${schoolId}`);
    }

    term.status = 'COMPLETED';
    term.updatedAt = new Date().toISOString();
    return term;
  },

  getActiveTerm(schoolId: string, forDate?: string): AcademicTerm | null {
    const targetTime = forDate ? new Date(forDate).getTime() : Date.now();

    // First check if an explicitly active term matches the date or is ACTIVE
    for (const term of academicTermsStore.values()) {
      if (term.schoolId === schoolId) {
        if (forDate) {
          const s = new Date(term.startDate).getTime();
          const e = new Date(term.endDate).getTime();
          if (targetTime >= s && targetTime <= e) {
            return term;
          }
        } else if (term.status === 'ACTIVE') {
          return term;
        }
      }
    }

    // Fallback: return any ACTIVE term for school
    for (const term of academicTermsStore.values()) {
      if (term.schoolId === schoolId && term.status === 'ACTIVE') {
        return term;
      }
    }
    return null;
  },

  listTerms(schoolId: string, academicYearId?: string): AcademicTerm[] {
    return Array.from(academicTermsStore.values()).filter(
      t => t.schoolId === schoolId && (!academicYearId || t.academicYearId === academicYearId)
    );
  },

  // ----------------------------------------------------
  // 3. ACADEMIC CALENDAR & EVENTS
  // ----------------------------------------------------
  addCalendarEvent(params: {
    schoolId: string;
    academicYearId: string;
    termId?: string;
    date: string;
    eventType: AcademicCalendarEvent['eventType'];
    name: string;
    isTeachingDay: boolean;
    notes?: string;
    requestingRole: string;
  }): AcademicCalendarEvent {
    if (params.requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can add calendar events.');
    }

    const year = academicYearsStore.get(params.academicYearId);
    if (!year || year.schoolId !== params.schoolId) {
      throw new Error(`Academic year ${params.academicYearId} not found for school ${params.schoolId}`);
    }

    // Idempotent check: if same event exists on date
    for (const ev of calendarEventsStore.values()) {
      if (
        ev.schoolId === params.schoolId &&
        ev.date === params.date &&
        ev.name === params.name &&
        ev.eventType === params.eventType
      ) {
        return ev;
      }
    }

    const event: AcademicCalendarEvent = {
      id: `calevt_${params.schoolId}_${params.date}_${params.eventType}_${Date.now()}`,
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      termId: params.termId,
      date: params.date,
      eventType: params.eventType,
      name: params.name,
      isTeachingDay: params.isTeachingDay,
      notes: params.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    calendarEventsStore.set(event.id, event);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'CALENDAR_EVENT_ADDED',
      eventId: event.id,
      eventType: event.eventType,
      date: event.date,
    });

    return event;
  },

  getCalendarEvents(schoolId: string, startDate?: string, endDate?: string): AcademicCalendarEvent[] {
    return Array.from(calendarEventsStore.values()).filter(e => {
      if (e.schoolId !== schoolId) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    });
  },

  getAcademicDayView(schoolId: string, date: string): AcademicDayView {
    const school = SchoolConfigService.getSchoolProfile(schoolId);
    if (!school) {
      throw new Error(`School not found: ${schoolId}`);
    }

    const events = this.getCalendarEvents(schoolId, date, date);
    const activeYear = this.getActiveAcademicYear(schoolId) || undefined;
    const activeTerm = this.getActiveTerm(schoolId, date) || undefined;

    // Day of week calculation (1 = Mon, ..., 7 = Sun)
    const dt = new Date(date + 'T00:00:00Z');
    const dayIndex = dt.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const dayOfWeek = dayIndex === 0 ? 7 : dayIndex;

    let isTeachingDay = dayOfWeek >= 1 && dayOfWeek <= 5; // default Mon-Fri
    let dayType: AcademicDayType = isTeachingDay ? 'TEACHING_DAY' : 'NON_TEACHING_DAY';

    for (const ev of events) {
      if (ev.eventType === 'SCHOOL_CLOSURE') {
        isTeachingDay = false;
        dayType = 'SCHOOL_CLOSED';
        break;
      } else if (ev.eventType === 'HOLIDAY' || ev.eventType === 'PUBLIC_HOLIDAY') {
        isTeachingDay = false;
        dayType = 'NON_TEACHING_DAY';
      } else if (ev.eventType === 'SPECIAL_ACADEMIC_DAY') {
        dayType = 'SPECIAL_ACADEMIC_DAY';
        if (!ev.isTeachingDay) isTeachingDay = false;
      } else if (ev.isTeachingDay === false) {
        isTeachingDay = false;
        dayType = 'NON_TEACHING_DAY';
      }
    }

    // Deterministic week number calculation if in active term
    let teachingWeekNumber: number | undefined;
    if (activeTerm) {
      const termStart = new Date(activeTerm.startDate + 'T00:00:00Z').getTime();
      const current = new Date(date + 'T00:00:00Z').getTime();
      if (current >= termStart) {
        const diffDays = Math.floor((current - termStart) / (1000 * 60 * 60 * 24));
        teachingWeekNumber = Math.floor(diffDays / 7) + 1;
        if (teachingWeekNumber > activeTerm.teachingWeeks) {
          teachingWeekNumber = activeTerm.teachingWeeks;
        }
      }
    }

    return {
      date,
      schoolId,
      isTeachingDay,
      dayType,
      events,
      activeYear,
      activeTerm,
      teachingWeekNumber,
    };
  },

  // ----------------------------------------------------
  // 4. TEACHING WEEKS CALCULATION
  // ----------------------------------------------------
  getTeachingWeeks(schoolId: string, termId: string): TeachingWeekView[] {
    const term = academicTermsStore.get(termId);
    if (!term || term.schoolId !== schoolId) {
      throw new Error(`Academic term ${termId} not found for school ${schoolId}`);
    }

    const weeks: TeachingWeekView[] = [];
    const termStart = new Date(term.startDate + 'T00:00:00Z');

    for (let w = 1; w <= term.teachingWeeks; w++) {
      const wStart = new Date(termStart.getTime() + (w - 1) * 7 * 24 * 60 * 60 * 1000);
      const wEnd = new Date(wStart.getTime() + 4 * 24 * 60 * 60 * 1000); // Friday of that week

      const startDateStr = wStart.toISOString().split('T')[0];
      const endDateStr = wEnd.toISOString().split('T')[0];

      // Check for closure events during this week
      const events = this.getCalendarEvents(schoolId, startDateStr, endDateStr);
      const hasClosure = events.some(e => e.eventType === 'SCHOOL_CLOSURE');

      weeks.push({
        weekNumber: w,
        startDate: startDateStr,
        endDate: endDateStr,
        status: hasClosure ? 'INTERRUPTED' : w === 1 ? 'CURRENT' : 'UPCOMING',
        totalTeachingDays: hasClosure ? 4 : 5,
      });
    }

    return weeks;
  },

  // ----------------------------------------------------
  // 5. TEACHER ASSIGNMENTS
  // ----------------------------------------------------
  assignTeacher(params: {
    schoolId: string;
    teacherId: string;
    gradeId: string;
    learningAreaId: string;
    academicYearId: string;
    requestingRole: string;
  }): TeacherAssignment {
    if (params.requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can assign teachers.');
    }

    const year = academicYearsStore.get(params.academicYearId);
    if (!year || year.schoolId !== params.schoolId) {
      throw new Error(`Academic year ${params.academicYearId} not found for school ${params.schoolId}`);
    }

    // Check existing
    for (const assign of teacherAssignmentsStore.values()) {
      if (
        assign.schoolId === params.schoolId &&
        assign.teacherId === params.teacherId &&
        assign.gradeId === params.gradeId &&
        assign.learningAreaId === params.learningAreaId &&
        assign.academicYearId === params.academicYearId &&
        assign.active
      ) {
        return assign;
      }
    }

    const assignment: TeacherAssignment = {
      id: `assign_${params.schoolId}_${params.teacherId}_${params.gradeId}_${params.learningAreaId}_${Date.now()}`,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      gradeId: params.gradeId,
      learningAreaId: params.learningAreaId,
      academicYearId: params.academicYearId,
      active: true,
      assignedAt: new Date().toISOString(),
    };

    teacherAssignmentsStore.set(assignment.id, assignment);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'TEACHER_ASSIGNED',
      assignmentId: assignment.id,
      teacherId: params.teacherId,
      gradeId: params.gradeId,
      learningAreaId: params.learningAreaId,
    });

    return assignment;
  },

  getTeacherAssignments(schoolId: string, teacherId: string): TeacherAssignment[] {
    return Array.from(teacherAssignmentsStore.values()).filter(
      a => a.schoolId === schoolId && a.teacherId === teacherId && a.active
    );
  },

  verifyTeacherAssignment(schoolId: string, teacherId: string, gradeId: string, learningAreaId: string): boolean {
    for (const a of teacherAssignmentsStore.values()) {
      if (
        a.schoolId === schoolId &&
        a.teacherId === teacherId &&
        a.gradeId === gradeId &&
        a.learningAreaId === learningAreaId &&
        a.active
      ) {
        return true;
      }
    }
    return false;
  },

  // ----------------------------------------------------
  // 6. LESSON SCHEDULE (TIMETABLE)
  // ----------------------------------------------------
  createLessonSchedule(params: {
    schoolId: string;
    academicYearId: string;
    termId: string;
    gradeId: string;
    learningAreaId: string;
    teacherId: string;
    dayOfWeek: number; // 1 = Mon .. 5 = Fri
    period: number; // 1, 2, 3..
    startTime: string;
    endTime: string;
    roomId?: string;
    requestingRole: string;
  }): LessonSchedule {
    if (params.requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can configure lesson schedules.');
    }

    const term = academicTermsStore.get(params.termId);
    if (!term || term.schoolId !== params.schoolId) {
      throw new Error(`Academic term ${params.termId} not found for school ${params.schoolId}`);
    }

    // Check teacher assignment authorization
    if (!this.verifyTeacherAssignment(params.schoolId, params.teacherId, params.gradeId, params.learningAreaId)) {
      throw new Error(`Teacher ${params.teacherId} is not assigned to ${params.gradeId} ${params.learningAreaId}`);
    }

    // Detect timetable conflicts:
    // 1. Teacher already scheduled in same period on same day
    for (const s of lessonSchedulesStore.values()) {
      if (
        s.schoolId === params.schoolId &&
        s.termId === params.termId &&
        s.dayOfWeek === params.dayOfWeek &&
        s.period === params.period &&
        s.active
      ) {
        if (s.teacherId === params.teacherId) {
          throw new Error(
            `Scheduling Conflict: Teacher ${params.teacherId} is already scheduled for ${s.gradeId} ${s.learningAreaId} during Period ${params.period} on Day ${params.dayOfWeek}`
          );
        }
        if (s.gradeId === params.gradeId) {
          throw new Error(
            `Scheduling Conflict: Grade ${params.gradeId} already has ${s.learningAreaId} scheduled during Period ${params.period} on Day ${params.dayOfWeek}`
          );
        }
      }
    }

    const schedule: LessonSchedule = {
      id: `sched_${params.schoolId}_${params.gradeId}_${params.learningAreaId}_d${params.dayOfWeek}_p${params.period}`,
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      termId: params.termId,
      gradeId: params.gradeId,
      learningAreaId: params.learningAreaId,
      teacherId: params.teacherId,
      dayOfWeek: params.dayOfWeek,
      period: params.period,
      startTime: params.startTime,
      endTime: params.endTime,
      roomId: params.roomId,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    lessonSchedulesStore.set(schedule.id, schedule);

    AuditService.log('ARTIFACT_CREATED', params.schoolId, {
      action: 'LESSON_SCHEDULE_CREATED',
      scheduleId: schedule.id,
      teacherId: schedule.teacherId,
      dayOfWeek: schedule.dayOfWeek,
      period: schedule.period,
    });

    return schedule;
  },

  getTeacherSchedule(schoolId: string, teacherId: string, termId?: string): LessonSchedule[] {
    return Array.from(lessonSchedulesStore.values()).filter(
      s => s.schoolId === schoolId && s.teacherId === teacherId && (!termId || s.termId === termId) && s.active
    );
  },

  // ----------------------------------------------------
  // 7. OPERATIONAL EXCEPTIONS (CANCEL, RESCHEDULE, CLOSURE)
  // ----------------------------------------------------
  cancelLesson(params: {
    schoolId: string;
    scheduleId: string;
    teachingAllocationId?: string;
    effectiveDate: string;
    reason: string;
    requestingUserId: string;
    requestingRole: string;
  }): OperationalException {
    const schedule = lessonSchedulesStore.get(params.scheduleId);
    if (!schedule || schedule.schoolId !== params.schoolId) {
      throw new Error(`Lesson schedule ${params.scheduleId} not found in school ${params.schoolId}`);
    }

    // Check authorization: Admin or assigned teacher
    if (params.requestingRole !== 'admin' && schedule.teacherId !== params.requestingUserId) {
      throw new Error('Unauthorized: Cannot cancel a lesson for another teacher without admin role.');
    }

    const exception: OperationalException = {
      id: `op_ex_cancel_${params.schoolId}_${params.scheduleId}_${params.effectiveDate}_${Date.now()}`,
      schoolId: params.schoolId,
      academicYearId: schedule.academicYearId,
      termId: schedule.termId,
      exceptionType: 'LESSON_CANCELLED',
      affectedScheduleId: params.scheduleId,
      teachingAllocationId: params.teachingAllocationId,
      teacherId: schedule.teacherId,
      gradeId: schedule.gradeId,
      learningAreaId: schedule.learningAreaId,
      originalDate: params.effectiveDate,
      originalPeriod: schedule.period,
      reason: params.reason,
      effectiveDate: params.effectiveDate,
      createdBy: params.requestingUserId,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };

    operationalExceptionsStore.set(exception.id, exception);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LESSON_CANCELLED',
      scheduleId: params.scheduleId,
      effectiveDate: params.effectiveDate,
      reason: params.reason,
      actor: params.requestingUserId,
    });

    return exception;
  },

  rescheduleLesson(params: {
    schoolId: string;
    scheduleId: string;
    teachingAllocationId?: string;
    originalDate: string;
    originalPeriod: number;
    rescheduledDate: string;
    rescheduledPeriod: number;
    reason: string;
    requestingUserId: string;
    requestingRole: string;
  }): OperationalException {
    const schedule = lessonSchedulesStore.get(params.scheduleId);
    if (!schedule || schedule.schoolId !== params.schoolId) {
      throw new Error(`Lesson schedule ${params.scheduleId} not found in school ${params.schoolId}`);
    }

    // Check authorization: Admin or assigned teacher
    if (params.requestingRole !== 'admin' && schedule.teacherId !== params.requestingUserId) {
      throw new Error('Unauthorized: Cannot reschedule a lesson for another teacher without admin role.');
    }

    // Verify rescheduledDate is a valid operating day
    const dayView = this.getAcademicDayView(params.schoolId, params.rescheduledDate);
    if (!dayView.isTeachingDay) {
      throw new Error(`Cannot reschedule lesson to ${params.rescheduledDate}: Not an active teaching day (${dayView.dayType})`);
    }

    const exception: OperationalException = {
      id: `op_ex_resched_${params.schoolId}_${params.scheduleId}_${params.originalDate}_${Date.now()}`,
      schoolId: params.schoolId,
      academicYearId: schedule.academicYearId,
      termId: schedule.termId,
      exceptionType: 'LESSON_RESCHEDULED',
      affectedScheduleId: params.scheduleId,
      teachingAllocationId: params.teachingAllocationId,
      teacherId: schedule.teacherId,
      gradeId: schedule.gradeId,
      learningAreaId: schedule.learningAreaId,
      originalDate: params.originalDate,
      originalPeriod: params.originalPeriod,
      rescheduledDate: params.rescheduledDate,
      rescheduledPeriod: params.rescheduledPeriod,
      reason: params.reason,
      effectiveDate: params.originalDate,
      createdBy: params.requestingUserId,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };

    operationalExceptionsStore.set(exception.id, exception);

    AuditService.log('ARTIFACT_UPDATED', params.schoolId, {
      action: 'LESSON_RESCHEDULED',
      scheduleId: params.scheduleId,
      originalDate: params.originalDate,
      rescheduledDate: params.rescheduledDate,
      reason: params.reason,
      actor: params.requestingUserId,
    });

    return exception;
  },

  recordSchoolClosure(params: {
    schoolId: string;
    academicYearId: string;
    termId?: string;
    date: string;
    reason: string;
    requestingUserId: string;
    requestingRole: string;
  }): { event: AcademicCalendarEvent; impact: CalendarImpactSummary } {
    if (params.requestingRole !== 'admin') {
      throw new Error('Unauthorized: Only administrators can record school closures.');
    }

    const event = this.addCalendarEvent({
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      termId: params.termId,
      date: params.date,
      eventType: 'SCHOOL_CLOSURE',
      name: `School Closure: ${params.reason}`,
      isTeachingDay: false,
      notes: params.reason,
      requestingRole: params.requestingRole,
    });

    // Record exception
    const exception: OperationalException = {
      id: `op_ex_closure_${params.schoolId}_${params.date}_${Date.now()}`,
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      termId: params.termId,
      exceptionType: 'SCHOOL_CLOSED',
      reason: params.reason,
      effectiveDate: params.date,
      createdBy: params.requestingUserId,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };
    operationalExceptionsStore.set(exception.id, exception);

    const term = params.termId
      ? academicTermsStore.get(params.termId)
      : this.getActiveTerm(params.schoolId, params.date);

    const activeTerm = AcademicOperationsService.getActiveTerm(params.schoolId, params.date);
    const impact = this.evaluateCalendarCapacityImpact(params.schoolId, term?.id || activeTerm?.id || 'term_lwps_2026_1', event.id);

    return { event, impact };
  },

  // ----------------------------------------------------
  // 8. CAPACITY IMPACT EVALUATION (USES PHASE 3 RULES)
  // ----------------------------------------------------
  evaluateCalendarCapacityImpact(schoolId: string, termId: string, calendarEventId?: string): CalendarImpactSummary {
    const term = academicTermsStore.get(termId);
    const config = SchoolConfigService.getTeachingConfig(schoolId);

    const totalPossibleSlots = (term ? term.teachingWeeks : config.teachingWeeksPerTerm) * config.lessonsPerWeek;

    // Count closures in term
    const closures = Array.from(calendarEventsStore.values()).filter(
      e => e.schoolId === schoolId && e.eventType === 'SCHOOL_CLOSURE' && (!term || !e.termId || e.termId === termId)
    );

    const lostDays = Math.max(1, closures.length);
    // Lessons lost approx (lostDays * (lessonsPerWeek / 5))
    const lostSlots = Math.max(1, Math.ceil(lostDays * (config.lessonsPerWeek / 5)));
    const availableTeachingSlots = Math.max(0, totalPossibleSlots - lostSlots);

    // Required lessons from typical CBC term (e.g. 50 lessons for Integrated Science)
    const requiredTeachingSlots = 48;

    let capacityStatus: CapacityStatus = 'sufficient';
    let capacityWarning: string | undefined;
    let reviewRequired = false;

    if (availableTeachingSlots < requiredTeachingSlots) {
      capacityStatus = 'insufficient';
      capacityWarning = `Available teaching slots (${availableTeachingSlots}) are below required curriculum capacity (${requiredTeachingSlots}). Teaching Plan requires review.`;
      reviewRequired = true;
    } else if (availableTeachingSlots <= requiredTeachingSlots + 2) {
      capacityStatus = 'tight';
      capacityWarning = `Available capacity (${availableTeachingSlots}) is tight for required curriculum (${requiredTeachingSlots}).`;
    }

    return {
      schoolId,
      calendarEventId: calendarEventId || `eval_${Date.now()}`,
      affectedLessonsCount: lostSlots,
      availableTeachingSlots,
      requiredTeachingSlots,
      capacityStatus,
      capacityWarning,
      reviewRequired,
    };
  },

  // ----------------------------------------------------
  // 9. DAILY TEACHING CONTROL & OPERATIONS VIEW
  // ----------------------------------------------------
  getTodayOperationsView(
    schoolId: string,
    date: string,
    requestingRole: string,
    teacherId?: string
  ): TodayTeachingOperationsView {
    const dayView = this.getAcademicDayView(schoolId, date);
    const dt = new Date(date + 'T00:00:00Z');
    const dayIndex = dt.getUTCDay();
    const dayOfWeek = dayIndex === 0 ? 7 : dayIndex;

    // Filter schedules
    const allSchedules = Array.from(lessonSchedulesStore.values()).filter(s => {
      if (s.schoolId !== schoolId || !s.active) return false;
      if (s.dayOfWeek !== dayOfWeek) return false;
      if (teacherId && s.teacherId !== teacherId) return false;
      return true;
    });

    let deliveredCount = 0;
    let inProgressCount = 0;
    let outstandingCount = 0;
    let cancelledCount = 0;
    let rescheduledCount = 0;
    let missedCount = 0;

    const lessons: ScheduledLessonOperationItem[] = [];

    for (const sched of allSchedules) {
      const activeTermName = dayView.activeTerm?.name || AcademicOperationsService.getActiveTerm(schoolId)?.name || 'Term 1';
      const teachingPlanId = `tp_${schoolId}_${sched.gradeId}_${sched.learningAreaId}_${activeTermName}`;
      const teachingAllocationId = `week_${dayView.teachingWeekNumber || 1}_lesson_${sched.period}`;

      // Check operational exceptions for this schedule on this date
      let opStatus: LessonOperationalStatus = 'SCHEDULED';
      let cancellationReason: string | undefined;
      let reschedDate: string | undefined;
      let reschedPeriod: number | undefined;

      if (!dayView.isTeachingDay) {
        opStatus = 'CANCELLED';
        cancellationReason = dayView.dayType === 'SCHOOL_CLOSED' ? 'School closed' : 'Non-teaching day / Holiday';
      }

      for (const ex of operationalExceptionsStore.values()) {
        if (
          ex.schoolId === schoolId &&
          ex.affectedScheduleId === sched.id &&
          ex.effectiveDate === date &&
          ex.status === 'ACTIVE'
        ) {
          if (ex.exceptionType === 'LESSON_CANCELLED') {
            opStatus = 'CANCELLED';
            cancellationReason = ex.reason;
          } else if (ex.exceptionType === 'LESSON_RESCHEDULED') {
            opStatus = 'RESCHEDULED';
            reschedDate = ex.rescheduledDate;
            reschedPeriod = ex.rescheduledPeriod;
          }
        }
      }

      // Check activity status
      const activityId = `tact_${schoolId}_${teachingPlanId}_${teachingAllocationId}`;
      let actStatus: ScheduledLessonOperationItem['activityStatus'] = 'NOT_STARTED';

      try {
        const act = TeachingActivityService.getTeachingActivity(activityId, schoolId);
        actStatus = act.status;
      } catch {
        // No activity started
      }

      // Tally counts
      if (opStatus === 'CANCELLED') {
        cancelledCount++;
      } else if (opStatus === 'RESCHEDULED') {
        rescheduledCount++;
      } else if (actStatus === 'COMPLETED' || actStatus === 'DELIVERED') {
        deliveredCount++;
      } else if (actStatus === 'IN_PROGRESS') {
        inProgressCount++;
      } else {
        // If date has passed and not started, mark missed
        const todayStr = new Date().toISOString().split('T')[0];
        if (date < todayStr) {
          opStatus = 'MISSED';
          missedCount++;
        } else {
          outstandingCount++;
        }
      }

      lessons.push({
        scheduleId: sched.id,
        teachingPlanId,
        teachingAllocationId,
        gradeId: sched.gradeId,
        learningAreaId: sched.learningAreaId,
        teacherId: sched.teacherId,
        period: sched.period,
        startTime: sched.startTime,
        endTime: sched.endTime,
        operationalStatus: opStatus,
        activityStatus: actStatus,
        rescheduledToDate: reschedDate,
        rescheduledToPeriod: reschedPeriod,
        cancellationReason,
      });
    }

    return {
      date,
      schoolId,
      isTeachingDay: dayView.isTeachingDay,
      dayType: dayView.dayType,
      activeYearName: dayView.activeYear?.name,
      activeTermName: dayView.activeTerm?.name,
      teachingWeekNumber: dayView.teachingWeekNumber,
      expectedLessonsCount: allSchedules.length,
      deliveredLessonsCount: deliveredCount,
      inProgressLessonsCount: inProgressCount,
      outstandingLessonsCount: outstandingCount,
      cancelledLessonsCount: cancelledCount,
      rescheduledLessonsCount: rescheduledCount,
      missedLessonsCount: missedCount,
      lessons,
    };
  },

  getLessonSchedules(schoolId: string): LessonSchedule[] {
    const list: LessonSchedule[] = [];
    for (const sch of lessonSchedulesStore.values()) {
      if (sch.schoolId === schoolId && sch.active) {
        list.push({ ...sch });
      }
    }
    return list;
  },

  getOperationalExceptions(schoolId: string): OperationalException[] {
    const list: OperationalException[] = [];
    for (const ex of operationalExceptionsStore.values()) {
      if (ex.schoolId === schoolId && ex.status === 'ACTIVE') {
        list.push({ ...ex });
      }
    }
    return list;
  },

  recordOperationalException(params: {
    schoolId: string;
    academicYearId?: string;
    termId?: string;
    date: string;
    type: OperationalException['exceptionType'];
    reason: string;
    affectedAllocationId?: string;
    affectedScheduleId?: string;
    requestingRole?: string;
  }): OperationalException {
    const activeTerm = AcademicOperationsService.getActiveTerm(params.schoolId, params.date);
    const exception: OperationalException = {
      id: `op_ex_${params.schoolId}_${Date.now()}`,
      schoolId: params.schoolId,
      academicYearId: params.academicYearId || `ay_${params.schoolId}_2026`,
      termId: params.termId || activeTerm?.id || `term_${params.schoolId}_1`,
      exceptionType: params.type,
      affectedScheduleId: params.affectedScheduleId,
      teachingAllocationId: params.affectedAllocationId,
      originalDate: params.date,
      reason: params.reason,
      effectiveDate: params.date,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };

    operationalExceptionsStore.set(exception.id, exception);
    return exception;
  }
};
