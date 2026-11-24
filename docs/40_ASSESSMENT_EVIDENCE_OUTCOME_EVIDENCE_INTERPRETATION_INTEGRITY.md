# PHASE 40 ARCHITECTURE SPECIFICATION
## Assessment Evidence, Outcome Evidence & Evidence-Based Interpretation Integrity

---

### 1. OBJECTIVE & GOVERNING ARCHITECTURE

The objective of Phase 40 is to establish an authoritative, deterministic, secure, and auditable chain of assessment evidence and learning-outcome evidence within the Exameno CBE Content Generator (ECG).

ECG operates under a strict fundamental constitutional rule:
> **ECG MUST NEVER CLAIM A LEARNING OUTCOME, COMPETENCY, OR MASTERY LEVEL THAT IS NOT SUPPORTED BY VALID ASSESSMENT EVIDENCE.**

Phase 40 strictly separates learning outcome evidence and competency interpretation from lesson completion, content interaction, attendance, and curriculum coverage.

#### Authoritative Evidence Chain
`CURRICULUM → TEACHING PLAN → TEACHING ALLOCATION → CONTENT ARTIFACT → DELIVERY → TEACHING ACTIVITY → LEARNER ACTIVITY → COMPLETION EVIDENCE → ASSESSMENT EVIDENCE → OUTCOME EVIDENCE → INTERPRETATION → TEACHER DECISION → ADJUST / NEXT TEACHING ACTION`

---

### 2. STRICT SEPARATION OF CONCERNS & BOUNDARIES

1. **Attendance ≠ Completion**: Learner presence in class records attendance, not task or lesson completion.
2. **Interaction ≠ Completion**: Clicking a resource or reading content logs engagement, not completion.
3. **Completion ≠ Assessment**: Completing a lesson task or activity creates `CompletionEvidence`, NOT `LearningOutcomeEvidence`.
4. **Completion ≠ Mastery**: Delivering or completing 100% of planned lessons does NOT yield mastery or demonstrated competency.
5. **Assessment ≠ Mastery**: Submitting an assessment or practice exercise creates raw performance data; it does NOT automatically grant mastery.
6. **Coverage ≠ Mastery**: 100% teaching plan coverage represents curriculum delivery, NOT learner mastery.
7. **Gemini AI ≠ Evidence Authority**: Gemini AI models serve strictly as advisory tools for teachers. Gemini CANNOT generate assessment evidence, fabricate scores, override server evaluations, declare mastery, or modify curriculum outcomes.

---

### 3. ASSESSMENT EVIDENCE ARCHITECTURE & SERVER INTEGRITY

Assessment evidence represents immutable performance records tied directly to specific learners, assessments, and curriculum learning outcomes.

#### Core Rules & Invariants
- **Server-Authoritative Evaluation**: All scoring, percentages, and evidence creation occur strictly on the server. Clients cannot pass artificial scores, forced `mastered = true` flags, or directly set `status = EVALUATED`.
- **Score Range Validation**:
  - Item scores must satisfy `0 <= marksAwarded <= maxMarks` and `maxMarks > 0`.
  - Direct assessment results must satisfy `0 <= rawScore <= maxScore` and `maxScore > 0`.
  - Attempts with negative, missing, or out-of-bounds scores are strictly rejected with explicit validation errors.
- **Curriculum Outcome Validation**: All assessments and assessment evidence records must link to valid, non-empty `learningOutcomeId` references anchored in the official curriculum.

---

### 4. OUTCOME EVIDENCE & EVIDENCE SUFFICIENCY

`LearningOutcomeEvidence` bridges raw assessment evaluations with curriculum learning outcomes.

#### Deterministic Sufficiency Engine
- **INSUFFICIENT_EVIDENCE / NO_EVIDENCE**: Returned when zero valid, unvoided assessment records exist for a learner and learning outcome.
- **DEVELOPING**:
  - Returned when only a single evidence record exists (even with a high score >= 80%), because single records require corroboration under policy `LO-MASTERY-V1`.
  - Returned when evidence records exist but show high score variance (>40% gap between highest and lowest score).
- **DEMONSTRATED**: Returned when 2+ valid evidence records exist with average score >= 70% and lowest score >= 50%.
- **STRONG_DEMONSTRATION**: Returned when 2+ valid evidence records exist with average score >= 85% and lowest score >= 70%.
- **HIGH_CONFLICT**: When score gap across evidence exceeds 40%, the conflict status is set to `HIGH_CONFLICT`, status remains `DEVELOPING`, and the system flags the outcome as requiring teacher review without fabricating certainty.

