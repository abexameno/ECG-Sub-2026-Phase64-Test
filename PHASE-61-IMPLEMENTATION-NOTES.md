# Phase 61 — SOW Extraction Reliability

## Scope delivered

- DOCX extraction now attempts Mammoth HTML conversion first and preserves table rows as tab-delimited source rows. It falls back to Mammoth raw-text extraction when HTML conversion is unavailable or fails.
- PDF extraction continues to reconstruct visual text rows and likely column boundaries, and now detects image-only/scanned PDFs with insufficient extractable text. Such files receive an explicit OCR-required message rather than producing an empty import.
- SOW header detection now supports a two-physical-row split heading when the parts align by column.
- SOW lesson extraction now appends wrapped continuation rows to the previous source lesson, preserving column association and avoiding fabricated lesson rows.
- Added regression tests for split multi-line headings and wrapped continuation rows.
- No canonical curriculum data or eligibility rules were changed. Uploaded SOW content remains source-authoritative; missing values remain blank for teacher review.

## Explicit limitation

OCR recognition itself is not included in this phase. The repository does not contain an OCR engine or configured authenticated OCR backend, and this environment has no dependency installation/network access. The parser now identifies likely scanned PDFs and gives a precise next action. Do not describe scanned-PDF OCR as available until an approved OCR provider/engine is integrated and tested.

## Verification

- TypeScript syntax transpilation for changed `.ts` files: passed.
- SOW import runtime smoke tests for split headings and wrapped continuation rows: 2 passed.
- Full `tsc --noEmit`: blocked before project checking because the supplied project has no installed dependencies and cannot resolve `vite/client`.
- Jest suite: not run; Jest is not installed in this working environment.
- Production build: not run; project dependencies are not installed.

## Files changed

- `services/documentParser.ts`
- `services/sowImportService.ts`
- `sowImportService.test.ts`
- `PHASE-61-IMPLEMENTATION-NOTES.md` (new)
