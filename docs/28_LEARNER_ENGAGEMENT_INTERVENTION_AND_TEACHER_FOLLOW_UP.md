# Phase 22 — Learner Engagement, Intervention & Teacher Follow-Up

## Executive Summary & Architectural Intent

Phase 22 builds a lightweight, teacher-first engagement, intervention, and follow-up layer for the Exameno CBE Content Generator (ECG) platform.

While Phase 21 established **WHO** participated in a given classroom learning event, Phase 22 provides the mechanism to identify **WHICH LEARNERS** require teacher attention or follow-up support based on observable patterns, and track teacher follow-up actions to resolution.

### Core Philosophy & Boundary Directives

1. **Derivation from Authoritative Evidence, No Invalidation**:
   - ECG may derive attention signals from authoritative underlying records (attendance, participation, assessment evidence, outcome interpretation conflicts), but ECG **MUST NOT** invent arbitrary learner states or diagnoses.
   - Attention signals serve solely as internal review prompts ("Needs Review").

2. **No Black-Box Risk Scores or Deficit Labeling**:
   - ECG strictly forbids calculating opaque "risk scores", "failure probabilities", or using deficit labeling (e.g. "failing", "lazy", "at-risk").
   - Every signal explicitly references its observable evidence (e.g. "3 absences recorded in past 5 lessons").

3. **Strict Non-Interference with Authoritative Records**:
   - Flagging a learner, creating a follow-up, or completing an intervention **DOES NOT** alter attendance records, participation logs, assessment marks, mastery evaluations, or curriculum coverage.
   - Semantic boundary: `Attendance ≠ Participation ≠ Activity ≠ Assessment ≠ Interpretation ≠ Intervention`.

4. **Teacher-First Ownership & Workflow**:
   - Primary workflow: `TODAY'S LESSON → MY CLASS → LEARNERS → ATTENTION SIGNALS → REVIEW → FOLLOW UP → RECORD ACTION`.
   - Teachers remain in full control: they can scan signals, flag learners manually, acknowledge/dismiss signals, create actionable follow-ups, and log observations.

5. **Strict Isolation & Authorization**:
   - Multi-school isolation and IDOR protection prevent cross-school or unauthorized cross-class access to learner engagement signals and follow-up notes.
   - All actions and unauthorized attempts are logged in `AuditService`.

---

## Core Domain Models & Data Structures

### 1. `LearnerAttentionSignal`

Represents an objective, observable signal indicating that a learner may benefit from teacher review:

```typescript
export type AttentionSignalType =
  | 'ATTENDANCE_PATTERN'
  | 'PARTICIPATION_PATTERN'
  | 'ASSESSMENT_EVIDENCE_GAP'
  | 'INTERPRETATION_CONFLICT'
  | 'TEACHER_FLAG';

export type SignalSeverity = 'INFO' | 'REVIEW' | 'ATTENTION';

export type SignalStatus = 'OPEN' | 'ACKNOWLEDGED' | 'DISMISSED' | 'FOLLOW_UP_REQUIRED';

export interface LearnerAttentionSignal {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId?: string;
  signalType: AttentionSignalType;
  severity: SignalSeverity;
  reason: string;
  sourceReferences: string[]; // e.g. attendance record IDs, assessment IDs
  status: SignalStatus;
  detectedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  dismissalReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2. `LearnerFollowUp`

Represents a teacher-driven follow-up action planned or executed for a learner:

```typescript
export type FollowUpActionType =
  | 'CHECK_IN_WITH_LEARNER'
  | 'REVIEW_LEARNING_ACTIVITY'
  | 'PROVIDE_ADDITIONAL_PRACTICE'
  | 'RETEACH_CONCEPT'
  | 'PAIR_WITH_PEER'
  | 'MONITOR_NEXT_LESSON'
  | 'REVIEW_ASSESSMENT'
  | 'OTHER';

export type FollowUpStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface FollowUpHistoryEntry {
  timestamp: string;
  actorId: string;
  action: string;
  previousValues?: Record<string, unknown>;
  reason?: string;
}

export interface LearnerFollowUp {
  id: string;
  schoolId: string;
  learnerId: string;
  classGroupId: string;
  teacherId: string;
  attentionSignalId?: string;
  actionType: FollowUpActionType;
  status: FollowUpStatus;
  followUpDate: string; // YYYY-MM-DD
  notes?: string;
  completedAt?: string;
  completedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  history: FollowUpHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
}
```

---

## Signal Generation & Business Rules

1. **Attendance Pattern**:
   - Triggered when a learner records 3 or more absences in their recent attendance logs for the class.
2. **Participation Pattern**:
   - Triggered when a learner is marked `PRESENT` but `NOT_RECORDED` for participation across 3 or more recent teaching activities.
3. **Assessment Evidence Gap**:
   - Triggered when a learner on the active roster has zero valid assessment evidence records.
4. **Interpretation Conflict**:
   - Triggered when a learner's learning outcome evaluation status is `CONFLICT_UNRESOLVED` or `INSUFFICIENT_EVIDENCE`.
5. **Teacher Flag**:
   - Triggered manually by the assigned teacher whenever they observe classroom engagement or learning needs requiring follow-up.

---

## Follow-Up Action Lifecycle

```
[ Teacher Observes Signal / Flags Learner ]
                  ↓
          [ Create Follow-Up ]
            (Status: OPEN)
                  ↓
       [ Update / Modify Notes ]
         (History Appended)
                  ↓
    ┌─────────────┴─────────────┐
    ↓                           ↓
