# Phase 67 source baseline receipt

- Supplied archive: `ecg-sub-2026-phase64-test.zip`
- SHA-256: `0279f3bf9dd15ab95fb24aec598fa7cef55b496218edc388580fefccf18fbc0f`
- Files: 490
- Uncompressed size: 11,266,518 bytes
- Git history included: no
- Source archive is the latest Google AI Studio snapshot identified by the project owner.

## Key file fingerprints

| File | SHA-256 |
|---|---|
| `package.json` | `f9abd5fbbb98e47b1125c0a57fd9d877cea1dcc2c569aa66f86941718be4a70c` |
| `App.tsx` | `13bd920f39c5123dfdb5dabc501ce8afd3dbd8b06499723d13cedd4225846cf6` |
| `components/SOWLibrary.tsx` | `abc9cbf178813108bceb36b067cf02a25ae44d9426cc29bb7513bb72910d096a` |
| `components/GeneratorForm.tsx` | `4c393ff08c6afd30d58f481aeefb2503f76966bb3114fe76f2aa1ac3754dbf17` |
| `services/sowImportService.ts` | `97d6f68ba8453a96b04824f910fe504d60d87eb628832364cd3a0fb520a997a1` |
| `services/sowSourceDocumentStorage.ts` | `a666c900e612616e04d47b06b7edab0a29e21b17b6bdfa50378602bd69988c6b` |
| `services/documentParser.ts` | `2d4fb810c38215b4d1b63f3a51f11ca7f500528dc438c57a852d490345691cd4` |
| `services/pdfReconstruction.ts` | `a68f04baf52b05038e77462b9f5e07332d36e2b3c46e76ff3dc0503e4f4fb975` |
| `constants/academicCalendar.ts` | `5c5998df8eded0b2ba83306c00e31615e4de3edb9ca560013f8cc5f166c18604` |
| `types.ts` | `a8a3b50c466ab7497722720f6ec384b3e3453406ecb334b2a7e8a61860363dac` |

## Security preflight
- No `.git` directory was present in the archive.
- Filename scan found only `.env.example` among environment/credential-like names.
- No service-account, PEM, P12 or private-key filenames were found.
- This is a filename-level preflight, not a complete secret-content scan. Run a content scanner before publishing the full source snapshot to this public repository.

## Synchronisation status
This receipt records the exact archive inspected; it does **not** mean the 490 source files have been imported into GitHub. The GitHub connector exposes text-file and Git-object writes, but this workflow has no direct binary archive-to-repository upload operation. Do not claim the source baseline is synchronised until the source files themselves are committed and the key fingerprints are verified against GitHub.
