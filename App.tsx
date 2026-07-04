import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from '@/navigation/RootNavigator';
import { linking } from '@/navigation/linking';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import {
  recordBackgroundEntry,
  handleForegroundReturn,
  getSessionState,
} from '@/services/analyticsSession';
import { logEvent } from '@/services/analyticsEventLogger';
import { getDaysSinceInstall } from '@/services/analyticsRetention';

export default function App() {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Initialize analytics (non-blocking — failures never prevent app from starting)
    try {
      useAnalyticsStore.getState().initialize().then(() => {
        // Store the initial session ID after initialization completes
        sessionIdRef.current = getSessionState().sessionId;
      }).catch(() => {
        // Analytics initialization failed — silently continue
      });
    } catch {
      // Synchronous errors in initialization — silently continue
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        try {
          if (nextAppState === 'background') {
            recordBackgroundEntry();
          } else if (
            nextAppState === 'active' &&
            appStateRef.current !== 'active'
          ) {
            const previousSessionId = sessionIdRef.current;
            const session = handleForegroundReturn();
            sessionIdRef.current = session.sessionId;

            // If a new session was started (30-min timeout expired), log app_opened
            if (
              previousSessionId !== null &&
              session.sessionId !== previousSessionId
            ) {
              getDaysSinceInstall()
                .then((daysSinceInstall) =>
                  logEvent('app_opened', { days_since_install: daysSinceInstall })
                )
                .catch(() => {
                  // Analytics event failed — silently continue
                });
            }
          }
        } catch {
          // AppState handling error — silently continue
        }

        appStateRef.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <NavigationContainer linking={linking}>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
