# Phase 38: Teacher Lesson Preparation & One-Click Teaching Workflow

## Overview
Phase 38 transforms ECG's curriculum, teaching-plan, content-generation, delivery, evidence, reflection, and continuity capabilities into a simple, single-view daily teacher workflow.

The core principle is: **"ECG must hide architectural complexity from teachers."** 

## Architectural Principles
*   **Curriculum Context Resolution:** The system automatically resolves the school, grade, class, learning area, term, strand, sub-strand, and specific learning outcomes directly from the server-authoritative context (Teacher assignment + Teaching Plan allocation).
*   **Next Lesson Determinism:** The `DailyTeachingService` calculates the next lesson by finding the earliest uncompleted slot in the active teaching plan. Gemini is NOT used to guess or fabricate the next lesson.
*   **Content Generation Integration:** When generating new materials, the generator is pre-filled with the authoritative context to avoid manual configuration and reduce errors.
*   **Credit Enforcement:** Preserves the credit cost logic (SOW = 2, Lesson = 1, etc.) and ensures that failed generations do NOT deduct credits.
*   **Completion != Mastery:** Delivering a lesson marks it as "Delivered", and completing a lesson stores "Completion Evidence". It does not automatically grant mastery to the learners.

## Workflow Execution
1.  **Today's Dashboard:** The `TeacherWorkdayDashboard` prominently displays the *next* authoritative lesson, derived from the active `TeachingPlanService`.
2.  **Lesson Preparation:** Provides immediate access to existing repository resources. If none are available (or the teacher wants new ones), they can "Prepare Lesson", which routes to the generator with pre-filled context (`extraContext`).
3.  **Classroom Delivery Modal:** A dedicated focus view to execute the lesson:
    *   Timer for standard pacing.
    *   One-click "Start Lesson", "Mark Delivered", and "Complete Lesson".
    *   In-line learner activity recording to explicitly capture assessment evidence.
    *   Lightweight reflection form mapping observations (pacing, learner response, resource utility) to the `TeachingReflectionService`.
4.  **Next Lesson Transition:** Upon completion, it immediately presents the next scheduled allocation, allowing the teacher to prepare for it seamlessly.

## Security & Constraints
*   Multi-school isolation and role-based access are enforced via `SchoolMembershipService`.
*   All IDs (schoolId, classGroupId, etc.) are verified server-side.
*   No client modification of authoritative KICD curriculum records is allowed.
