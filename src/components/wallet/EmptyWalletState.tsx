/**
 * EmptyWalletState — Shown when the wallet has 0 cards.
 *
 * Displays: "Add your first coping tool" message with a prominent
 * "Add tool" button linking to the library browser.
 *
 * Validates: Requirements 1.5
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface EmptyWalletStateProps {
  onAddToolPress: () => void;
}

export default function EmptyWalletState({
  onAddToolPress,
}: EmptyWalletStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon} accessibilityLabel="Cards icon">
        🃏
      </Text>
      <Text style={styles.message}>Add your first coping tool</Text>
      <Text style={styles.subtext}>
        Browse the library to find tools that work for you, or create your own.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={onAddToolPress}
        accessibilityRole="button"
        accessibilityLabel="Add tool"
        accessibilityHint="Opens the library browser to add a coping tool"
      >
        <Text style={styles.buttonText}>Add tool</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    fontSize: 56,
    marginBottom: 20,
  },
  message: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  button: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minHeight: 48,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
