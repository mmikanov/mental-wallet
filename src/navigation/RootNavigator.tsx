/**
 * RootNavigator — Native stack navigator managing all top-level screens.
 *
 * Flow:
 * - If disclaimer not acknowledged → DisclaimerScreen (initial)
 * - Otherwise → MainTabs (WalletScreen via bottom tab)
 * - Modal presentations: LibraryBrowser, CardCreator
 * - Push screens: Archive, Settings
 *
 * Deep link handling: `card_reminder` notification taps navigate to
 * WalletScreen with the focused card ID.
 *
 * Validates: Requirements 2.1, 12.4, 15.1
 */

import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import DisclaimerScreen from '@/screens/DisclaimerScreen';
import CardCreatorScreen from '@/screens/CardCreatorScreen';
import LibraryBrowserScreen from '@/screens/LibraryBrowserScreen';
import UsageHistoryScreen from '@/screens/UsageHistoryScreen';
import ReminderConfigScreen from '@/screens/ReminderConfigScreen';
import ArchiveScreen from '@/screens/ArchiveScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import CrisisResourcesScreen from '@/screens/CrisisResourcesScreen';
import MainTabNavigator from './MainTabNavigator';
import { getDatabase } from '@/data/database';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);

  useEffect(() => {
    checkDisclaimerStatus();
  }, []);

  async function checkDisclaimerStatus() {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'disclaimer_acknowledged'"
      );
      setDisclaimerAcknowledged(result?.value === 'true');
    } catch {
      // On error (e.g., first launch before DB is ready), show disclaimer
      setDisclaimerAcknowledged(false);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={disclaimerAcknowledged ? 'MainTabs' : 'Disclaimer'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Disclaimer" component={DisclaimerScreen} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="LibraryBrowser"
        component={LibraryBrowserScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="CardCreator"
        component={CardCreatorScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Archive" component={ArchiveScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="CrisisResources" component={CrisisResourcesScreen} />
      <Stack.Screen name="UsageHistory" component={UsageHistoryScreen} />
      <Stack.Screen name="ReminderConfig" component={ReminderConfigScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
