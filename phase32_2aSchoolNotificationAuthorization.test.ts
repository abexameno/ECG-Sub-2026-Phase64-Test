import { NotificationService } from './services/notificationService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';
import fs from 'fs';
import path from 'path';

describe('Phase 32.2A Stage 2: School Authorization & Tenant Restrictions', () => {
  const schoolAlpha = 'school-alpha-001';
  const schoolBeta = 'school-beta-002';

  const teacherAlpha = 'teacher-alpha-active';
  const teacherBeta = 'teacher-beta-active';
  const teacherSuspendedAlpha = 'teacher-alpha-suspended';
  const adminAlpha = 'school-admin-alpha';
  const ordinaryTeacher = 'teacher-ordinary-no-role';

  beforeEach(() => {
    NotificationService.clearStore();
    jest.clearAllMocks();

    // 1. Register Active Teacher in School Alpha
    SchoolMembershipService.addTeacherMembership({
      userId: teacherAlpha,
      schoolId: schoolAlpha,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    // 2. Register Active Teacher in School Beta
    SchoolMembershipService.addTeacherMembership({
      userId: teacherBeta,
      schoolId: schoolBeta,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    // 3. Register Suspended Teacher in School Alpha
    SchoolMembershipService.addTeacherMembership({
      userId: teacherSuspendedAlpha,
      schoolId: schoolAlpha,
      role: 'TEACHER',
      status: 'SUSPENDED',
    });

    // 4. Register School Admin in School Alpha
    SchoolMembershipService.addTeacherMembership({
      userId: adminAlpha,
      schoolId: schoolAlpha,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    });

    // 5. Register Ordinary Teacher with no admin rights in School Alpha
    SchoolMembershipService.addTeacherMembership({
      userId: ordinaryTeacher,
      schoolId: schoolAlpha,
      role: 'TEACHER',
      status: 'ACTIVE',
    });
  });

  describe('1. School Announcement Read Restrictions & Tenant Isolation', () => {
    test('an active member can read an authorized notification for their school', async () => {
      await NotificationService.notifySchoolAnnouncement({
        schoolId: schoolAlpha,
        schoolName: 'Alpha Academy',
        title: 'Staff Briefing',
        message: 'All Alpha teachers must attend morning briefing.',
        senderUserId: adminAlpha,
      });

      const feedAlpha = NotificationService.getNotificationsForUser(teacherAlpha, schoolAlpha);
      expect(feedAlpha.length).toBe(1);
      expect(feedAlpha[0].title).toBe('Staff Briefing');
      expect(feedAlpha[0].schoolId).toBe(schoolAlpha);
    });

    test('a user from another school cannot read that notification', async () => {
      await NotificationService.notifySchoolAnnouncement({
        schoolId: schoolAlpha,
        schoolName: 'Alpha Academy',
        title: 'Confidential Internal Alpha Notice',
        message: 'Strictly Alpha Academy staff only.',
        senderUserId: adminAlpha,
      });

      // Teacher from school Beta attempts to read with their own school context
      const feedBeta = NotificationService.getNotificationsForUser(teacherBeta, schoolBeta);
      expect(feedBeta.length).toBe(0);
    });

    test('a former, suspended, or inactive member cannot access school-restricted notifications', async () => {
      await NotificationService.notifySchoolAnnouncement({
        schoolId: schoolAlpha,
        schoolName: 'Alpha Academy',
        title: 'Term 2 Planning',
        message: 'Planning agenda for active staff.',
        senderUserId: adminAlpha,
      });

      // Suspended teacher attempts to read
      const feedSuspended = NotificationService.getNotificationsForUser(teacherSuspendedAlpha, schoolAlpha);
      expect(feedSuspended.length).toBe(0);
    });

    test('a forged client-selected school ID does not grant access to another school', async () => {
      await NotificationService.notifySchoolAnnouncement({
        schoolId: schoolAlpha,
        schoolName: 'Alpha Academy',
        title: 'Exam Papers Ready',
        message: 'Internal Alpha assessment papers.',
        senderUserId: adminAlpha,
      });

      // Teacher from School Beta maliciously supplies schoolAlpha as candidate schoolId in client request
      const feedForged = NotificationService.getNotificationsForUser(teacherBeta, schoolAlpha);
      // Because teacherBeta only has active membership in schoolBeta, schoolAlpha is rejected
      expect(feedForged.length).toBe(0);
    });
  });

  describe('2. Global Broadcasts and Personal Notifications', () => {
    test('global broadcasts remain readable by all intended recipients regardless of school', async () => {
      await NotificationService.notifySystemAlert({
        title: 'Scheduled System Maintenance',
        message: 'The system will undergo routine maintenance at midnight.',
      });

      const feedAlpha = NotificationService.getNotificationsForUser(teacherAlpha, schoolAlpha);
      const feedBeta = NotificationService.getNotificationsForUser(teacherBeta, schoolBeta);

      expect(feedAlpha.some(n => n.title === 'Scheduled System Maintenance')).toBe(true);
      expect(feedBeta.some(n => n.title === 'Scheduled System Maintenance')).toBe(true);
    });

    test('personal notifications are visible only to the recipient user', async () => {
      await NotificationService.createNotification({
        userId: teacherAlpha,
        title: 'Personal Account Notice',
        message: 'Your personal password was updated.',
        type: 'account_update',
      });

      const feedAlpha = NotificationService.getNotificationsForUser(teacherAlpha, schoolAlpha);
      const feedBeta = NotificationService.getNotificationsForUser(teacherBeta, schoolBeta);

      expect(feedAlpha.some(n => n.title === 'Personal Account Notice')).toBe(true);
      expect(feedBeta.some(n => n.title === 'Personal Account Notice')).toBe(false);
    });
  });

  describe('3. Creation Restrictions & Role Enforcement', () => {
    test('an authorized school administrator can create a school announcement', async () => {
      const announcement = await NotificationService.notifySchoolAnnouncement({
        schoolId: schoolAlpha,
        schoolName: 'Alpha Academy',
        title: 'Sports Day Notice',
        message: 'Sports day will be held on Friday.',
        senderUserId: adminAlpha,
        senderName: 'Principal Alpha',
      });

      expect(announcement.id).toBeDefined();
      expect(announcement.type).toBe('announcement');
      expect(announcement.schoolId).toBe(schoolAlpha);
    });

    test('an ordinary teacher without school admin role is rejected from creating announcements', async () => {
      await expect(
        NotificationService.notifySchoolAnnouncement({
          schoolId: schoolAlpha,
          schoolName: 'Alpha Academy',
          title: 'Unauthorized Notice',
          message: 'This should not be allowed.',
          senderUserId: ordinaryTeacher,
        })
      ).rejects.toThrow(/UNAUTHORIZED_SCHOOL_ADMIN/);
    });

    test('a school administrator cannot create announcements for a school they do not administer', async () => {
      // Admin of schoolAlpha attempts to create an announcement for schoolBeta
      await expect(
        NotificationService.notifySchoolAnnouncement({
          schoolId: schoolBeta,
          schoolName: 'Beta High',
          title: 'Cross-School Tampering',
          message: 'Trying to broadcast to Beta High.',
          senderUserId: adminAlpha,
        })
      ).rejects.toThrow(/UNAUTHORIZED_SCHOOL_ADMIN/);
    });

    test('school announcement creation requires a valid non-empty schoolId', async () => {
      await expect(
        NotificationService.notifySchoolAnnouncement({
          schoolId: '',
          schoolName: 'No School',
          title: 'Invalid Announcement',
          message: 'Missing school id.',
          senderUserId: adminAlpha,
        })
      ).rejects.toThrow('schoolId is required for school announcements');
    });
  });

  describe('4. Read Receipts & Protected Fields Integrity', () => {
    test('users can mark their own notifications as read without altering document metadata', async () => {
      const notif = await NotificationService.createNotification({
        userId: teacherAlpha,
        title: 'Mark Read Test',
        message: 'Verifying metadata immutability.',
        type: 'info',
        metadata: { link: '/lesson-plans' },
      });

      await NotificationService.markAsRead(notif.id);

      const updated = NotificationService.getNotificationsForUser(teacherAlpha, schoolAlpha)[0];
      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
      // Protected fields must remain unchanged
      expect(updated.title).toBe('Mark Read Test');
      expect(updated.message).toBe('Verifying metadata immutability.');
      expect(updated.type).toBe('info');
      expect(updated.metadata?.link).toBe('/lesson-plans');
    });

    test('batch markAllAsRead updates only personal notifications of the authenticated user', async () => {
      // Create personal notification for teacherAlpha
      await NotificationService.createNotification({
        userId: teacherAlpha,
        title: 'Teacher Alpha Personal',
        message: 'Personal 1',
      });

      // Create personal notification for teacherBeta
      const notifBeta = await NotificationService.createNotification({
        userId: teacherBeta,
        title: 'Teacher Beta Personal',
        message: 'Personal 2',
      });

      // Teacher Alpha marks all read
      await NotificationService.markAllAsRead(teacherAlpha, schoolAlpha);

      const feedAlpha = NotificationService.getNotificationsForUser(teacherAlpha, schoolAlpha);
      expect(feedAlpha.find(n => n.title === 'Teacher Alpha Personal')?.isRead).toBe(true);

      // Teacher Beta notification must remain unread
      const feedBeta = NotificationService.getNotificationsForUser(teacherBeta, schoolBeta);
      expect(feedBeta.find(n => n.id === notifBeta.id)?.isRead).toBe(false);
    });
  });

  describe('5. Static Security Rules Audit for Stage 2', () => {
    test('firestore.rules enforces school membership, restricted updates, and schema validation', () => {
      const rulesContent = fs.readFileSync(path.resolve(__dirname, 'firestore.rules'), 'utf8');

      // Rule must contain match /notifications/{notificationId}
      expect(rulesContent).toContain('match /notifications/{notificationId}');

      // Must enforce active school membership check
      expect(rulesContent).toContain('isActiveSchoolMember(resource.data.schoolId)');

      // Must enforce school admin role on announcement creation
      expect(rulesContent).toContain('isSchoolAdminFor(request.resource.data.schoolId)');

      // Must restrict updates exclusively to isRead and readAt
      expect(rulesContent).toContain("affectedKeys().hasOnly(['isRead', 'readAt'])");

      // Must prohibit client-side deletion
      expect(rulesContent).toContain('allow delete: if isPlatformAdmin()');

      // Must prevent privileged payment and credit metadata fields
      expect(rulesContent).toContain('creditsAwarded');
      expect(rulesContent).toContain('transactionId');
    });
  });
});
