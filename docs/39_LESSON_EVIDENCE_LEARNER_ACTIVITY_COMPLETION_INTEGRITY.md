# PHASE 39 — LESSON EVIDENCE, LEARNER ACTIVITY & COMPLETION INTEGRITY

## Executive Overview
Phase 39 governs the integrity, traceability, and auditability of lesson delivery, learner activity, completion evidence, and related progress signals across the Exameno CBE Content Generator (ECG) platform.

While Phase 38 established the frictionless teacher workflow:
`TODAY → NEXT LESSON → PREPARE → TEACH → RECORD → COMPLETE → REFLECT → NEXT LESSON`

Phase 39 ensures that every evidence record produced by or ingested into this workflow is trustworthy, deterministic, auditable, and strictly separated by operational meaning.

---

## 1. Governing Architecture Alignment

This specification operates under the absolute authority of `/docs/00_ECG_MASTER_ARCHITECTURE.md`.
The fundamental architectural separations must be preserved without exception:

- **Curriculum** = WHAT (National KICD Standards, Strands, Sub-strands, SLOs)
- **School** = WHERE / UNDER WHAT CONDITIONS (Tenants, Calendars, Schedules, Memberships)
- **Teaching Plan** = WHEN (Term allocation, sequence of topics and SLOs)
- **Teaching Allocation** = SPECIFIC TIMETABLE SLOT (Grade, Subject, Week, Lesson Number)
- **Content Artifact** = GENERATED/PROVIDED MATERIAL (Schemes, Lesson Plans, Notes, Assessment)
- **Delivery** = TEACHER ACTION (Executing the lesson in class)
- **Teaching Activity** = RECORD OF TEACHING (Status, time delivered, resources used)
- **Learner Activity** = RECORD OF LEARNER INTERACTION (Exercises, submissions, engagements)
- **Completion Evidence** = PROOF OF LESSON COMPLETION (Teacher confirmation or verified digital event)
- **Progress** = DERIVED MEASUREMENT (Percentage of plan completed based on unrevoked evidence)
- **Assessment Evidence** = EVALUATION OF LEARNING (Attempt, items, score, rubric responses)
- **Interpretation** = PROFESSIONAL JUDGMENT (Teacher review of learner mastery)
- **Teacher Decision** = ACTIONABLE PEDAGOGICAL CHOICE (Remediate, reinforce, advance)

---

## 2. State Separation Matrix & Core Rules

ECG strictly separates operational states. These states **MUST NOT** be silently collapsed:

| State | Definition | Trigger / Source | Is Completion? | Is Mastery? |
| :--- | :--- | :--- | :--- | :--- |
| **PLANNED** | Lesson allocated on schedule | Teaching Plan / Timetable | ❌ No | ❌ No |
| **STARTED** | Lesson timer initiated or session opened | Teacher click / System event | ❌ No | ❌ No |
| **DELIVERED** | Lesson taught to class | Teacher "Mark Delivered" | ❌ No | ❌ No |
| **INTERACTED** | Learner engaged with material | ELMS event / Practice submission | ❌ No | ❌ No |
| **COMPLETED** | Lesson verified finished | Teacher "Confirm Completion" | ✅ Yes (Unrevoked) | ❌ No |
| **DEMONSTRATED** | Learner attempted practice items | Exercise / Task responses | ❌ No | ❌ No |
| **ASSESSED** | Formative/Summative evaluation scored | Assessment submission & grading | ❌ No | ❌ No |
| **MASTERED** | Outcome achievement confirmed | Professional teacher judgment | ❌ No | ✅ Yes |

### Fundamental Rules:
1. **PLANNED ≠ DELIVERED ≠ INTERACTED ≠ COMPLETED ≠ MASTERED**.
2. **Assessment ≠ Completion**: Completing an assessment does not automatically complete a scheduled teaching lesson unless explicitly mapped and verified.
3. **Assessment ≠ Mastery**: A high score on an assessment provides evidence, but mastery is an interpreted pedagogical conclusion.
4. **Coverage ≠ Mastery**: Delivering 100% of planned lessons does not prove that all learners have mastered the curriculum.
5. **Attendance ≠ Completion**: A learner being present in class does not automatically prove lesson completion, item response, or outcome mastery.

---

## 3. Learner Identity & School Tenant Isolation

