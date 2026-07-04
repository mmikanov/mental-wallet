/**
 * ModeChoiceScreen — Onboarding screen for choosing the app's start experience.
 *
 * Presented after Intent Selection when no Start_Mode exists in the database.
 * The user must pick one of two options to proceed — no back navigation.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8
 */

import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as settingsService from '@/services/settingsService';
import { logEvent } from '@/services/analyticsEventLogger';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ModeChoice'>;

export default function ModeChoiceScreen({ navigation }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Req 1.7: No back navigation — hide header and disable gestures
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      gestureEnabled: false,
    });
  }, [navigation]);

  const handleSelect = useCallback(
    async (mode: 'wallet' | 'emotion') => {
      setIsLoading(true);
      setError(null);

      try {
        await settingsService.setStartMode(mode);

        // Log analytics event for mode selection (Requirements 3.4)
        logEvent('start_mode_selected', {
          mode: mode === 'wallet' ? 'wallet_first' : 'emotion_first',
        });

        if (mode === 'wallet') {
          // Req 1.2: Navigate to Wallet with standard stacked card view
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          });
        } else {
          // Req 1.3: Navigate to Wallet with Session Launcher Card highlighted
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'MainTabs',
                params: { screen: 'Wallet', params: { highlightSessionCard: true } },
              },
            ],
          });
        }
      } catch {
        // Req 1.8: Show error, allow retry
        setError('Could not save your preference. Please try again.');
        setIsLoading(false);
      }
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Heading — Req 1.1 */}
        <Text style={styles.heading}>How would you like to start?</Text>

        {/* Option cards */}
        <View style={styles.options}>
          <TouchableOpacity
            style={styles.optionCard}
            activeOpacity={0.7}
            onPress={() => handleSelect('wallet')}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Open my wallet of tools"
          >
            <Text style={styles.optionIcon}>💼</Text>
            <Text style={styles.optionText}>Open my wallet of tools</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            activeOpacity={0.7}
            onPress={() => handleSelect('emotion')}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Start from how I feel right now"
          >
            <Text style={styles.optionIcon}>🫶</Text>
            <Text style={styles.optionText}>Start from how I feel right now</Text>
          </TouchableOpacity>
        </View>

        {/* Loading indicator */}
        {isLoading && (
          <ActivityIndicator
            style={styles.loadingIndicator}
            size="small"
            color="#7C3AED"
          />
        )}

        {/* Error banner — Req 1.8 */}
        {error && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => setError(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <Text style={styles.errorDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Reassurance text — Req 1.4 */}
        <Text style={styles.reassurance}>
          You can always change this in Settings.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 32,
  },
  options: {
    width: '100%',
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  optionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    flexShrink: 1,
  },
  loadingIndicator: {
    marginTop: 24,
  },
  errorBanner: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 24,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  errorDismiss: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  reassurance: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 32,
  },
});
