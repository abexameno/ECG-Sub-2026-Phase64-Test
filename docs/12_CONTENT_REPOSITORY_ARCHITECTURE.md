# ECG Architecture: Content Repository & Operational Management (Phase 6)

## 1. Overview
Phase 6 establishes the **Content Repository & Operational Management Layer** on top of the Content Artifact Architecture (Phase 5).

The repository (`ContentArtifactRepository`) provides controlled persistence, version-aware retrieval, lifecycle management, cross-school copying, and rigorous multi-school isolation.

## 2. Architectural Principles
- **Curriculum = WHAT**: The repository references canonical curriculum and version identifiers without becoming a duplicate source of curriculum truth.
- **School = WHERE**: Strict multi-school isolation is enforced at the repository boundary. School A cannot query or access School B artifacts.
- **Teaching Plan = WHEN**: Teaching context (`teachingPlanId`, `termId`, `weekNumber`, `lessonNumber`) is preserved within artifact metadata.
- **Gemini = HOW**: AI generated outputs are validated and normalized into structured `ContentArtifact` objects before repository persistence.
- **Repository = OPERATIONAL CONTROL**: Manages creation, versioned retrieval, listing with filters, archiving, restoring, and cross-school cloning.

## 3. Architecture Flow
```text
CURRICULUM + SCHOOL CONFIGURATION + TEACHING PLAN
                       │
                       ↓
              GENERATION CONTEXT
                       │
                       ↓
               PEDAGOGICAL ENGINE
                       │
                       ↓
                    GEMINI
                       │
                       ↓
              STRUCTURED CONTENT ARTIFACT
                       │
                       ↓
              ARTIFACT VALIDATION
                       │
                       ↓
              CONTENT REPOSITORY
                       │
  ┌────────────────────┼────────────────────┐
  │                    │                    │
  ▼                    ▼                    ▼
Retrieve / List    Version / Edit      Copy / Archive
```
