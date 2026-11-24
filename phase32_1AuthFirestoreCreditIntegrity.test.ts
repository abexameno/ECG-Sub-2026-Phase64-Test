import * as fs from 'fs';
import * as path from 'path';
import {
  AuthoritativeAccountService,
  createInMemoryStorageAdapter,
} from './services/authoritativeAccountService.ts';

describe('Phase 32.1 — Authentication, Firestore Security & Credit Integrity Remediation', () => {
  beforeEach(() => {
    AuthoritativeAccountService.resetInMemoryStore();
  });

  describe('1-7. Authoritative User Initialization, Role Assignment, Welcome Credits & Referral Integrity', () => {
    it('1. New user registration succeeds through the server initialization path', async () => {
      const result = await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'new_teacher_001', email: 'jane.wanjiku@school.ac.ke', emailVerified: true },
        {
          firstName: 'Jane',
          lastName: 'Wanjiku',
          phoneNumber: '0712345678',
          schoolName: 'Nairobi Primary School',
          county: 'Nairobi',
        }
      );

      expect(result.welcomeCreditsGrantedNow).toBe(true);
      expect(result.user.id).toBe('new_teacher_001');
      expect(result.user.role).toBe('Teacher');
      expect(result.user.credits).toBe(5);
      expect(result.user.profileComplete).toBe(true);
      expect(result.user.firstLoginBonusGranted).toBe(true);
    });

    it('2. Client attempt to self-assign role: Admin, isAdmin, schoolId, tenantId, or credits is ignored', async () => {
      const result = await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'attacker_uid', email: 'attacker@school.ac.ke', emailVerified: true },
        {
          firstName: 'Attacker',
          lastName: 'User',
          phoneNumber: '0712345678',
          schoolName: 'Nakuru High School',
          county: 'Nakuru',
          role: 'Admin',
          isAdmin: true,
          schoolId: 'hijacked_school',
          tenantId: 'hijacked_tenant',
          credits: 99999,
        }
      );

      expect(result.user.role).toBe('Teacher');
      expect(result.user.credits).toBe(5);
      expect(result.user.schoolId).toBeUndefined();
      expect(result.user.tenantId).toBeUndefined();
    });

    it('2b. Verified Firebase Custom Claims or existing server-persisted role resolves Admin authority (never client email alone)', () => {
      // Unverified email match without custom claim or existing server doc defaults to Teacher
      const unverifiedEmailRole = AuthoritativeAccountService.resolveAuthoritativeRole(
        { uid: 'u1', email: 'abexameno@gmail.com', claims: {} },
        null
      );
      expect(unverifiedEmailRole).toBe('Teacher');

      // Custom claim admin === true resolves to Admin
      const claimAdminRole = AuthoritativeAccountService.resolveAuthoritativeRole(
        { uid: 'u2', email: 'admin@exameno.com', claims: { admin: true } },
        null
      );
      expect(claimAdminRole).toBe('Admin');

      // Existing server-persisted role resolves to Admin
      const persistedAdminRole = AuthoritativeAccountService.resolveAuthoritativeRole(
        { uid: 'u3', email: 'persisted@exameno.com', claims: {} },
        { role: 'Admin' }
      );
      expect(persistedAdminRole).toBe('Admin');
    });

    it('3. Welcome credits are granted once and never duplicated on repeated initialization or profile completion calls', async () => {
      // Step 1: Initial signup call (initializeOnly: true)
      const firstInit = await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'teacher_idempotent', email: 'idem@school.ac.ke', emailVerified: true },
        { initializeOnly: true, name: 'Mary Atieno' }
      );
      expect(firstInit.welcomeCreditsGrantedNow).toBe(true);
      expect(firstInit.user.credits).toBe(5);

      // Step 2: Retry signup initialization call
      const secondInit = await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'teacher_idempotent', email: 'idem@school.ac.ke', emailVerified: true },
        { initializeOnly: true, name: 'Mary Atieno' }
      );
      expect(secondInit.welcomeCreditsGrantedNow).toBe(false);
      expect(secondInit.user.credits).toBe(5);

      // Step 3: Complete onboarding profile modal call
      const fullOnboarding = await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'teacher_idempotent', email: 'idem@school.ac.ke', emailVerified: true },
        {
          firstName: 'Mary',
          lastName: 'Atieno',
          phoneNumber: '0722334455',
          schoolName: 'Kisumu Girls High School',
          county: 'Kisumu',
        }
      );
      expect(fullOnboarding.welcomeCreditsGrantedNow).toBe(false);
      expect(fullOnboarding.user.credits).toBe(5);
      expect(fullOnboarding.user.profileComplete).toBe(true);
    });

    it('4. Self-referral is rejected', async () => {
      await expect(
        AuthoritativeAccountService.completeOrInitializeProfile(
          { uid: 'self_ref_uid', email: 'self@school.ac.ke', emailVerified: true },
          {
            initializeOnly: true,
            name: 'Self Referrer',
            inviterId: 'self_ref_uid',
          }
        )
      ).rejects.toThrow(/SELF_REFERRAL_REJECTED/);
    });

    it('5. Duplicate referral is rejected', async () => {
      // Create valid inviter first
      await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'inviter_01', email: 'inviter01@school.ac.ke', emailVerified: true },
        { initializeOnly: true, name: 'Inviter One' }
      );

      // First claim succeeds
      const firstClaim = await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'invitee_01', email: 'invitee01@school.ac.ke', emailVerified: true },
        {
          initializeOnly: true,
          name: 'Invitee One',
          inviterId: 'inviter_01',
        }
      );
      expect(firstClaim.referralCreditsGrantedNow).toBe(true);
      expect(firstClaim.user.credits).toBe(15); // 5 welcome + 10 referral

      // Second referral claim on the same account is rejected
      await expect(
        AuthoritativeAccountService.completeOrInitializeProfile(
          { uid: 'invitee_01', email: 'invitee01@school.ac.ke', emailVerified: true },
          {
            firstName: 'Invitee',
            lastName: 'One',
            phoneNumber: '0711223344',
            schoolName: 'Mombasa Primary',
            county: 'Mombasa',
            inviterId: 'inviter_01',
          }
        )
      ).rejects.toThrow(/DUPLICATE_REFERRAL_REJECTED/);
    });

    it('6. Invalid or non-existent inviter is rejected', async () => {
      await expect(
        AuthoritativeAccountService.completeOrInitializeProfile(
          { uid: 'invitee_bad', email: 'invitee.bad@school.ac.ke', emailVerified: true },
          {
            initializeOnly: true,
            name: 'Invitee Bad',
            inviterId: 'non_existent_inviter_999',
          }
        )
      ).rejects.toThrow(/INVALID_INVITER_REJECTED/);
    });

    it('7. Valid referral awards credits atomically once to both inviter and invitee', async () => {
      const adapter = createInMemoryStorageAdapter();
      AuthoritativeAccountService.setStorageAdapter(adapter);

      await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'inviter_atomic', email: 'inviter.atomic@school.ac.ke', emailVerified: true },
        { initializeOnly: true, name: 'Atomic Inviter' },
        adapter
      );

      const inviteeRes = await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'invitee_atomic', email: 'invitee.atomic@school.ac.ke', emailVerified: true },
        {
          initializeOnly: true,
          name: 'Atomic Invitee',
          inviterId: 'inviter_atomic',
        },
        adapter
      );

      expect(inviteeRes.welcomeCreditsGrantedNow).toBe(true);
      expect(inviteeRes.referralCreditsGrantedNow).toBe(true);
      expect(inviteeRes.user.credits).toBe(15);

      const updatedInviter = await adapter.getDoc('users', 'inviter_atomic');
      expect(updatedInviter.credits).toBe(15); // 5 initial + 10 referral reward

      const referralRecord = await adapter.getDoc('referrals', 'ref_invitee_atomic');
      expect(referralRecord).toBeTruthy();
      expect(referralRecord.inviterId).toBe('inviter_atomic');
      expect(referralRecord.inviteeId).toBe('invitee_atomic');
      expect(referralRecord.creditsAwarded).toBe(10);
    });
  });

  describe('8-12. Server-Side Credit Enforcement, Concurrency Protection & Idempotent Refunds', () => {
    it('8. Generation with sufficient server credits succeeds and deducts atomically', async () => {
      await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'teacher_gen_ok', email: 'genok@school.ac.ke', emailVerified: true },
        { initializeOnly: true, name: 'Teacher Gen' }
      );

      const reservation = await AuthoritativeAccountService.verifyAndReserveCredits({
        uid: 'teacher_gen_ok',
        endpoint: '/api/generate',
        contentType: 'Scheme of Work', // Cost = 2
      });

      expect(reservation.costDeducted).toBe(2);
      expect(reservation.remainingCredits).toBe(3);

      await AuthoritativeAccountService.commitCreditReservation('teacher_gen_ok', reservation.reservationId);
    });

    it('9. Generation with 0 server credits fails even if client claims 100 credits in request/localStorage/sessionStorage', async () => {
      const adapter = createInMemoryStorageAdapter();
      AuthoritativeAccountService.setStorageAdapter(adapter);

      await adapter.runTransaction(async (tx) => {
        await tx.setDoc('users', 'teacher_zero', {
          id: 'teacher_zero',
          name: 'Zero Credits Teacher',
          email: 'zero@school.ac.ke',
          role: 'Teacher',
          status: 'Active',
          credits: 0,
          creditLogs: [],
        });
      });

      await expect(
        AuthoritativeAccountService.verifyAndReserveCredits(
          {
            uid: 'teacher_zero',
            endpoint: '/api/generate',
            contentType: 'Lesson Plan',
            clientCredits: 100,
            localStorageCredits: 100,
            sessionStorageCredits: 100,
          },
          adapter
        )
      ).rejects.toThrow(/INSUFFICIENT_CREDITS/);
    });

    it('10. Firestore failure during credit verification fails closed and never grants free generation', async () => {
      await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'teacher_db_fail', email: 'dbfail@school.ac.ke', emailVerified: true },
        { initializeOnly: true, name: 'Teacher DB Fail' }
      );

      AuthoritativeAccountService.setSimulateStorageFailure(true);

      await expect(
        AuthoritativeAccountService.verifyAndReserveCredits({
          uid: 'teacher_db_fail',
          endpoint: '/api/generate',
          contentType: 'Lesson Plan',
        })
      ).rejects.toThrow(/FIRESTORE_UNAVAILABLE/);

      // Fallback helper also guarantees 0 credits and Teacher role when Firestore is down
      const fallbackUser = AuthoritativeAccountService.buildSafeUninitializedUserFallback({
        uid: 'teacher_db_fail',
        email: 'abexameno@gmail.com',
        displayName: 'Offline User',
      });
      expect(fallbackUser.credits).toBe(0);
      expect(fallbackUser.role).toBe('Teacher');
    });

    it('11. Concurrent generation requests cannot spend the same credits twice', async () => {
      const adapter = createInMemoryStorageAdapter();
      AuthoritativeAccountService.setStorageAdapter(adapter);

      // Give user exactly 2 credits (enough for only ONE Assessment of cost 2)
      await adapter.runTransaction(async (tx) => {
        await tx.setDoc('users', 'teacher_concurrent', {
          id: 'teacher_concurrent',
          name: 'Concurrent Teacher',
          email: 'concurrent@school.ac.ke',
          role: 'Teacher',
          status: 'Active',
          credits: 2,
          creditLogs: [],
        });
      });

      const results = await Promise.allSettled([
        AuthoritativeAccountService.verifyAndReserveCredits(
          {
            uid: 'teacher_concurrent',
            endpoint: '/api/generate',
            contentType: 'Assessment', // Cost 2
          },
          adapter
        ),
        AuthoritativeAccountService.verifyAndReserveCredits(
          {
            uid: 'teacher_concurrent',
            endpoint: '/api/generate',
            contentType: 'Assessment', // Cost 2
          },
          adapter
        ),
        AuthoritativeAccountService.verifyAndReserveCredits(
          {
            uid: 'teacher_concurrent',
            endpoint: '/api/generate',
            contentType: 'Assessment', // Cost 2
          },
          adapter
        ),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);

      const finalUser = await adapter.getDoc('users', 'teacher_concurrent');
      expect(finalUser.credits).toBe(0);
      expect(finalUser.credits).toBeGreaterThanOrEqual(0);
    });

    it('12. Generation failure refunds reserved credits once and is idempotent on retry', async () => {
      const adapter = createInMemoryStorageAdapter();
      AuthoritativeAccountService.setStorageAdapter(adapter);

      await AuthoritativeAccountService.completeOrInitializeProfile(
        { uid: 'teacher_refund', email: 'refund@school.ac.ke', emailVerified: true },
        { initializeOnly: true, name: 'Refund Teacher' },
        adapter
      );

      const reservation = await AuthoritativeAccountService.verifyAndReserveCredits(
        {
          uid: 'teacher_refund',
          endpoint: '/api/generate',
          contentType: 'Scheme of Work', // Cost 2 -> balance drops from 5 to 3
        },
        adapter
      );
      expect(reservation.remainingCredits).toBe(3);

      // First refund restores balance to 5
      const firstRefund = await AuthoritativeAccountService.refundCreditReservation(
        'teacher_refund',
        reservation.reservationId,
        'Gemini upstream timeout',
        adapter
      );
      expect(firstRefund.refunded).toBe(true);
      expect(firstRefund.remainingCredits).toBe(5);

      // Second refund call for the same reservation is a no-op (never double-refunds)
      const secondRefund = await AuthoritativeAccountService.refundCreditReservation(
        'teacher_refund',
        reservation.reservationId,
        'Duplicate refund attempt',
        adapter
      );
      expect(secondRefund.refunded).toBe(false);
      expect(secondRefund.remainingCredits).toBe(5);
    });
  });

  describe('13-14. Cross-User & Cross-School Firestore Isolation and Codebase Hardening Verification', () => {
    it('13. Cross-user users/{userId} read is denied for non-admin users and allowed for platform admin', async () => {
      const denied = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'users/victim_teacher',
        operation: 'read',
        auth: { uid: 'other_teacher', email: 'other@school.ac.ke', emailVerified: true },
      });
      expect(denied.allowed).toBe(false);

      const adminAllowed = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'users/victim_teacher',
        operation: 'read',
        auth: { uid: 'platform_admin', email: 'admin@exameno.com', emailVerified: true, claims: { admin: true } },
      });
      expect(adminAllowed.allowed).toBe(true);
    });

    it('14. Cross-school schools/{schoolId} modification and schoolMemberships escalation are denied', async () => {
      const schoolEscalation = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'schoolMemberships/mem_attacker_school_x',
        operation: 'create',
        auth: { uid: 'attacker', email: 'attacker@school.ac.ke', emailVerified: true },
        requestData: {
          userId: 'attacker',
          schoolId: 'school_x',
          role: 'SCHOOL_ADMIN',
          status: 'ACTIVE',
        },
      });
      expect(schoolEscalation.allowed).toBe(false);

      const schoolOverwrite = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'schools/school_x',
        operation: 'update',
        auth: { uid: 'attacker', email: 'attacker@school.ac.ke', emailVerified: true },
        resourceData: { id: 'school_x', name: 'School X', createdBy: 'owner_x', status: 'active' },
        requestData: { name: 'Compromised School X' },
      });
      expect(schoolOverwrite.allowed).toBe(false);
    });

    it('verifies LoginScreen.tsx and App.tsx no longer contain client-side credit: 100 fallbacks or direct users/{uid} creation', () => {
      const loginSource = fs.readFileSync(path.resolve(__dirname, 'components/LoginScreen.tsx'), 'utf8');
      const appSource = fs.readFileSync(path.resolve(__dirname, 'App.tsx'), 'utf8');

      expect(loginSource).not.toContain('credits: 100');
      expect(loginSource).not.toContain("collection(db, 'referrals')");
      expect(loginSource).toContain('/api/user/complete-profile');

      expect(appSource).not.toContain('credits: 100');
      expect(appSource).toContain('/api/user/complete-profile');
    });
  });
});
