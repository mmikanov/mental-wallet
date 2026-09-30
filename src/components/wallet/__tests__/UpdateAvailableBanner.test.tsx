/**
 * UpdateAvailableBanner — component test (Task 9.3, TDD / test-first).
 *
 * **Validates: Requirements 8.1, 8.4**
 *
 * This is the prominent, tappable "update available" notice that replaces the old
 * small pill (Req 8.1 — a banner across the top of the tool, not a badge among
 * badges). Tapping it opens the update confirmation sheet (Req 8.4 — the banner is
 * the entry point, not an inline Update button).
 *
 * ---------------------------------------------------------------------------
 * COMPONENT CONTRACT FOR THE TASK 9.4 IMPLEMENTER
 *
 * File: `src/components/wallet/UpdateAvailableBanner.tsx`
 * Model it on `BadgeExplanationBanner` (full-width bar, StyleSheet, blue palette
 * background #E3F2FD / border #90CAF9 / text #0D47A1 — distinct from the amber
 * check-in banner). Palette is a styling detail and is intentionally NOT asserted
 * here; the contract this test locks is behavior + accessibility + visible text.
 *
 *   Props:
 *     {
 *       onPress: () => void;   // required — opens the UpdateAvailableSheet
 *       label?: string;        // optional — override for the visible/headline text.
 *                              // When omitted, the banner shows a sensible default
 *                              // ("Update available — tap to see what changed").
 *                              // The per-card change summary lives in the SHEET,
 *                              // not the banner; the banner is just the entry point.
 *     }
 *
 *   Rendered element (the tappable bar) MUST expose:
 *     accessibilityRole="button"
 *     accessibilityLabel="Update available — see what changed"   // EXACT string
 *
 *   And it MUST render some visible text containing "Update available", and call
 *   `onPress` when pressed.
 * ---------------------------------------------------------------------------
 *
 * TEST-FIRST: `../UpdateAvailableBanner` does NOT exist yet (Task 9.4 creates it).
 * This import — and therefore the whole suite — is EXPECTED TO FAIL until 9.4
 * lands the component. That failure is the intended TDD red state.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { UpdateAvailableBanner } from '../UpdateAvailableBanner';

const A11Y_LABEL = 'Update available — see what changed';

describe('UpdateAvailableBanner (Req 8.1, 8.4)', () => {
  it('renders a tappable element with the button role and the exact a11y label', async () => {
    await render(<UpdateAvailableBanner onPress={jest.fn()} />);

    const banner = screen.getByLabelText(A11Y_LABEL);
    expect(banner).toBeTruthy();
    expect(banner.props.accessibilityRole).toBe('button');
  });

  it('shows visible text indicating an update is available (default label)', async () => {
    await render(<UpdateAvailableBanner onPress={jest.fn()} />);

    expect(screen.getByText(/Update available/i)).toBeTruthy();
  });

  it('uses a provided label as the visible text when one is given', async () => {
    await render(
      <UpdateAvailableBanner onPress={jest.fn()} label="Update available — 2 changes" />
    );

    expect(screen.getByText('Update available — 2 changes')).toBeTruthy();
  });

  it('calls onPress when the banner is pressed', async () => {
    const onPress = jest.fn();
    await render(<UpdateAvailableBanner onPress={onPress} />);

    fireEvent.press(screen.getByLabelText(A11Y_LABEL));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
