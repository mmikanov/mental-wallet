/**
 * Unit tests for BadgeExplanationBanner component.
 *
 * Validates: Requirements 7.1, 7.3, 7.4, 7.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BadgeExplanationBanner } from '../BadgeExplanationBanner';

describe('BadgeExplanationBanner', () => {
  it('renders nothing when daysElapsedSnapshot is null', async () => {
    const result = await render(
      <BadgeExplanationBanner daysElapsedSnapshot={null} checkInCompleted={false} />
    );
    expect(result.toJSON()).toBeNull();
  });

  it('renders nothing when daysElapsedSnapshot is 0', async () => {
    const result = await render(
      <BadgeExplanationBanner daysElapsedSnapshot={0} checkInCompleted={false} />
    );
    expect(result.toJSON()).toBeNull();
  });

  it('renders nothing when checkInCompleted is true', async () => {
    const result = await render(
      <BadgeExplanationBanner daysElapsedSnapshot={5} checkInCompleted={true} />
    );
    expect(result.toJSON()).toBeNull();
  });

  it('renders singular "day" message for daysElapsedSnapshot = 1', async () => {
    await render(
      <BadgeExplanationBanner daysElapsedSnapshot={1} checkInCompleted={false} />
    );
    expect(screen.getByText("It's been 1 day since your last check-in")).toBeTruthy();
  });

  it('renders plural "days" message for daysElapsedSnapshot >= 2', async () => {
    await render(
      <BadgeExplanationBanner daysElapsedSnapshot={3} checkInCompleted={false} />
    );
    expect(screen.getByText("It's been 3 days since your last check-in")).toBeTruthy();
  });
});
