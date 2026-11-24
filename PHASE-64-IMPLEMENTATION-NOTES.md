# Phase 64 — SOW Import-to-Export Integrity

## Scope delivered

- Added detection of an academic year printed inline in a source term heading (for example, `TERM 1 2026`) when no separate `Academic Year:` label exists.
- Preserved explicit source academic year through XLSX workbook metadata, PDF header metadata, and export filename generation. Exports no longer substitute the host computer's current year when the uploaded SOW explicitly states its year.
- Changed the XLSX subtitle for `sowAuthority: UPLOADED_SOURCE` records. Uploaded school SOWs are labelled as source-preserved rather than being presented under a generic `KICD/TSC-ALIGNED` workbook claim.
- Added an explicit source-authority note to PDF exports of uploaded SOWs. The note clarifies that the reviewed uploaded document is the source and that no independent canonical curriculum validation is implied.
- Added `sowImportExportRoundTrip.test.ts` to cover extraction metadata, source-page retention, CSV field ordering and content, XLSX year/source labelling, PDF year/source notice, and filename year.
- Added a parser regression test for inline term-heading year detection.

## End-to-end integrity checks

A deterministic source-text fixture was passed through `parseUploadedSowText`, then represented as an uploaded-source SOW record and sent through CSV, XLSX workbook, PDF document-definition, and filename generation logic.

The check verified:

- Grade 7, MATHEMATICS, Term 1 and academic year 2025 were retained.
- The lesson's source page (page 2) remained attached to the extracted row.
- CSV retained the established ten-column SOW schema and the extracted lesson content.
- XLSX used `Term 1 / 2026` and did not claim KICD/TSC alignment for uploaded-source content.
- PDF header displayed Academic Year 2026 and its content included the uploaded-source authority notice.
- Export filename used 2025 rather than the current machine year.

Runtime verification: **8 of 8 checks passed** using the project's TypeScript modules transpiled at runtime and lightweight mocks for browser-only dependencies.

## Verification limitations

- `tsc --noEmit` was attempted and is blocked because this supplied project ZIP does not include installed dependencies and cannot resolve the configured `vite/client` type definition (`TS2688`).
- Jest was not run because `jest` and `ts-jest` are not installed in this workspace.
- Production build and browser integration tests were not run.
- This phase uses a deterministic source-text fixture. It does not claim a new live OCR run or a new full 22-page PDF visual comparison. The Phase 63 source-document QA findings remain separate evidence.

## Files changed

- `services/sowImportService.ts`
- `services/exportService.ts`
- `services/pdfService.ts`
- `sowImportService.test.ts`
- `sowImportExportRoundTrip.test.ts` (new)
- `PHASE-64-IMPLEMENTATION-NOTES.md` (new)

## Authority boundaries

- Uploaded SOW content remains authoritative for its own lesson sequence and fields.
- No canonical curriculum lookup, KICD revalidation, or canonical term-allocation requirement was added.
- Export labels do not imply independent validation of uploaded SOW content.
- New AI-authored SOW eligibility checks remain unchanged.

## Repository status

This phase is delivered as a local project ZIP and patch. No GitHub commit, push, merge, deployment, or PR status change was performed.
