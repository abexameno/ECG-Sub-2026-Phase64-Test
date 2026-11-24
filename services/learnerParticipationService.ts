import {
  LearnerParticipation,
  LearnerAttendanceStatus,
  LearnerParticipationStatus,
  RecordAttendanceBatchParams,
  AttendanceSummary,
} from '../types/attendance.ts';
import { SchoolMembershipService } from './schoolMembershipService.ts';
import { TeacherAssignmentService } from './teacherAssignmentService.ts';
import { LearnerRosterService } from './learnerRosterService.ts';
import { ClassGroupService } from './classGroupService.ts';
import { AuditService } from './auditService.ts';
import { SchoolConfigService } from './schoolConfigService.ts';

const participationStore: Map<string, LearnerParticipation> = new Map();

export const LearnerParticipationService = {
  clearStore() {
    participationStore.clear();
  },

  // Authorize teacher or admin for a class group in a specific school
  authorizeTeacherForClass(schoolId: string, teacherId: string, classGroupId: string): void {
    // 1. Verify school membership
    const memberships = SchoolMembershipService.getMemberships(teacherId);
    const activeMem = memberships.find(
      (m) => m.schoolId === schoolId && m.status === 'ACTIVE'
    );

    if (!activeMem) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        reason: 'NO_ACTIVE_SCHOOL_MEMBERSHIP',
        teacherId,
        classGroupId,
      });
      throw new Error(`Unauthorized: User ${teacherId} has no active membership in school ${schoolId}.`);
    }

    // 2. If user is SCHOOL_ADMIN, ACADEMIC_ADMIN, or SUPER_ADMIN in this school, they are authorized
    if (['SCHOOL_ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'].includes(activeMem.role)) {
      return;
    }

    // 3. Otherwise, check explicit Teacher Teaching Assignment
    const assignments = TeacherAssignmentService.getTeacherAssignments(teacherId, schoolId);
    const classGroup = ClassGroupService.getClassGroupById(classGroupId);

    if (!classGroup || classGroup.schoolId !== schoolId) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        reason: 'INVALID_CLASS_GROUP',
        teacherId,
        classGroupId,
      });
      throw new Error(`Unauthorized: Class group ${classGroupId} not found in school ${schoolId}.`);
    }

    const isAssigned = assignments.some(
      (a) =>
        a.status === 'ACTIVE' &&
        (a.classGroupId === classGroupId || a.gradeId === classGroup.gradeId)
    );

    if (!isAssigned) {
      AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
        reason: 'NO_TEACHING_ASSIGNMENT_FOR_CLASS',
        teacherId,
        classGroupId,
      });
      throw new Error(
        `Unauthorized: Teacher ${teacherId} does not have an active assignment for class group ${classGroupId} in school ${schoolId}.`
      );
    }
  },

  // Record classroom attendance & participation for a batch of learners
  recordAttendanceBatch(params: RecordAttendanceBatchParams): LearnerParticipation[] {
    const {
      schoolId,
      teacherId,
      classGroupId,
      teachingActivityId,
      teachingAllocationId,
      curriculumVersionId,
      learningOutcomeId,
      lessonDate,
      academicYearId,
      termId,
      records,
    } = params;

    // Validate school existence
    if (!SchoolConfigService.isRegisteredSchool(schoolId)) {
      throw new Error(`Unauthorized or invalid school: ${schoolId}`);
    }

    // Check teacher authorization
    this.authorizeTeacherForClass(schoolId, teacherId, classGroupId);

    // Get active roster learners for class group
    const rosterLearners = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
    const rosterLearnerIds = new Set(rosterLearners.map((l) => l.id));

    const updatedRecords: LearnerParticipation[] = [];
    const now = new Date().toISOString();

    for (const entry of records) {
      // Validate that learner belongs to class group roster
      if (!rosterLearnerIds.has(entry.learnerId)) {
        AuditService.log('UNAUTHORIZED_ACCESS_ATTEMPTED', schoolId, {
          reason: 'LEARNER_NOT_ON_CLASS_ROSTER',
          teacherId,
          learnerId: entry.learnerId,
          classGroupId,
        });
        throw new Error(
          `Unauthorized: Learner ${entry.learnerId} is not on the active roster for class group ${classGroupId} in school ${schoolId}.`
        );
      }

      const activityKey = teachingActivityId || 'default_activity';
      const recordKey = `part_${schoolId}_${classGroupId}_${entry.learnerId}_${lessonDate}_${activityKey}`;

      let participationStatus: LearnerParticipationStatus =
        entry.participationStatus || (entry.attendanceStatus === 'PRESENT' ? 'PRESENT' : 'NOT_RECORDED');

      const existingRecord = participationStore.get(recordKey);

      const record: LearnerParticipation = {
        id: recordKey,
        schoolId,
        learnerId: entry.learnerId,
        classGroupId,
        teacherId,
        teachingActivityId,
        teachingAllocationId,
        curriculumVersionId,
        learningOutcomeId,
        lessonDate,
        academicYearId,
        termId,
        attendanceStatus: entry.attendanceStatus,
        participationStatus,
        recordedAt: existingRecord ? existingRecord.recordedAt : now,
        recordedBy: teacherId,
        notes: entry.notes || existingRecord?.notes,
        recordState: existingRecord && existingRecord.attendanceStatus !== entry.attendanceStatus ? 'CORRECTED' : 'ACTIVE',
        correctedAt: existingRecord && existingRecord.attendanceStatus !== entry.attendanceStatus ? now : existingRecord?.correctedAt,
        correctedBy: existingRecord && existingRecord.attendanceStatus !== entry.attendanceStatus ? teacherId : existingRecord?.correctedBy,
        correctionReason: existingRecord && existingRecord.attendanceStatus !== entry.attendanceStatus ? 'Attendance corrected in batch update' : existingRecord?.correctionReason,
      };

      participationStore.set(recordKey, record);
      updatedRecords.push(record);
    }

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'CLASSROOM_ATTENDANCE_RECORDED',
      teacherId,
      classGroupId,
      lessonDate,
      count: updatedRecords.length,
    });

    return updatedRecords;
  },

  // Convenience workflow: Mark all roster learners as present
  markAllPresentQuick(params: {
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
  }): LearnerParticipation[] {
    const rosterLearners = LearnerRosterService.getLearnersForClassGroup(
      params.classGroupId,
      params.schoolId
    );

    const records = rosterLearners.map((l) => ({
      learnerId: l.id,
      attendanceStatus: 'PRESENT' as LearnerAttendanceStatus,
      participationStatus: 'PRESENT' as LearnerParticipationStatus,
    }));

    return this.recordAttendanceBatch({
      ...params,
      records,
    });
  },

  // Correct a single learner's attendance record with auditability
  correctAttendanceRecord(params: {
    schoolId: string;
    teacherId: string;
    recordId: string;
    newAttendanceStatus: LearnerAttendanceStatus;
    newParticipationStatus?: LearnerParticipationStatus;
    reason: string;
    notes?: string;
  }): LearnerParticipation {
    const { schoolId, teacherId, recordId, newAttendanceStatus, newParticipationStatus, reason, notes } = params;

    const record = participationStore.get(recordId);
    if (!record || record.schoolId !== schoolId) {
      throw new Error(`Attendance record ${recordId} not found in school ${schoolId}.`);
    }

    // Check teacher authorization for the class
    this.authorizeTeacherForClass(schoolId, teacherId, record.classGroupId);

    const now = new Date().toISOString();
    const updatedRecord: LearnerParticipation = {
      ...record,
      attendanceStatus: newAttendanceStatus,
      participationStatus:
        newParticipationStatus ||
        (newAttendanceStatus === 'PRESENT' && record.participationStatus === 'NOT_RECORDED'
          ? 'PRESENT'
          : record.participationStatus),
      notes: notes !== undefined ? notes : record.notes,
      recordState: 'CORRECTED',
      correctedAt: now,
      correctedBy: teacherId,
      correctionReason: reason,
    };

    participationStore.set(recordId, updatedRecord);

    AuditService.log('ARTIFACT_UPDATED', schoolId, {
      action: 'CLASSROOM_ATTENDANCE_CORRECTED',
      teacherId,
      recordId,
      oldStatus: record.attendanceStatus,
      newStatus: newAttendanceStatus,
      reason,
    });

    return updatedRecord;
  },

  // Get attendance summary for a lesson/session
  getAttendanceForLesson(params: {
    schoolId: string;
    requestingUserId: string;
    classGroupId: string;
    lessonDate: string;
    teachingActivityId?: string;
  }): AttendanceSummary {
    const { schoolId, requestingUserId, classGroupId, lessonDate, teachingActivityId } = params;

    // Check caller authorization
    this.authorizeTeacherForClass(schoolId, requestingUserId, classGroupId);

    const rosterLearners = LearnerRosterService.getLearnersForClassGroup(classGroupId, schoolId);
    const activityKey = teachingActivityId || 'default_activity';

    const records: LearnerParticipation[] = [];
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let participatedCount = 0;

    for (const learner of rosterLearners) {
      const recordKey = `part_${schoolId}_${classGroupId}_${learner.id}_${lessonDate}_${activityKey}`;
      const rec = participationStore.get(recordKey);

      if (rec) {
        records.push(rec);
        if (rec.attendanceStatus === 'PRESENT') presentCount++;
        else if (rec.attendanceStatus === 'ABSENT') absentCount++;
        else if (rec.attendanceStatus === 'LATE') lateCount++;
        else if (rec.attendanceStatus === 'EXCUSED') excusedCount++;

        if (rec.participationStatus === 'PARTICIPATED' || rec.participationStatus === 'COMPLETED_ACTIVITY') {
          participatedCount++;
        }
      }
    }

    return {
      schoolId,
      classGroupId,
      lessonDate,
      teachingActivityId,
      totalLearners: rosterLearners.length,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      participatedCount,
      records,
    };
  },

  // Get historical attendance records for a learner in a school
  getLearnerAttendanceHistory(params: {
    schoolId: string;
    requestingUserId: string;
    learnerId: string;
  }): LearnerParticipation[] {
    const { schoolId, requestingUserId, learnerId } = params;

    // Check requesting user membership
    const memberships = SchoolMembershipService.getMemberships(requestingUserId);
    const activeMem = memberships.find((m) => m.schoolId === schoolId && m.status === 'ACTIVE');

    if (!activeMem) {
      throw new Error(`Unauthorized: Requesting user ${requestingUserId} has no active membership in school ${schoolId}.`);
    }

    // Verify learner belongs to requesting school
    const learner = LearnerRosterService.getLearnerById(learnerId, schoolId);
    if (!learner) {
      return [];
    }

    const history: LearnerParticipation[] = [];
    for (const record of participationStore.values()) {
      if (record.schoolId === schoolId && record.learnerId === learnerId) {
        history.push(record);
      }
    }

    return history.sort((a, b) => b.lessonDate.localeCompare(a.lessonDate));
  },
};
