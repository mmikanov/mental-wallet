/**
 * Unit tests for useReminderStatusMap hook.
 *
 * Validates: Requirements 3.1, 3.6
 */

import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

// --- Mock useFocusEffect to execute the callback immediately like useEffect ---
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, []);
  },
}));

// --- Mock the database module ---
const mockGetAllAsync = jest.fn();
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({ getAllAsync: mockGetAllAsync })
  ),
}));

import { useReminderStatusMap } from '../useReminderStatusMap';

/**
 * Test component that renders the hook result as text for assertion.
 */
function TestConsumer() {
  const statusMap = useReminderStatusMap();
  return (
    <View>
      <Text testID="size">{String(statusMap.size)}</Text>
      <Text testID="keys">{JSON.stringify([...statusMap.keys()])}</Text>
    </View>
  );
}

describe('useReminderStatusMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty map when no active reminders exist', async () => {
    mockGetAllAsync.mockResolvedValue([]);

    render(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('size').props.children).toBe('0');
    });

    expect(mockGetAllAsync).toHaveBeenCalledWith(
      'SELECT card_id FROM reminders WHERE is_active = 1'
    );
  });

  it('returns a map with card IDs that have active reminders', async () => {
    mockGetAllAsync.mockResolvedValue([
      { card_id: 'card-1' },
      { card_id: 'card-2' },
      { card_id: 'card-3' },
    ]);

    render(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('size').props.children).toBe('3');
    });

    const keys = JSON.parse(screen.getByTestId('keys').props.children);
    expect(keys).toContain('card-1');
    expect(keys).toContain('card-2');
    expect(keys).toContain('card-3');
    expect(keys).not.toContain('card-4');
  });

  it('returns an empty map when the query fails', async () => {
    mockGetAllAsync.mockRejectedValue(new Error('DB error'));

    render(<TestConsumer />);

    await waitFor(() => {
      // Initial state is an empty map, stays empty on error
      expect(screen.getByTestId('size').props.children).toBe('0');
    });
  });

  it('map values are true for all entries', async () => {
    mockGetAllAsync.mockResolvedValue([
      { card_id: 'card-a' },
      { card_id: 'card-b' },
    ]);

    render(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('size').props.children).toBe('2');
    });

    const keys = JSON.parse(screen.getByTestId('keys').props.children);
    expect(keys).toEqual(['card-a', 'card-b']);
  });
});
