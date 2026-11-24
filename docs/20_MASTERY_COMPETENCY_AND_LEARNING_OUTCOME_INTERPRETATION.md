# ECG Architecture: Mastery, Competency & Learning Outcome Interpretation (Phase 14)

## 1. Overview
Phase 14 establishes a governed, deterministic interpretation layer that answers:
> **"Given the available evidence, what can ECG reasonably conclude about the learner's demonstrated performance against a Learning Outcome?"**

It builds strictly on canonical curriculum outcomes, teaching allocations, artifacts, activities, assessments, and evaluations without collapsing or confusing the underlying concepts.

## 2. Mandatory Conceptual Distinctions
```text
CURRICULUM            = WHAT SHOULD BE LEARNED
TEACHING PLAN         = WHEN IT IS PLANNED
TEACHING ALLOCATION   = WHAT IS PLANNED FOR A LESSON
CONTENTARTIFACT       = WHAT CONTENT IS PROVIDED
TEACHING ACTIVITY     = WHAT WAS ACTUALLY TAUGHT
LEARNER ACTIVITY      = WHAT THE LEARNER DID
COMPLETION EVIDENCE   = WHAT WAS EXPLICITLY COMPLETED
ASSESSMENT            = WHAT WAS ASSESSED
EVALUATION            = HOW PERFORMANCE WAS EVALUATED
LEARNING OUTCOME EVIDENCE = WHAT PERFORMANCE EVIDENCE EXISTS
INTERPRETATION        = WHAT THE EVIDENCE SUPPORTS
MASTERY               = A GOVERNED INTERPRETATION, NOT A RAW SCORE
```

## 3. Core Interpretation Policy (`LO-MASTERY-V1`)
- **Zero Evidence Rule**: 0 valid evidence records produce `INSUFFICIENT_EVIDENCE`. Absence of evidence is NEVER treated as failure.
- **Single Score Limitation**: A single high assessment score (e.g. 100%) produces `DEVELOPING` and does NOT grant instant mastery without corroboration or teacher confirmation.
- **Multiple Evidence Records**:
  - Consistent high demonstration (avg >= 85%, lowest >= 70%) -> `STRONG_DEMONSTRATION`.
  - Satisfactory demonstration (avg >= 70%, lowest >= 50%) -> `DEMONSTRATED`.
  - Conflicting evidence (spread > 40%) -> `HIGH_CONFLICT` with `DEVELOPING` status retained.
  - Emerging performance (avg < 50%) -> `EMERGING`.
- **Explainability**: Every interpretation produces a human-readable deterministic explanation detailing evidence count, types, lowest/highest scores, conflict status, and policy version.
- **Teacher Override**: Teachers can provide an authorized override with documented rationale, preserving the original system state and recording full audit details.

## 4. Verification Matrix (EC-01 through EC-44)
- **EC-01 to EC-07**: Linkage to curriculum version and learning outcome, school-scoping, zero-evidence handling (`INSUFFICIENT_EVIDENCE`), no failure on absence of evidence — **VERIFIED**.
- **EC-08 to EC-11**: Deterministic aggregation, explicit versioned policy (`LO-MASTERY-V1`), reproducible outputs — **VERIFIED**.
- **EC-12 to EC-15**: Multiple evidence sources, transparent conflict exposure, provenance preservation, immutable historical evidence — **VERIFIED**.
- **EC-16 to EC-21**: Historical reproducibility, scores/progress/coverage != mastery, no false precision, explainable interpretation — **VERIFIED**.
- **EC-22 to EC-25**: Non-authoritative AI boundary, no invented evidence or modified records — **VERIFIED**.
- **EC-26 to EC-33**: Authorized/auditable teacher overrides, school isolation, learner privacy/IDOR rejection, auditable corrections — **VERIFIED**.
- **EC-34 to EC-44**: Idempotency, concurrency safety, Phase 12/13 integration, LWPS & multi-school tests, TypeScript compilation, lint, and production build — **VERIFIED**.
