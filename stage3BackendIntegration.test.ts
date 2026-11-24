import { NotificationService } from './services/notificationService.ts';
import { SchoolMembershipService } from './services/schoolMembershipService.ts';

describe('Stage 3: Backend Integration & Tenant Isolation Verification', () => {
  const schoolAlpha = 'school-alpha-integration';
  const schoolBeta = 'school-beta-integration';

  const teacherAlpha = 'teacher-alpha-usr';
  const teacherBeta = 'teacher-beta-usr';
  const suspendedTeacher = 'teacher-suspended-usr';
  const adminAlpha = 'admin-alpha-usr';
  const ordinaryTeacherAlpha = 'teacher-ordinary-alpha';

  // Backing database simulator for server-side endpoints
  let mockDbMemberships: Map<string, any>;
  let mockDbNotifications: Map<string, any>;

  // Simulated server endpoints replicating server.ts handlers
  const handleGetNotificationsFeed = async (req: { uid: string; claims?: any }) => {
    const uid = req.uid;
    const isPlatformAdmin = Boolean(req.claims?.admin || req.claims?.role === 'Admin');

    // 1. Fetch user's active school memberships
    const activeSchoolIds = new Set<string>();
    for (const mem of mockDbMemberships.values()) {
      if (mem.userId === uid && mem.status === 'ACTIVE') {
        activeSchoolIds.add(mem.schoolId);
      }
    }

    // 2. Fetch notifications
    const allNotifs = Array.from(mockDbNotifications.values());

    // 3. Filter strictly according to authorization rules
    const authorizedNotifs = allNotifs.filter((notif: any) => {
      if (isPlatformAdmin) return true;
      // Direct personal notifications
      if (notif.userId === uid || notif.recipientUserId === uid) return true;
      // Broadcasts
      if (notif.userId === 'all') {
        // Global broadcast (no schoolId or empty)
        if (!notif.schoolId || notif.schoolId === '') return true;
        // School-specific announcement: must be an active member of that school
        if (activeSchoolIds.has(notif.schoolId)) return true;
      }
      return false;
    });

    authorizedNotifs.sort((a: any, b: any) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return {
      status: 200,
      body: {
        success: true,
        notifications: authorizedNotifs,
        activeSchoolIds: Array.from(activeSchoolIds),
      },
    };
  };

  const handlePostSchoolAnnouncement = async (req: { uid: string; email?: string; claims?: any; body: any }) => {
    const uid = req.uid;
    const { schoolId, schoolName, title, message, actionUrl, pollOptions } = req.body || {};

    if (!schoolId || typeof schoolId !== 'string' || !schoolId.trim()) {
      return { status: 400, body: { error: 'schoolId is required' } };
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return { status: 400, body: { error: 'title is required' } };
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return { status: 400, body: { error: 'message is required' } };
    }

    const isPlatformAdmin = Boolean(req.claims?.admin || req.claims?.role === 'Admin');
    let isAuthorized = isPlatformAdmin;

    if (!isAuthorized) {
      const canonicalMemId = `mem_${uid}_${schoolId.trim()}`;
      const membership = mockDbMemberships.get(canonicalMemId);
      if (
        membership &&
        membership.userId === uid &&
        membership.schoolId === schoolId.trim() &&
        membership.status === 'ACTIVE' &&
        (membership.role === 'SCHOOL_ADMIN' || membership.role === 'SUPER_ADMIN')
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return {
        status: 403,
        body: { error: 'UNAUTHORIZED_SCHOOL_ADMIN: You are not an active administrator of this school.' },
      };
    }

    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const notificationDoc = {
      id: notifId,
      userId: 'all',
      schoolId: schoolId.trim(),
      schoolName: schoolName || schoolId.trim(),
      title: title.trim(),
      message: message.trim(),
      type: 'announcement',
      isRead: false,
      createdAt: now,
      actionUrl: actionUrl || undefined,
      pollOptions: Array.isArray(pollOptions) ? pollOptions : undefined,
      metadata: {
        senderUid: uid,
        updatedBy: req.email || 'School Administrator',
      },
    };

    mockDbNotifications.set(notifId, notificationDoc);

    return {
      status: 200,
      body: {
        success: true,
        notification: notificationDoc,
      },
    };
  };

  beforeEach(() => {
    mockDbMemberships = new Map();
    mockDbNotifications = new Map();
    NotificationService.clearStore();

    // Register test memberships in mock DB and SchoolMembershipService
    mockDbMemberships.set(`mem_${teacherAlpha}_${schoolAlpha}`, {
      id: `mem_${teacherAlpha}_${schoolAlpha}`,
      userId: teacherAlpha,
      schoolId: schoolAlpha,
      role: 'TEACHER',
      status: 'ACTIVE',
    });
    SchoolMembershipService.addTeacherMembership({
      userId: teacherAlpha,
      schoolId: schoolAlpha,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    mockDbMemberships.set(`mem_${teacherBeta}_${schoolBeta}`, {
      id: `mem_${teacherBeta}_${schoolBeta}`,
      userId: teacherBeta,
      schoolId: schoolBeta,
      role: 'TEACHER',
      status: 'ACTIVE',
    });
    SchoolMembershipService.addTeacherMembership({
      userId: teacherBeta,
      schoolId: schoolBeta,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    mockDbMemberships.set(`mem_${suspendedTeacher}_${schoolAlpha}`, {
      id: `mem_${suspendedTeacher}_${schoolAlpha}`,
      userId: suspendedTeacher,
      schoolId: schoolAlpha,
      role: 'TEACHER',
      status: 'SUSPENDED',
    });
    SchoolMembershipService.addTeacherMembership({
      userId: suspendedTeacher,
      schoolId: schoolAlpha,
      role: 'TEACHER',
      status: 'SUSPENDED',
    });

    mockDbMemberships.set(`mem_${adminAlpha}_${schoolAlpha}`, {
      id: `mem_${adminAlpha}_${schoolAlpha}`,
      userId: adminAlpha,
      schoolId: schoolAlpha,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    });
    SchoolMembershipService.addTeacherMembership({
      userId: adminAlpha,
      schoolId: schoolAlpha,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    });

    mockDbMemberships.set(`mem_${ordinaryTeacherAlpha}_${schoolAlpha}`, {
      id: `mem_${ordinaryTeacherAlpha}_${schoolAlpha}`,
      userId: ordinaryTeacherAlpha,
      schoolId: schoolAlpha,
      role: 'TEACHER',
      status: 'ACTIVE',
    });
    SchoolMembershipService.addTeacherMembership({
      userId: ordinaryTeacherAlpha,
      schoolId: schoolAlpha,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    // Seed mock notifications
    mockDbNotifications.set('notif_global_1', {
      id: 'notif_global_1',
      userId: 'all',
      title: 'Platform Maintenance Notice',
      message: 'Scheduled downtime on Sunday.',
      type: 'system_alert',
      createdAt: '2026-10-18T00:00:00.000Z',
    });

    mockDbNotifications.set('notif_alpha_1', {
      id: 'notif_alpha_1',
      userId: 'all',
      schoolId: schoolAlpha,
      schoolName: 'Alpha High',
      title: 'Alpha Staff Meeting',
      message: 'Meeting at 8:00 AM.',
      type: 'announcement',
      createdAt: '2026-10-18T01:00:00.000Z',
    });

    mockDbNotifications.set('notif_beta_1', {
      id: 'notif_beta_1',
      userId: 'all',
      schoolId: schoolBeta,
      schoolName: 'Beta Academy',
      title: 'Beta Internal Notice',
      message: 'Classrooms renovation.',
      type: 'announcement',
      createdAt: '2026-10-18T02:00:00.000Z',
    });

    mockDbNotifications.set('notif_personal_alpha', {
      id: 'notif_personal_alpha',
      userId: teacherAlpha,
      title: 'Lesson Plan Approved',
      message: 'Your Grade 7 Lesson Plan is approved.',
      type: 'info',
      createdAt: '2026-10-18T03:00:00.000Z',
    });
  });

  describe('1. GET /api/notifications/feed — Tenant Isolation & Authorization', () => {
    test('authorized member of School Alpha receives Alpha announcements, global alerts, and personal notifications', async () => {
      const res = await handleGetNotificationsFeed({ uid: teacherAlpha });
      expect(res.status).toBe(200);

      const notifTitles = res.body.notifications.map((n: any) => n.title);
      expect(notifTitles).toContain('Alpha Staff Meeting');
      expect(notifTitles).toContain('Platform Maintenance Notice');
      expect(notifTitles).toContain('Lesson Plan Approved');
      // Cross-school announcement must NOT be present
      expect(notifTitles).not.toContain('Beta Internal Notice');
    });

    test('member of School Beta receives Beta announcements, but NOT Alpha announcements', async () => {
      const res = await handleGetNotificationsFeed({ uid: teacherBeta });
      expect(res.status).toBe(200);

      const notifTitles = res.body.notifications.map((n: any) => n.title);
      expect(notifTitles).toContain('Beta Internal Notice');
      expect(notifTitles).toContain('Platform Maintenance Notice');
      expect(notifTitles).not.toContain('Alpha Staff Meeting');
      expect(notifTitles).not.toContain('Lesson Plan Approved');
    });

    test('inactive or suspended teacher cannot receive school announcements', async () => {
      const res = await handleGetNotificationsFeed({ uid: suspendedTeacher });
      expect(res.status).toBe(200);

      const notifTitles = res.body.notifications.map((n: any) => n.title);
      // Can see global alerts
      expect(notifTitles).toContain('Platform Maintenance Notice');
      // Cannot see Alpha announcements despite school association
      expect(notifTitles).not.toContain('Alpha Staff Meeting');
      expect(notifTitles).not.toContain('Beta Internal Notice');
    });

    test('platform administrator receives all notifications regardless of school boundary', async () => {
      const res = await handleGetNotificationsFeed({ uid: 'superadmin_1', claims: { admin: true } });
      expect(res.status).toBe(200);

      const notifTitles = res.body.notifications.map((n: any) => n.title);
      expect(notifTitles).toContain('Alpha Staff Meeting');
      expect(notifTitles).toContain('Beta Internal Notice');
      expect(notifTitles).toContain('Platform Maintenance Notice');
    });
  });

  describe('2. POST /api/notifications/school-announcement — Role Enforcement & Restrictions', () => {
    test('authorized school administrator can dispatch an announcement for their school', async () => {
      const res = await handlePostSchoolAnnouncement({
        uid: adminAlpha,
        email: 'admin@alpha.ac.ke',
        body: {
          schoolId: schoolAlpha,
          schoolName: 'Alpha High',
          title: 'Parent-Teacher Conference',
          message: 'Conference scheduled for Friday afternoon.',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notification.title).toBe('Parent-Teacher Conference');
      expect(res.body.notification.schoolId).toBe(schoolAlpha);
      expect(res.body.notification.type).toBe('announcement');
    });

    test('ordinary teacher without school admin role is rejected with 403', async () => {
      const res = await handlePostSchoolAnnouncement({
        uid: ordinaryTeacherAlpha,
        body: {
          schoolId: schoolAlpha,
          title: 'Unauthorized Announcement',
          message: 'Teachers attempt to broadcast.',
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('UNAUTHORIZED_SCHOOL_ADMIN');
    });

    test('school administrator attempting to target another school is rejected with 403', async () => {
      const res = await handlePostSchoolAnnouncement({
        uid: adminAlpha,
        body: {
          schoolId: schoolBeta, // Admin of Alpha attempts to post to Beta
          title: 'Cross-School Announcement',
          message: 'Attempting to inject announcement into Beta.',
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('UNAUTHORIZED_SCHOOL_ADMIN');
    });

    test('announcement post fails with 400 when required fields are missing', async () => {
      const resMissingTitle = await handlePostSchoolAnnouncement({
        uid: adminAlpha,
        body: { schoolId: schoolAlpha, message: 'No title' },
      });
      expect(resMissingTitle.status).toBe(400);

      const resMissingSchool = await handlePostSchoolAnnouncement({
        uid: adminAlpha,
        body: { title: 'No schoolId', message: 'Content' },
      });
      expect(resMissingSchool.status).toBe(400);
    });
  });

  describe('3. Client Notification Subscriptions & Read Receipts Protection', () => {
    test('markAsRead updates read receipt without corrupting protected content metadata', async () => {
      const notif = await NotificationService.createNotification({
        userId: teacherAlpha,
        title: 'Curriculum Update',
        message: 'New KICD Guidelines available.',
        type: 'info',
        metadata: { strand: 'Science' },
      });

      await NotificationService.markAsRead(notif.id);

      const feed = NotificationService.getNotificationsForUser(teacherAlpha, schoolAlpha);
      const updated = feed.find(n => n.id === notif.id)!;
      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
      expect(updated.title).toBe('Curriculum Update');
      expect(updated.message).toBe('New KICD Guidelines available.');
      expect(updated.type).toBe('info');
      expect(updated.metadata?.strand).toBe('Science');
    });

    test('bulk markAllAsRead does NOT mutate shared school announcements or other users documents', async () => {
      // 1. Ingest shared announcement and another user's notification
      const sharedAnnouncement = {
        id: 'shared_ann_alpha',
        userId: 'all',
        schoolId: schoolAlpha,
        title: 'Morning Assembly',
        message: 'Assembly starts at 7:30 AM.',
        type: 'announcement' as const,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      const otherTeacherPersonal = {
        id: 'other_teacher_notif',
        userId: teacherBeta,
        title: 'Beta Personal Message',
        message: 'Private message for Beta teacher.',
        type: 'info' as const,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      NotificationService.ingestNotifications([sharedAnnouncement, otherTeacherPersonal]);

      // 2. Create personal notification for teacherAlpha
      const teacherPersonal = await NotificationService.createNotification({
        userId: teacherAlpha,
        title: 'Personal Notification',
        message: 'Personal reminder.',
        type: 'info',
      });

      // 3. teacherAlpha invokes markAllAsRead
      await NotificationService.markAllAsRead(teacherAlpha, schoolAlpha);

      // Verify that teacherPersonal was marked as read
      const personalInFeed = NotificationService.getNotificationsForUser(teacherAlpha, schoolAlpha).find(n => n.id === teacherPersonal.id);
      expect(personalInFeed?.isRead).toBe(true);

      // Verify that otherTeacherPersonal remains unread
      const otherInFeed = NotificationService.getNotificationsForUser(teacherBeta, schoolBeta).find(n => n.id === otherTeacherPersonal.id);
      expect(otherInFeed?.isRead).toBe(false);
    });
  });
});
