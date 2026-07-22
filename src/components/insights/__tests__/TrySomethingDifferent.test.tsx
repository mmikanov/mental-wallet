/**
 * Unit tests for TrySomethingDifferent component.
 *
 * Validates: Requirements 6.10
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TrySomethingDifferent } from '../TrySomethingDifferent';

describe('TrySomethingDifferent', () => {
  it('renders null when tools array is empty (section hidden)', async () => {
    const result = await render(
      <TrySomethingDifferent tools={[]} onToolPress={jest.fn()} />
    );
    expect(result.toJSON()).toBeNull();
  });

  it('renders section title and tool names for multiple tools', async () => {
    await render(
      <TrySomethingDifferent
        tools={[
          { cardId: 'card-1', cardTitle: 'Deep Breathing' },
          { cardId: 'card-2', cardTitle: 'Body Scan' },
        ]}
        onToolPress={jest.fn()}
      />
    );
    expect(screen.getByText('Try something different')).toBeTruthy();
    expect(screen.getByText('Deep Breathing')).toBeTruthy();
    expect(screen.getByText('Body Scan')).toBeTruthy();
  });

  it('each tool row is accessible as a link with proper label', async () => {
    await render(
      <TrySomethingDifferent
        tools={[
          { cardId: 'card-1', cardTitle: 'Deep Breathing' },
          { cardId: 'card-2', cardTitle: 'Body Scan' },
        ]}
        onToolPress={jest.fn()}
      />
    );
    const link1 = screen.getByLabelText('Deep Breathing. Open this tool.');
    expect(link1.props.accessibilityRole).toBe('link');

    const link2 = screen.getByLabelText('Body Scan. Open this tool.');
    expect(link2.props.accessibilityRole).toBe('link');
  });

  it('calls onToolPress with the correct cardId and does not crash without it', async () => {
    // Test with onToolPress provided
    const mockOnToolPress = jest.fn();
    await render(
      <TrySomethingDifferent
        tools={[
          { cardId: 'card-1', cardTitle: 'Deep Breathing' },
          { cardId: 'card-2', cardTitle: 'Body Scan' },
        ]}
        onToolPress={mockOnToolPress}
      />
    );

    fireEvent.press(screen.getByText('Deep Breathing'));
    expect(mockOnToolPress).toHaveBeenCalledWith('card-1');

    fireEvent.press(screen.getByText('Body Scan'));
    expect(mockOnToolPress).toHaveBeenCalledWith('card-2');
    expect(mockOnToolPress).toHaveBeenCalledTimes(2);

    // Test without onToolPress (should not crash) — use rerender
    screen.rerender(
      <TrySomethingDifferent
        tools={[{ cardId: 'card-1', cardTitle: 'Deep Breathing' }]}
      />
    );
    fireEvent.press(screen.getByText('Deep Breathing'));
    // If we get here without crashing, the test passes
  });
});