1. **Server Authority**: All identity resolution (learner ID, teacher ID, school ID) is strictly server-authoritative.
2. **Client Assertions Rejected**: The client cannot assert arbitrary learner identities or cross-tenant scopes.
3. **Tenant Boundary Enforcement**:
   - Cross-school access to teaching activities, learner activities, or evidence throws a `SECURITY_VIOLATION` audit log and raises an explicit error.
   - A learner can inspect only their own activity records.
4. **ELMS Learner ID Mapping**: External ELMS learner identifiers must be explicitly mapped to ECG learner records within the specific school context (`mapLearner`). Unmapped external identities are safely rejected or queued for reconciliation.

---

## 4. Event Provenance & Idempotency

1. **Event Provenance Metadata**:
   Every activity and evidence item must record its true origin:
   - `source`: `'TEACHER_CONFIRMATION'` | `'ELMS_INGESTION'` | `'SYSTEM_AUTOMATION'`
   - `recordedBy` / `learnerId` / `teacherId`
   - `timestamp` / `eventId` / `idempotencyKey`
2. **Idempotency Guarantee**:
   - Double-clicking "Mark Complete" or receiving duplicate ELMS webhook events with the same idempotency key **MUST NOT** create duplicate completion evidence or inflate progress counters.
   - Existing valid evidence records are returned safely without mutating history.
3. **Out-of-Order Handling**:
   - System accepts completion or submission events even if delivered asynchronously, ensuring state consistency without corrupting event sequence history.

---

## 5. Completion Evidence, Revocation & Auditable Correction

1. **Explicit Confirmation Required**:
   - Opening a lesson page, starting a 45-minute timer, or clicking "Teach Now" DOES NOT constitute completion evidence.
   - Completion requires explicit teacher confirmation with optional observations or verified digital event completion.
2. **Revocation & Correction**:
   - If a lesson was marked completed in error, the teacher or admin can call `revokeOrCorrectCompletion(activityId, schoolId, teacherId, reason)`.
   - Revocation sets `completionEvidence.isRevoked = true`, logs an audit entry (`COMPLETION_CORRECTED`), and moves lesson status back to `IN_PROGRESS`.
3. **Exclusion from Derived Calculations**:
   - Revoked evidence **MUST NOT** contribute to authoritative completion rates, progress percentages, or coverage metrics.
   - Audit trail remains preserved for historical transparency.

---

## 6. Deterministic Progress & Coverage Calculations

1. **Progress as Derived Measurement**:
   - Progress is a pure, side-effect-free calculation derived from active (unrevoked) completion evidence and total planned lessons.
   - Progress calculations **MUST NOT** mutate curriculum definitions, teaching plans, or allocations.
2. **Calculation Formula**:
   $$\text{Progress \%} = \min\left(100, \frac{\text{Unrevoked Completed Lessons}}{\text{Total Planned Lessons}} \times 100\right)$$
3. **Non-Inference Boundary**:
   - Progress counters NEVER automatically infer learner outcome mastery or grade promotion.

---

## 7. Gemini AI Boundary Rules

The Gemini AI model is strictly advisory and operates within rigid boundaries:

1. **Gemini MUST NOT**:
   - Create completion or activity evidence.
   - Fabricate learner activity or attendance records.
   - Determine whether a physical or online lesson actually occurred.
   - Override server-authoritative evidence or status.
   - Modify curriculum standards or teaching allocations.
   - Determine learner identity or authorization credentials.
2. **Gemini MAY ONLY**:
   - Provide pedagogical suggestions, differentiation guidance, and revision recommendations based on server-provided evidence data.

---

## 8. Simple Teacher UX & Evidence Presentation

The teacher workflow remains simple and focused:
1. **Teaching View**: Displays clear status badges (`PLANNED`, `IN_PROGRESS`, `DELIVERED`, `COMPLETED`).
2. **Evidence Summary Badge**:
   - `✓ Lesson Delivered`
   - `✓ Learner Practice Recorded (3)`
   - `✓ Completion Confirmed`
   - `✓ Reflection Logged`
3. **Timeline Event Trail**:
   A lightweight, chronologically ordered event log inside the lesson delivery view showing exact timestamps for:
   - Lesson Planned
   - Timer Started
   - Materials Prepared
   - Practice Activity Ingested
   - Delivery Marked
   - Completion Confirmed
