import { auth } from '../firebase.ts';

export interface SowOcrResult {
  text: string;
  pageCount?: number;
  pages?: Array<{ pageNumber: number; characterCount: number }>;
  provider: 'google-cloud-document-ai';
}

/**
 * Sends a scanned PDF to the authenticated server-side OCR endpoint.
 * No Google Cloud credentials or processor identifiers are exposed to the browser.
 */
export async function recognizeSowPdf(file: File): Promise<SowOcrResult> {
  if (!file || file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('OCR currently supports PDF documents only.');
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    throw new Error('The PDF is empty or exceeds the 20 MB OCR limit.');
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in again before running OCR.');

  const token = await user.getIdToken();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  const contentBase64 = btoa(binary);

  const response = await fetch('/api/sow/ocr', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName: file.name, mimeType: 'application/pdf', contentBase64 }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `OCR request failed (${response.status}).`);
  if (typeof payload?.text !== 'string' || !payload.text.trim()) {
    throw new Error('OCR completed without returning readable text.');
  }
  return payload as SowOcrResult;
}