[ Complete Action ]     [ Cancel Action ]
(Status: COMPLETED)     (Status: CANCELLED)
```

---

## Verification & Acceptance Criteria Matrix (EC-01 to EC-59)

| Criterion | Description | Verification Status |
|---|---|---|
| **EC-01** | Canonical attention signal model exists | **PASSED** |
| **EC-02** | School ownership enforced | **PASSED** |
| **EC-03** | Teacher authorization enforced | **PASSED** |
| **EC-04** | Class assignment authorization enforced | **PASSED** |
| **EC-05** | Learner roster validation enforced | **PASSED** |
| **EC-06** | Attendance signal generation deterministic | **PASSED** |
| **EC-07** | Participation signal generation deterministic | **PASSED** |
| **EC-08** | Activity evidence signal generation deterministic | **PASSED** |
| **EC-09** | Assessment evidence gap signal generation deterministic | **PASSED** |
| **EC-10** | Existing interpretation conflicts surfaced | **PASSED** |
| **EC-11** | No unsupported learner diagnosis terminology used | **PASSED** |
| **EC-12** | No black-box risk score computed | **PASSED** |
| **EC-13** | Signals explain their evidence sources | **PASSED** |
| **EC-14** | Missing evidence treated as insufficient evidence | **PASSED** |
| **EC-15** | Teacher can acknowledge a signal | **PASSED** |
| **EC-16** | Teacher can create a follow-up action | **PASSED** |
| **EC-17** | Teacher can complete a follow-up explicitly | **PASSED** |
| **EC-18** | Teacher can cancel a follow-up action | **PASSED** |
| **EC-19** | Teacher notes are auditable with history tracking | **PASSED** |
| **EC-20** | Follow-up does NOT alter attendance records | **PASSED** |
| **EC-21** | Follow-up does NOT alter participation records | **PASSED** |
| **EC-22** | Follow-up does NOT alter assessment evidence | **PASSED** |
| **EC-23** | Follow-up does NOT alter learning outcome mastery | **PASSED** |
| **EC-24** | Follow-up does NOT alter curriculum coverage | **PASSED** |
| **EC-25** | Historical follow-up records remain intact | **PASSED** |
| **EC-26** | Corrections are auditable in AuditService | **PASSED** |
| **EC-27** | Duplicate attention signals prevented | **PASSED** |
| **EC-28** | Duplicate follow-ups prevented via idempotency key | **PASSED** |
| **EC-29** | Concurrent operations safe with clean summaries | **PASSED** |
| **EC-30** | Cross-school access blocked | **PASSED** |
| **EC-31** | Cross-class access blocked | **PASSED** |
| **EC-32** | Cross-teacher unauthorized access blocked | **PASSED** |
| **EC-33** | IDOR manipulation blocked | **PASSED** |
| **EC-34** | Unauthorized requests audited | **PASSED** |
| **EC-35** | Teacher UI remains simple and responsive | **PASSED** |
| **EC-36** | Needs Review view works deterministically | **PASSED** |
| **EC-37** | Learner detail view retrieves signals and follow-ups | **PASSED** |
| **EC-38** | Follow-up creation requires minimal interaction | **PASSED** |
| **EC-39** | Class summary is deterministic and accurate | **PASSED** |
| **EC-40** | Multi-school behavior verified without state leakage | **PASSED** |
| **EC-41** | Roster transfers preserve historical follow-ups | **PASSED** |
| **EC-42** | Teacher reassignment preserves historical attribution | **PASSED** |
| **EC-43** | Phase 12 Learner Activity integration intact | **PASSED** |
| **EC-44** | Phase 13 Assessment Evidence integration intact | **PASSED** |
| **EC-45** | Phase 14 Interpretation integration intact | **PASSED** |
| **EC-46** | Phase 20 Roster & Assignment integration intact | **PASSED** |
| **EC-47** | Phase 21 Attendance & Participation integration intact | **PASSED** |
| **EC-48** | AI cannot authoritatively create learner risk signals | **PASSED** |
| **EC-49** | AI cannot authoritatively create intervention status | **PASSED** |
| **EC-50** | AI cannot modify mastery | **PASSED** |
| **EC-51** | AI cannot modify assessment evidence | **PASSED** |
| **EC-52** | AI cannot bypass authorization | **PASSED** |
| **EC-53** | Performance targets verified (< 1000ms execution) | **PASSED** |
| **EC-54** | Data integrity verified (no orphaned records) | **PASSED** |
| **EC-55** | TypeScript compilation passes cleanly (`tsc --noEmit`) | **PASSED** |
| **EC-56** | Lint passes cleanly (`npm run lint`) | **PASSED** |
| **EC-57** | Production build passes cleanly (`npm run build`) | **PASSED** |
| **EC-58** | Full regression suite passes across all phases | **PASSED** |
| **EC-59** | Documentation complete in /docs | **PASSED** |
