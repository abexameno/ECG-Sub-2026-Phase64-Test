export type NotificationType = 'system' | 'credit' | 'announcement' | 'update' | 'poll';

export interface AppNotification {
    id: string;
    userId: string | 'all';
    recipientUserId?: string;
    schoolId?: string;
    schoolName?: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
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
    readAt?: string;
}

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
  metadata?: AppNotification['metadata'];
  actionUrl?: string;
}
