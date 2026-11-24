# ECG Architecture: Teaching Delivery, Learner Progress & Completion (Phase 12)

## 1. Overview
Phase 12 establishes the authoritative evidence layer for recording teaching activities, learner interactions, and explicit completion evidence after curriculum-aligned content has been planned, generated, and delivered.

It enforces strict separation between:
```text
PLANNED ──► ALLOCATED ──► CONTENT AVAILABLE ──► DELIVERED / TAUGHT ──► LEARNER INTERACTION ──► COMPLETION EVIDENCE ──► PROGRESS
```

## 2. Core Architectural Principles
- **Curriculum = WHAT**: Authoritative learning outcomes.
- **Teaching Plan = WHEN**: School calendar and teaching allocations.
- **ContentArtifact = CONTENT**: Governed, validated structured content.
- **Teaching Activity = DELIVERY**: Explicit record of teacher delivery.
- **Learner Activity = ENGAGEMENT**: Explicit record of learner interaction.
- **Completion Evidence = PROOF**: Explicit authoritative completion signals. Content viewing or generation does NOT imply completion.
- **Progress = DERIVED**: Deterministic calculation based purely on explicit evidence. Progress is NOT mastery.

## 3. Teaching & Learner Evidence Architecture
```text
AUTHORITATIVE CURRICULUM VERSION
             ↓
     TEACHING PLAN
             ↓
     TEACHING ALLOCATION (Week + Slot)
             ↓
     CONTENT ARTIFACT (Versioned)
             ↓
  AUTHORIZED SECURE DELIVERY
             ├──► TEACHING ACTIVITY (Teacher Delivery & Attributable Evidence)
             │          ↓
             │   TEACHING PROGRESS (Deterministic % Calculation)
             │
             └──► LEARNER ACTIVITY (Learner Engagement & Submissions)
                        ↓
                 LEARNER PROGRESS (Deterministic % Calculation)
```

## 4. Key Rules & Guarantees
1. **No Inferred Completion**: Loading a page or viewing content does not mark a lesson delivered or completed.
2. **Idempotency & Concurrency**: Retrying completion requests preserves existing timestamps without double counting.
3. **Auditable Revocation/Corrections**: Revoking a completion updates evidence notes with actor ID, marks evidence revoked, and adjusts progress metrics deterministically.
4. **School & Learner Isolation**: All teaching and learner data is strictly school-scoped. Peer learners cannot access each other's records (IDOR protection).
5. **AI Non-Authority**: Gemini cannot declare lessons taught, mark learners completed, or alter authoritative progress.

## 5. Verification Matrix (EC-01 through EC-35)
- **EC-01 to EC-04**: Authoritative linkages and school scoping — **VERIFIED**.
- **EC-05 to EC-10**: Explicit teaching delivery, viewing != completion, attributable timestamped evidence — **VERIFIED**.
- **EC-11 to EC-15**: Deterministic progress, zero denominator safety, progress != mastery — **VERIFIED**.
- **EC-16 to EC-21**: Curriculum and artifact version stability, historical integrity, auditable corrections, idempotent completion — **VERIFIED**.
- **EC-22 to EC-27**: Server-side authorization, cross-school isolation, learner privacy/IDOR prevention, AI boundary protection — **VERIFIED**.
- **EC-28 to EC-35**: Existing assessment integration, LWPS compatibility, multi-school validation, build/lint quality, and documentation — **VERIFIED**.
