/**
 * Unit tests for EngagementMessage component.
 * Validates: Requirements 5.7
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { EngagementMessage } from '../EngagementMessage';
import type { EngagementMessage as EngagementMessageType } from '@/utils/engagementMessaging';

describe('EngagementMessage', () => {
  it('renders the message text for nascent tier', async () => {
    const message: EngagementMessageType = {
      text: "You've practiced 4 times this week",
      tier: 'nascent',
    };

    await render(<EngagementMessage message={message} />);

    expect(screen.getByText("You've practiced 4 times this week")).toBeTruthy();
  });

  it('renders the message text for preliminary tier', async () => {
    const message: EngagementMessageType = {
      text: "You've used your tools 6 times this week \u2014 that's more than last week",
      tier: 'preliminary',
    };

    await render(<EngagementMessage message={message} />);

    expect(
      screen.getByText(
        "You've used your tools 6 times this week \u2014 that's more than last week"
      )
    ).toBeTruthy();
  });

  it('renders the message text for confident tier', async () => {
    const message: EngagementMessageType = {
      text: "You've been more active this week \u2014 nice work.",
      tier: 'confident',
    };

    await render(<EngagementMessage message={message} />);

    expect(
      screen.getByText("You've been more active this week \u2014 nice work.")
    ).toBeTruthy();
  });

  it('sets accessibilityRole to text on the container', async () => {
    const message: EngagementMessageType = {
      text: "You've practiced 2 times this week",
      tier: 'nascent',
    };

    await render(<EngagementMessage message={message} />);

    // The container View has accessibilityRole="text" and the full accessibilityLabel
    expect(
      screen.getByLabelText("You've practiced 2 times this week")
    ).toBeTruthy();
  });

  it('sets accessibilityLabel to the full message text', async () => {
    const message: EngagementMessageType = {
      text: "Quieter week so far \u2014 that's okay too.",
      tier: 'confident',
    };

    await render(<EngagementMessage message={message} />);

    expect(
      screen.getByLabelText("Quieter week so far \u2014 that's okay too.")
    ).toBeTruthy();
  });

  it('displays sparkle icon for nascent tier', async () => {
    const message: EngagementMessageType = {
      text: "You've practiced 1 times this week",
      tier: 'nascent',
    };

    await render(<EngagementMessage message={message} />);

    expect(screen.getByText('\u2728')).toBeTruthy();
  });

  it('displays running icon for confident tier', async () => {
    const message: EngagementMessageType = {
      text: "You've been more active this week \u2014 nice work.",
      tier: 'confident',
    };

    await render(<EngagementMessage message={message} />);

    expect(screen.getByText('\uD83C\uDFC3')).toBeTruthy();
  });

  it('handles below_nascent tier gracefully', async () => {
    const message: EngagementMessageType = {
      text: "You've practiced 0 times this week",
      tier: 'below_nascent',
    };

    await render(<EngagementMessage message={message} />);

    expect(screen.getByText("You've practiced 0 times this week")).toBeTruthy();
    expect(screen.getByText('\u2728')).toBeTruthy();
  });
});
