/**
 * PracticeTimeDisclosure — a short, muted caption clarifying what the
 * "Practice time" line on the Outcome Trends chart measures.
 *
 * Rendered near the DualAxisChart on BOTH the per-tool and whole-wallet
 * Insights surfaces so the copy reads identically. Informational subtext
 * (ordinary text for screen readers), not a blocking dialog/alert.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';

/** Shared copy so both surfaces read identically. */
export const PRACTICE_TIME_DISCLOSURE_TEXT =
  "Practice time counts time you spend using a tool in the app. It doesn't include time in other apps or external media.";

export function PracticeTimeDisclosure() {
  return (
    <Text
      style={styles.caption}
      accessibilityRole="text"
      testID="practice-time-disclosure"
    >
      {PRACTICE_TIME_DISCLOSURE_TEXT}
    </Text>
  );
}

const styles = StyleSheet.create({
  caption: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 16,
    marginTop: 8,
  },
});

export default PracticeTimeDisclosure;
