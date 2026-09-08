import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, I18nManager, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// The app UI is English-only. Lock layout direction to left-to-right so that
// devices set to a right-to-left locale (e.g. Hebrew, Arabic) don't mirror the
// interface (flipped headers, right-aligned bullets, swapped controls). This
// only affects LAYOUT DIRECTION — users can still type and store any script
// (including Hebrew) in text fields. Runs once at module load, before render.
try {
  if (I18nManager.allowRTL) {
    I18nManager.allowRTL(false);
  }
  if (I18nManager.isRTL && I18nManager.forceRTL) {
    I18nManager.forceRTL(false);
  }
} catch {
  // I18nManager may be unavailable in some environments (e.g. tests) — safe to ignore.
}
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
