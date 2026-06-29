/**
 * SessionActiveBanner — Floating indicator that an emotion session is active.
 * Shows when the user navigates away from the session launcher to view a tool.
 * Tapping returns to the session launcher card.
 */

import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SessionActiveBannerProps {
  onReturnToSession: () => void;
}

export default function SessionActiveBanner({ onReturnToSession }: SessionActiveBannerProps) {
  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onReturnToSession}
      accessibilityRole="button"
      accessibilityLabel="Session active. Tap to return to session"
    >
      <Text style={styles.dot}>●</Text>
      <Text style={styles.text}>Session active</Text>
      <Text style={styles.action}>Tap to return</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 100,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  dot: {
    fontSize: 8,
    color: '#A5F3FC',
    marginRight: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  action: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 8,
  },
});
