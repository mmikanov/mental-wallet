/**
 * TimePeriodSelector — Segmented control for selecting insight time periods.
 *
 * Renders a horizontal row of period options as a pill/segmented control.
 * Available options vary by tier:
 *   - Nascent: 7d, all
 *   - Preliminary: 7d, 30d, all
 *   - Confident: 7d, 30d, 90d, all
 *
 * Validates: Requirements 4.6, 5.9, 9.4
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { TimePeriod } from '@/services/tierEvaluator';

// --- Display labels ---

const PERIOD_LABELS: Record<TimePeriod, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  'all': 'All time',
};

// --- Props ---

export interface TimePeriodSelectorProps {
  availablePeriods: TimePeriod[];
  selectedPeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  /** Periods that are visually dimmed and non-interactive. */
  disabledPeriods?: TimePeriod[];
}

// --- Component ---

export function TimePeriodSelector({
  availablePeriods,
  selectedPeriod,
  onPeriodChange,
  disabledPeriods = [],
}: TimePeriodSelectorProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {availablePeriods.map((period) => {
        const isSelected = period === selectedPeriod;
        const isDisabled = disabledPeriods.includes(period);

        return (
          <TouchableOpacity
            key={period}
            style={[
              styles.segment,
              isSelected && !isDisabled && styles.segmentSelected,
              isDisabled && styles.segmentDisabled,
            ]}
            onPress={isDisabled ? undefined : () => onPeriodChange(period)}
            disabled={isDisabled}
            accessibilityRole="tab"
            accessibilityState={{
              selected: isSelected && !isDisabled,
              disabled: isDisabled,
            }}
            accessibilityLabel={PERIOD_LABELS[period]}
            testID={`period-segment-${period}`}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            activeOpacity={isDisabled ? 1 : 0.7}
          >
            <Text
              style={[
                styles.label,
                isSelected && !isDisabled && styles.labelSelected,
                isDisabled && styles.labelDisabled,
              ]}
            >
              {PERIOD_LABELS[period]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  segmentSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
  },
  labelSelected: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  segmentDisabled: {
    opacity: 0.4,
  },
  labelDisabled: {
    color: '#666666',
  },
});
