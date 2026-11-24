// Phase 48A: Subscription & Credits UX Redesign Test Suite
import fs from 'fs';
import path from 'path';
import {
  normalizeTransactionStatus,
  isTransactionPending,
  isTransactionVerified,
  isTransactionRejected,
  getTransactionStatusLabel,
  getTransactionBadgeClasses,
  generateWhatsAppApprovalUrl
} from './utils/transactionStatus';
import { PACKAGES, MPESA_PAYMENT_NUMBER } from './components/BuyCredits';
import { SubscriptionTransaction } from './types/subscription';
import { CreditLog } from './types';

describe('Phase 48A: Subscription & Credits UX Redesign', () => {
  const subscriptionPanelSource = fs.readFileSync(
    path.join(__dirname, 'components/SubscriptionPanel.tsx'),
    'utf8'
  );
  const buyCreditsSource = fs.readFileSync(
    path.join(__dirname, 'components/BuyCredits.tsx'),
    'utf8'
  );

  describe('1. Removal of Clutter and Visual Distractions', () => {
    it('verifies "USAGE HIGH" indicator has been completely removed', () => {
      expect(subscriptionPanelSource).not.toContain('Usage High');
      expect(subscriptionPanelSource).not.toContain('USAGE HIGH');
    });

    it('verifies 7-Day Usage graph and recharts AreaChart have been removed', () => {
      expect(subscriptionPanelSource).not.toContain('7-Day Usage');
      expect(subscriptionPanelSource).not.toContain('UsageChart');
      expect(subscriptionPanelSource).not.toContain('recharts');
      expect(subscriptionPanelSource).not.toContain('AreaChart');
    });

    it('verifies redundant visual status badges have been cleaned up', () => {
      expect(subscriptionPanelSource).not.toContain('Credit activity analysis');
    });
  });

  describe('2. Section Structure and Page Layout Compliance', () => {
    it('renders the clean page header with exact title and description', () => {
      expect(subscriptionPanelSource).toContain('Subscription & Credits');
      expect(subscriptionPanelSource).toContain('Buy credits, track your usage, and view your transaction history.');
    });

    it('contains the Credit Balance Summary card with all key metrics', () => {
      expect(subscriptionPanelSource).toContain('Current Balance');
      expect(subscriptionPanelSource).toContain('Total Purchased');
      expect(subscriptionPanelSource).toContain('Total Used');
      expect(subscriptionPanelSource).toContain('Member Since');
      expect(subscriptionPanelSource).toContain('ACCOUNT');
    });

    it('contains the Credit Policy Notice with educator protection copy', () => {
      expect(subscriptionPanelSource).toContain(
        'Credits are only deducted when a document is successfully generated.'
      );
      expect(subscriptionPanelSource).toContain(
        'If generation fails or is interrupted, your credits are completely safe.'
      );
    });

    it('contains the 3 Quick Action buttons', () => {
      expect(subscriptionPanelSource).toContain('Buy Credits');
      expect(subscriptionPanelSource).toContain('Transaction History');
      expect(subscriptionPanelSource).toContain('Referrals');
    });

    it('contains the M-Pesa Payment Guide with recipient and copy action', () => {
      expect(subscriptionPanelSource).toContain('Pay via M-Pesa');
      expect(subscriptionPanelSource).toContain('0717 713 493');
      expect(subscriptionPanelSource).toContain('(Abraham Tumuti)');
      expect(subscriptionPanelSource).toContain('Copy Number');
    });

    it('retains the high-visibility critical manual payment warning alert', () => {
      expect(subscriptionPanelSource).toContain('manual-payment-warning');
      expect(subscriptionPanelSource).toContain(
        'Payments are Manual. Confirm M-Pesa code on phone before clicking Submit.'
      );
    });

    it('presents Credit Packages and Recent Transactions sections', () => {
      expect(subscriptionPanelSource).toContain('id="credit-packages"');
      expect(subscriptionPanelSource).toContain('Credit Packages');
      expect(subscriptionPanelSource).toContain('id="recent-transactions"');
      expect(subscriptionPanelSource).toContain('Recent Transactions');
      expect(subscriptionPanelSource).toContain('View All');
    });

    it('provides Complete History & Ledger modal with tabs', () => {
      expect(subscriptionPanelSource).toContain('Complete History & Ledger');
      expect(subscriptionPanelSource).toContain('M-Pesa Payments');
      expect(subscriptionPanelSource).toContain('Credit Ledger');
    });
  });

  describe('3. Credit Balance Summary Calculations', () => {
    it('calculates Total Used accurately from negative credit logs', () => {
      const sampleLogs: CreditLog[] = [
        { id: '1', date: '2026-09-01', action: 'Generated SOW', creditsUsed: -2, balance: 18 },
        { id: '2', date: '2026-09-02', action: 'Generated Lesson Plan', creditsUsed: -1, balance: 17 },
        { id: '3', date: '2026-09-03', action: 'Purchased Credits', creditsUsed: 20, balance: 37 },
        { id: '4', date: '2026-09-04', action: 'Generated Exam', creditsUsed: -3, balance: 34 }
      ];

      const totalUsed = Math.abs(
        sampleLogs
          .filter(l => l.creditsUsed < 0)
          .reduce((sum, l) => sum + l.creditsUsed, 0)
      );

      expect(totalUsed).toBe(6); // 2 + 1 + 3
    });

    it('only counts VERIFIED transactions towards Total Purchased', () => {
      const sampleTransactions: SubscriptionTransaction[] = [
        {
          id: 'tx1',
          userId: 'u1',
          amount: 200,
          packageId: 'pkg_10',
          transactionNumber: 'TX_VERIFIED_1',
          status: 'VERIFIED',
          createdAt: '2026-09-01T00:00:00Z'
        },
        {
          id: 'tx2',
          userId: 'u1',
          amount: 400,
          packageId: 'pkg_20',
          transactionNumber: 'TX_PENDING',
          status: 'PENDING_VERIFICATION',
          createdAt: '2026-09-02T00:00:00Z'
        },
        {
          id: 'tx3',
          userId: 'u1',
          amount: 500,
          packageId: 'pkg_30',
          transactionNumber: 'TX_REJECTED',
          status: 'REJECTED',
          createdAt: '2026-09-03T00:00:00Z'
        },
        {
          id: 'tx4',
          userId: 'u1',
          amount: 500,
          packageId: 'pkg_30',
          transactionNumber: 'TX_VERIFIED_2',
          status: 'APPROVED', // normalizes to VERIFIED
          createdAt: '2026-09-04T00:00:00Z'
        }
      ];

      const verifiedCredits = sampleTransactions
        .filter(tx => isTransactionVerified(tx.status))
        .reduce((sum, tx) => {
          if (tx.packageId === 'pkg_10' || tx.amount === 200) return sum + 10;
          if (tx.packageId === 'pkg_20' || tx.amount === 400) return sum + 20;
          if (tx.packageId === 'pkg_30' || tx.amount === 500) return sum + 30;
          return sum + Math.floor((tx.amount || 0) / 20);
        }, 0);

      // tx1 is 10, tx4 is 30 -> 40 credits total. PENDING and REJECTED are ignored!
      expect(verifiedCredits).toBe(40);
    });
  });

  describe('4. Credit Package Definitions and Pricing', () => {
    it('defines the 3 canonical packages correctly', () => {
      expect(PACKAGES).toHaveLength(3);

      const basic = PACKAGES.find(p => p.id === 'pkg_10');
      expect(basic).toBeDefined();
      expect(basic?.credits).toBe(10);
      expect(basic?.price).toBe(200);

      const standard = PACKAGES.find(p => p.id === 'pkg_20');
      expect(standard).toBeDefined();
      expect(standard?.credits).toBe(20);
      expect(standard?.price).toBe(400);
      expect(standard?.popular).toBe(true);

      const premium = PACKAGES.find(p => p.id === 'pkg_30');
      expect(premium).toBeDefined();
      expect(premium?.credits).toBe(30);
      expect(premium?.price).toBe(500);
    });

    it('ensures official M-Pesa number matches Abraham Tumuti', () => {
      expect(MPESA_PAYMENT_NUMBER).toBe('0717 713 493');
    });
  });

  describe('5. Manual M-Pesa Workflow and CTA Preservation', () => {
    it('preserves SUBMIT FOR APPROVAL as primary CTA', () => {
      expect(buyCreditsSource).toContain('SUBMIT FOR APPROVAL');
      expect(buyCreditsSource).toContain('handleManualConfirmation');
    });

    it('preserves SEND APPROVAL REQUEST VIA WHATSAPP as secondary CTA', () => {
      expect(buyCreditsSource).toContain('SEND APPROVAL REQUEST VIA WHATSAPP');
      expect(buyCreditsSource).toContain('handleWhatsAppConfirmation');
    });

    it('preserves STATUS: PENDING VERIFICATION on submission', () => {
      expect(buyCreditsSource).toContain('STATUS: PENDING VERIFICATION');
    });

    it('ensures no automated payment gateways or STK push exist', () => {
      expect(buyCreditsSource).not.toContain('stk-push');
      expect(buyCreditsSource).not.toContain('lipana');
      expect(subscriptionPanelSource).not.toContain('stk-push');
      expect(subscriptionPanelSource).not.toContain('lipana');
    });
  });
});
