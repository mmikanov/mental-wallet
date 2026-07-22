/**
 * InsightTooltip — Reusable explainability tooltip for insight metrics.
 *
 * Renders a small ⓘ icon button (44×44pt minimum tap target) that opens
 * a modal overlay displaying a plain-language explanation of the metric.
 * Dismissible by tapping outside or tapping the close button.
 *
 * When `isPreliminary` is true, a "Based on limited data" qualifier is
 * prepended to signal lower confidence.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 9.4
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';

export interface InsightTooltipProps {
  /** Plain-language explanation shown in the tooltip */
  explanation: string;
  /** When true, prefixes with "Based on limited data" qualifier (Preliminary tier) */
  isPreliminary?: boolean;
}

export function InsightTooltip({ explanation, isPreliminary = false }: InsightTooltipProps) {
  const [visible, setVisible] = useState(false);

  const handleOpen = useCallback(() => {
    setVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <View>
      <TouchableOpacity
        onPress={handleOpen}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel="More information"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID="insight-tooltip-trigger"
      >
        <Text style={styles.triggerIcon}>ⓘ</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
        statusBarTranslucent
        testID="insight-tooltip-modal"
      >
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss tooltip"
          testID="insight-tooltip-backdrop"
        >
          <Pressable
            style={styles.tooltipContainer}
            onPress={(e) => e.stopPropagation()}
            testID="insight-tooltip-content"
          >
            {isPreliminary && (
              <View style={styles.qualifierContainer} testID="insight-tooltip-qualifier">
                <Text style={styles.qualifierText}>Based on limited data</Text>
              </View>
            )}
            <Text style={styles.explanationText}>{explanation}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="insight-tooltip-close"
            >
              <Text style={styles.closeButtonText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerIcon: {
    fontSize: 18,
    color: '#6B7280',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  tooltipContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    maxWidth: 320,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  qualifierContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  qualifierText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
  closeButton: {
    marginTop: 16,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A90D9',
  },
});
