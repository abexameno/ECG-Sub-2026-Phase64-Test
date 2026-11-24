# ECG Architecture: Curriculum Coverage, Progression & Teaching Alignment (Phase 10)

## 1. Overview
Phase 10 establishes the deterministic bridge between authoritative curriculum versions (Phase 9) and school-specific teaching plans. It guarantees that teaching allocations explicitly reference curriculum learning outcomes, tracks coverage completeness, detects gaps, duplicates, invalid allocations, and ensures historical plan version integrity without mutating past records.

## 2. Core Architectural Principles
- **Curriculum = WHAT**: Authoritative canonical curriculum versions define the valid learning outcomes.
- **Teaching Plan = WHEN**: School-specific teaching plans allocate teaching weeks and lesson slots to specific learning outcomes.
- **Explicit Version Linkage**: Every production teaching plan references an explicit `curriculumVersionId`.
- **Deterministic Coverage**: Coverage percentage, allocated outcomes, unallocated outcomes, and duplicates are calculated deterministically without AI judgment.
- **Historical Immutability**: Publishing new curriculum versions does not alter or overwrite historical teaching plans.

## 3. Teaching Plan Validation & Coverage Model
```text
ACTIVE CURRICULUM VERSION ──► VALID OUTCOME REPOSITORY ──┐
                                                           ├─► TEACHING COVERAGE SERVICE ──► VALIDATION & COVERAGE METRICS
TEACHING PLAN ────────────► LEARNING OUTCOME ALLOCATIONS ──┘
```

## 4. Verification Matrix (EC-01 through EC-23)
- **EC-01 to EC-05**: Explicit curriculum version, outcome allocation, deterministic coverage calculation, unallocated gap detection, and duplicate detection — **VERIFIED**.
- **EC-06 to EC-10**: Reference integrity, grade integrity, learning area integrity, capacity validation, and explicit sequencing — **VERIFIED**.
- **EC-11 to EC-23**: Version immutability, staleness detection, historical integrity, multi-school independence, AI boundary compliance, generation traceability, repository compatibility, security, auditability, concurrency, regression, build quality, and documentation — **VERIFIED**.
