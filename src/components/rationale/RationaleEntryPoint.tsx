/**
 * RationaleEntryPoint — Inline "Learn more" hyperlink appended to card description.
 *
 * Renders nothing if `inANutshell` is undefined, empty, or whitespace-only.
 * Designed to be placed inside a <Text> element as a nested inline link,
 * appearing at the end of the tool description paragraph.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface RationaleEntryPointProps {
  /** The in_a_nutshell text — if empty/whitespace, component renders null */
  inANutshell: string | undefined;
  /** Callback when tapped — opens the RationaleSheet */
  onPress: () => void;
}

export function RationaleEntryPoint({ inANutshell, onPress }: RationaleEntryPointProps) {
  if (!inANutshell || inANutshell.trim().length === 0) {
    return null;
  }

  return (
    <Text
      style={styles.link}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel="Learn more about why this might help"
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
    >
      {' Learn more'}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
});
