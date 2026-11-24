import { validateSowSourceFile, MAX_SOW_SOURCE_FILE_BYTES } from './sowSourceDocumentStorage';

describe('SOW source document validation', () => {
  it('accepts supported PDF, DOCX and TXT files', () => {
    expect(validateSowSourceFile({ name: 'scheme.pdf', size: 100, type: 'application/pdf' })).toBeNull();
    expect(validateSowSourceFile({ name: 'scheme.docx', size: 100, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBeNull();
    expect(validateSowSourceFile({ name: 'scheme.txt', size: 100, type: 'text/plain' })).toBeNull();
  });

  it('rejects unsupported formats, empty files and oversized documents', () => {
    expect(validateSowSourceFile({ name: 'scheme.doc', size: 100, type: 'application/msword' })).toMatch(/Only PDF/);
    expect(validateSowSourceFile({ name: 'scheme.pdf', size: 0, type: 'application/pdf' })).toMatch(/empty/);
    expect(validateSowSourceFile({ name: 'scheme.pdf', size: MAX_SOW_SOURCE_FILE_BYTES + 1, type: 'application/pdf' })).toMatch(/20 MB/);
  });

  it('rejects mismatched MIME types', () => {
    expect(validateSowSourceFile({ name: 'scheme.pdf', size: 100, type: 'text/plain' })).toMatch(/does not match/);
  });
});
