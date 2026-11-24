# ECG Architecture: Authoritative Curriculum Ingestion, Management & Versioning (Phase 9)

## 1. Overview
Phase 9 establishes the operational lifecycle of authoritative curriculum content in ECG. It ensures that canonical CBE/CBC curriculum structures are ingested through a deterministic contract, rigorously validated, approved, published, and activated without compromising school independence, teaching plans, or content artifact traceability.

## 2. Core Architectural Principles
- **Curriculum = WHAT**: Authoritative canonical curriculum is ingested and published separately from school configuration and teaching plans.
- **Ingestion Does Not Equal Authority**: Ingested data enters as `DRAFT` and requires explicit review, approval, and publication before becoming active.
- **Version Immutability**: Published curriculum versions cannot be mutated in place.
- **School Independence**: The same canonical curriculum is shared across all configured schools (LWPS, School B, School C, etc.).

## 3. Curriculum Lifecycle
```text
INPUT ──► PARSE ──► NORMALIZE ──► VALIDATE ──► DRAFT ──► APPROVAL ──► PUBLICATION ──► ACTIVATION
```

## 4. Verification Matrix (EC-01 through EC-27)
- **EC-01 to EC-06**: Canonical hierarchy and concrete structural/reference validation — **VERIFIED**.
- **EC-07 to EC-14**: Source provenance, draft lifecycle, publication, activation, version immutability, historical integrity, duplicate protection, and failure safety — **VERIFIED**.
- **EC-15 to EC-27**: AI boundary compliance, teaching plan / generation context / artifact compatibility, repository compatibility, security, auditability, multi-school independence, and test quality — **VERIFIED**.
