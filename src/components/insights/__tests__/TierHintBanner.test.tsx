/**
 * Unit tests for TierHintBanner component.
 * Validates: Requirements 11.9, 11.10
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TierHintBanner } from '../TierHintBanner';

// Mock the InsightsStore
const mockDismissTierHint = jest.fn();
let mockTierHintsDismissed = {
  below_nascent: true,
  nascent: false,
  preliminary: false,
  confident: false,
};

jest.mock('@/stores/insightsStore', () => ({
  useInsightsStore: Object.assign(
    (selector: (state: any) => any) => {
      const state = {
        tierHintsDismissed: mockTierHintsDismissed,
      };
      return selector(state);
    },
    {
      getState: () => ({
        dismissTierHint: mockDismissTierHint,
      }),
    }
  ),
}));

describe('TierHintBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTierHintsDismissed = {
      below_nascent: true,
      nascent: false,
      preliminary: false,
      confident: false,
    };
  });

  it('renders nascent tier hint text', async () => {
    await render(<TierHintBanner tier="nascent" />);
    expect(
      screen.getByText(
        "Welcome! As you check in and practice, we'll start spotting patterns for you."
      )
    ).toBeTruthy();
  });

  it('renders preliminary tier hint text', async () => {
    await render(<TierHintBanner tier="preliminary" />);
    expect(
      screen.getByText(
        /You've unlocked early patterns/
      )
    ).toBeTruthy();
  });

  it('renders confident tier hint text', async () => {
    await render(<TierHintBanner tier="confident" />);
    expect(
      screen.getByText(
        'Full insights unlocked! You now have access to your complete toolkit analysis.'
      )
    ).toBeTruthy();
  });

  it('renders nothing for below_nascent tier', async () => {
    await render(<TierHintBanner tier="below_nascent" />);
    expect(screen.queryByText('Got it')).toBeNull();
  });

  it('renders nothing when tier hint is already dismissed', async () => {
    mockTierHintsDismissed = {
      below_nascent: true,
      nascent: true,
      preliminary: false,
      confident: false,
    };

    await render(<TierHintBanner tier="nascent" />);
    expect(screen.queryByText('Got it')).toBeNull();
  });

  it('calls dismissTierHint when "Got it" is pressed', async () => {
    await render(<TierHintBanner tier="nascent" />);

    fireEvent.press(screen.getByText('Got it'));

    expect(mockDismissTierHint).toHaveBeenCalledWith('nascent');
  });

  it('has accessible dismiss button with label', async () => {
    await render(<TierHintBanner tier="nascent" />);
    expect(screen.getByLabelText('Dismiss hint')).toBeTruthy();
  });

  it('has accessibility role "alert" on the container', async () => {
    await render(<TierHintBanner tier="nascent" />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
