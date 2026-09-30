import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';

interface UpdateAvailableBannerProps {
  /** Opens the update confirmation sheet. The banner is the entry point. */
  onPress: () => void;
  /**
   * Optional override for the visible headline text. When omitted, a sensible
   * default containing "Update available" is shown. The per-card change summary
   * lives in the sheet, not the banner.
   */
  label?: string;
}

const DEFAULT_LABEL = 'Update available — tap to see what changed';
const A11Y_LABEL = 'Update available — see what changed';

/**
 * Prominent, full-width tappable notice shown at the top of the card body when a
 * library update is available (Req 8.1). Tapping it opens the update confirmation
 * sheet (Req 8.4). Uses an informational (blue) palette, deliberately distinct
 * from the amber check-in banner.
 */
export function UpdateAvailableBanner({ onPress, label }: UpdateAvailableBannerProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={A11Y_LABEL}
      activeOpacity={0.7}
    >
      <Text style={styles.text}>{label ?? DEFAULT_LABEL}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#90CAF9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D47A1',
    textAlign: 'center',
  },
});

export default UpdateAvailableBanner;
