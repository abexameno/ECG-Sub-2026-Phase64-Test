# AGENTS.md

## Project Overview
Exameno ECG is an education content and assessment platform for Kenyan CBC/CBE schools, teachers and learners.

The SOW Library is the authoritative source for teacher-uploaded Schemes of Work. ECG does **not** author or generate new Schemes of Work using AI.

## SOW Library — Non-negotiable product rules
- Teachers and authorised administrators upload already prepared Schemes of Work.
- Preserve the uploaded source document unchanged and retain its provenance.
- Treat the uploaded SOW as authoritative for its own Grade, Subject, Term, Academic Year, week and lesson numbering, strands, sub-strands, specific learning outcomes, learning experiences, inquiry questions, resources, assessment methods and remarks.
- Organise records by Grade → Term → Subject → Academic Year. Support Play Group, PP1, PP2 and Grades 1–12, and Terms 1–3.
- Support structured Excel (.xlsx) and CSV uploads as first-class formats. Also support Exameno-formatted PDF and DOCX uploads.
- Never silently invent, rewrite, normalise away, or fill missing source lesson content. Report ambiguous or missing fields for review.
- Do not reject an uploaded SOW merely because a corresponding KICD canonical curriculum record or canonical term allocation is absent or different.
- Perform technical integrity checks: file readability, required structure, lesson identity, source lineage, duplicates, schedule gaps relative to the uploaded source, column integrity and export correctness.
- Preserve explicitly detected historical academic years. Default only new records with no supplied year to 2027.
- Keep original uploaded files downloadable unchanged. Provide PDF, editable DOCX and RFC-4180 UTF-8-BOM CSV exports.
- Generated resources must retain sourceSowId, sourceSowEntryId, sourceDocumentRef and the selected lesson context.
- SOW-driven resource generation must not require school timetable capacity or a school teaching schedule.
- Do not make the KICD curriculum library a prerequisite for SOW upload or SOW-driven resource generation.

## SOW-derived content
The Generator may create Lesson Plans, Lesson Notes, Learner Study Guides, Short Quizzes, Topic Exams, Comprehensive Term Exams, Assessments and Records of Work Covered (ROWC) from selected uploaded SOW lessons.
AI must not create or regenerate the source SOW itself.
Do not diagnose learners. Assessment evidence and results must remain traceable to their source resources and assignments.

## Curriculum standards
For curriculum-dependent content, use the approved curriculum source available to the relevant workflow. Never invent strands, sub-strands, specific learning outcomes or content standards. Do not apply canonical curriculum validation as a gate to registering an uploaded SOW.

## Grade coverage
Support Play Group, PP1, PP2 and Grades 1–12 where the relevant platform modules support them.

## Question generation rules
- Multiple-choice questions use four options (A, B, C, D) and exactly one correct answer.
- Avoid ambiguous wording and answer-pattern repetition.
- Structured questions include clear marks allocation and accurate marking schemes.
- Verify answer keys against their questions.

## Technical rules
- Preserve existing functionality outside the scoped change.
- Prefer reusable components and modular TypeScript.
- Preserve Firebase security boundaries and enforce authorisation server-side.
- Validate uploads by file signature/content as well as extension and MIME type.
- Never expose secrets, service-account credentials or private environment files in source control.
- Add or update automated tests for every changed behaviour.
- Do not claim tests, builds or deployments passed unless they were actually run and the results are available.

## UI standards
- Use Inter font, clean spacing, accessible contrast and responsive layouts.
- Use consistent 1px borders for cards and containers.
- Keep navigation and workflows clear and predictable.

## Output priority
Source fidelity and data integrity > security > correctness > usability > speed.
