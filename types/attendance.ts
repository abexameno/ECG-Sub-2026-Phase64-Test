export type LearnerAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export type LearnerParticipationStatus =
  | 'NOT_RECORDED'
  | 'PRESENT'
  | 'PARTICIPATED'
  | 'COMPLETED_ACTIVITY';

export type ParticipationRecordState = 'ACTIVE' | 'CORRECTED' | 'REVOKED';

export interface LearnerParticipation {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  teachingActivityId?: string;
  teachingAllocationId?: string;
  curriculumVersionId?: string;
  learningOutcomeId?: string;
  lessonDate: string; // YYYY-MM-DD
  academicYearId: string;
  termId?: string;
  attendanceStatus: LearnerAttendanceStatus;
  participationStatus: LearnerParticipationStatus;
  recordedAt: string;
  recordedBy: string; // teacher userId
  notes?: string;
  recordState: ParticipationRecordState;
  correctedAt?: string;
  correctedBy?: string;
  correctionReason?: string;
}

export interface IndividualAttendanceEntry {
  learnerId: string;
  attendanceStatus: LearnerAttendanceStatus;
  participationStatus?: LearnerParticipationStatus;
  notes?: string;
}

export interface RecordAttendanceBatchParams {
  schoolId: string;
  teacherId: string;
  classGroupId: string;
  teachingActivityId?: string;
  teachingAllocationId?: string;
  curriculumVersionId?: string;
  learningOutcomeId?: string;
  lessonDate: string;
  academicYearId: string;
  termId?: string;
  records: IndividualAttendanceEntry[];
}

export interface AttendanceSummary {
  schoolId: string;
  classGroupId: string;
  lessonDate: string;
  teachingActivityId?: string;
  totalLearners: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  participatedCount: number;
  records: LearnerParticipation[];
}
