# ECG Architecture: Teacher Classroom Delivery & Daily Teaching Workflow (Phase 16)

## 1. Overview
Phase 16 transforms ECG into a simple daily classroom assistant and teaching workspace based on the core product principle:
> **"SIMPLE ON THE SURFACE. SOPHISTICATED UNDERNEATH."**

Rather than exposing the underlying complexity of curriculum versions, allocation IDs, artifact repositories, or evidence schemas, the teacher interacts with a clean, linear daily journey:
```text
Curriculum
   ↓
Teaching Plan
   ↓
Teaching Allocation / Lesson
   ↓
Scheme of Work
   ↓
Lesson Plan
   ↓
Lesson Notes
   ↓
START TODAY'S LESSON
   ↓
TEACH (MARK DELIVERED)
   ↓
LEARNER ACTIVITY
   ↓
ASSESS
   ↓
REVIEW PERFORMANCE
   ↓
NEXT LESSON
```

## 2. Core Architectural Separation of Concerns
Phase 16 respects and orchestrates the existing authoritative boundaries from Phases 1–15:
- **Curriculum = WHAT**: Authoritative canonical KICD CBC/CBE learning outcomes.
- **School = WHERE / UNDER WHAT CONDITIONS**: Independent school profile, terms, weeks, and lesson structures.
- **Teaching Plan = WHEN**: Deterministic mapping of curriculum outcomes across available term slots.
- **Teaching Allocation = WHAT IS PLANNED**: The specific planned lesson slot (e.g., `week_1_lesson_1`).
- **Teaching Activity = WHAT WAS ACTUALLY DELIVERED**: Explicit classroom events (`NOT_STARTED` → `IN_PROGRESS` → `DELIVERED` → `COMPLETED`).
- **Learner Activity = WHAT THE LEARNER ACTUALLY DID**: Formative tasks, practice exercises, or discussions.
- **Completion Evidence = WHAT WAS EXPLICITLY COMPLETED**: Auditable, teacher-attributed completion records.
- **Assessment = EVIDENCE OF PERFORMANCE**: Phase 13 objective and teacher-evaluated attempts.
- **Mastery / Interpretation = WHAT THE EVIDENCE MEANS**: Phase 14 interpretation policy without invented scores.
- **Content Artifact = STRUCTURED RESOURCE**: Version-controlled lesson plans, notes, and schemes.
- **Gemini = PEDAGOGICAL ASSISTANCE ONLY**: Non-authoritative generator of pedagogical suggestions.

## 3. Daily Teaching Service Workflow
- **Deterministic Today's Lesson**: `DailyTeachingService.resolveTodayLesson` finds the active lesson slot from the teaching plan without asking teachers to re-enter known information.
- **Explicit Delivery Lifecycle**:
  - `startLesson`: Initializes or resumes `TeachingActivity` in `IN_PROGRESS`, binding exact resource versions used.
  - `markDelivered`: Confirms actual classroom teaching has taken place.
  - `recordLearnerActivity`: Records learner engagement/submissions.
  - `recordLearnerAssessmentAttempt`: Evaluates objective assessment items.
  - `completeLesson`: Creates auditable `CompletionEvidence` record.
  - `correctLessonCompletion`: Corrects/revokes completion evidence if an interruption occurred.
- **Performance Review**: `getLessonReviewSummary` aggregates learner evidence demonstrations (`STRONG_DEMONSTRATION`, `DEVELOPING`, `INSUFFICIENT_EVIDENCE`) directly from Phase 14.
- **Deterministic Next Lesson**: `getNextLesson` resolves the immediate sequential lesson slot from the `TeachingPlan`.

## 4. Verification Matrix (EC-01 through EC-49)
- **EC-01 to EC-08**: Deterministic today's lesson resolution, no fabricated lessons, correct school/grade/area context, teaching allocation linkage, curriculum version integrity, learning outcome linkage — **PASS**.
- **EC-09 & EC-10**: Existing resource reuse and exact artifact version preservation in teaching activity — **PASS**.
- **EC-11 to EC-14**: Start lesson creates TeachingActivity, idempotent start, explicit mark delivered without inferring delivery from viewing — **PASS**.
- **EC-15 & EC-16**: Learner activity uses Phase 12 architecture, no implicit learner completion — **PASS**.
- **EC-17 & EC-18**: Assessment uses Phase 13, exact assessment version integrity preserved — **PASS**.
- **EC-19 to EC-21**: Lesson completion requires explicit confirmation, auditable, correctable with historical preservation — **PASS**.
- **EC-22 & EC-23**: Performance review displays Phase 14 interpretation without inventing mastery — **PASS**.
- **EC-24**: Next lesson deterministically resolved from Teaching Plan — **PASS**.
- **EC-25 to EC-29**: Teacher and learner authorization, IDOR protection, strict school isolation, multi-school compatibility (LWPS and School B) — **PASS**.
- **EC-30 to EC-34**: LWPS regression tested, AI failure resilience, partial resources support, duplicate request protection, auditability — **PASS**.
- **EC-35 to EC-40**: Progress/coverage/mastery boundaries respected, no curriculum or teaching plan mutation, historical integrity preserved — **PASS**.
- **EC-41 to EC-44**: Teacher simplicity, context restoration without re-asking, error masking, security regression — **PASS**.
- **EC-45 to EC-49**: TypeScript clean, lint clean, production build succeeded, full test suite passes, documentation complete — **PASS**.

## 5. Known Limitations & Deferred Capabilities
- Real-time offline synchronization using service workers and background sync is architecturally accommodated but deferred to a dedicated offline phase.
- Multi-teacher co-teaching and live classroom screen sharing remain out of scope for Phase 16.
