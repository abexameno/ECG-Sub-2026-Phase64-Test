import { useState } from 'react';

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  message: string;
  severity: ErrorSeverity;
}

// In-memory notifications (could be replaced by a Context provider)
const listeners: ((n: Notification) => void)[] = [];

export function subscribeToNotifications(listener: (n: Notification) => void) {
  listeners.push(listener);
}

export function notify(message: string, severity: ErrorSeverity = 'error') {
  const notification: Notification = {
    id: Math.random().toString(36).substr(2, 9),
    message,
    severity,
  };
  listeners.forEach(l => l(notification));
}
