/**
 * ReminderService — CRUD operations for per-card reminders with
 * notification scheduling and reconciliation on app launch.
 *
 * Validates: Requirements 12.1, 12.5, 12.6
 */

import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { getDatabase } from '../data/database';
import { createNotificationService } from './notificationService';
import { AppError, ErrorCode } from '../types/errors';
import type { Reminder, ReminderConfig, ReminderFrequency, NotificationConfig } from '../types/index';
import type { ReminderService } from '../types/services';

/**
 * Maps a DB row to a Reminder domain object.
 */
function mapRowToReminder(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as string,
    cardId: row.card_id as string,
    type: 'per_card',
    time: row.time as string,
    frequency: JSON.parse((row.frequency as string) || '{}') as ReminderFrequency,
    isActive: (row.is_active as number) === 1,
    notificationId: (row.notification_id as string) || null,
    createdAt: row.created_at as string,
  };
}

/**
 * Given a reminder config, generates the notification configs needed
 * (one per scheduled day for weekly, one for daily).
 */
function buildNotificationConfigs(
  cardTitle: string,
  cardId: string,
  config: ReminderConfig
): NotificationConfig[] {
  const [hourStr, minuteStr] = config.time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  const baseContent = {
    title: 'Time for your practice',
    body: `Time for your ${cardTitle} practice`,
    data: { type: 'card_reminder' as const, cardId },
  };

  if (config.frequency.type === 'daily') {
    return [
      {
        ...baseContent,
        trigger: { hour, minute, repeats: true },
      },
    ];
  }

  // For 3x_week or custom, schedule one notification per selected day
  const days = config.frequency.days || [];
  return days.map((day) => ({
    ...baseContent,
    // Convert 0-based (Sun=0) to expo format (Sun=1)
    trigger: { hour, minute, repeats: true, weekday: day + 1 },
  }));
}

/**
 * Creates the concrete ReminderService implementation.
 */
export function createReminderService(): ReminderService {
  const notificationService = createNotificationService();

  return {
    /**
     * Set a reminder for a card. Creates the DB record and schedules notifications.
     * Validates: Requirement 12.1
     */
    async setCardReminder(cardId: string, config: ReminderConfig): Promise<Reminder> {
      const db = await getDatabase();
      const reminderId = Crypto.randomUUID();
      const now = new Date().toISOString();

      // Get the card title for notification content
      const cardRow = await db.getFirstAsync<{ title: string }>(
        'SELECT title FROM cards WHERE id = ?',
        [cardId]
      );
      const cardTitle = cardRow?.title || 'your tool';

      // Schedule notifications
      const notificationConfigs = buildNotificationConfigs(cardTitle, cardId, config);
      const notificationIds: string[] = [];

      for (const notifConfig of notificationConfigs) {
        const id = await notificationService.scheduleLocal(notifConfig);
        notificationIds.push(id);
      }

      // Store all notification IDs as JSON array
      const notificationIdValue = JSON.stringify(notificationIds);

      try {
        await db.runAsync(
          `INSERT INTO reminders (id, card_id, type, time, frequency, is_active, notification_id, created_at)
           VALUES (?, ?, 'per_card', ?, ?, 1, ?, ?)`,
          [
            reminderId,
            cardId,
            config.time,
            JSON.stringify(config.frequency),
            notificationIdValue,
            now,
          ]
        );
      } catch (error) {
        // Cancel scheduled notifications if DB insert fails
        for (const nId of notificationIds) {
          await notificationService.cancelScheduled(nId).catch(() => {});
        }
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to save reminder',
          error instanceof Error ? error : undefined
        );
      }

      return {
        id: reminderId,
        cardId,
        type: 'per_card',
        time: config.time,
        frequency: config.frequency,
        isActive: true,
        notificationId: notificationIdValue,
        createdAt: now,
      };
    },

    /**
     * Get the active reminder for a card, if any.
     */
    async getReminder(cardId: string): Promise<Reminder | null> {
      const db = await getDatabase();

      const row = await db.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM reminders WHERE card_id = ? AND is_active = 1 LIMIT 1',
        [cardId]
      );

      if (!row) return null;
      return mapRowToReminder(row);
    },

    /**
     * Update an existing reminder's configuration.
     * Cancels old notifications and schedules new ones.
     * Validates: Requirement 12.5
     */
    async updateReminder(reminderId: string, config: ReminderConfig): Promise<Reminder> {
      const db = await getDatabase();

      const existing = await db.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM reminders WHERE id = ?',
        [reminderId]
      );

      if (!existing) {
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_NOT_FOUND,
          `Reminder not found: ${reminderId}`
        );
      }

      const reminder = mapRowToReminder(existing);

      // Cancel existing notifications
      await cancelNotificationIds(reminder.notificationId);

      // Get card title for new notifications
      const cardRow = await db.getFirstAsync<{ title: string }>(
        'SELECT title FROM cards WHERE id = ?',
        [reminder.cardId]
      );
      const cardTitle = cardRow?.title || 'your tool';

      // Schedule new notifications
      const notificationConfigs = buildNotificationConfigs(cardTitle, reminder.cardId, config);
      const notificationIds: string[] = [];

      for (const notifConfig of notificationConfigs) {
        const id = await notificationService.scheduleLocal(notifConfig);
        notificationIds.push(id);
      }

      const notificationIdValue = JSON.stringify(notificationIds);

      await db.runAsync(
        `UPDATE reminders SET time = ?, frequency = ?, notification_id = ? WHERE id = ?`,
        [config.time, JSON.stringify(config.frequency), notificationIdValue, reminderId]
      );

      return {
        ...reminder,
        time: config.time,
        frequency: config.frequency,
        notificationId: notificationIdValue,
      };
    },

    /**
     * Delete a reminder. Cancels associated notifications.
     * Validates: Requirement 12.5
     */
    async deleteReminder(reminderId: string): Promise<void> {
      const db = await getDatabase();

      const existing = await db.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM reminders WHERE id = ?',
        [reminderId]
      );

      if (!existing) return;

      const reminder = mapRowToReminder(existing);
      await cancelNotificationIds(reminder.notificationId);

      await db.runAsync('DELETE FROM reminders WHERE id = ?', [reminderId]);
    },

    /**
     * Disable all reminders for a card (used when archiving).
     * Validates: Requirement 12.6
     */
    async disableForCard(cardId: string): Promise<void> {
      const db = await getDatabase();

      const rows = await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM reminders WHERE card_id = ? AND is_active = 1',
        [cardId]
      );

      for (const row of rows) {
        const reminder = mapRowToReminder(row);
        await cancelNotificationIds(reminder.notificationId);
      }

      await db.runAsync(
        'UPDATE reminders SET is_active = 0 WHERE card_id = ?',
        [cardId]
      );
    },

    /**
     * Schedule a system notification for a reminder.
     * Used internally by setCardReminder and updateReminder.
     */
    async scheduleNotification(reminder: Reminder): Promise<void> {
      const db = await getDatabase();
      const cardRow = await db.getFirstAsync<{ title: string }>(
        'SELECT title FROM cards WHERE id = ?',
        [reminder.cardId]
      );
      const cardTitle = cardRow?.title || 'your tool';

      const config: ReminderConfig = {
        time: reminder.time,
        frequency: reminder.frequency,
      };

      const notificationConfigs = buildNotificationConfigs(cardTitle, reminder.cardId, config);
      const notificationIds: string[] = [];

      for (const notifConfig of notificationConfigs) {
        const id = await notificationService.scheduleLocal(notifConfig);
        notificationIds.push(id);
      }

      const notificationIdValue = JSON.stringify(notificationIds);
      await db.runAsync(
        'UPDATE reminders SET notification_id = ? WHERE id = ?',
        [notificationIdValue, reminder.id]
      );
    },
  };
}