#### Full Audit Traceability
Every interpretation explicitly maintains `supportingEvidenceIds` containing the exact IDs of all valid `LearningOutcomeEvidence` records used to compute the interpretation.

---

### 5. REVOCATION & VOIDING MECHANICS

- **Non-Destructive Revocation**: When an assessment evidence record is voided (`voidEvidence`), it is marked `isVoided = true`.
- **Historical Audit Trail**: Voided records remain permanently in historical stores for auditability, logged via `AuditService.log('ARTIFACT_UPDATED', schoolId, { action: 'EVIDENCE_VOIDED', ... })`.
- **Exclusion from Interpretation**: Voided evidence is strictly filtered out when evaluating current outcome status, metrics, and class progress.

---

### 6. ELMS INTEGRATION & PROVENANCE INGESTION

- **Provenance Preservation**: Assessment submissions ingested from ELMS maintain full provenance including external event IDs, ELMS resource IDs, learner IDs, and timestamps.
- **Idempotency**: Duplicate event delivery with the same `idempotencyKey` returns `IGNORED_DUPLICATE` without duplicating evidence records or corrupting historical stats.
- **Out-of-Order Resiliency**: Out-of-order event delivery (e.g., assessment submission arriving before activity completion) is ingested cleanly without throwing errors or corrupting sequence history.

---

### 7. SECURITY, TENANT ISOLATION & IDOR PROTECTION

- **Multi-School Isolation**: Operations on assessment attempts, evaluations, evidence, and interpretations enforce strict `schoolId` match and membership validation.
- **Cross-School Denial**: Attempts by a teacher in School A to evaluate, access, or override evidence or interpretations in School B are rejected with `Unauthorized cross-school access`.
- **Learner Peer Access Protection**: Learners can only access their own assessment evidence and outcome interpretations. Peer access attempts throw security violations and generate audit logs.
- **Unauthorized Assessor Protection**: Non-teachers or users without active teacher membership in the target school cannot evaluate assessments or issue teacher overrides.

---

### 8. TEACHER AUTHORITY & DECISION OVERRIDES

- **Final Authority**: Teachers remain the ultimate decision-makers for learner progress.
- **Teacher Overrides**: Authorized teachers can override an automated interpretation status using `overrideInterpretation`, providing a mandatory reason.
- **Auditable Overrides**: Overrides record `previousStatus`, `overriddenStatus`, `teacherId`, `reason`, and `recordedAt`, generating an `INTERPRETATION_OVERRIDDEN` audit entry.

---

### 9. COMPREHENSIVE AUDITABILITY

All critical mutations generate immutable audit records via `AuditService`:
- `ASSESSMENT_RESULT_RECORDED`
- `TEACHER_EVALUATION_RECORDED`
- `EVIDENCE_VOIDED`
- `LEARNING_OUTCOME_INTERPRETED`
- `INTERPRETATION_OVERRIDDEN`
- `SECURITY_VIOLATION` / `UNAUTHORIZED_ASSESSOR_ATTEMPT`

---

### 10. TEST COVERAGE MATRIX

Phase 40 is verified by `/phase40AssessmentEvidenceIntegrity.test.ts`, covering tests A through AR:
- **A–E**: Valid assessment creation, submission, deterministic scoring, and outcome evidence linkage.
- **F–J**: Invalid score boundaries, negative marks, out-of-range scores, and server-side rejection.
- **K–O**: Client-side manipulation resistance (client cannot force scores or mastery).
- **P–T**: Evidence sufficiency rules (zero evidence, single high score, consistent high scores, high variance/conflict).
- **U–Y**: Voiding and revocation integrity (historical preservation, exclusion from active metrics).
- **Z–AD**: ELMS evidence ingestion, provenance tracking, idempotency, and out-of-order resiliency.
- **AE–AI**: Strict non-fungibility (attendance, interaction, completion, and coverage do NOT equal mastery).
- **AJ–AN**: Gemini AI boundary enforcement (Gemini cannot create evidence, scores, or mastery).
- **AO–AR**: Multi-school tenant isolation, IDOR protection, peer access rejection, and teacher authority validation.
