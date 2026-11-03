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

/**
 * Bug 3 (1.0.6-bug-fixes): "an archived tool's reminder still fires".
 *
 * On-device verification on a real iPhone (current code) showed the bug is NOT
 * reproducible — archiving a tool with a reminder cancels the OS notification,
 * marks the reminder inactive, the notification does not fire, and a relaunch
 * does not re-arm it. There is therefore no behavioral fix; these regression
 * tests lock the already-correct service-layer behavior so it can't silently
 * regress.
 *
 * Honest trust level: this proves `disableForCard` cancels EACH stored OS id and
 * flips the row inactive (the layer the bug would have lived in), and that the
 * restore path re-arms WITHOUT double-scheduling. It does NOT prove the OS-level
 * repeating notification stops — that was verified ON-DEVICE (two clean iPhone
 * runs, V.4), not by this unit suite.
 */
describe('reminderService — Bug 3 regression (archive cancels + inactivates; restore re-arms)', () => {
  it('REGRESSION (disableForCard): cancels every stored OS id AND marks the reminder inactive', async () => {
    // A card with an active reminder carrying three stored OS notification ids.
    const storedIds = ['os-a', 'os-b', 'os-c'];
    const active = reminderRow({ notification_id: JSON.stringify(storedIds) });
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([active]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      execAsync: jest.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(mockDb);

    const service = createReminderService();
    await service.disableForCard('card-1');

    // (a) EVERY stored scheduled OS id is cancelled — exactly these, no more/less.
    for (const id of storedIds) {
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(id);
    }
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(storedIds.length);

    // (b) The reminder row is marked inactive (is_active = 0) for the card.
    const inactivateCall = mockDb.runAsync.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' && /UPDATE reminders SET is_active = 0 WHERE card_id = \?/.test(c[0] as string)
    );
    expect(inactivateCall).toBeDefined();
    expect(inactivateCall?.[1]).toEqual(['card-1']);
  });

  it('PRESERVATION (reactivateForCard): re-arms the preserved reminder and does NOT double-schedule', async () => {
    const inactive = reminderRow({ is_active: 0, notification_id: JSON.stringify([]) });
    const mockDb = {
      // 1) active-reminder guard (none active → null),
      // 2) preserved inactive reminder lookup (the row to re-arm),
      // 3) card title for the notification body.
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
    const result = await service.reactivateForCard('card-1');

    // Re-armed: the daily reminder schedules exactly one OS notification (no double-schedule).
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    // Flipped back to active.
    const activated = mockDb.runAsync.mock.calls.some(
      (c: unknown[]) => typeof c[0] === 'string' && /UPDATE reminders SET.*is_active = 1/s.test(c[0] as string)
    );
    expect(activated).toBe(true);
    expect(result).not.toBeNull();
    expect(result?.isActive).toBe(true);
  });

  it('PRESERVATION (reactivateForCard): does NOT re-schedule when an active reminder already exists', async () => {
    // Guard against double-scheduling: an already-active reminder is returned untouched.
    const alreadyActive = reminderRow({ is_active: 1, notification_id: JSON.stringify(['os-live']) });
    const mockDb = {
      getFirstAsync: jest.fn().mockResolvedValueOnce(alreadyActive),
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
      execAsync: jest.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(mockDb);

    const service = createReminderService();
    const result = await service.reactivateForCard('card-1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
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
