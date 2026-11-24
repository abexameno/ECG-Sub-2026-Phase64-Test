// Phase 48 Jest test suite
import {
  normalizeTransactionStatus,
  isTransactionPending,
  isTransactionVerified,
  isTransactionRejected,
  getTransactionStatusLabel,
  getTransactionBadgeClasses,
  formatKenyanPhoneForWhatsApp,
  generateWhatsAppApprovalUrl,
  generateWhatsAppReceiptUrl,
  deduplicateAndSortTransactions,
  ADMIN_WHATSAPP_PHONE,
  ADMIN_MPESA_NUMBER
} from './utils/transactionStatus';
import { SubscriptionTransaction } from './types/subscription';

describe('Phase 48: Transaction Synchronization & WhatsApp Communication', () => {

  describe('1. Canonical Status Normalization', () => {
    it('normalizes all pending status variants to PENDING_VERIFICATION', () => {
      expect(normalizeTransactionStatus('pending')).toBe('PENDING_VERIFICATION');
      expect(normalizeTransactionStatus('PENDING')).toBe('PENDING_VERIFICATION');
      expect(normalizeTransactionStatus('pending_verification')).toBe('PENDING_VERIFICATION');
      expect(normalizeTransactionStatus('PENDING_VERIFICATION')).toBe('PENDING_VERIFICATION');
      expect(normalizeTransactionStatus('under_review')).toBe('PENDING_VERIFICATION');
      expect(normalizeTransactionStatus(undefined)).toBe('PENDING_VERIFICATION');
      expect(normalizeTransactionStatus(null)).toBe('PENDING_VERIFICATION');
      expect(normalizeTransactionStatus('')).toBe('PENDING_VERIFICATION');
    });

    it('normalizes all successful/verified status variants to VERIFIED', () => {
      expect(normalizeTransactionStatus('verified')).toBe('VERIFIED');
      expect(normalizeTransactionStatus('VERIFIED')).toBe('VERIFIED');
      expect(normalizeTransactionStatus('success')).toBe('VERIFIED');
      expect(normalizeTransactionStatus('SUCCESS')).toBe('VERIFIED');
      expect(normalizeTransactionStatus('successful')).toBe('VERIFIED');
      expect(normalizeTransactionStatus('SUCCESSFUL')).toBe('VERIFIED');
      expect(normalizeTransactionStatus('completed')).toBe('VERIFIED');
      expect(normalizeTransactionStatus('COMPLETED')).toBe('VERIFIED');
      expect(normalizeTransactionStatus('approved')).toBe('VERIFIED');
      expect(normalizeTransactionStatus('APPROVED')).toBe('VERIFIED');
    });

    it('normalizes all failed/rejected status variants to REJECTED', () => {
      expect(normalizeTransactionStatus('rejected')).toBe('REJECTED');
      expect(normalizeTransactionStatus('REJECTED')).toBe('REJECTED');
      expect(normalizeTransactionStatus('failed')).toBe('REJECTED');
      expect(normalizeTransactionStatus('FAILED')).toBe('REJECTED');
      expect(normalizeTransactionStatus('declined')).toBe('REJECTED');
      expect(normalizeTransactionStatus('DECLINED')).toBe('REJECTED');
      expect(normalizeTransactionStatus('cancelled')).toBe('REJECTED');
      expect(normalizeTransactionStatus('CANCELLED')).toBe('REJECTED');
    });

    it('provides accurate status predicates', () => {
      expect(isTransactionPending('pending')).toBe(true);
      expect(isTransactionPending('VERIFIED')).toBe(false);
      expect(isTransactionPending('FAILED')).toBe(false);

      expect(isTransactionVerified('SUCCESS')).toBe(true);
      expect(isTransactionVerified('VERIFIED')).toBe(true);
      expect(isTransactionVerified('pending')).toBe(false);

      expect(isTransactionRejected('failed')).toBe(true);
      expect(isTransactionRejected('REJECTED')).toBe(true);
      expect(isTransactionRejected('VERIFIED')).toBe(false);
    });

    it('enforces UI status consistency between Admin and User views', () => {
      const statuses = ['pending', 'PENDING_VERIFICATION', 'success', 'VERIFIED', 'failed', 'REJECTED'];
      statuses.forEach(status => {
        const canonical = normalizeTransactionStatus(status);
        const userLabel = getTransactionStatusLabel(status, 'user');
        const adminLabel = getTransactionStatusLabel(status, 'admin');

        // Canonical mapping must be identical
        if (canonical === 'VERIFIED') {
          expect(userLabel).toContain('VERIFIED');
          expect(adminLabel).toBe('VERIFIED');
        } else if (canonical === 'PENDING_VERIFICATION') {
          expect(userLabel).toContain('PENDING');
          expect(adminLabel).toBe('PENDING_VERIFICATION');
        } else if (canonical === 'REJECTED') {
          expect(userLabel).toContain('REJECTED');
          expect(adminLabel).toBe('REJECTED');
        }
      });
    });

    it('returns consistent badge color classes for each canonical status', () => {
      const pendingBadge = getTransactionBadgeClasses('pending');
      expect(pendingBadge.full).toContain('amber');

      const verifiedBadge = getTransactionBadgeClasses('VERIFIED');
      expect(verifiedBadge.full).toContain('emerald');

      const rejectedBadge = getTransactionBadgeClasses('failed');
      expect(rejectedBadge.full).toContain('rose');
    });
  });

  describe('2. Kenyan Phone Number Formatting for WhatsApp', () => {
    it('formats local 07... numbers to 2547...', () => {
      expect(formatKenyanPhoneForWhatsApp('0717713493')).toBe('254717713493');
      expect(formatKenyanPhoneForWhatsApp('0712345678')).toBe('254712345678');
    });

    it('formats local 01... numbers to 2541...', () => {
      expect(formatKenyanPhoneForWhatsApp('0112345678')).toBe('254112345678');
    });

    it('strips leading plus sign and spaces', () => {
      expect(formatKenyanPhoneForWhatsApp('+254 717 713 493')).toBe('254717713493');
      expect(formatKenyanPhoneForWhatsApp('254 712 345 678')).toBe('254712345678');
    });

    it('handles 7... numbers without leading zero', () => {
      expect(formatKenyanPhoneForWhatsApp('717713493')).toBe('254717713493');
    });

    it('falls back gracefully to cleaned digits if not standard Kenyan format', () => {
      expect(formatKenyanPhoneForWhatsApp('1234567890')).toBe('1234567890');
      expect(formatKenyanPhoneForWhatsApp('')).toBe('');
    });
  });

  describe('3. User WhatsApp Approval Request Generation', () => {
    it('targets the authoritative Admin WhatsApp phone number', () => {
      const url = generateWhatsAppApprovalUrl({
        transactionNumber: 'QK89X123AB',
        amount: 250,
        userEmail: 'teacher@school.ac.ke'
      });

      expect(url).toContain(`https://wa.me/${ADMIN_WHATSAPP_PHONE}`);
      expect(ADMIN_WHATSAPP_PHONE).toBe('254717713493');
      expect(ADMIN_MPESA_NUMBER).toBe('0717 713 493');
    });

    it('includes all necessary transaction verification details in pre-filled text', () => {
      const url = generateWhatsAppApprovalUrl({
        transactionNumber: 'QK89X123AB',
        amount: 500,
        userEmail: 'teacher@school.ac.ke',
        packageName: 'Termly Booster'
      });

      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('QK89X123AB');
      expect(decoded).toContain('500');
      expect(decoded).toContain('teacher@school.ac.ke');
      expect(decoded).toContain('Termly Booster');
      expect(decoded).toContain('Please verify my payment');
    });

    it('works cleanly even when optional package name is omitted', () => {
      const url = generateWhatsAppApprovalUrl({
        transactionNumber: 'RT34474',
        amount: 150,
        userEmail: 'abexameno@gmail.com'
      });

      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('RT34474');
      expect(decoded).toContain('150');
      expect(decoded).toContain('abexameno@gmail.com');
    });
  });

  describe('4. Admin WhatsApp Verified Payment Receipt Generation', () => {
    it('generates a pre-filled receipt addressed to customer phone number', () => {
      const url = generateWhatsAppReceiptUrl({
        transactionNumber: 'RT34474',
        amount: 300,
        userName: 'Wanjiku Kamau',
        userEmail: 'wanjiku@gmail.com',
        date: '10 Sep 2026'
      }, '0722000000');

      expect(url).toContain('https://wa.me/254722000000');
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('OFFICIAL PAYMENT RECEIPT');
      expect(decoded).toContain('RT34474');
      expect(decoded).toContain('300');
      expect(decoded).toContain('Wanjiku Kamau');
      expect(decoded).toContain('wanjiku@gmail.com');
      expect(decoded).toContain('VERIFIED (Credits Activated)');
    });

    it('falls back to admin phone number if customer phone is not provided', () => {
      const url = generateWhatsAppReceiptUrl({
        transactionNumber: 'QK99999',
        amount: 100
      });

      expect(url).toContain(`https://wa.me/${ADMIN_WHATSAPP_PHONE}`);
    });
  });

  describe('5. Deduplication and Ordering Safeguards', () => {
    it('deduplicates transactions with identical reference numbers and retains VERIFIED state', () => {
      const rawList: SubscriptionTransaction[] = [
        {
          id: 'doc-1',
          userId: 'user-123',
          amount: 250,
          transactionNumber: 'QK89X123AB',
          status: 'PENDING_VERIFICATION',
          createdAt: '2026-09-09T10:00:00Z'
        },
        {
          id: 'doc-2',
          userId: 'user-123',
          amount: 250,
          transactionNumber: 'QK89X123AB',
          status: 'VERIFIED',
          createdAt: '2026-09-09T10:05:00Z'
        }
      ];

      const deduplicated = deduplicateAndSortTransactions(rawList);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].status).toBe('VERIFIED');
    });

    it('sorts transactions newest first', () => {
      const rawList: SubscriptionTransaction[] = [
        {
          id: 'doc-1',
          userId: 'user-123',
          amount: 100,
          transactionNumber: 'TX_OLD',
          status: 'VERIFIED',
          createdAt: '2026-09-01T10:00:00Z'
        },
        {
          id: 'doc-2',
          userId: 'user-123',
          amount: 200,
          transactionNumber: 'TX_NEW',
          status: 'PENDING_VERIFICATION',
          createdAt: '2026-09-10T10:00:00Z'
        }
      ];

      const result = deduplicateAndSortTransactions(rawList);
      expect(result).toHaveLength(2);
      expect(result[0].transactionNumber).toBe('TX_NEW');
      expect(result[1].transactionNumber).toBe('TX_OLD');
    });
  });

  describe('6. Preservation of Manual M-Pesa Architecture (Zero Automated Verification)', () => {
    it('ensures WhatsApp links are purely communication URIs without side effects', () => {
      const approvalUrl = generateWhatsAppApprovalUrl({
        transactionNumber: 'TEST123',
        amount: 200
      });
      const receiptUrl = generateWhatsAppReceiptUrl({
        transactionNumber: 'TEST123',
        amount: 200
      });

      // Validates that URLs are standard WhatsApp deep links
      expect(approvalUrl.startsWith('https://wa.me/')).toBe(true);
      expect(receiptUrl.startsWith('https://wa.me/')).toBe(true);

      // Ensures no fake API callbacks or automated credit endpoints are invoked
      expect(approvalUrl).not.toContain('/api/');
      expect(receiptUrl).not.toContain('/api/');
      expect(approvalUrl).not.toContain('automate');
      expect(receiptUrl).not.toContain('automate');
    });
  });
});
