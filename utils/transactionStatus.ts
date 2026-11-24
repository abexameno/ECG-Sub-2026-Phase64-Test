import { SubscriptionTransaction, TransactionCanonicalStatus } from '../types/subscription';

export const ADMIN_MPESA_NUMBER = '0717 713 493';
export const ADMIN_WHATSAPP_PHONE = '254717713493';

/**
 * Normalizes any transaction status string into one of the three canonical statuses:
 * 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED'
 */
export function normalizeTransactionStatus(status?: string | null): TransactionCanonicalStatus {
  if (!status) return 'PENDING_VERIFICATION';

  const clean = status.trim().toUpperCase();

  if (['VERIFIED', 'SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'APPROVED'].includes(clean)) {
    return 'VERIFIED';
  }

  if (['REJECTED', 'FAILED', 'DECLINED', 'CANCELLED', 'CANCELED'].includes(clean)) {
    return 'REJECTED';
  }

  return 'PENDING_VERIFICATION';
}

/**
 * Returns human-readable label for display in user or admin contexts.
 */
export function getTransactionStatusLabel(
  status?: string | null,
  context: 'admin' | 'user' = 'user'
): string {
  const canonical = normalizeTransactionStatus(status);

  switch (canonical) {
    case 'VERIFIED':
      return context === 'user' ? 'VERIFIED (CREDITS ACTIVATED)' : 'VERIFIED';
    case 'REJECTED':
      return 'REJECTED';
    case 'PENDING_VERIFICATION':
    default:
      return context === 'user' ? 'PENDING VERIFICATION' : 'PENDING_VERIFICATION';
  }
}

/**
 * Returns consistent Tailwind badge styles for each status.
 */
export function getTransactionBadgeClasses(status?: string | null): {
  bg: string;
  text: string;
  border: string;
  full: string;
} {
  const canonical = normalizeTransactionStatus(status);

  switch (canonical) {
    case 'VERIFIED':
      return {
        bg: 'bg-emerald-100',
        text: 'text-emerald-900',
        border: 'border-emerald-300',
        full: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      };
    case 'REJECTED':
      return {
        bg: 'bg-rose-100',
        text: 'text-rose-900',
        border: 'border-rose-300',
        full: 'bg-rose-100 text-rose-900 border-rose-300',
      };
    case 'PENDING_VERIFICATION':
    default:
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-900',
        border: 'border-amber-300',
        full: 'bg-amber-100 text-amber-900 border-amber-300',
      };
  }
}

export function isTransactionPending(status?: string | null): boolean {
  return normalizeTransactionStatus(status) === 'PENDING_VERIFICATION';
}

export function isTransactionVerified(status?: string | null): boolean {
  return normalizeTransactionStatus(status) === 'VERIFIED';
}

export function isTransactionRejected(status?: string | null): boolean {
  return normalizeTransactionStatus(status) === 'REJECTED';
}

/**
 * Cleans and normalizes a phone number to standard international format without '+'
 * e.g. '0717 713 493' -> '254717713493'
 *      '+254 717-713-493' -> '254717713493'
 *      '0112345678' -> '254112345678'
 */
export function formatKenyanPhoneForWhatsApp(rawPhone?: string | null): string {
  if (!rawPhone) return '';

  // Strip all non-digit characters
  let digits = rawPhone.replace(/\D/g, '');

  if (digits.startsWith('0') && digits.length === 10) {
    // 07... or 01...
    digits = '254' + digits.substring(1);
  } else if (digits.startsWith('7') && digits.length === 9) {
    digits = '254' + digits;
  } else if (digits.startsWith('1') && digits.length === 9) {
    digits = '254' + digits;
  } else if (digits.startsWith('254') && digits.length === 12) {
    // Already in correct format
  }

  return digits;
}

/**
 * Generates WhatsApp URL for User to send approval request to Admin.
 */
