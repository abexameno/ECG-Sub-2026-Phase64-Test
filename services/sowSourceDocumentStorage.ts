import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

export const MAX_SOW_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);
const MIME_BY_EXTENSION: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  txt: ['text/plain', 'application/octet-stream'],
};

export interface SowSourceDocumentRecord {
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  uploadedAt: string;
}

export function validateSowSourceFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(extension)) return 'Only PDF, DOCX and TXT source documents are supported.';
  if (!file.size) return 'The selected source document is empty.';
  if (file.size > MAX_SOW_SOURCE_FILE_BYTES) return 'The source document exceeds the 20 MB upload limit.';
  const allowedMimeTypes = MIME_BY_EXTENSION[extension];
  if (file.type && !allowedMimeTypes.includes(file.type)) return 'The file type does not match its filename extension.';
  return null;
}

/** Uploads the original source under the authenticated user's own Storage namespace. */
export async function uploadSowSourceDocument(
  userId: string,
  file: File,
): Promise<SowSourceDocumentRecord> {
  if (!userId.trim()) throw new Error('A signed-in user is required to store the original SOW document.');
  const validationError = validateSowSourceFile(file);
  if (validationError) throw new Error(validationError);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'source-document';
  const storagePath = `users/${userId}/sow-source-documents/${Date.now()}-${safeName}`;
  const objectRef = ref(getStorage(), storagePath);
  const contentType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
  await uploadBytes(objectRef, file, {
    contentType,
    customMetadata: { ownerId: userId, documentType: 'uploaded-scheme-of-work' },
  });

  return {
    fileName: file.name,
    contentType,
    size: file.size,
    storagePath,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteSowSourceDocument(storagePath: string): Promise<void> {
  if (!storagePath.startsWith('users/') || !storagePath.includes('/sow-source-documents/')) return;
  await deleteObject(ref(getStorage(), storagePath));
}

/** Resolve a download URL on demand after the caller has authenticated. */
export async function getSowSourceDocumentDownloadUrl(storagePath: string): Promise<string> {
  if (!storagePath.startsWith('users/')) throw new Error('Invalid SOW source-document path.');
  return getDownloadURL(ref(getStorage(), storagePath));
}
