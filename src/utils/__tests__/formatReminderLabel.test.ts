/**
 * Unit tests for formatReminderLabel utility.
 *
 * Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.8
 */

import { formatReminderLabel } from '../formatReminderLabel';
import type { Reminder } from '@/types';

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'test-reminder',
    cardId: 'test-card',
    type: 'per_card',
    time: '09:00',
    frequency: { type: 'daily' },
    isActive: true,
    notificationId: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('formatReminderLabel', () => {
  describe('daily frequency', () => {
    it('returns "HH:mm · Daily" for daily frequency', () => {
      const reminder = makeReminder({ time: '09:00', frequency: { type: 'daily' } });
      expect(formatReminderLabel(reminder)).toBe('09:00 · Daily');
    });

    it('preserves time exactly as stored', () => {
      const reminder = makeReminder({ time: '23:45', frequency: { type: 'daily' } });
      expect(formatReminderLabel(reminder)).toBe('23:45 · Daily');
    });

    it('handles midnight time', () => {
      const reminder = makeReminder({ time: '00:00', frequency: { type: 'daily' } });
      expect(formatReminderLabel(reminder)).toBe('00:00 · Daily');
    });
  });

  describe('3x_week frequency', () => {
    it('formats Mon, Wed, Fri correctly', () => {
      const reminder = makeReminder({
        time: '09:00',
        frequency: { type: '3x_week', days: [1, 3, 5] },
      });
      expect(formatReminderLabel(reminder)).toBe('09:00 · Mon, Wed, Fri');
    });

    it('sorts days in Mon–Sun calendar order regardless of input order', () => {
      const reminder = makeReminder({
        time: '08:30',
        frequency: { type: '3x_week', days: [5, 1, 3] },
      });
      expect(formatReminderLabel(reminder)).toBe('08:30 · Mon, Wed, Fri');
    });

    it('handles Sunday (0) placed last in calendar order', () => {
      const reminder = makeReminder({
        time: '07:00',
        frequency: { type: '3x_week', days: [0, 3, 6] },
      });
      expect(formatReminderLabel(reminder)).toBe('07:00 · Wed, Sat, Sun');
    });
  });

  describe('custom frequency', () => {
    it('formats single day', () => {
      const reminder = makeReminder({
        time: '14:00',
        frequency: { type: 'custom', days: [2] },
      });
      expect(formatReminderLabel(reminder)).toBe('14:00 · Tue');
    });

    it('formats all days in Mon–Sun order', () => {
      const reminder = makeReminder({
        time: '06:00',
        frequency: { type: 'custom', days: [0, 1, 2, 3, 4, 5, 6] },
      });
      expect(formatReminderLabel(reminder)).toBe('06:00 · Mon, Tue, Wed, Thu, Fri, Sat, Sun');
    });

    it('formats weekend days correctly', () => {
      const reminder = makeReminder({
        time: '10:00',
        frequency: { type: 'custom', days: [0, 6] },
      });
      expect(formatReminderLabel(reminder)).toBe('10:00 · Sat, Sun');
    });

    it('handles empty days array gracefully', () => {
      const reminder = makeReminder({
        time: '12:00',
        frequency: { type: 'custom', days: [] },
      });
      // Empty days produces empty frequency part
      expect(formatReminderLabel(reminder)).toBe('12:00 · ');
    });
  });
});
