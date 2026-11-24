# ECG Architecture: Content Artifact Architecture (Phase 5)

## 1. Overview
Phase 5 establishes a unified, structured, traceable Content Artifact Domain for ECG.

> **Every generated ECG artifact must be a structured, traceable, versionable content object — not merely a block of AI-generated text.**

## 2. Core Architectural Model
```text
CANONICAL CURRICULUM
        │
        ↓
TEACHING PLAN
        │
        ↓
GENERATION CONTEXT
        │
        ↓
CONTENT ARTIFACT
        │
        ├── Scheme of Work
        ├── Lesson Plan
        ├── Learning Activity
        ├── Assessment
        ├── Revision Content
        └── Learning Resource
        │
        ↓
VALIDATION
        │
        ↓
PERSISTENCE
        │
        ↓
EXPORT / USE / REUSE
```

## 3. Key Principles
- **Separation of Metadata and Content**: Common metadata (`schoolId`, `curriculumReferences`, `version`, `status`, `source`) is cleanly separated from specialized typed content payloads.
- **Traceability**: Every artifact is tied immutably to its authoritative curriculum and school context via IDs.
- **Versioning & Editing**: Human edits and AI regenerations increment version numbers and record provenance without corrupting historical records or identity.
- **School Isolation**: School scoping is strictly enforced at the service and validation layer.
