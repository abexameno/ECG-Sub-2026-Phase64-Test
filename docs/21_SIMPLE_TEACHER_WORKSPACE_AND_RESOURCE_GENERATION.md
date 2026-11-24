# ECG Architecture: Simple Teacher Workspace & Resource Generation (Phase 15)

## 1. Overview
Phase 15 transforms the complete backend capabilities established in Phases 1–14 into an intuitive, minimal-click teacher experience based on the principle:
> **"SIMPLE ON THE SURFACE. SOPHISTICATED UNDERNEATH."**

The teacher promise is **Select → Choose → Generate → Use**, removing technical jargon (`curriculumVersionId`, `GenerationContext`, `AIGovernanceService`, etc.) from the user-facing workflow while preserving rigorous backend validation, security, and versioning.

## 2. Core Teacher Concepts & Workflows
- **Active Teaching Context**: Resolves `{ schoolId, gradeId, learningAreaId, academicYear, termId }` with sensible defaults and context restoration so teachers are never asked to re-enter known information.
- **Direct Lesson Access**: Today's Lesson summary provides immediate entry to Lesson Plans, Lesson Notes, and Assessments without searching the repository.
- **Generate My Teaching Package (One Coordinated Request)**: Generates Schemes of Work, Lesson Plans, Lesson Notes, and Assessments in a single coordinated pipeline following dependency hierarchy: `Curriculum` → `Teaching Plan` → `Teaching Allocations` → `Resources`.
- **Sensible Reuse & Explicit Versioning**: Automatically reuses existing valid artifacts to save quota, while allowing explicit regeneration to create new versions without overwriting historical records.
- **Progressive Disclosure**: Keeps the primary view focused on core resource checkboxes; advanced parameters are tucked behind optional disclosure toggles.

## 3. Verification Matrix (EC-01 through EC-47)
- **EC-01 to EC-04**: Active context establishment, server authorization, sensible defaults, no duplicate questions — **VERIFIED**.
- **EC-05 to EC-10**: Core resource selection (SOW, Lesson Plans, Notes, Assessments), coordinated single-request generation — **VERIFIED**.
- **EC-11 to EC-15**: Authoritative curriculum, school config, teaching plans, allocations, and generation contexts — **VERIFIED**.
- **EC-16 to EC-21**: Non-authoritative AI, deterministic validation, ContentArtifacts creation, repository persistence, versioning & provenance — **VERIFIED**.
- **EC-22 to EC-27**: Resource reuse, safe versioned regeneration, direct today's lesson access, viewing/downloading — **VERIFIED**.
- **EC-28 to EC-34**: Progressive disclosure, <= 3 action target for returning teachers, graceful error handling — **VERIFIED**.
- **EC-35 to EC-39**: School isolation, IDOR prevention, server-authoritative quota, audit logs, duplicate request protection — **VERIFIED**.
- **EC-40 to EC-47**: Compatibility with LWPS and multi-school environments, compilation, linting, and production builds — **VERIFIED**.
