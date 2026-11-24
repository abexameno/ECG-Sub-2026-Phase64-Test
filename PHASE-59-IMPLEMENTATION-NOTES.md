# Phase 59 — Original SOW Document Storage

## Implemented
- Original PDF, DOCX or TXT file is uploaded to Firebase Storage under `users/{uid}/sow-source-documents/`.
- The SOW library record stores source filename, MIME type, byte size, storage path and upload timestamp in `metadata.sourceDocument`.
- The original document path is also recorded in `metadata.sourceDocumentRef` for compatibility with existing SOW lineage metadata.
- Storage rules restrict reads, writes and deletes to the authenticated owner; uploads are limited to 20 MB and approved MIME types.
- Firestore save failure triggers best-effort deletion of the newly uploaded Storage object to avoid orphaned files.
- Client-side validation rejects unsupported, empty, oversized and mismatched MIME/extension files before parsing.
- A helper resolves a download URL on demand; a bearer download URL is not persisted in the library record.

## Not claimed / remaining verification
- Firebase Storage rules have not been deployed. `firebase.json` now points to `storage.rules` for a future reviewed deployment.
- Firebase Storage emulator tests, authenticated upload/download tests, Jest, full TypeScript check and production build have not been run in this environment.
- Existing deployment/release controls remain unchanged. No commit, push, merge or deploy was performed.
