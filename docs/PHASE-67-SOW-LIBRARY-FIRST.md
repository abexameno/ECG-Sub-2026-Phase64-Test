# Phase 67 — SOW Library-first architecture and remediation

## Baseline and scope
The authoritative implementation baseline is the latest user-supplied Google AI Studio source archive, `ecg-sub-2026-phase64-test.zip` (512 ZIP entries; no Git history). The repository's existing `main` branch is an older snapshot and must not be treated as the current application source until the archive is synchronised and reviewed.

This phase changes the product workflow: ECG does not generate new Schemes of Work. Teachers upload existing SOWs and generate downstream resources from selected lessons.

## Data model and provenance
Each registered SOW must retain:
- Stable `sowId`, owner/tenant scope and access-control metadata.
- Grade, Term, Subject and Academic Year.
- Original filename, storage object reference, content type, file size, checksum and upload timestamp.
- Structured lesson rows preserving all ten source columns and source ordering.
- Import/review status, validation findings and audit timestamps.

Every generated artifact must retain `sourceSowId`, `sourceSowEntryId`, `sourceDocumentRef` and the selected lesson context. Do not detach generated resources from their originating SOW.

## Library organisation
Use Grade → Term → Subject → Academic Year. Grades include Play Group, PP1, PP2 and Grades 1–12. Terms include Term 1, Term 2 and Term 3. Provide search and filters without relying solely on folder navigation.

## Upload and registration
- First-class structured imports: XLSX and CSV.
- Also accept supported Exameno-formatted PDF and DOCX.
- Preserve the original file unchanged.
- Use template-aware reading for formatted documents. OCR may be used only when required; uncertain or unreadable content must be flagged for human review, never fabricated.
- Detect Grade, Subject, Term and Academic Year from the document where possible. Let an authorised user confirm or correct metadata before registration.
- Preserve explicitly supplied historical years. Use 2027 only as the default when a new record has no year.
- Do not validate uploaded source schedules against canonical KICD term allocations or block registration because a canonical curriculum record is missing.
- Validate technical integrity, source row structure, lesson identity, duplicates and schedule gaps relative to the uploaded document.

## Export
Provide:
- Original source download, byte-for-byte unchanged.
- Landscape A4 PDF using the Exameno SOW Master Template, ten columns, repeated headers, wrapped cells and page numbering.
- Editable landscape DOCX with usable column widths and wrapped text.
- RFC-4180 CSV with UTF-8 BOM and all ten columns.

## Generator integration
Allow generation from selected SOW lessons for Lesson Plans, Lesson Notes, Learner Study Guides, Short Quizzes, Topic Exams, Comprehensive Term Exams, Assessments and ROWC. Do not require a school timetable, teaching schedule or canonical curriculum-library record for this SOW-driven path.

## Removal/deprecation
Remove the AI-authored SOW generation workflow and stale user-facing claims that ECG creates SOWs. Do not remove unrelated curriculum-based content generation. Keep the SOW Library and Generator as adjacent top-level navigation destinations.

## Implementation gates
1. Synchronise and review the latest source archive on this feature branch.
2. Map current SOW schema, storage rules, import/export code, navigation and generator callbacks before editing.
3. Implement data model and folder organisation.
4. Implement XLSX/CSV and template-aware PDF/DOCX registration.
5. Implement original-file and PDF/DOCX/CSV download flows.
6. Integrate provenance-preserving downstream generation.
7. Remove obsolete AI-SOW authoring paths and update documentation.
8. Add regression, security, import/export round-trip and rendered-PDF tests.
9. Run lint, build, unit, browser and PDF-render tests where configured. Report actual results; do not infer success.

## Release safety
Do not commit secrets or environment files. Do not modify production Firebase data or deploy as part of this phase. Keep all work on `feature/phase-67-sow-library-first` and submit a pull request for review; do not merge automatically.
