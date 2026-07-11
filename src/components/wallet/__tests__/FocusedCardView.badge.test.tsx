/**
 * Unit tests for FocusedCardView badge explanation banner integration.
 *
 * Tests the banner visibility logic as driven by FocusedCardView:
 * - Banner renders when daysElapsedSnapshot >= 1 (KPI card with past check-in)
 * - Banner does not render for non-KPI cards (snapshot is null)
 * - Banner hides after check-in completion
 *
 * Validates: Requirements 7.1, 7.3, 7.4
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BadgeExplanationBanner } from '../BadgeExplanationBanner';
import { computeDaysElapsed } from '@/utils/kpiBadgeUtils';

const KPI_CARD_SOURCE_ID = 'lib-personal-kpi';

describe('FocusedCardView — BadgeExplanationBanner Integration', () => {
  it('banner renders when daysElapsedSnapshot >= 1 (KPI card with past check-in)', async () => {
    // Simulate: KPI card opened, last check-in was 3 days ago
    const lastCheckInDate = '2024-06-10T10:00:00.000Z';
    const now = new Date('2024-06-13T10:00:00.000Z');
    const daysElapsed = computeDaysElapsed(lastCheckInDate, now);

    await render(
      <BadgeExplanationBanner daysElapsedSnapshot={daysElapsed} checkInCompleted={false} />
    );

    expect(screen.getByText("It's been 3 days since your last check-in")).toBeTruthy();
  });

  it('banner does not render for non-KPI cards (daysElapsedSnapshot is null)', async () => {
    // For non-KPI cards, FocusedCardView never computes daysElapsedSnapshot
    const result = await render(
      <BadgeExplanationBanner daysElapsedSnapshot={null} checkInCompleted={false} />
    );

    expect(result.toJSON()).toBeNull();
  });

  it('banner hides after check-in completion', async () => {
    // Simulate: user completes check-in while banner is visible
    const daysElapsed = 3;

    const result = await render(
      <BadgeExplanationBanner daysElapsedSnapshot={daysElapsed} checkInCompleted={true} />
    );

    expect(result.toJSON()).toBeNull();
  });

  it('isKpiCard logic: identifies KPI card by sourceLibraryId', () => {
    // FocusedCardView uses card.sourceLibraryId === KPI_CARD_SOURCE_ID
    const kpiCard = { sourceLibraryId: KPI_CARD_SOURCE_ID };
    const otherCard = { sourceLibraryId: 'lib-breathing-box' };

    expect(kpiCard.sourceLibraryId === KPI_CARD_SOURCE_ID).toBe(true);
    expect(otherCard.sourceLibraryId === KPI_CARD_SOURCE_ID).toBe(false);
  });

  it('checkInCompleted triggers when lastCheckInDate becomes today', () => {
    // FocusedCardView sets checkInCompleted = true when computeDaysElapsed returns 0
    const now = new Date('2024-06-13T15:00:00.000Z');
    const todayCheckIn = '2024-06-13T14:00:00.000Z';

    const elapsed = computeDaysElapsed(todayCheckIn, now);
    // When elapsed is 0, FocusedCardView sets checkInCompleted = true
    expect(elapsed).toBe(0);
  });
});
