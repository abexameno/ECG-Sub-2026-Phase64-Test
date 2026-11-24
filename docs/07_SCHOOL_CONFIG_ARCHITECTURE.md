# ECG Architecture: School Configuration & Multi-School Agnostic Core (Phase 1)

## 1. Overview
In Phase 1 of the ECG (Exameno CBE Content Generator) architectural modernization, the system transitions from an architecture with implicit hardcoded assumptions about Lizzie Wanyoike Preparatory School (LWPS) to a fully school-agnostic CBE content generation engine.

## 2. Core Architectural Principles
- **Curriculum and SOW content are deterministic.** KICD strands, sub-strands, and learning outcomes remain standardized and authoritative.
- **Lesson-plan pedagogy is generative.** AI assists in crafting pedagogical guidance and learning experiences.
- **School-specific settings belong to the configuration layer, not ECG Core.** Parameters such as teaching weeks per term, lessons per week, lesson duration, and textbook preferences are maintained in `SchoolProfile` configurations rather than hardcoded global constants.

## 3. The `SchoolProfile` Model
Each school profile defines:
- `id`: Unique school identifier (e.g., `'lwps'`, `'school-b'`).
- `name`: Full display name of the school.
- `teachingConfig`:
  - `lessonsPerWeek`: Number of lessons scheduled per week (e.g. 5 for LWPS, 4 for Hillside Academy).
  - `teachingWeeksPerTerm`: Number of teaching weeks in a term (e.g. 13 for LWPS, 12 for School B).
  - `lessonDurationMinutes`: Duration of each lesson.
- `contentPreferences`: Default textbook references and style preferences.

## 4. Separation of Curriculum vs School Customization
- **Curriculum Data**: Standardized KICD learning areas and strands.
- **School Teaching Sequence / Breakdown**: School-specific scheduling configuration (weeks, lesson counts) layered on top of core curriculum.

## 5. Backward Compatibility
If no `schoolId` is supplied in `FormState`, ECG defaults safely to `'lwps'` (`Lizzie Wanyoike Preparatory School`), ensuring 100% backward compatibility with existing LWPS workflows and tests.
