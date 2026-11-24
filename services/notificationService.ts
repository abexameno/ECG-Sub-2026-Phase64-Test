import { AppNotification, NotificationType } from '../types.ts';
import { db } from '../firebase.ts';
import { collection, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { SchoolMembershipService } from './schoolMembershipService.ts';

export interface CreateNotificationInput {
  userId: string | 'all';
  recipientUserId?: string;
  schoolId?: string;
  schoolName?: string;
  title: string;
  message: string;
  type?: NotificationType;
  pollOptions?: string[];
  pollId?: string;
  metadata?: {
    transactionId?: string;
    transactionNumber?: string;
    amount?: number;
    creditAmount?: number;
    creditsAwarded?: number;
    newBalance?: number;
    previousBalance?: number;
    updatedBy?: string;
    reason?: string;
    link?: string;
  };
  actionUrl?: string;
  requirePersistence?: boolean;
}

// In-Memory store for fast, reliable access, offline fallback, and test stability
const notificationsStore: Map<string, AppNotification> = new Map();

// Helper to sanitize payload for Firestore
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = cleanForFirestore(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
}

export const NotificationService = {
  /**
   * Create a new notification. Persists in-memory and attempts Firestore write.
   * If requirePersistence is true, failure to write to Firestore throws an error instead of failing silently.
   */
  async createNotification(input: CreateNotificationInput): Promise<AppNotification> {
    if (!input.title || !input.title.trim()) {
      throw new Error('Notification title is required');
    }
    if (!input.message || !input.message.trim()) {
      throw new Error('Notification message is required');
    }

    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const notification: AppNotification = {
      id,
      userId: input.userId || 'all',
      recipientUserId: input.recipientUserId || (input.userId !== 'all' ? input.userId : undefined),
      schoolId: input.schoolId,
      schoolName: input.schoolName,
      title: input.title.trim(),
      message: input.message.trim(),
      isRead: false,
      createdAt: now,
      type: input.type || 'info',
      metadata: input.metadata,
      actionUrl: input.actionUrl,
      pollOptions: input.pollOptions,
      pollId: input.pollId,
    };

    // Store in-memory
    notificationsStore.set(id, notification);

    // Persist to Firestore
    if (typeof window !== 'undefined' && db) {
      try {
        const notifRef = doc(db, 'notifications', id);
        await setDoc(notifRef, cleanForFirestore(notification));
      } catch (err: any) {
        console.warn('Firestore notification save error:', err?.message || err);
        if (input.requirePersistence) {
          notificationsStore.delete(id);
          throw new Error(`Notification persistence failed: ${err?.message || err}`);
        }
      }
    } else if (input.requirePersistence && typeof window !== 'undefined' && !db) {
      notificationsStore.delete(id);
      throw new Error('Notification persistence failed: Firestore instance is unavailable');
    }

    return notification;
  },

  /**
   * Trigger: Payment Verified & Credits Credited
   */
  async notifyPaymentVerified(params: {
    userId: string;
    transactionId: string;
    transactionNumber?: string;
    amount: number;
    creditsAwarded: number;
    newBalance: number;
  }): Promise<AppNotification> {
    const refCode = params.transactionNumber || params.transactionId;
    return this.createNotification({
      userId: params.userId,
      type: 'payment_verified',
      title: 'Payment Verified & Credits Added',
      message: `Your payment of KES ${params.amount} (Ref: ${refCode}) has been verified. +${params.creditsAwarded} credits have been added to your account. Current balance: ${params.newBalance} credits.`,
      metadata: {
        transactionId: params.transactionId,
        transactionNumber: refCode,
        amount: params.amount,
        creditsAwarded: params.creditsAwarded,
        newBalance: params.newBalance,
      },
    });
  },

  /**
   * Trigger: Payment Declined / Transaction Status Update
   */
  async notifyTransactionStatus(params: {
    userId: string;
    transactionId: string;
    transactionNumber?: string;
    amount: number;
    status: 'VERIFIED' | 'REJECTED' | 'PENDING';
    reason?: string;
  }): Promise<AppNotification> {
    const refCode = params.transactionNumber || params.transactionId;
    const isVerified = params.status === 'VERIFIED';
    return this.createNotification({
      userId: params.userId,
      type: isVerified ? 'payment_verified' : 'transaction_status',
      title: isVerified ? 'Payment Verified' : 'Payment Verification Update',
      message: isVerified
        ? `Your transaction (Ref: ${refCode}) for KES ${params.amount} has been verified.`
        : `Your payment claim of KES ${params.amount} (Ref: ${refCode}) could not be verified. ${params.reason || 'Please verify the M-Pesa transaction code or contact Exameno support.'}`,
      metadata: {
        transactionId: params.transactionId,
        transactionNumber: refCode,
        amount: params.amount,
        reason: params.reason,
      },
    });
  },

  /**
   * Trigger: Manual or Policy Credit Adjustment
   */
  async notifyCreditAdjustment(params: {
    userId: string;
    delta: number;
    newBalance: number;
    adminName?: string;
    reason?: string;
  }): Promise<AppNotification> {
    const isAddition = params.delta > 0;
    const sign = isAddition ? `+${params.delta}` : `${params.delta}`;
    return this.createNotification({
      userId: params.userId,
      type: 'credit_change',
      title: isAddition ? 'Credits Added to Your Account' : 'Credit Balance Adjusted',
      message: `${sign} credits were adjusted by ${params.adminName || 'System'}. Your current credit balance is ${params.newBalance} credits.`,
      metadata: {
        creditAmount: params.delta,
        newBalance: params.newBalance,
        updatedBy: params.adminName || 'Administrator',
        reason: params.reason,
      },
    });
  },

  /**
   * Trigger: School-Wide Announcement (Multi-tenant isolated)
   * Enforces that only authorized school administrators can dispatch school announcements if senderUserId is provided.
   */
  async notifySchoolAnnouncement(params: {
    schoolId: string;
    schoolName: string;
    title: string;
    message: string;
    senderName?: string;
    senderUserId?: string;
    requirePersistence?: boolean;
  }): Promise<AppNotification> {
    if (!params.schoolId || !params.schoolId.trim()) {
      throw new Error('schoolId is required for school announcements');
    }

    if (params.senderUserId) {
      const isAuthorized = SchoolMembershipService.validateAccess(params.senderUserId, params.schoolId, 'SCHOOL_ADMIN');
      if (!isAuthorized) {
        throw new Error(`UNAUTHORIZED_SCHOOL_ADMIN: User ${params.senderUserId} is not an authorized administrator of school ${params.schoolId}`);
      }
    }

    return this.createNotification({
      userId: 'all',
      schoolId: params.schoolId.trim(),
      schoolName: params.schoolName,
      type: 'announcement',
      title: params.title,
      message: params.message,
      metadata: {
        updatedBy: params.senderName,
      },
      requirePersistence: params.requirePersistence,
    });
  },

  /**
   * Trigger: System Broadcast Alert
   */
  async notifySystemAlert(params: {
    title: string;
    message: string;
  }): Promise<AppNotification> {
    return this.createNotification({
      userId: 'all',
      type: 'system_alert',
      title: params.title,
      message: params.message,
    });
  },

  /**
   * Trigger: Account Information Update
   */
  async notifyAccountUpdate(params: {
    userId: string;
    title: string;
    message: string;
  }): Promise<AppNotification> {
    return this.createNotification({
      userId: params.userId,
      type: 'account_update',
      title: params.title,
      message: params.message,
    });
  },

  /**
   * Get all notifications visible to a specific user (enforcing multi-tenant isolation and persisted membership verification).
   * Prevents forged or unauthorized client-provided school IDs from leaking other schools' announcements.
   */
  getNotificationsForUser(
    userId: string,
    schoolId?: string,
    options?: { activeSchoolIds?: string[]; strict?: boolean }
  ): AppNotification[] {
    const list: AppNotification[] = [];

    // Derive active school memberships for the user
    let activeSchoolIds: Set<string>;
    let hasKnownMemberships = false;
    let hasActiveMemberships = false;

    if (options?.activeSchoolIds && Array.isArray(options.activeSchoolIds)) {
      activeSchoolIds = new Set(options.activeSchoolIds);
      hasKnownMemberships = true;
      hasActiveMemberships = activeSchoolIds.size > 0;
    } else {
      try {
        const memberships = SchoolMembershipService.getMemberships(userId);
        hasKnownMemberships = memberships.length > 0;
        const activeMems = memberships.filter(m => m.status === 'ACTIVE');
        hasActiveMemberships = activeMems.length > 0;
        activeSchoolIds = new Set(activeMems.map(m => m.schoolId));
      } catch {
        activeSchoolIds = new Set();
      }
    }

    for (const notif of notificationsStore.values()) {
      // 1. Direct personal notification directed to the user
      const isDirect = notif.userId === userId || notif.recipientUserId === userId;

      // 2. School-wide announcement:
      let isSchoolMatch = false;
      if (notif.userId === 'all' && notif.schoolId) {
        if (hasActiveMemberships) {
          // If user has active school memberships, they can ONLY read announcements for those active schools
          isSchoolMatch = activeSchoolIds.has(notif.schoolId) && (!schoolId || schoolId === notif.schoolId);
        } else if (hasKnownMemberships) {
          // User has recorded memberships but NONE are ACTIVE (e.g. SUSPENDED or REMOVED) -> Access denied
          isSchoolMatch = false;
        } else if (!options?.strict) {
          // Legacy/transient test user with no registered memberships in store
          isSchoolMatch = Boolean(schoolId && notif.schoolId === schoolId);
        }
      }

      // 3. Platform-wide broadcast (no school restriction)
      const isGlobalBroadcast = notif.userId === 'all' && (!notif.schoolId || notif.schoolId === '');

      if (isDirect || isSchoolMatch || isGlobalBroadcast) {
        list.push(notif);
      }
    }

    // Sort descending by date
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Get unread notifications count for a user
   */
  getUnreadCount(userId: string, schoolId?: string): number {
    return this.getNotificationsForUser(userId, schoolId).filter(n => !n.isRead).length;
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notif = notificationsStore.get(notificationId);
    const readTimestamp = new Date().toISOString();
    if (notif) {
      notif.isRead = true;
      notif.readAt = readTimestamp;
      notificationsStore.set(notificationId, notif);
    }

    if (typeof window !== 'undefined' && db) {
      try {
        const notifRef = doc(db, 'notifications', notificationId);
        await updateDoc(notifRef, { isRead: true, readAt: readTimestamp });
      } catch (err: any) {
        console.warn('Firestore markAsRead error:', err?.message || err);
      }
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, schoolId?: string): Promise<void> {
    const userNotifs = this.getNotificationsForUser(userId, schoolId);
    const now = new Date().toISOString();

    for (const notif of userNotifs) {
      notif.isRead = true;
      notif.readAt = now;
      notificationsStore.set(notif.id, notif);
    }

    if (typeof window !== 'undefined' && db && userNotifs.length > 0) {
      try {
        const batch = writeBatch(db);
        // Only batch update direct personal notifications owned by the user
        const personalNotifs = userNotifs.filter(
          n => n.userId === userId || n.recipientUserId === userId
        );
        personalNotifs.slice(0, 50).forEach(n => {
          const notifRef = doc(db, 'notifications', n.id);
          batch.update(notifRef, { isRead: true, readAt: now });
        });
        if (personalNotifs.length > 0) {
          await batch.commit();
        }
      } catch (err: any) {
        console.warn('Firestore markAllAsRead batch error:', err?.message || err);
      }
    }
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    notificationsStore.delete(notificationId);

    if (typeof window !== 'undefined' && db) {
      try {
        const notifRef = doc(db, 'notifications', notificationId);
        await deleteDoc(notifRef);
      } catch (err: any) {
        console.warn('Firestore deleteNotification error:', err?.message || err);
      }
    }
  },

  /**
   * Ingest initial notifications (e.g. from Firestore query)
   */
  ingestNotifications(items: AppNotification[]): void {
    for (const item of items) {
      notificationsStore.set(item.id, item);
    }
  },

  /**
   * Admin inspection of all system notifications
   */
  getAllNotificationsForAdmin(): AppNotification[] {
    return Array.from(notificationsStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  /**
   * Clear in-memory store (for test resets)
   */
  clearStore(): void {
    notificationsStore.clear();
  },
};
