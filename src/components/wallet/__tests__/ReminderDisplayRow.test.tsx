/**
 * Unit tests for ReminderDisplayRow component.
 *
 * Validates: Requirements 2.1, 2.2
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ReminderDisplayRow from '../ReminderDisplayRow';
import type { Reminder } from '@/types';

// --- Test fixtures ---

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'reminder-1',
    cardId: 'card-1',
    type: 'per_card',
    time: '09:00',
    frequency: { type: 'daily' },
    isActive: true,
    notificationId: 'notif-1',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('ReminderDisplayRow', () => {
  // --- Requirement 2.1: Renders when active reminder exists ---
  describe('renders when active reminder exists', () => {
    it('renders bell icon and label for a daily reminder', async () => {
      const reminder = makeReminder({ time: '09:00', frequency: { type: 'daily' } });

      await render(<ReminderDisplayRow reminder={reminder} textColor="#000000" />);

      expect(screen.getByText('🔔')).toBeTruthy();
      expect(screen.getByText('09:00 · Daily')).toBeTruthy();
    });

    it('renders with custom frequency days', async () => {
      const reminder = makeReminder({
        time: '14:30',
        frequency: { type: 'custom', days: [1, 3, 5] },
      });

      await render(<ReminderDisplayRow reminder={reminder} textColor="#FFFFFF" />);

      expect(screen.getByText('🔔')).toBeTruthy();
      expect(screen.getByText('14:30 · Mon, Wed, Fri')).toBeTruthy();
    });

    it('sets accessibilityLabel with formatted reminder info', async () => {
      const reminder = makeReminder({ time: '08:15', frequency: { type: 'daily' } });

      await render(<ReminderDisplayRow reminder={reminder} textColor="#000000" />);

      expect(screen.getByLabelText('Reminder: 08:15 · Daily')).toBeTruthy();
    });
  });

  // --- Requirement 2.2: Hidden when no reminder or isActive=false ---
  describe('hidden when no reminder or isActive=false', () => {
    it('renders nothing when reminder is null', async () => {
      const result = await render(
        <ReminderDisplayRow reminder={null} textColor="#000000" />
      );

      expect(result.toJSON()).toBeNull();
    });

    it('renders nothing when reminder.isActive is false', async () => {
      const reminder = makeReminder({ isActive: false });

      const result = await render(
        <ReminderDisplayRow reminder={reminder} textColor="#000000" />
      );

      expect(result.toJSON()).toBeNull();
    });
  });

  // --- Correct formatting output ---
  describe('correct formatting output', () => {
    it('formats daily frequency as "HH:mm · Daily"', async () => {
      const reminder = makeReminder({ time: '07:30', frequency: { type: 'daily' } });

      await render(<ReminderDisplayRow reminder={reminder} textColor="#333333" />);

      expect(screen.getByText('07:30 · Daily')).toBeTruthy();
    });

    it('formats 3x_week frequency with days in Mon-Sun order', async () => {
      const reminder = makeReminder({
        time: '20:00',
        frequency: { type: '3x_week', days: [0, 3, 5] },
      });

      await render(<ReminderDisplayRow reminder={reminder} textColor="#333333" />);

      // Days should be ordered Mon–Sun: Wed(3), Fri(5), Sun(0)
      expect(screen.getByText('20:00 · Wed, Fri, Sun')).toBeTruthy();
    });

    it('formats custom frequency with all days', async () => {
      const reminder = makeReminder({
        time: '06:00',
        frequency: { type: 'custom', days: [0, 1, 2, 3, 4, 5, 6] },
      });

      await render(<ReminderDisplayRow reminder={reminder} textColor="#333333" />);

      expect(screen.getByText('06:00 · Mon, Tue, Wed, Thu, Fri, Sat, Sun')).toBeTruthy();
    });

    it('applies textColor to both icon and label', async () => {
      const reminder = makeReminder({ time: '12:00', frequency: { type: 'daily' } });

      await render(<ReminderDisplayRow reminder={reminder} textColor="#FF5500" />);

      const icon = screen.getByText('🔔');
      const label = screen.getByText('12:00 · Daily');

      expect(icon.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#FF5500' })])
      );
      expect(label.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#FF5500' })])
      );
    });
  });
});
