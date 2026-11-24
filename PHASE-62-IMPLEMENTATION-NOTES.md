# Phase 62 — Authenticated SOW OCR and Source-Page Traceability

## Implemented

- Added an authenticated `POST /api/sow/ocr` backend endpoint using Firebase ID-token verification.
- Added per-IP request throttling (5 OCR requests per 15 minutes), PDF signature validation, strict PDF MIME validation, and a 20 MB decoded payload limit.
- Integrated Google Cloud Document AI through its regional REST endpoint. Processor names and OAuth credentials remain on the server; no Google credentials are sent to the browser.
- The endpoint returns page-aware text. Where Document AI returns table structures, table cells are reconstructed as tab-delimited rows; otherwise page text anchors are used.
- Added a teacher-facing OCR action when a scanned/image-only PDF is detected by the existing parser.
- Added optional `sourcePage` to extracted SOW lesson records and display it in the import review table.
- Added a regression test proving OCR page markers are preserved as lesson source-page references.
- Uploaded SOWs remain authoritative. OCR only recognizes the uploaded source; it does not query or replace canonical curriculum records.

## Required deployment configuration

Set the following server environment variable to the full Document AI processor resource name:

`DOCUMENT_AI_PROCESSOR_NAME=projects/PROJECT_ID/locations/LOCATION/processors/PROCESSOR_ID`

Also ensure:

1. Document AI API is enabled in the Google Cloud project.
2. The server's Firebase Admin/Application Default Credentials can obtain a Google OAuth access token.
3. The server service account has permission to invoke the configured processor (for example, the Document AI API User role, scoped to the required project/processor where possible).
4. The processor is provisioned in the region encoded in the processor resource name.
5. The Cloud Run/service request body limit supports the configured 20 MB PDF limit plus base64 overhead (the Express JSON parser is currently 50 MB).

No API key, service-account JSON, or processor secret is required in browser code.

## Important limitations

- OCR is now wired end-to-end in code, but it will return `OCR_NOT_CONFIGURED` until `DOCUMENT_AI_PROCESSOR_NAME` and Google Cloud permissions are configured in the deployment environment.
- The endpoint uses online Document AI processing. Processor-specific online page/file limits apply; very large or long SOW PDFs may need an asynchronous Cloud Storage batch-processing workflow in a later phase.
- Table reconstruction uses Document AI's detected table structure when available. Complex merged cells and low-quality scans still require teacher review.
- Page provenance is the physical page number reported by Document AI and is retained on extracted lesson rows when page markers are present.
- OCR provider calls, Firebase authentication, Cloud Run deployment, emulator tests, Jest, full TypeScript checks and production build were not executed in this offline workspace.

## Files changed

- `server.ts`
- `services/sowOcrService.ts` (new)
- `components/TeacherDashboard.tsx`
- `services/sowImportService.ts`
- `types.ts`
- `sowImportService.test.ts`
- `PHASE-62-IMPLEMENTATION-NOTES.md` (new)
