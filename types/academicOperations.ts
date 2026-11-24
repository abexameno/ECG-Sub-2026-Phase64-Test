import { TeachingActivityStatus } from './activity.ts';
import { CapacityStatus } from './teachingPlan.ts';

export type AcademicYearStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type AcademicTermStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export type CalendarEventType =
  | 'TEACHING_DAY'
  | 'HOLIDAY'
  | 'PUBLIC_HOLIDAY'
  | 'SCHOOL_CLOSURE'
  | 'HALF_DAY'
  | 'EXAMINATION_PERIOD'
  | 'SPECIAL_ACADEMIC_DAY';

export type OperationalExceptionType =
  | 'SCHOOL_CLOSED'
  | 'TEACHER_ABSENT'
  | 'LESSON_CANCELLED'
  | 'LESSON_RESCHEDULED'
  | 'SPECIAL_EVENT'
  | 'TIMETABLE_CHANGE';

export type LessonOperationalStatus = 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED' | 'MISSED';

export type AcademicDayType = 'TEACHING_DAY' | 'NON_TEACHING_DAY' | 'SCHOOL_CLOSED' | 'SPECIAL_ACADEMIC_DAY';

export interface AcademicYear {
  id: string;
  schoolId: string;
  name: string; // e.g. "2026"
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  status: AcademicYearStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicTerm {
  id: string;
  schoolId: string;
  academicYearId: string;
  termNumber: number; // 1, 2, 3
  name: string; // "Term 1"
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  teachingWeeks: number; // e.g. 13 for LWPS, 12 for School B
  status: AcademicTermStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicCalendarEvent {
  id: string;
  schoolId: string;
  academicYearId: string;
  termId?: string;
  date: string; // ISO YYYY-MM-DD
  eventType: CalendarEventType;
  name: string;
  isTeachingDay: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonSchedule {
  id: string;
  schoolId: string;
  academicYearId: string;
  termId: string;
  gradeId: string;
  learningAreaId: string;
  teacherId: string;
  dayOfWeek: number; // 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 7 = Sunday
  period: number; // 1, 2, 3, 4, 5
  startTime: string; // e.g. "08:00"
  endTime: string; // e.g. "08:40"
  roomId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAssignment {
  id: string;
  schoolId: string;
  teacherId: string;
  gradeId: string;
  learningAreaId: string;
  academicYearId: string;
  active: boolean;
  assignedAt: string;
}

export interface OperationalException {
  id: string;
  schoolId: string;
  academicYearId: string;
  termId?: string;
  exceptionType: OperationalExceptionType;
  affectedScheduleId?: string;
  teachingAllocationId?: string;
  teacherId?: string;
  gradeId?: string;
  learningAreaId?: string;
  originalDate?: string;
  originalPeriod?: number;
  rescheduledDate?: string;
  rescheduledPeriod?: number;
  reason: string;
  effectiveDate: string;
  createdBy: string;
  createdAt: string;
  status: 'ACTIVE' | 'REVOKED';
}

export interface AcademicDayView {
  date: string;
  schoolId: string;
  isTeachingDay: boolean;
  dayType: AcademicDayType;
  events: AcademicCalendarEvent[];
  activeYear?: AcademicYear;
  activeTerm?: AcademicTerm;
  teachingWeekNumber?: number;
}

export interface ScheduledLessonOperationItem {
  scheduleId: string;
  teachingPlanId: string;
  teachingAllocationId: string;
  gradeId: string;
  learningAreaId: string;
  teacherId: string;
  period: number;
  startTime: string;
  endTime: string;
  operationalStatus: LessonOperationalStatus;
  activityStatus: TeachingActivityStatus;
  rescheduledToDate?: string;
  rescheduledToPeriod?: number;
  cancellationReason?: string;
}

export interface TodayTeachingOperationsView {
  date: string;
  schoolId: string;
  isTeachingDay: boolean;
  dayType: AcademicDayType;
  activeYearName?: string;
  activeTermName?: string;
  teachingWeekNumber?: number;
  expectedLessonsCount: number;
  deliveredLessonsCount: number;
  inProgressLessonsCount: number;
  outstandingLessonsCount: number;
  cancelledLessonsCount: number;
  rescheduledLessonsCount: number;
  missedLessonsCount: number;
  lessons: ScheduledLessonOperationItem[];
}

export interface CalendarImpactSummary {
  schoolId: string;
  calendarEventId: string;
  affectedLessonsCount: number;
  availableTeachingSlots: number;
  requiredTeachingSlots: number;
  capacityStatus: CapacityStatus;
  capacityWarning?: string;
  reviewRequired: boolean;
}

export interface TeachingWeekView {
  weekNumber: number;
  startDate: string;
  endDate: string;
  status: 'UPCOMING' | 'CURRENT' | 'COMPLETED' | 'INTERRUPTED';
  totalTeachingDays: number;
}
