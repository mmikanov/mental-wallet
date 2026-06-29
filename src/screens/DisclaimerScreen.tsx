/**
 * DisclaimerScreen — First-launch disclaimer requiring user acknowledgment.
 *
 * Displays: "Mental Health Wallet is not a replacement for therapy
 * or professional mental health care."
 *
 * The user must tap "I Understand" to proceed. Acknowledgment is stored
 * in the settings table so subsequent launches skip this screen.
 *
 * Validates: Requirements 15.1
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getDatabase } from '@/data/database';
import { hasStartMode } from '@/services/settingsService';
import type { RootStackParamList } from '@/navigation/types';

type DisclaimerNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Disclaimer'
>;

export default function DisclaimerScreen() {
  const navigation = useNavigation<DisclaimerNavigationProp>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAcknowledge() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const db = await getDatabase();
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('disclaimer_acknowledged', 'true')"
      );

      // After disclaimer, check if Start_Mode exists to decide next screen
      const startModeExists = await hasStartMode();

      if (startModeExists) {
        // Skip ModeChoice → go straight to wallet
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } else {
        // No Start_Mode → show ModeChoice (Req 1.9)
        navigation.reset({
          index: 0,
          routes: [{ name: 'ModeChoice' }],
        });
      }
    } catch {
      // If storage fails, still let the user proceed — route to ModeChoice as safe default
      navigation.reset({
        index: 0,
        routes: [{ name: 'ModeChoice' }],
      });
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon} accessibilityLabel="Heart icon">
          💙
        </Text>
        <Text style={styles.title}>Welcome to Mental Health Wallet</Text>
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            Mental Health Wallet is not a replacement for therapy or professional
            mental health care.
          </Text>
        </View>
        <Text style={styles.subtext}>
          This app provides self-help tools and coping exercises. If you are
          experiencing a mental health crisis, please contact a professional or
          call 988 (US Suicide &amp; Crisis Lifeline).
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleAcknowledge}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="I Understand — acknowledge disclaimer and proceed"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>I Understand</Text>
          )}
        </TouchableOpacity>
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
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 24,
  },
  disclaimerBox: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    width: '100%',
  },
  disclaimerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    lineHeight: 24,
  },
  subtext: {
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  button: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
