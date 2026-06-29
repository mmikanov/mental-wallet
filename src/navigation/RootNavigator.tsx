/**
 * RootNavigator — Native stack navigator managing all top-level screens.
 *
 * Flow:
 * - If disclaimer not acknowledged → DisclaimerScreen (initial)
 * - If disclaimer acknowledged but no Start_Mode → ModeChoice
 * - If disclaimer acknowledged AND Start_Mode exists → MainTabs
 * - Modal presentations: LibraryBrowser, CardCreator
 * - Push screens: Archive, Settings
 *
 * On launch: calls endUnterminatedSessions() to clean up stale sessions.
 *
 * Deep link handling: `card_reminder` notification taps navigate to
 * WalletScreen with the focused card ID.
 *
 * Validates: Requirements 1.1, 1.6, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 11.3, 12.4, 15.1
 */

import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, AppState, AppStateStatus, View, StyleSheet } from 'react-native';
import DisclaimerScreen from '@/screens/DisclaimerScreen';
import ModeChoiceScreen from '@/screens/ModeChoiceScreen';
import CardCreatorScreen from '@/screens/CardCreatorScreen';
import LibraryBrowserScreen from '@/screens/LibraryBrowserScreen';
import UsageHistoryScreen from '@/screens/UsageHistoryScreen';
import ReminderConfigScreen from '@/screens/ReminderConfigScreen';
import ArchiveScreen from '@/screens/ArchiveScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import CrisisResourcesScreen from '@/screens/CrisisResourcesScreen';
import MainTabNavigator from './MainTabNavigator';
import { getDatabase } from '@/data/database';
import { hasStartMode, getStartMode, getLastUsedMode } from '@/services/settingsService';
import { endUnterminatedSessions } from '@/services/emotionSessionService';
import { useSessionStore } from '@/stores/sessionStore';
import type { RootStackParamList } from './types';

type InitialRoute = 'Disclaimer' | 'ModeChoice' | 'MainTabs';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<InitialRoute>('Disclaimer');
  const [initialMainTabsParams, setInitialMainTabsParams] = useState<
    RootStackParamList['MainTabs']
  >(undefined);

  useEffect(() => {
    initializeApp();
  }, []);

  // End active emotion session when app goes to background/inactive (Req 11.3)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        const { isSessionActive, endSession } = useSessionStore.getState();
        if (isSessionActive) {
          endSession();
        }
      }
    });
    return () => subscription.remove();
  }, []);

  async function initializeApp() {
    try {
      // Clean up any unterminated emotion sessions from previous launches (Req 11.3)
      endUnterminatedSessions().catch(() => {
        // Fire-and-forget: non-critical cleanup
      });

      // Check disclaimer status
      const db = await getDatabase();
      const disclaimerResult = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'disclaimer_acknowledged'"
      );
      const disclaimerAcknowledged = disclaimerResult?.value === 'true';

      if (!disclaimerAcknowledged) {
        setInitialRoute('Disclaimer');
      } else {
        // Disclaimer acknowledged — check Start_Mode (Req 1.6, 2.1–2.5)
        const startModeExists = await hasStartMode();

        if (!startModeExists) {
          // No Start_Mode → show ModeChoice (Req 1.9)
          setInitialRoute('ModeChoice');
        } else {
          // Start_Mode exists → determine launch behavior (Req 2.1–2.3)
          const startMode = await getStartMode();
          let effectiveMode: 'wallet' | 'emotion' = 'wallet';

          if (startMode === 'emotion') {
            effectiveMode = 'emotion';
          } else if (startMode === 'last_used') {
            effectiveMode = await getLastUsedMode();
          }
          // startMode === 'wallet' → effectiveMode stays 'wallet'

          if (effectiveMode === 'emotion') {
            // Launch with session card highlighted (Req 2.2)
            setInitialMainTabsParams({
              screen: 'Wallet',
              params: { highlightSessionCard: true },
            });
          }

          setInitialRoute('MainTabs');
        }
      }
    } catch {
      // On error (e.g., first launch before DB is ready), show disclaimer
      setInitialRoute('Disclaimer');
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
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Disclaimer" component={DisclaimerScreen} />
      <Stack.Screen name="ModeChoice" component={ModeChoiceScreen} />
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        initialParams={initialMainTabsParams}
      />
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
