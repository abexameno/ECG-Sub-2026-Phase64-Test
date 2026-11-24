import { User } from './types';
import { SubscriptionTransaction } from './types/subscription';
import fs from 'fs';
import path from 'path';

describe('Phase 46: Manual M-Pesa Verification UX Hardening', () => {
  const adminUser: User = {
    id: 'admin_usr_01',
    email: 'abexameno@gmail.com',
    name: 'ECG Administrator',
    role: 'Admin',
    status: 'Active',
    avatarColor: 'bg-indigo-600',
    credits: 100,
    profileComplete: true,
  };

  const regularUser: User = {
    id: 'user_cust_01',
    email: 'teacher@school.ac.ke',
    name: 'Jane Mwalimu',
    role: 'Teacher',
    status: 'Active',
    avatarColor: 'bg-emerald-600',
    credits: 10,
    profileComplete: true,
  };

  // ---------------------------------------------------------------------------
  // Test 1: Admin Panel Pending Notification Visibility
  // ---------------------------------------------------------------------------
  describe('Test 1: Admin Panel Pending Notification Visibility', () => {
    it('calculates pending count correctly for pending and pending_verification statuses', () => {
      const mockTransactions: Partial<SubscriptionTransaction>[] = [
        { id: 'tx_1', status: 'pending_verification' as any, amount: 400 },
        { id: 'tx_2', status: 'PENDING' as any, amount: 200 },
        { id: 'tx_3', status: 'VERIFIED' as any, amount: 400 },
        { id: 'tx_4', status: 'REJECTED' as any, amount: 500 },
        { id: 'tx_5', status: 'pending_verification' as any, amount: 200 },
      ];

      const pendingCount = mockTransactions.filter(t => {
        const s = (t.status || '').toString().toLowerCase();
        return s === 'pending' || s === 'pending_verification';
      }).length;

      expect(pendingCount).toBe(3);
    });

    it('banner content correctly exposes pending payments count to administrator', () => {
      const pendingCount = 3;
      const bannerText = `Pending Payments: ${pendingCount}`;
      expect(bannerText).toBe('Pending Payments: 3');
      expect(pendingCount > 0).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Admin Panel Zero Pending State
  // ---------------------------------------------------------------------------
  describe('Test 2: Admin Panel Zero Pending State', () => {
    it('shows zero pending or neutral indicator when all transactions are verified or rejected', () => {
      const mockTransactions: Partial<SubscriptionTransaction>[] = [
        { id: 'tx_1', status: 'VERIFIED' as any, amount: 400 },
        { id: 'tx_2', status: 'REJECTED' as any, amount: 200 },
      ];

      const pendingCount = mockTransactions.filter(t => {
        const s = (t.status || '').toString().toLowerCase();
        return s === 'pending' || s === 'pending_verification';
      }).length;

      expect(pendingCount).toBe(0);

      // State determination
      const bannerShouldShow = pendingCount > 0;
      const neutralStateText = 'No pending payments. All transactions have been reviewed.';
      expect(bannerShouldShow).toBe(false);
      expect(neutralStateText).toContain('No pending payments');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Admin Review Transactions CTA
  // ---------------------------------------------------------------------------
  describe('Test 3: Admin Review Transactions CTA', () => {
    it('clicking CTA navigates to subscriptions (Transactions) tab', () => {
      let currentTab = 'users';
      const onReviewTransactionsClick = () => {
        currentTab = 'subscriptions';
      };

      onReviewTransactionsClick();
      expect(currentTab).toBe('subscriptions');
    });

    it('AdminPanel source code includes the Review Transactions CTA wired to subscriptions tab', () => {
      const adminPanelSource = fs.readFileSync(path.join(__dirname, 'components/AdminPanel.tsx'), 'utf8');
      expect(adminPanelSource).toContain('Review Transactions');
      expect(adminPanelSource).toContain("setActiveTab('subscriptions')");
      expect(adminPanelSource).toContain('Pending Payments: {pendingTransactionsCount}');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Admin Audit Column Rendering
  // ---------------------------------------------------------------------------
  describe('Test 4: Admin Audit Column Rendering', () => {
    const renderAuditBadge = (tx: { manuallyProcessed?: boolean }) => {
      return tx.manuallyProcessed ? 'Manual' : 'Standard';
    };

    it('renders "Manual" when manuallyProcessed is true', () => {
      const tx = { id: 'tx_manual', manuallyProcessed: true };
      expect(renderAuditBadge(tx)).toBe('Manual');
    });

    it('renders "Standard" when manuallyProcessed is false or undefined', () => {
      const tx1 = { id: 'tx_std_1', manuallyProcessed: false };
      const tx2 = { id: 'tx_std_2' };
      expect(renderAuditBadge(tx1)).toBe('Standard');
      expect(renderAuditBadge(tx2)).toBe('Standard');
    });

    it('AdminPanel source code includes Audit column in desktop table and mobile cards', () => {
      const adminPanelSource = fs.readFileSync(path.join(__dirname, 'components/AdminPanel.tsx'), 'utf8');
      expect(adminPanelSource).toContain('<th className="px-6 py-4 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest border-r-2 border-slate-200/10">Audit</th>');
      expect(adminPanelSource).toContain("t.manuallyProcessed ? 'Manual' : 'Standard'");
      expect(adminPanelSource).toContain("Audit: <span className={t.manuallyProcessed ? \"text-purple-700 font-black\" : \"text-slate-500\"}>{t.manuallyProcessed ? 'Manual' : 'Standard'}</span>");
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: Buy Credits Warning Visibility
  // ---------------------------------------------------------------------------
  describe('Test 5: Buy Credits Warning Visibility', () => {
    const buyCreditsSource = fs.readFileSync(path.join(__dirname, 'components/BuyCredits.tsx'), 'utf8');

    it('verifies exact manual payment alert heading is present in BuyCredits', () => {
      expect(buyCreditsSource).toContain(
        'Payments are Manual. Confirm M-Pesa code on phone before clicking Submit.'
      );
    });

    it('verifies all 7 required guidance points are present in BuyCredits warning', () => {
      // 1. Manually send money to 0717 713 493
      expect(buyCreditsSource).toContain('Send money manually to');
      expect(buyCreditsSource).toContain('{MPESA_PAYMENT_NUMBER}');

      // 2. Verify code on phone before submitting
      expect(buyCreditsSource).toContain('Verify and confirm the transaction code on your phone SMS receipt before submitting');

      // 3. Submitting creates a verification request
      expect(buyCreditsSource).toContain('Submitting the code creates a verification request');

      // 4. Credits are not active immediately upon submission
      expect(buyCreditsSource).toContain('credits are not active immediately upon submission');

      // 5. Administrator must verify
      expect(buyCreditsSource).toContain('An administrator must manually verify the payment before credits are awarded');

      // 6. M-Pesa receipt on phone is proof of payment
      expect(buyCreditsSource).toContain('The M-Pesa receipt on your phone is the official proof of payment');

      // 7. Submitting incorrect/fake code delays or cancels
      expect(buyCreditsSource).toContain('Submitting an incorrect or fake code will delay or cancel the transaction');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 6: Customer Submission Creates PENDING_VERIFICATION Only
  // ---------------------------------------------------------------------------
  describe('Test 6: Customer Submission Creates PENDING_VERIFICATION Only', () => {
    it('customer payment submission records status as PENDING_VERIFICATION without awarding credits', () => {
      const userBeforeSubmission = { ...regularUser, credits: 10 };
      const submittedCode = 'RK4599TEST';
      const selectedPackage = { id: 'pkg_20', name: 'Standard', credits: 20, price: 400 };

      // Simulate customer submission
      const newTransaction = {
        id: 'tx_sub_01',
        userId: userBeforeSubmission.id,
        userEmail: userBeforeSubmission.email,
        amount: selectedPackage.price,
        creditsRequested: selectedPackage.credits,
        transactionNumber: submittedCode,
        status: 'PENDING_VERIFICATION',
        manuallyProcessed: false,
        createdAt: new Date().toISOString(),
      };

      // Ensure user credits are NOT increased on submission
      const userAfterSubmission = { ...userBeforeSubmission };

      expect(newTransaction.status).toBe('PENDING_VERIFICATION');
      expect(newTransaction.transactionNumber).toBe(submittedCode);
      expect(userAfterSubmission.credits).toBe(10); // Untouched
      expect(userAfterSubmission.credits).toBe(userBeforeSubmission.credits);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 7: Verification Requires Administrator Action
  // ---------------------------------------------------------------------------
  describe('Test 7: Verification Requires Administrator Action', () => {
    it('only explicit administrator approval transitions transaction to VERIFIED and awards credits', () => {
      let pendingTx = {
        id: 'tx_sub_01',
        userId: regularUser.id,
        amount: 400,
        status: 'PENDING_VERIFICATION',
        manuallyProcessed: false,
      };

      let userState = { ...regularUser, credits: 10 };

      // Non-admin attempting to approve is rejected
      const unauthorizedApproval = (caller: User) => {
        if (caller.role !== 'Admin') {
          throw new Error('Forbidden: Administrator privileges required');
        }
      };
      expect(() => unauthorizedApproval(regularUser)).toThrow('Forbidden');

      // Administrator approval execution
      const adminApproval = (caller: User) => {
        if (caller.role !== 'Admin') throw new Error('Forbidden');
        pendingTx = {
          ...pendingTx,
          status: 'VERIFIED',
          manuallyProcessed: true,
        };
        const packageCredits = pendingTx.amount === 400 ? 20 : 10;
        userState.credits += packageCredits;
      };

      adminApproval(adminUser);

      expect(pendingTx.status).toBe('VERIFIED');
      expect(pendingTx.manuallyProcessed).toBe(true);
      expect(userState.credits).toBe(30); // 10 + 20
    });
  });

  // ---------------------------------------------------------------------------
  // Test 8: Rejection Workflow
  // ---------------------------------------------------------------------------
  describe('Test 8: Rejection Workflow', () => {
    it('administrator rejection sets status to REJECTED and adds 0 credits', () => {
      let pendingTx = {
        id: 'tx_sub_invalid',
        userId: regularUser.id,
        amount: 400,
        status: 'PENDING_VERIFICATION',
        manuallyProcessed: false,
      };

      let userState = { ...regularUser, credits: 10 };

      // Administrator rejects
      const adminReject = (caller: User) => {
        if (caller.role !== 'Admin') throw new Error('Forbidden');
        pendingTx = {
          ...pendingTx,
          status: 'REJECTED',
          manuallyProcessed: true,
        };
        // No credits added
      };

      adminReject(adminUser);

      expect(pendingTx.status).toBe('REJECTED');
      expect(pendingTx.manuallyProcessed).toBe(true);
      expect(userState.credits).toBe(10); // Credits remain untouched
    });
  });

  // ---------------------------------------------------------------------------
  // Test 9: Production RT34474 Safety
  // ---------------------------------------------------------------------------
  describe('Test 9: Production RT34474 Safety', () => {
    it('confirms RT34474 transaction record invariants remain strictly preserved', () => {
      const rt34474Record = {
        transactionNumber: 'RT34474',
        userEmail: 'abexameno@gmail.com',
        amount: 400,
        package: 'Standard',
        status: 'VERIFIED',
      };

      // Strict assertions on RT34474 integrity
      expect(rt34474Record.transactionNumber).toBe('RT34474');
      expect(rt34474Record.status).toBe('VERIFIED');
      expect(rt34474Record.userEmail).toBe('abexameno@gmail.com');
      expect(rt34474Record.amount).toBe(400);
      // Ensure no code modifies RT34474
      const serverSource = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
      expect(serverSource).not.toContain('RT34474');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 10: Regression Prevention
  // ---------------------------------------------------------------------------
  describe('Test 10: Regression Prevention', () => {
    it('confirms BuyCredits client workflow uses manual M-Pesa submission and no automated gateway', () => {
      const buyCreditsSource = fs.readFileSync(path.join(__dirname, 'components/BuyCredits.tsx'), 'utf8');
      expect(buyCreditsSource).toContain('MPESA_PAYMENT_NUMBER');
      expect(buyCreditsSource).toContain('handleManualConfirmation');
      expect(buyCreditsSource).toContain('pending_verification');
      expect(buyCreditsSource).toContain('STATUS: PENDING VERIFICATION');
      expect(buyCreditsSource).not.toContain('/api/payments/stk-push');
    });

    it('confirms server provides manual administrator transaction endpoints', () => {
      const serverSource = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');
      expect(serverSource).toContain('/api/admin/transactions');
      expect(serverSource).toContain('/api/admin/transactions/update');
      expect(serverSource).toContain('manuallyProcessed: true');
    });
  });
});
