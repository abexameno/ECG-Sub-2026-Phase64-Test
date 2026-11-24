import { SchoolConfigService } from './services/schoolConfigService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import { NotificationService } from './services/notificationService.ts';
import { SchoolProfile } from './types.ts';
import { MembershipRole, SchoolMembership } from './types/teacherOnboarding.ts';

describe('Phase 49: School Management & Notifications', () => {
  beforeEach(() => {
    // Reset notification store before tests
    NotificationService.clearStore();
  });

  // ==========================================
  // 1. SCHOOL CONFIG & DE-DUPLICATION (School Management)
  // ==========================================
  describe('A. School Management', () => {
    test('should allow creating a new school with immediate owner membership', () => {
      const creatorId = 'teacher-owner-123';
      const newSchoolData: Partial<SchoolProfile> = {
        name: 'Safaricom Academy',
        schoolType: 'Primary',
        country: 'Kenya',
        county: 'Nairobi',
        schoolCode: 'SAF-001',
      };

      const result = SchoolMembershipService.createSchoolWithMembership(creatorId, newSchoolData);

      expect(result.school).toBeDefined();
      expect(result.school.id).toBeDefined();
      expect(result.school.name).toBe('Safaricom Academy');
      expect(result.membership).toBeDefined();
      expect(result.membership.role).toBe('SCHOOL_ADMIN');
      expect(result.membership.status).toBe('ACTIVE');
      expect(result.membership.userId).toBe(creatorId);

      // Verify the school is registered in the service
      const fetched = SchoolConfigService.getSchoolProfile(result.school.id);
      expect(fetched.name).toBe('Safaricom Academy');
    });

    test('should find duplicate candidates based on fuzzy name and registry parameters', () => {
      // Safely register a school with duplicate-looking name
      const schoolData: SchoolProfile = {
        id: 'school-lwps-dup',
        name: 'Lizzie Wanyoike Preparatory School (Duplicate)',
        schoolType: 'Primary',
        country: 'Kenya',
        county: 'Kiambu',
        schoolCode: 'LWPS-DUP-999',
        status: 'active',
        isAuthoritative: false,
        teachingConfig: {
          lessonsPerWeek: 5,
          lessonDurationMinutes: 40,
          teachingWeeksPerTerm: 13,
          revisionWeeks: 1,
          assessmentWeeks: 1,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      SchoolConfigService.registerSchool(schoolData);

      const duplicates = SchoolConfigService.findDuplicateCandidates();
      const hasDupCandidate = duplicates.some(c => 
        (c.schoolA.id === 'lwps' && c.schoolB.id === 'school-lwps-dup') ||
        (c.schoolA.id === 'school-lwps-dup' && c.schoolB.id === 'lwps')
      );

      expect(hasDupCandidate).toBe(true);
    });

    test('should support merging duplicate schools into a canonical/authoritative record', () => {
      const sourceId = 'school-lwps'; // existing alias record
      const targetId = 'lwps'; // canonical record

      const mergeResult = SchoolConfigService.mergeSchools({
        sourceSchoolId: sourceId,
        targetSchoolId: targetId,
        mergedByUserId: 'admin-user',
        notes: 'Deduplicating old testing record.'
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.sourceSchoolId).toBe(sourceId);
      expect(mergeResult.targetSchoolId).toBe(targetId);

      // Verify source status is now merged
      const mergedProfile = SchoolConfigService.getSchoolProfileRaw(sourceId);
      expect(mergedProfile?.status).toBe('merged');
      expect(mergedProfile?.canonicalSchoolId).toBe(targetId);

      // Active switch or resolve target must redirect to targetId
      const resolvedId = SchoolConfigService.resolveCanonicalSchoolId(sourceId);
      expect(resolvedId).toBe(targetId);
    });
  });

  // ==========================================
  // 2. SCHOOL ADMINISTRATION VISIBILITY & ISOLATION
  // ==========================================
  describe('B. School Administration Visibility & Isolation', () => {
    test('should validate active memberships for designated role tiers', () => {
      const teacherId = 'teacher-user-1';
      const schoolId = 'school-b';

      // No membership yet
      expect(SchoolMembershipService.validateAccess(teacherId, schoolId, 'TEACHER')).toBe(false);

      // Add as basic teacher
      SchoolMembershipService.addTeacherMembership({
        userId: teacherId,
        schoolId,
        role: 'TEACHER',
        status: 'ACTIVE',
      });

      expect(SchoolMembershipService.validateAccess(teacherId, schoolId, 'TEACHER')).toBe(true);
      expect(SchoolMembershipService.validateAccess(teacherId, schoolId, 'SCHOOL_ADMIN')).toBe(false);
    });

    test('should reject school membership lists for unauthorized non-admins', () => {
      const teacherId = 'regular-teacher-id';
      const adminId = 'school-admin-id';
      const targetSchool = 'school-a';

      // Register memberships
      SchoolMembershipService.addTeacherMembership({
        userId: teacherId,
        schoolId: targetSchool,
        role: 'TEACHER',
        status: 'ACTIVE',
      });

      SchoolMembershipService.addTeacherMembership({
        userId: adminId,
        schoolId: targetSchool,
        role: 'SCHOOL_ADMIN',
        status: 'ACTIVE',
      });

      // Admin should succeed
      const adminFetch = SchoolMembershipService.getSchoolMemberships(targetSchool, adminId);
      expect(adminFetch.length).toBeGreaterThan(0);

      // Regular teacher should be rejected
      expect(() => {
        SchoolMembershipService.getSchoolMemberships(targetSchool, teacherId);
      }).toThrow(/Unauthorized/);
    });
  });

  // ==========================================
  // 3. ROLE WORKFLOWS & ACCESS CONTROL
  // ==========================================
  describe('C. School Membership & Role Management', () => {
    test('should support request join, approval, rejection and suspension workflows', () => {
      const applicantId = 'applicant-1';
      const schoolId = 'school-b';
      const adminId = 'admin-user-b';

      // Add school admin
      SchoolMembershipService.addTeacherMembership({
        userId: adminId,
        schoolId,
        role: 'SCHOOL_ADMIN',
        status: 'ACTIVE',
      });

      // Join request (creates pending)
      const membership = SchoolMembershipService.requestJoinSchool(applicantId, schoolId, 'TEACHER');
      expect(membership.status).toBe('PENDING');

      // Rejecting pending
      SchoolMembershipService.rejectMembership(membership.id, adminId);
      expect(membership.status).toBe('REMOVED');

      // New request and approve
      const secondRequest = SchoolMembershipService.requestJoinSchool(applicantId, schoolId, 'TEACHER');
      SchoolMembershipService.approveMembership(secondRequest.id, adminId);
      expect(secondRequest.status).toBe('ACTIVE');

      // Suspend
      SchoolMembershipService.suspendMembership(secondRequest.id, adminId);
      expect(secondRequest.status).toBe('SUSPENDED');
    });

    test('should support role promotion by school admins', () => {
      const teacherId = 'promoted-teacher';
      const schoolId = 'school-b';
      const adminId = 'admin-user-b';

      const membership = SchoolMembershipService.addTeacherMembership({
        userId: teacherId,
        schoolId,
        role: 'TEACHER',
        status: 'ACTIVE',
      });

      SchoolMembershipService.changeRole(membership.id, 'ACADEMIC_ADMIN', adminId);
      expect(membership.role).toBe('ACADEMIC_ADMIN');
    });
  });

  // ==========================================
  // 4. SCHOOL-LEVEL OPERATIONAL SETTINGS
  // ==========================================
  describe('D. School-Level Operational Settings', () => {
    test('should support updating teaching config and calculating capacity impact', () => {
      const adminId = 'admin-user-b';
      const schoolId = 'school-b';

      const impact = SchoolConfigService.updateTeachingConfig(schoolId, {
        lessonsPerWeek: 6, // previous was 4
        lessonDurationMinutes: 40,
        teachingWeeksPerTerm: 12,
      }, adminId);

      expect(impact.schoolId).toBe(schoolId);
      expect(impact.previousConfig.lessonsPerWeek).toBe(4);
      expect(impact.newConfig.lessonsPerWeek).toBe(6);
      expect(impact.reviewRequired).toBeDefined();

      const schoolProfile = SchoolConfigService.getSchoolProfile(schoolId);
      expect(schoolProfile.teachingConfig.lessonsPerWeek).toBe(6);
    });
  });

  // ==========================================
  // 5. SYSTEM NOTIFICATIONS WITH TENANT ISOLATION
  // ==========================================
  describe('E. Notifications & Multi-Tenant Isolation', () => {
    test('should handle payment verification, credit adjustment and system alerts', async () => {
      const teacherId = 'teacher-notifications-test';

      const notifPayment = await NotificationService.notifyPaymentVerified({
        userId: teacherId,
        transactionId: 'tx-999',
        transactionNumber: 'MPESA-999',
        amount: 500,
        creditsAwarded: 50,
        newBalance: 55,
      });

      expect(notifPayment.userId).toBe(teacherId);
      expect(notifPayment.type).toBe('payment_verified');
      expect(notifPayment.message).toContain('verified');
      expect(notifPayment.message).toContain('MPESA-999');

      const notifAdjust = await NotificationService.notifyCreditAdjustment({
        userId: teacherId,
        delta: 10,
        newBalance: 65,
        adminName: 'Super Admin',
        reason: 'Holiday Voucher',
      });

      expect(notifAdjust.userId).toBe(teacherId);
      expect(notifAdjust.type).toBe('credit_change');
      expect(notifAdjust.message).toContain('Super Admin');

      const userNotifs = NotificationService.getNotificationsForUser(teacherId);
      expect(userNotifs.length).toBe(2);
      expect(NotificationService.getUnreadCount(teacherId)).toBe(2);

      // Mark single read
      await NotificationService.markAsRead(notifPayment.id);
      expect(NotificationService.getUnreadCount(teacherId)).toBe(1);

      // Mark all read
      await NotificationService.markAllAsRead(teacherId);
      expect(NotificationService.getUnreadCount(teacherId)).toBe(0);
    });

    test('should enforce multi-tenant isolation for school-wide announcements', async () => {
      const schoolAId = 'school-a';
      const schoolBId = 'school-b';

      const teacherA = 'teacher-school-a';
      const teacherB = 'teacher-school-b';

      // Announcement in school A
      await NotificationService.notifySchoolAnnouncement({
        schoolId: schoolAId,
        schoolName: 'School A Academy',
        title: 'Important Assembly',
        message: 'All teachers must attend the assembly at 9 AM.',
        senderName: 'Principal A',
      });

      // Get notifications for teacher A (with school A context)
      const feedA = NotificationService.getNotificationsForUser(teacherA, schoolAId);
      expect(feedA.length).toBe(1);
      expect(feedA[0].title).toBe('Important Assembly');

      // Get notifications for teacher B (with school B context) - should NOT see school A announcement
      const feedB = NotificationService.getNotificationsForUser(teacherB, schoolBId);
      expect(feedB.length).toBe(0);
    });
  });
});