/**
 * Reconciles scheduled notifications with active reminders on app launch.
 * If a reminder in the DB doesn't have a matching scheduled notification,
 * it reschedules it.
 */
export async function reconcileRemindersOnLaunch(): Promise<void> {
  const db = await getDatabase();
  const notificationService = createNotificationService();

  try {
    const activeReminders = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM reminders WHERE is_active = 1'
    );

    if (activeReminders.length === 0) return;

    // Get all currently scheduled notifications
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIds = new Set(scheduledNotifications.map((n) => n.identifier));

    const reminderService = createReminderService();

    for (const row of activeReminders) {
      const reminder = mapRowToReminder(row);
      const storedIds = parseNotificationIds(reminder.notificationId);

      // Check if any stored notification IDs are missing from scheduled
      const hasMissing = storedIds.some((id) => !scheduledIds.has(id));

      if (hasMissing || storedIds.length === 0) {
        // Cancel any remaining and reschedule
        for (const id of storedIds) {
          if (scheduledIds.has(id)) {
            await notificationService.cancelScheduled(id).catch(() => {});
          }
        }
        await reminderService.scheduleNotification(reminder);
      }
    }
  } catch {
    // Non-fatal — log but don't crash the app
    console.warn('Failed to reconcile reminders on launch');
  }
}

/**
 * Parses stored notification IDs (could be JSON array or single string).
 */
function parseNotificationIds(notificationId: string | null): string[] {
  if (!notificationId) return [];
  try {
    const parsed = JSON.parse(notificationId);
    if (Array.isArray(parsed)) return parsed;
    return [notificationId];
  } catch {
    return notificationId ? [notificationId] : [];
  }
}

/**
 * Cancels all notification IDs stored in a reminder's notification_id field.
 */
async function cancelNotificationIds(notificationId: string | null): Promise<void> {
  const ids = parseNotificationIds(notificationId);
  const notificationService = createNotificationService();
  for (const id of ids) {
    await notificationService.cancelScheduled(id).catch(() => {});
  }
}
