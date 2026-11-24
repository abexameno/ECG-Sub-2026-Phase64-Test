import * as fs from 'fs';
import * as path from 'path';
import { AuthoritativeAccountService } from './services/authoritativeAccountService.ts';

describe('Firestore Security Rules (Phase 32.1 Active P0 Security Verification)', () => {
  const rulesSource = fs.readFileSync(path.resolve(__dirname, 'firestore.rules'), 'utf8');

  beforeEach(() => {
    AuthoritativeAccountService.resetInMemoryStore();
  });

  describe('Static Rule Specification Verification (/firestore.rules)', () => {
    it('restricts /users/{userId} read to owner or platform admin (never allow read: if isSignedIn())', () => {
      expect(rulesSource).toContain('match /users/{userId}');
      expect(rulesSource).toContain('allow read: if isSignedIn() && (userId == request.auth.uid || isPlatformAdmin());');
      expect(rulesSource).not.toContain('allow read: if isSignedIn(); // Allow reading users');
    });

    it('restricts /curriculum_overrides/{key} write to isPlatformAdmin()', () => {
      const overrideBlock = rulesSource.split('match /curriculum_overrides/{key}')[1]?.split('match /')[0] || '';
      expect(overrideBlock).toContain('allow write: if isPlatformAdmin();');
      expect(overrideBlock).not.toContain('allow write: if isSignedIn();');
    });

    it('blocks all client writes to /referrals/{referralId} and /credit_reservations/{reservationId}', () => {
      const referralsBlock = rulesSource.split('match /referrals/{referralId}')[1]?.split('match /')[0] || '';
      expect(referralsBlock).toContain('allow create, update, delete: if false;');

      const reservationsBlock = rulesSource.split('match /credit_reservations/{reservationId}')[1]?.split('match /')[0] || '';
      expect(reservationsBlock).toContain('allow read, write: if false;');
    });

    it('restricts /schools/{schoolId}/elms_connections/{connectionId} to platform or school admin', () => {
      const elmsBlock = rulesSource.split('match /elms_connections/{connectionId}')[1]?.split('match /')[0] || '';
      expect(elmsBlock).toContain('allow read, create, update: if isPlatformAdmin() || isSchoolAdminFor(schoolId);');
      expect(elmsBlock).not.toContain('allow read, create, update: if isSignedIn();');
    });
  });

  describe('Executable Rule Enforcement Matrix', () => {
    it('allows a user to read their own user doc', async () => {
      const res = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'users/teacher_1',
        operation: 'read',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
      });
      expect(res.allowed).toBe(true);
    });

    it('denies a user from reading another user doc', async () => {
      const res = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'users/teacher_2',
        operation: 'read',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('CROSS_USER_READ_DENIED');
    });

    it('denies a user from creating a user doc with role: Admin', async () => {
      const res = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'users/teacher_1',
        operation: 'create',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
        requestData: {
          id: 'teacher_1',
          name: 'Teacher One',
          email: 't1@school.ke',
          role: 'Admin',
          credits: 5,
        },
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('NON_TEACHER_ROLE_ON_CLIENT_CREATE_DENIED');
    });

    it('denies a user from updating their own role, isAdmin, schoolId, or tenantId', async () => {
      const existingUser = {
        id: 'teacher_1',
        name: 'Teacher One',
        email: 't1@school.ke',
        role: 'Teacher',
        credits: 5,
      };

      for (const illegalPatch of [
        { role: 'Admin' },
        { isAdmin: true },
        { schoolId: 'school_hijack' },
        { tenantId: 'tenant_hijack' },
      ]) {
        const res = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
          path: 'users/teacher_1',
          operation: 'update',
          auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
          resourceData: existingUser,
          requestData: illegalPatch,
        });
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('IMMUTABLE_PRIVILEGED_FIELD_UPDATE_DENIED');
      }
    });

    it('denies a user from increasing their own credits', async () => {
      const existingUser = {
        id: 'teacher_1',
        name: 'Teacher One',
        email: 't1@school.ke',
        role: 'Teacher',
        credits: 5,
      };

      const res = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'users/teacher_1',
        operation: 'update',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
        resourceData: existingUser,
        requestData: { credits: 100 },
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('CLIENT_CREDIT_INFLATION_DENIED');
    });

    it('denies a user from creating arbitrary schoolMemberships with SCHOOL_ADMIN', async () => {
      const res = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'schoolMemberships/mem_teacher_1_school_a',
        operation: 'create',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
        requestData: {
          userId: 'teacher_1',
          schoolId: 'school_a',
          role: 'SCHOOL_ADMIN',
          status: 'ACTIVE',
        },
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('PRIVILEGED_OR_CROSS_USER_MEMBERSHIP_CREATE_DENIED');
    });

    it('denies a user from overwriting another school in /schools/{schoolId}', async () => {
      const res = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'schools/school_b',
        operation: 'update',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
        resourceData: {
          id: 'school_b',
          name: 'School B',
          createdBy: 'admin_b',
          status: 'active',
        },
        requestData: {
          name: 'Hijacked School B',
        },
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('CROSS_SCHOOL_OR_NON_ADMIN_UPDATE_DENIED');
    });

    it('denies a user from reading or writing another school elms_connections', async () => {
      const readRes = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'schools/school_b/elms_connections/conn_1',
        operation: 'read',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
      });
      expect(readRes.allowed).toBe(false);
      expect(readRes.reason).toBe('UNAUTHORIZED_ELMS_CONNECTION_ACCESS_DENIED');

      const writeRes = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'schools/school_b/elms_connections/conn_1',
        operation: 'update',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
        requestData: { status: 'CONNECTED', portalUrl: 'https://evil.example.com' },
      });
      expect(writeRes.allowed).toBe(false);
      expect(writeRes.reason).toBe('UNAUTHORIZED_ELMS_CONNECTION_ACCESS_DENIED');
    });

    it('denies a non-admin from writing curriculum_overrides', async () => {
      const res = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'curriculum_overrides/grade_7_math',
        operation: 'create',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
        requestData: { overridden: true },
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('UNAUTHORIZED_CURRICULUM_OVERRIDE_WRITE_DENIED');
    });

    it('denies a user from forging referral credit records in /referrals/{referralId}', async () => {
      const createRes = await AuthoritativeAccountService.evaluateFirestoreRuleAccess({
        path: 'referrals/forged_ref_1',
        operation: 'create',
        auth: { uid: 'teacher_1', email: 't1@school.ke', emailVerified: true },
        requestData: {
          inviterId: 'teacher_1',
          inviteeId: 'fake_user',
          status: 'completed',
          creditsAwarded: 10,
        },
      });
      expect(createRes.allowed).toBe(false);
      expect(createRes.reason).toBe('CLIENT_REFERRAL_WRITE_DENIED');
    });
  });
});
