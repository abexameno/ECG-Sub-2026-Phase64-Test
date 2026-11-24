# Phase 63 — SOW Extraction Quality Assurance and End-to-End Validation

## Scope delivered

- Added deterministic extraction-quality reporting to `parseUploadedSowText`.
- The report includes lesson count, duplicate week/lesson slots, missing identifiers, populated content-field ratio, source-page coverage, and possible sequence gaps within observed weeks.
- The score is explicitly a structural completeness indicator only. It is not semantic confidence, curriculum validation, or automatic approval. Every import remains `reviewRequired: true`.
- Added a teacher-facing quality report in the SOW import review panel. The report is persisted in imported resource metadata as `importQuality`.
- Added detection for subject headings printed adjacent to a detected Grade (for example, MATHEMATICS immediately before GRADE 7), without consulting canonical curriculum data.
- Added recognition of common broken PDF header fragments (for example, `We ek`, `LS N`, split Sub-strand and Key Inquiry labels).
- Fixed tab parsing so leading empty cells are retained. This prevents wrapped PDF rows from shifting content into Week/Lesson columns.
- Added coordinate-based PDF table reconstruction using header-derived column anchors. Empty cells remain in their original columns, and detected anchors are reused on subsequent pages without repeated headers.
- Preserved physical page markers for text PDFs and OCR pages.
- Merged Week cells are carried forward only when the current source row has a numeric lesson identifier and the preceding source lesson supplies the Week. This is recorded as an import warning; no missing lesson numbers are created.
- Possible missing lesson numbers within an observed week are reported for teacher review and are not fabricated or blocked automatically.

## Real-document QA

A supplied 22-page document was used as a layout/coordinate fixture:

`TERM-1-GRADE-7-MATHEMATICS-SCHEMES-OF-WORK(1).pdf`

The extracted source metadata was:

- Grade 7
- MATHEMATICS
- Term 1

The coordinate reconstruction plus SOW parser produced 58 lesson rows with page references on all extracted rows. It detected a possible source sequence gap at Week 8, Lesson 4. The importer does not invent that lesson; the teacher is asked to compare the flagged gap with the original document.

The extraction-quality report for this sample was:

- Structural score: 80/100
- Lesson rows: 58
- Duplicate slots: 0
- Missing Week/Lesson identifiers: 0
- Populated content fields: 75.4%
- Source-page coverage: 100%
- Possible sequence gaps: 1 (Week 8, Lesson 4)

This is a coordinate-fixture test using word positions extracted from the supplied PDF. It is not a full browser/PDF.js integration run, and it does not establish semantic accuracy of every extracted field. Teacher review remains mandatory.

## Tests and verification

- 6 runtime QA checks passed, including the 22-page source-document coordinate fixture.
- TypeScript/TSX syntax transpilation passed for all changed TypeScript files.
- Full `tsc --noEmit` could not run because dependencies are not installed and `vite/client` type definitions are unavailable.
- Jest suite was not run because project dependencies are not installed in this workspace.
- Production build and browser integration tests were not run.
- Google Cloud Document AI live OCR was not invoked; Phase 62 deployment configuration is still required.

## Files changed

- `services/documentParser.ts`
- `services/documentParser.test.ts` (new)
- `services/sowImportService.ts`
- `sowImportService.test.ts`
- `components/TeacherDashboard.tsx`
- `PHASE-63-IMPLEMENTATION-NOTES.md` (new)

## Authority and safety boundaries

- Uploaded SOWs remain authoritative for their own lesson plan and curriculum fields.
- No canonical curriculum lookup, KICD revalidation, or canonical term-allocation check was added.
- Extraction-quality scores never approve or reject curriculum correctness.
- Duplicate and sequence-gap findings are review warnings, not fabricated corrections.
- New AI-authored SOW eligibility rules and unrelated Teacher Action Plan integrity checks remain unchanged.

## Repository status

No GitHub commit, push, merge, deployment, or PR status change was performed. This phase is delivered as a local project ZIP and patch for review.
