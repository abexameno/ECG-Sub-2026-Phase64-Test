# Phase 43 Documentation: Subscription Payment Instructions & Pre-Launch UX Polish

## 1. Objective
Phase 43 enhances the Subscription & Credits user experience on the Exameno CBE Content Generator (ECG) platform before public launch. It provides clear, unambiguous payment instructions for Kenyan teachers, establishing a transparent manual M-Pesa payment workflow while preserving the server-authoritative credit architecture.

---

## 2. Current Payment Workflow
The MVP payment workflow remains simple, secure, and server-authoritative:

```
CHOOSE PACKAGE
      ↓
PAY VIA M-PESA (0717 713 493)
      ↓
ENTER TRANSACTION NUMBER
      ↓
CONFIRM PAYMENT VIA WHATSAPP (0717 713 493)
      ↓
ECG ADMIN VERIFIES PAYMENT
      ↓
CREDITS ACTIVATED
```

---

## 3. Approved Package Pricing
- **BASIC**: 10 Credits — **KES 200**
- **STANDARD**: 20 Credits — **KES 400**
- **PREMIUM**: 30 Credits — **KES 500**

---

## 4. Approved M-Pesa & WhatsApp Number
- **M-Pesa Payment Number**: `0717 713 493`
- **WhatsApp Confirmation Number**: `0717 713 493` (Clean format: `254717713493`)

---

## 5. Transaction Number Process & Validation
- Teachers enter their M-Pesa transaction reference (e.g., `QK89X123AB`) received via SMS.
- Empty or whitespace transaction submissions are strictly rejected client-side and server-side.
- The transaction reference is stored in the `transactions` Firestore collection with status `PENDING_VERIFICATION`.
- **Entering a transaction number does NOT automatically grant credits.**

---

## 6. WhatsApp Confirmation
- Teachers tap **"Confirm Payment via WhatsApp"** to launch WhatsApp pointing to `254717713493`.
- Generates a prefilled message containing:
  - Package Name & Amount (e.g. `Ksh 200 for Basic Package`)
  - Transaction Reference
  - Account Email
- Does NOT contain any passwords, tokens, API keys, or sensitive credentials.

---

## 7. Manual Admin Verification & Payment Authority
- **Teacher Authority**: Chooses package, makes M-Pesa payment, inputs transaction number, sends confirmation details.
- **ECG Authority**: Receives request, verifies M-Pesa receipt in administrative portal, approves/rejects payment.
- **Server Authority**: `/api/admin/transactions/update` updates transaction status to `VERIFIED` and atomically increments user credits.
- Teachers cannot approve their own payments or modify transaction statuses.

---

## 8. Payment States
1. `PENDING_VERIFICATION` (Amber Badge): Submitted by teacher, awaiting admin verification.
2. `VERIFIED` (Green Badge): Payment verified by ECG administrator; credits activated.
3. `REJECTED` (Red Badge): Invalid or unverified transaction reference.

---

## 9. Credit Activation & Policy
- **Onboarding Bonus**: 5 free credits awarded once upon completing first-login profile onboarding.
- **Generation Deduction Rules**:
  - SOW / CBA = **2 Credits**
  - LESSON PLAN = **1 Credit**
  - QUIZ / ROWC = **1 Credit**
- **Failed Generation Protection**: Credits are deducted only upon successful content creation. Failed attempts consume 0 credits.

---

## 10. Idempotency & Security
- **Duplicate Submission Protection**: `SubscriptionService.createTransaction` checks if a transaction number already exists in `transactions` and rejects duplicates.
- **Duplicate Admin Verification Protection**: `/api/admin/transactions/update` checks if transaction is already marked as `VERIFIED` and skips duplicate credit allocation.
- **No Client-Side Self-Granting**: Credit mutations occur exclusively via server-side endpoints with `requireAdmin` or `verifyAuthToken` authorization.

---

## 11. Auditability
- Administrative transaction updates are logged with `processedBy` administrator UID and server timestamps.
- User credit adjustments generate structured ledger entries in `user.creditLogs`.

---

## 12. Mobile UX Polish
- Responsive layout optimized for Android mobile screens.
- Comfort touch targets (minimum 44px).
- Prominent M-Pesa number display with one-tap copy functionality ("Copied!" feedback).
- Zero horizontal overflow or clipped text fields.

---

## 13. Payment FAQ
1. **How do I buy credits?**
   Choose a package, pay the exact amount to 0717 713 493 via M-Pesa, enter your transaction number, and confirm the payment via WhatsApp.
2. **When will my credits be activated?**
   Your credits are activated after an ECG administrator verifies your M-Pesa payment.
3. **Does entering the transaction number automatically activate credits?**
   No. ECG must verify the payment first before credits are activated.
4. **What if I enter the wrong transaction number?**
   Your payment will not be activated until the correct transaction reference is verified by an ECG administrator.
5. **Can I use my free credits first?**
   Yes. New users receive 5 free credits after completing their first-time profile setup.
6. **What happens when my credits run out?**
   You can purchase another credit package using the same M-Pesa process at any time.

---

## 14. Test Results
- **Phase 43 Test Suite**: `phase43SubscriptionPaymentUX.test.ts` passed (18/18 tests passed).
- **TypeScript Compilation**: Clean (`tsc --noEmit` passed).
- **Linter Status**: Clean (`lint_applet` passed).

---

## 15. Known Limitations & Deferred Work
- **Automated M-Pesa STK Push / Lipana Integration**: Permanently retired and removed from architecture.
- **External Payment Webhook (`EXTERNAL_WEBHOOK_URL`)**: Permanently retired and removed from architecture.
- **Automated Reconciliation**: Deferred to future release. The manual verification model remains the approved pre-launch MVP workflow.

---

## CURRENT MVP PAYMENT MODEL
`M-Pesa → Transaction Number → WhatsApp Confirmation → Admin Verification → Credit Activation`
