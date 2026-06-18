/**
 * NotificationService — Wraps expo-notifications API for local push notifications.
 * Handles permission requests, scheduling, cancellation, and notification tap handling.
 *
 * Validates: Requirements 12.2, 12.3, 12.4
 */

import * as Notifications from 'expo-notifications';
import type { NotificationService } from '../types/services';
import type { NotificationConfig, NotificationData } from '../types/index';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Creates the concrete NotificationService implementation.
 */
export function createNotificationService(): NotificationService {
  let navigationHandler: ((cardId: string) => void) | null = null;

  return {
    /**
     * Request push notification permission from the user.
     * Returns true if permission is granted, false otherwise.
     * Validates: Requirement 12.2
     */
    async requestPermission(): Promise<boolean> {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus === 'granted') {
        return true;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    },

    /**
     * Check if notification permission is currently granted.
     */
    async hasPermission(): Promise<boolean> {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    },

    /**
     * Schedule a local notification and return its identifier.
     * Validates: Requirement 12.3
     */
    async scheduleLocal(config: NotificationConfig): Promise<string> {
      const trigger: Notifications.NotificationTriggerInput = config.trigger.weekday
        ? {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: config.trigger.weekday,
            hour: config.trigger.hour,
            minute: config.trigger.minute,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: config.trigger.hour,
            minute: config.trigger.minute,
          };

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: config.title,
          body: config.body,
          data: config.data as unknown as Record<string, unknown>,
        },
        trigger,
      });

      return id;
    },

    /**
     * Cancel a previously scheduled notification by its identifier.
     */
    async cancelScheduled(notificationId: string): Promise<void> {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    },

    /**
     * Handle a notification tap and navigate to the appropriate card.
     * Validates: Requirement 12.4
     */
    handleNotificationTap(data: NotificationData): void {
      if (data.type === 'card_reminder' && data.cardId && navigationHandler) {
        navigationHandler(data.cardId);
      }
    },
  };
}

/**
 * Sets the navigation callback for notification taps.
 * Should be called from the root navigator on mount.
 */
let _navigationHandler: ((cardId: string) => void) | null = null;

export function setNotificationNavigationHandler(handler: (cardId: string) => void): void {
  _navigationHandler = handler;
}

export function getNotificationNavigationHandler(): ((cardId: string) => void) | null {
  return _navigationHandler;
}
