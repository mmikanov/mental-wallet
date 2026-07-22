/**
 * CorrelationDisclaimer — Shared disclaimer component for correlation insight screens.
 *
 * Always displays a base disclaimer reminding users that patterns reflect associations,
 * not causation. Optionally shows a supportive message about reaching for tools on tough days
 * when negative correlations are present.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface CorrelationDisclaimerProps {
  showNegativeCorrelationNote?: boolean;
}

export function CorrelationDisclaimer({
  showNegativeCorrelationNote = false,
}: CorrelationDisclaimerProps) {
  return (
    <View style={styles.container} accessibilityRole="text">
      <Text style={styles.disclaimerText}>
        These patterns reflect associations in your data — they don't prove that
        any tool caused a change in how you feel.
      </Text>

      {showNegativeCorrelationNote && (
        <View style={styles.negativeNoteContainer}>
          <Text style={styles.negativeNoteText}>
            Reaching for tools on tough days is a sign of good self-care. A lower
            check-in on days you use a tool might simply mean you tend to use it
            when you need it most.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    marginTop: 24,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  negativeNoteContainer: {
    marginTop: 12,
  },
  negativeNoteText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
});
