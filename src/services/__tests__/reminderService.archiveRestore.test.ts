/**
 * Bug 2 (1.0.4-user-reported-fixes-round-2): archiving a tool must cancel its
 * scheduled OS notifications while preserving the reminder definition, and
 * restoring the tool must re-arm it.
 *
 * These tests exercise the reminderService seam:
 *  - reactivateForCard (NEW): the inverse of disableForCard. Exploration test —
 *    fails until the method exists.
 *  - disableForCard: cancels OS notifications + marks inactive (already exists).
 *  - reconcileRemindersOnLaunch: must NOT reschedule inactive (archived)
 *    reminders (preservation — locks Req 2.6).
 *
 * The DB is mocked; expo-notifications is mocked so we can assert schedule /
 * cancel calls without touching a device.
 */

import * as Notifications from 'expo-notifications';
import {
  createReminderService,
  reconcileRemindersOnLaunch,
} from '../reminderService';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(7)),
}));

jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(async () => 'os-notif-' + Math.random().toString(36).slice(2)),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly' },
}));

// Discreet setting off by default (body includes the tool name).
jest.mock('../settingsService', () => ({
  getDiscreetNotifications: jest.fn(async () => false),
}));

const { getDatabase } = require('../../data/database');

/** A reminder DB row as stored (notification_id is a JSON array string). */
function reminderRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'rem-1',
    card_id: 'card-1',
    type: 'per_card',
    time: '09:00',
    frequency: JSON.stringify({ type: 'daily' }),
    is_active: 1,
    notification_id: JSON.stringify(['os-old-1']),
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reminderService — archive/restore reminder lifecycle (Bug 2)', () => {
  describe('reactivateForCard (exploration: desired behavior)', () => {
    it('reschedules the preserved inactive reminder and marks it active', async () => {
      const inactive = reminderRow({ is_active: 0, notification_id: JSON.stringify([]) });
      const mockDb = {
        // reactivateForCard calls getFirstAsync three times, in order:
        //  1) active-reminder guard (none active → null),
        //  2) preserved inactive reminder lookup (the row to re-arm),
        //  3) card title for the notification body.
        getFirstAsync: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(inactive)
          .mockResolvedValueOnce({ title: 'Box Breathing' }),
        getAllAsync: jest.fn().mockResolvedValue([]),
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
        execAsync: jest.fn().mockResolvedValue(undefined),
      };
      getDatabase.mockResolvedValue(mockDb);

      const service = createReminderService();
      // Exploration: this method does not exist yet on unfixed code → test fails.
      const result = await (service as any).reactivateForCard('card-1');

      // Rescheduled at least one OS notification.
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      // Flipped is_active back to 1 for the reminder.
      const activated = mockDb.runAsync.mock.calls.some(
        (c: unknown[]) => typeof c[0] === 'string' && /UPDATE reminders SET.*is_active = 1/s.test(c[0] as string)
      );
      expect(activated).toBe(true);
      expect(result).not.toBeNull();
    });

    it('is a no-op and returns null when the card has no reminder', async () => {
      const mockDb = {
        getFirstAsync: jest.fn().mockResolvedValue(null), // no reminder row
        getAllAsync: jest.fn().mockResolvedValue([]),
        runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
        execAsync: jest.fn().mockResolvedValue(undefined),
      };
      getDatabase.mockResolvedValue(mockDb);

      const service = createReminderService();
      const result = await (service as any).reactivateForCard('card-without-reminder');

      expect(result).toBeNull();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('disableForCard (cancels OS notifications + marks inactive)', () => {
    it('cancels each stored OS notification id and sets is_active = 0', async () => {
      const active = reminderRow({ notification_id: JSON.stringify(['os-a', 'os-b']) });
      const mockDb = {
        getAllAsync: jest.fn().mockResolvedValue([active]),
        getFirstAsync: jest.fn().mockResolvedValue(null),
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
        execAsync: jest.fn().mockResolvedValue(undefined),
      };
      getDatabase.mockResolvedValue(mockDb);

      const service = createReminderService();
      await service.disableForCard('card-1');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('os-a');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('os-b');
      const deactivated = mockDb.runAsync.mock.calls.some(
        (c: unknown[]) => typeof c[0] === 'string' && /UPDATE reminders SET is_active = 0/.test(c[0] as string)
      );
      expect(deactivated).toBe(true);
    });
  });
});

describe('reconcileRemindersOnLaunch (preservation — Req 2.6)', () => {
  it('reschedules an ACTIVE reminder whose OS notifications are missing', async () => {
    const active = reminderRow({ is_active: 1, notification_id: JSON.stringify(['os-missing']) });
    const mockDb = {
      // 1) active reminders query; scheduleNotification then reads the title.
      getAllAsync: jest.fn().mockResolvedValue([active]),
      getFirstAsync: jest.fn().mockResolvedValue({ title: 'Box Breathing' }),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      execAsync: jest.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(mockDb);
    // OS has nothing scheduled → the stored id is "missing" → should reschedule.
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

    await reconcileRemindersOnLaunch();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('does NOT reschedule an INACTIVE (archived) reminder', async () => {
    // Only active reminders are selected by the reconcile query; simulate that an
    // archived reminder (is_active = 0) is simply not returned.
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([]), // WHERE is_active = 1 → none
      getFirstAsync: jest.fn().mockResolvedValue({ title: 'Box Breathing' }),
      runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
      execAsync: jest.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(mockDb);

    await reconcileRemindersOnLaunch();

    // Nothing active → nothing scheduled. The archived reminder stays silent.
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    // Confirm the query filters on is_active = 1 (locks the behavior).
    const filteredOnActive = mockDb.getAllAsync.mock.calls.some(
      (c: unknown[]) => typeof c[0] === 'string' && /is_active = 1/.test(c[0] as string)
    );
    expect(filteredOnActive).toBe(true);
  });
});