export function generateWhatsAppApprovalUrl(
  tx: { transactionNumber: string; amount: number; userEmail?: string; packageName?: string },
  adminPhone: string = ADMIN_WHATSAPP_PHONE
): string {
  const cleanPhone = formatKenyanPhoneForWhatsApp(adminPhone) || ADMIN_WHATSAPP_PHONE;
  const cleanTx = (tx.transactionNumber || '').trim().toUpperCase();
  const pkgInfo = tx.packageName ? ` for the ${tx.packageName} package` : '';
  const emailInfo = tx.userEmail ? `\nAccount Email: ${tx.userEmail}` : '';

  const message = `Hello Exameno Admin, I have submitted an M-Pesa payment of KES ${tx.amount}${pkgInfo}.
Transaction Code: ${cleanTx}${emailInfo}

Please verify my payment and activate credits. Thank you!`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates WhatsApp URL for Admin to send official verified payment receipt to Customer.
 */
export function generateWhatsAppReceiptUrl(
  tx: {
    transactionNumber: string;
    amount: number;
    userEmail?: string;
    userName?: string;
    date?: string;
  },
  customerPhone?: string
): string {
  const cleanPhone = customerPhone ? formatKenyanPhoneForWhatsApp(customerPhone) : ADMIN_WHATSAPP_PHONE;
  if (!cleanPhone) return '';

  const cleanTx = (tx.transactionNumber || '').trim().toUpperCase();
  const dateFormatted = tx.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const customerName = tx.userName || 'Educator';
  const customerEmail = tx.userEmail || 'Registered Account';

  const receipt = `*EXAMENO CBC CONTENT GENERATOR (ECG)*
*OFFICIAL PAYMENT RECEIPT*
----------------------------------------
*Status:* VERIFIED (Credits Activated)
*Transaction Code:* ${cleanTx}
*Amount Paid:* KES ${tx.amount}
*Customer Name:* ${customerName}
*Account Email:* ${customerEmail}
*Date:* ${dateFormatted}
----------------------------------------
Your credits have been activated successfully on your Exameno account.
Thank you for supporting KICD-aligned CBC & CBE educational content delivery.

https://exameno.com`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(receipt)}`;
}

/**
 * Deduplicates transactions by canonical transaction code (uppercase trimmed),
 * giving precedence to VERIFIED status over PENDING or REJECTED.
 * Deterministically sorts newest-first.
 */
export function deduplicateAndSortTransactions(
  transactions: SubscriptionTransaction[]
): SubscriptionTransaction[] {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  const map = new Map<string, SubscriptionTransaction>();

  for (const rawTx of transactions) {
    const rawNumber = rawTx.transactionNumber || rawTx.id || '';
    const key = rawNumber.trim().toUpperCase();
    if (!key) continue;

    const normalizedStatus = normalizeTransactionStatus(rawTx.status);
    const candidate: SubscriptionTransaction = {
      ...rawTx,
      transactionNumber: key,
      status: normalizedStatus,
    };

    if (!map.has(key)) {
      map.set(key, candidate);
      continue;
    }

    const existing = map.get(key)!;
    // Status priority: VERIFIED (3) > PENDING_VERIFICATION (2) > REJECTED (1)
    const priority = (s: TransactionCanonicalStatus): number => {
      if (s === 'VERIFIED') return 3;
      if (s === 'PENDING_VERIFICATION') return 2;
      return 1;
    };

    if (priority(candidate.status) > priority(existing.status)) {
      map.set(key, { ...existing, ...candidate, status: candidate.status });
    } else {
      // Keep existing status, but update any missing fields
      map.set(key, {
        ...candidate,
        ...existing,
        status: existing.status,
      });
    }
  }

  const list = Array.from(map.values());

  // Sort newest first
  return list.sort((a, b) => {
    const getTimestamp = (val: any): number => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (val.seconds) return val.seconds * 1000;
      if (typeof val.toDate === 'function') return val.toDate().getTime();
      const d = new Date(val);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const timeB = getTimestamp(b.createdAt) || getTimestamp(b.updatedAt);
    const timeA = getTimestamp(a.createdAt) || getTimestamp(a.updatedAt);
    return timeB - timeA;
  });
}
