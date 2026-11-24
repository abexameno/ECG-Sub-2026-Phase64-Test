/**
 * Kenyan Phone Number Normalization, Validation and Display Utility
 * 
 * Complies with KICD/CBC ECG standards:
 * - Accepted input formats: 07XXXXXXXX, 01XXXXXXXX, +254XXXXXXXXX, 254XXXXXXXXX, with optional spaces/dashes
 * - Canonical storage format: +254XXXXXXXXX (e.g., +254717713493)
 * - Display format: +254 717 713 493 or 0717 713 493
 */

/**
 * Strips whitespace, dashes, brackets, and non-numeric characters (preserving leading '+')
 */
export function sanitizePhoneInput(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Validates whether the given string is a valid Kenyan mobile phone number.
 * Valid Kenyan mobile numbers start with:
 * - 07XXXXXXXX or 01XXXXXXXX (10 digits)
 * - +2547XXXXXXXX or +2541XXXXXXXX (13 chars)
 * - 2547XXXXXXXX or 2541XXXXXXXX (12 digits)
 */
export function isValidKenyanPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const sanitized = sanitizePhoneInput(phone);
  
  // Format 1: 07XXXXXXXX or 01XXXXXXXX (10 digits)
  if (/^0[71]\d{8}$/.test(sanitized)) {
    return true;
  }
  
  // Format 2: +2547XXXXXXXX or +2541XXXXXXXX (13 chars)
  if (/^\+254[71]\d{8}$/.test(sanitized)) {
    return true;
  }
  
  // Format 3: 2547XXXXXXXX or 2541XXXXXXXX (12 digits)
  if (/^254[71]\d{8}$/.test(sanitized)) {
    return true;
  }
  
  return false;
}

/**
 * Normalizes any valid Kenyan phone number to canonical storage format:
 * +254XXXXXXXXX (e.g. +254717713493)
 * Returns null if the phone number is invalid.
 */
export function normalizeKenyanPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const sanitized = sanitizePhoneInput(phone);

  // 07XXXXXXXX or 01XXXXXXXX -> +2547XXXXXXXX or +2541XXXXXXXX
  const localMatch = sanitized.match(/^0([71]\d{8})$/);
  if (localMatch) {
    return `+254${localMatch[1]}`;
  }

  // +2547XXXXXXXX or +2541XXXXXXXX -> +2547XXXXXXXX
  const plusMatch = sanitized.match(/^\+254([71]\d{8})$/);
  if (plusMatch) {
    return `+254${plusMatch[1]}`;
  }

  // 2547XXXXXXXX or 2541XXXXXXXX -> +2547XXXXXXXX
  const rawMatch = sanitized.match(/^254([71]\d{8})$/);
  if (rawMatch) {
    return `+254${rawMatch[1]}`;
  }

  return null;
}

/**
 * Formats a Kenyan phone number into a human-readable format for UI presentation.
 * Canonical: +254717713493 -> +254 717 713 493
 * Local display (optional): 0717 713 493
 */
export function formatKenyanPhoneDisplay(
  phone: string | null | undefined, 
  options?: { local?: boolean }
): string {
  if (!phone) return '';
  const normalized = normalizeKenyanPhone(phone);
  if (!normalized) {
    return phone.trim(); // Return raw if un-normalizable
  }

  const digits9 = normalized.slice(4); // e.g. 717713493
  const part1 = digits9.slice(0, 3); // 717
  const part2 = digits9.slice(3, 6); // 713
  const part3 = digits9.slice(6, 9); // 493

  if (options?.local) {
    return `0${part1} ${part2} ${part3}`;
  }

  // Standard readable international display with canonical country prefix
  return `+254 ${part1} ${part2} ${part3}`;
}
