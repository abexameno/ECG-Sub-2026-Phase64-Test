# ECG Architecture: Assessment, Evaluation & Learning Outcome Evidence (Phase 13)

## 1. Overview
Phase 13 establishes a deterministic, traceable assessment and evaluation evidence layer. It allows ECG to collect, evaluate, and interpret evidence related to Learning Outcomes without confusing assessment performance with curriculum completion or mastery.

It enforces strict separation between:
```text
CURRICULUM ──► TEACHING PLAN ──► TEACHING ALLOCATION ──► CONTENTARTIFACT ──► TEACHING ACTIVITY ──► LEARNER ACTIVITY ──► ASSESSMENT ──► RESPONSE ──► EVALUATION ──► LEARNING OUTCOME EVIDENCE ──► DERIVED REPORTING
```

## 2. Core Architectural Principles
- **Assessment = Structured Collection**: A structured method of collecting performance evidence against defined Learning Outcomes.
- **Evaluation = Interpretation**: Deterministic scoring (for objective items) or teacher marking (for human-judgment items) that produces scores and feedback with attributable provenance.
- **Evidence ≠ Mastery**: Strong assessment performance generates evidence records; it does NOT automatically declare mastery or competency without an external, explicit mastery model.
- **Evidence ≠ Curriculum Completion**: Passing an assessment does not automatically mark a curriculum outcome complete.
- **Historical Integrity**: Historical attempts and evaluations snapshot the exact `assessmentVersion` and question state at the time of the attempt and never migrate silently to newer versions.
- **School & Learner Isolation**: All assessments, attempts, evaluations, and evidence summaries are strictly isolated by school with IDOR protection between peer learners.

## 3. Assessment & Evaluation Pipeline
```text
AUTHORITATIVE CURRICULUM VERSION & LEARNING OUTCOME
                         ↓
               ASSESSMENT (Versioned)
                         ↓
             LEARNER ATTEMPT (Version Snapshot)
                         ↓
            RESPONSES (Immutable Submissions)
                         ↓
      EVALUATION (Deterministic ECG Scoring or Teacher Marking)
                         ↓
           LEARNING OUTCOME EVIDENCE (With Full Provenance)
                         ↓
         OUTCOME EVIDENCE SUMMARY (Transparent Reporting)
```

## 4. Verification Matrix (EC-01 through EC-40)
- **EC-01 to EC-05**: Authoritative curriculum/outcome linkage, school scoping, structured items with outcome preservation — **VERIFIED**.
- **EC-06 to EC-08**: Learner attempt school scoping, attributable responses, historical protection — **VERIFIED**.
- **EC-09 to EC-12**: Deterministic system scoring, teacher marking with feedback, non-authoritative AI boundary, explicit evaluation authority — **VERIFIED**.
- **EC-13 to EC-15**: Assessment versioning, historical attempt snapshot integrity, question version integrity — **VERIFIED**.
- **EC-16 to EC-21**: Learning outcome evidence traceability, provenance, multiple evidence sources, evidence != mastery, assessment != curriculum completion, progress isolation — **VERIFIED**.
- **EC-22 to EC-27**: Cross-school rejection, peer learner rejection, IDOR protection, idempotent submissions, concurrency safety — **VERIFIED**.
- **EC-28 to EC-40**: AI boundary, centralized governance/quota, auditability, Phase 11/12 integration, LWPS and multi-school tests, build/lint verification, documentation — **VERIFIED**.
