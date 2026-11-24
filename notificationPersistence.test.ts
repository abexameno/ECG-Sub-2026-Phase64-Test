jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  doc: jest.fn(() => ({ id: 'mock-notification-ref' })),
  setDoc: jest.fn(async () => {
    throw new Error('Mock Firestore write failure');
  }),
}));

import { NotificationService } from './services/notificationService.ts';
import { db } from './firebase.ts';

describe('Stage 1: Notification Persistence and Reliable Error Reporting', () => {
  beforeEach(() => {
    NotificationService.clearStore();
    jest.clearAllMocks();
  });

  describe('Notification Creation and In-Memory Handling', () => {
    test('should successfully create notification and store in-memory', async () => {
      const notif = await NotificationService.createNotification({
        userId: 'user-123',
        title: 'Curriculum Update',
        message: 'A new curriculum strand has been published.',
        type: 'info',
      });

      expect(notif.id).toBeDefined();
      expect(notif.userId).toBe('user-123');
      expect(notif.isRead).toBe(false);
      expect(notif.title).toBe('Curriculum Update');

      const userNotifs = NotificationService.getNotificationsForUser('user-123');
      expect(userNotifs.length).toBe(1);
      expect(userNotifs[0].id).toBe(notif.id);
    });

    test('should reject creation when title or message is empty', async () => {
      await expect(
        NotificationService.createNotification({
          userId: 'user-123',
          title: '',
          message: 'Valid message',
        })
      ).rejects.toThrow('Notification title is required');

      await expect(
        NotificationService.createNotification({
          userId: 'user-123',
          title: 'Valid title',
          message: '   ',
        })
      ).rejects.toThrow('Notification message is required');
    });

    test('should throw error when requirePersistence is true and Firestore throws', async () => {
      // In this Node test runtime, window is undefined or db setDoc might not be mocked
      // If we test requirePersistence with a failing write:
      const failingInput = {
        userId: 'user-123',
        title: 'Payment Alert',
        message: 'Your payment was processed.',
        requirePersistence: true,
      };

      // When window is defined but setDoc throws:
      const originalWindow = (global as any).window;
      try {
        (global as any).window = {};
        await expect(
          NotificationService.createNotification(failingInput)
        ).rejects.toThrow(/Notification persistence failed/);
      } finally {
        (global as any).window = originalWindow;
      }

      // Memory store should NOT retain the failed notification
      expect(NotificationService.getNotificationsForUser('user-123').length).toBe(0);
    });
  });

  describe('Read Receipts and Timestamps', () => {
    test('should record isRead and readAt timestamp on markAsRead', async () => {
      const notif = await NotificationService.createNotification({
        userId: 'user-456',
        title: 'Review Required',
        message: 'Please review lesson plan 4.',
      });

      expect(NotificationService.getUnreadCount('user-456')).toBe(1);

      const before = new Date().toISOString();
      await NotificationService.markAsRead(notif.id);
      const after = new Date().toISOString();

      expect(NotificationService.getUnreadCount('user-456')).toBe(0);
      const updated = NotificationService.getNotificationsForUser('user-456')[0];
      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
      expect(new Date(updated.readAt!).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime() - 1000);
      expect(new Date(updated.readAt!).getTime()).toBeLessThanOrEqual(new Date(after).getTime() + 1000);
    });

    test('should mark all notifications as read for a given user', async () => {
      await NotificationService.createNotification({
        userId: 'user-789',
        title: 'Alert 1',
        message: 'First notification',
      });
      await NotificationService.createNotification({
        userId: 'user-789',
        title: 'Alert 2',
        message: 'Second notification',
      });

      expect(NotificationService.getUnreadCount('user-789')).toBe(2);

      await NotificationService.markAllAsRead('user-789');
      expect(NotificationService.getUnreadCount('user-789')).toBe(0);

      const userNotifs = NotificationService.getNotificationsForUser('user-789');
      expect(userNotifs.every(n => n.isRead)).toBe(true);
      expect(userNotifs.every(n => Boolean(n.readAt))).toBe(true);
    });
  });

  describe('Delete Notification', () => {
    test('should remove notification from store', async () => {
      const notif = await NotificationService.createNotification({
        userId: 'user-del',
        title: 'Temporary Notice',
        message: 'Will be deleted',
      });

      expect(NotificationService.getNotificationsForUser('user-del').length).toBe(1);
      await NotificationService.deleteNotification(notif.id);
      expect(NotificationService.getNotificationsForUser('user-del').length).toBe(0);
    });
  });
});
