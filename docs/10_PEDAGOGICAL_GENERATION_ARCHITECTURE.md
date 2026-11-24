# ECG Architecture: Pedagogical Generation & AI Boundary (Phase 4)

## 1. Overview
Phase 4 establishes the definitive AI boundary for ECG. The core architectural rule is:

> **Gemini generates pedagogical content. ECG remains authoritative over curriculum, school configuration, teaching capacity, teaching structure, metadata, relationships, validation and system rules.**

## 2. Architecture Flow
```text
                    ECG
                     │
        ┌────────────┼────────────┐
        │            │            │
   CURRICULUM      SCHOOL      TEACHING
      TRUTH       CONFIG        PLAN
        │            │            │
        └────────────┼────────────┘
                     ↓
             GENERATION CONTEXT
                     ↓
          PEDAGOGICAL ENGINE
                     ↓
                   GEMINI
                     ↓
             STRUCTURED OUTPUT
                     ↓
          DETERMINISTIC VALIDATION
                     ↓
             GENERATED ARTIFACT
                     ↓
             PERSISTENCE / EXPORT
```

## 3. Separation of Concerns
- **Curriculum & Teaching Truth**: Owned by `CanonicalCurriculumService`, `SchoolConfigService`, and `TeachingPlanService`.
- **Generation Context**: Constructed deterministically (`GenerationContextService`) prior to calling Gemini.
- **AI Role**: Limited strictly to generating explanations, learning activities, differentiation strategies, and teaching guidance within the established deterministic teaching slot.
- **Deterministic Validation**: Programmatically validates generated metadata and content structure against authoritative context before persistence.
