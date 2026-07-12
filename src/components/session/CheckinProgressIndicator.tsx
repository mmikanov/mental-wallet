/**
 * CheckinProgressIndicator — Shows step N of 4 with visual dots.
 *
 * Displays a compact progress indicator at the top of the guided check-in flow.
 * Announces "Question [N] of 4" to assistive technology via a live region.
 *
 * Validates: Requirements 2.7, 8.4
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface CheckinProgressIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
  totalSteps?: number;
}

export default function CheckinProgressIndicator({
  currentStep,
  totalSteps = 4,
}: CheckinProgressIndicatorProps) {
  const progressLabel = `Question ${currentStep} of ${totalSteps}`;

  return (
    <View
      style={styles.container}
      accessibilityLiveRegion="polite"
      accessibilityLabel={progressLabel}
    >
      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isFilled = isCurrent || isCompleted;

          return (
            <View
              key={stepNumber}
              style={[
                styles.dot,
                isFilled ? styles.dotFilled : styles.dotUpcoming,
                isCurrent && styles.dotCurrent,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.label}>{progressLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: '#7C3AED',
  },
  dotCurrent: {
    backgroundColor: '#7C3AED',
  },
  dotUpcoming: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});
