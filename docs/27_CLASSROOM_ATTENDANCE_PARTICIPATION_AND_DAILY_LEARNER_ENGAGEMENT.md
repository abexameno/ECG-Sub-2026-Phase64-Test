# Phase 21 — Classroom Attendance, Participation & Daily Learner Engagement

## Executive Summary & Architectural Intent

Phase 21 extends the teacher-first Exameno CBE Content Generator (ECG) platform from knowing **WHO** the teacher is authorized to teach (Phase 20) to recording **WHO** actually participated in a specific classroom learning event on a given day.

### Core Philosophy & Boundary Directives
1. **Attendance is Evidence of Presence, NOT Mastery**:
   - Marking a learner `PRESENT` or `PARTICIPATED` proves presence/engagement during a classroom session.
   - It **does NOT** automatically grant learning outcome mastery, complete a competency assessment, or alter curriculum progress.
2. **Minimalist Teacher Experience**:
   - Fast, low-friction classroom interactions ("Start Lesson" -> "Mark All Present" -> "Correct Exceptions").
   - Frictionless, bulk-action enabled, and mobile responsive.
3. **Strict Isolation & Authorization**:
   - Multi-school isolation prevents cross-school attendance access.
   - Cross-class IDOR protection enforces that teachers can only record or view participation for class groups they are actively assigned to teach.
4. **Historical & Audit Integrity**:
   - Learner class transfers or teacher assignment changes preserve historical attendance and participation records without retroactive modification or data loss.
   - All batch creations, corrections, and unauthorized attempts generate explicit audit events.

---

## Core Domain Model & Data Structures

### 1. `LearnerParticipation`
Representing a single stateful participation event for a learner during a specific lesson date:

```typescript
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
```

### 2. `AttendanceSummary`
Aggregated read-model for a class group on a given lesson date:

```typescript
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
```

---

## Authorization & Security Boundaries

### Server-Side Validation Pipeline (`LearnerParticipationService.authorizeTeacherForClass`)
Before any attendance query, batch creation, or record correction, the service executes a 3-step authorization check:

1. **School Membership Verification**:
   - Checks that `requestingUserId` holds an `ACTIVE` membership in `schoolId`.
2. **Administrative Override**:
   - `SCHOOL_ADMIN`, `ACADEMIC_ADMIN`, and `SUPER_ADMIN` roles pass validation for administrative oversight and audit corrections.
3. **Teaching Assignment Check**:
   - For standard teachers, verifies an active `TeacherTeachingAssignment` linking `teacherId` to `classGroupId` in `schoolId`.
4. **Roster Validation**:
   - Verifies that every learner in a batch upload belongs to an active `ClassRoster` entry in `classGroupId` for `schoolId`.

---

## Integration Architecture

| Phase | Integration Point | Boundary Rule |
| :--- | :--- | :--- |
| **Phase 12 (Learner Activity)** | Optional link via `teachingActivityId` | Attendance does NOT auto-create completion evidence in Phase 12. |
| **Phase 13 (Assessment Evidence)** | Observational context | Attendance does NOT score competencies or modify assessment ratings. |
| **Phase 14 (Outcome Interpretation)** | Contextual reference | Phase 14 remains sole authority for rubric interpretation. |
| **Phase 15 (Delivery Progress)** | Lesson execution tracking | Starting a lesson in Phase 15 does NOT auto-mark attendance. |
| **Phase 16 (Today's Lesson)** | Direct linkage | `ClassroomAttendancePanel` reads today's lesson allocation and activity. |
| **Phase 20 (Roster & Assignments)** | Primary context supplier | Uses Phase 20 teaching assignments and class rosters for authorization. |

---

## Teacher UX Workflow & Performance Rules

### 1. Daily Classroom Workflow
```
[Select Class Workspace] -> [Click "Attendance & Participation" Tab] -> ["Mark All Present" Button] -> [Toggle Exceptions (Late/Absent)] -> [Save]
```
- **Execution Speed**: Mark All Present completes in 1 click (< 50ms in-memory update).
- **Offline & Re-entry Safety**: Batch operations use deterministic composite key checks (`part_${schoolId}_${classGroupId}_${learnerId}_${lessonDate}_${activityKey}`) ensuring idempotency.

### 2. UI Components
- `ClassroomAttendancePanel`: Interactive tab embedded in `ClassWorkspacePanel`. Includes quick summary stats pills, quick status toggles (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`), participation status dropdowns, observation note inputs, and correction dialogs with reason tracking.

---

## Governance & Auditability

All significant participation events trigger structured `AuditService.log` calls:
- `CLASSROOM_ATTENDANCE_RECORDED`: Logged when batch attendance is submitted or updated.
- `CLASSROOM_ATTENDANCE_CORRECTED`: Logged with `correctionReason`, `recordId`, and `correctedBy` when an existing record is edited.
- `UNAUTHORIZED_ACCESS_ATTEMPTED`: Logged when cross-school or unassigned class access is attempted.

---

## Verification & Acceptance Matrix (EC-01 to EC-59)

All 59 acceptance criteria verified and passed in test suite `classroomAttendanceSecurity.test.ts`:

- **EC-01 to EC-10**: Core model, stateful participation records, IDOR protection, school and class group isolation.
- **EC-11 to EC-15**: Integration with Phase 16 Today's Lesson, Teaching Activities, and Allocations.
- **EC-16 to EC-22**: Statuses (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`), "Mark All Present" bulk action, and auditable individual corrections.
- **EC-23 to EC-31**: Non-authority rules: starting a lesson does not auto-mark present; attendance does not create mastery, completion, or progress evidence.
- **EC-32 to EC-45**: Historical preservation on learner transfers, duplicate protection, idempotency, audit trails, and AI non-authority boundaries.
- **EC-46 to EC-59**: AI independence, regression testing across Phases 1–20, TypeScript strictly typed, clean linting (`npm run lint`), and production build verification (`npm run build`).
