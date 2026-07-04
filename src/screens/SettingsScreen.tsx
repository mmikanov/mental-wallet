/**
 * SettingsScreen — App settings with data management, crisis resources, and disclaimer.
 * Crisis resources are accessible within 2 taps from any screen (via Settings).
 *
 * Validates: Requirements 15.2, 15.4, 16.2, 16.3
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { createExportService } from '../services/exportService';
import { CommonActions } from '@react-navigation/native';
import StartExperienceSetting from '@/components/settings/StartExperienceSetting';
import { getDatabase, closeDatabase } from '@/data/database';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useKpiStore } from '@/stores/kpiStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { getFlushIntervalMs, setFlushIntervalMs } from '@/config/analytics';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingAnalytics, setIsResettingAnalytics] = useState(false);
  const [currentFlushInterval, setCurrentFlushInterval] = useState(getFlushIntervalMs());

  // Triple-tap on header title to open dev event viewer (dev builds only)
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHeaderTitlePress = useCallback(() => {
    if (!__DEV__) return;
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      navigation.navigate('DevEventViewer');
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 500);
    }
  }, [navigation]);

  const analyticsOptIn = useAnalyticsStore(state => state.optIn);

  const { personalKpi, isLoading: isKpiLoading, loadKpi } = useKpiStore();

  useEffect(() => {
    loadKpi();
  }, []);

  const exportService = createExportService();

  function handleExportData() {
    Alert.alert('Export Data', 'Choose a format for your data export.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'JSON',
        onPress: () => performExport('json'),
      },
      {
        text: 'CSV',
        onPress: () => performExport('csv'),
      },
    ]);
  }

  async function performExport(format: 'json' | 'csv') {
    setIsExporting(true);
    try {
      await exportService.exportData(format);
    } catch {
      Alert.alert('Export Failed', 'Unable to export your data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  function handleDeleteAllData() {
    Alert.alert(
      'Delete All Data',
      'This will permanently remove ALL your personal data (cards, entries, mood logs, statistics) and reset the app to its initial state. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: confirmDeleteAllData,
        },
      ]
    );
  }

  async function confirmDeleteAllData() {
    setIsDeleting(true);
    try {
      await exportService.deleteAllData();
      // Navigate to disclaimer screen (reset state)
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Disclaimer' }],
        })
      );
    } catch {
      Alert.alert('Delete Failed', 'Unable to delete your data. Please try again.');
      setIsDeleting(false);
    }
  }

  function handleCrisisResources() {
    navigation.navigate('CrisisResources');
  }

  function handleResetAnalyticsData() {
    Alert.alert(
      'Reset Analytics Data',
      'This will delete your locally stored anonymous usage data and generate a new anonymous identity. Your app content (cards, entries, settings) will not be affected. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            setIsResettingAnalytics(true);
            try {
              await useAnalyticsStore.getState().resetData();
              Alert.alert(
                'Reset Complete',
                'Your anonymous analytics data has been reset and a new anonymous identity has been generated.',
                [{ text: 'OK' }]
              );
            } catch {
              Alert.alert(
                'Reset Failed',
                'Unable to reset analytics data. Please try again.'
              );
            } finally {
              // Keep the success message visible for at least 3 seconds
              setTimeout(() => {
                setIsResettingAnalytics(false);
              }, 3000);
            }
          },
        },
      ]
    );
  }

  async function handleResetOnboarding() {
    Alert.alert(
      'Reset Onboarding',
      'This will clear onboarding state, delete all cards, and restart at the Welcome screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            await db.runAsync("DELETE FROM settings WHERE key IN ('onboarding_state', 'disclaimer_acknowledged', 'start_mode')");
            await db.runAsync('DELETE FROM control_values');
            await db.runAsync('DELETE FROM completions');
            await db.runAsync('DELETE FROM reminders');
            await db.runAsync('DELETE FROM controls');
            await db.runAsync('DELETE FROM background_overlays');
            await db.runAsync('DELETE FROM cards');
            // Reset Zustand store in-memory state
            useOnboardingStore.setState({
              disclaimerAcknowledged: false,
              onboardingScreensComplete: false,
              selectedIntent: null,
              kpiSelectionComplete: false,
              tutorialComplete: false,
              checklist: { openTool: false, tryExercise: false, addTool: false },
              checklistSessionCount: 0,
              bannerDismissed: false,
              isChecklistVisible: false,
              isChecklistComplete: false,
            });
            // Clear the cached DB singleton so seedData re-runs and re-creates session launcher
            await closeDatabase();
            navigation.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
            );
          },
        },
      ]
    );
  }

  async function handleResetEntireApp() {
    Alert.alert(
      'Reset Entire App',
      'This will DELETE ALL DATA (cards, completions, KPI records, settings, emotion sessions) and restart from scratch. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Nuke Everything',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            // Clear all data tables
            await db.runAsync('DELETE FROM control_values');
            await db.runAsync('DELETE FROM completions');
            await db.runAsync('DELETE FROM kpi_records');
            await db.runAsync('DELETE FROM reminders');
            await db.runAsync('DELETE FROM controls');
            await db.runAsync('DELETE FROM background_overlays');
            await db.runAsync('DELETE FROM cards');
            await db.runAsync('DELETE FROM settings');
            // Clear emotion tables if they exist
            try {
              await db.runAsync('DELETE FROM emotion_sessions');
              await db.runAsync('DELETE FROM emotion_entries');
            } catch {
              // Tables may not exist — that's fine
            }
            // Reset all Zustand stores
            useOnboardingStore.setState({
              disclaimerAcknowledged: false,
              onboardingScreensComplete: false,
              selectedIntent: null,
              kpiSelectionComplete: false,
              tutorialComplete: false,
              checklist: { openTool: false, tryExercise: false, addTool: false },
              checklistSessionCount: 0,
              bannerDismissed: false,
              isChecklistVisible: false,
              isChecklistComplete: false,
            });
            useKpiStore.setState({
              personalKpi: null,
              isLoading: false,
            });
            // Clear the cached DB singleton so seedData re-runs on next access
            await closeDatabase();
            navigation.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding' }] })
            );
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleHeaderTitlePress}
          activeOpacity={1}
          accessibilityLabel="Settings"
          style={styles.headerTitleTouchable}
        >
          <Text style={styles.headerTitle}>Settings</Text>
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Start Experience Section */}
        <StartExperienceSetting />

        {/* Focus Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focus</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('KpiChange')}
            accessibilityLabel={`What I'm focusing on: ${personalKpi ?? 'Not set'}. Tap to change.`}
            accessibilityRole="button"
          >
            <Text style={styles.menuItemIcon}>🎯</Text>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemText}>What I'm focusing on</Text>
              <Text style={styles.menuItemSubtitle} numberOfLines={1}>
                {isKpiLoading ? 'Loading…' : (personalKpi ?? 'Not set')}
              </Text>
            </View>
            <Text style={styles.menuItemChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleExportData}
            disabled={isExporting}
            accessibilityLabel="Export data"
            accessibilityRole="button"
          >
            <Text style={styles.menuItemIcon}>📤</Text>
            <Text style={styles.menuItemText}>Export Data</Text>
            {isExporting && (
              <ActivityIndicator size="small" color="#4A90D9" style={styles.menuItemSpinner} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleDeleteAllData}
            disabled={isDeleting}
            accessibilityLabel="Delete all data"
            accessibilityRole="button"
          >
            <Text style={styles.menuItemIcon}>🗑️</Text>
            <Text style={[styles.menuItemText, styles.destructiveText]}>
              Delete All Data
            </Text>
            {isDeleting && (
              <ActivityIndicator size="small" color="#E53935" style={styles.menuItemSpinner} />
            )}
          </TouchableOpacity>
        </View>

        {/* Privacy & Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Data</Text>
          <Text style={styles.sectionSubtitle}>
            Control how anonymous usage data is collected to help improve the app.
          </Text>

          <View style={styles.menuItem}>
            <View style={styles.toggleContent}>
              <Text style={styles.menuItemText}>
                Help improve the app with anonymous usage data
              </Text>
              <Text style={styles.toggleSubtitle}>
                We collect event counts and timing data. No personal information, messages, or identifiers are included.
              </Text>
            </View>
            <Switch
              value={analyticsOptIn}
              onValueChange={(value) => useAnalyticsStore.getState().setOptIn(value)}
              accessibilityLabel="Toggle anonymous analytics data collection"
              accessibilityRole="switch"
            />
          </View>

          {/* Separate visual group for data reset — ≥16pt spacing */}
          <View style={styles.resetGroup}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleResetAnalyticsData}
              disabled={isResettingAnalytics}
              accessibilityLabel="Reset my app data"
              accessibilityRole="button"
            >
              <Text style={styles.menuItemIcon}>🔃</Text>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>Reset my app data</Text>
                <Text style={styles.menuItemSubtitle}>
                  Get a new anonymous identity and clear usage history
                </Text>
              </View>
              {isResettingAnalytics && (
                <ActivityIndicator size="small" color="#5C6BC0" style={styles.menuItemSpinner} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('PrivacyPolicy')}
            accessibilityLabel="Privacy Policy"
            accessibilityRole="button"
          >
            <Text style={styles.menuItemIcon}>📋</Text>
            <Text style={styles.menuItemText}>Privacy Policy</Text>
            <Text style={styles.menuItemChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Safety Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleCrisisResources}
            accessibilityLabel="Crisis resources"
            accessibilityRole="button"
          >
            <Text style={styles.menuItemIcon}>🆘</Text>
            <Text style={styles.menuItemText}>Crisis Resources</Text>
            <Text style={styles.menuItemChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              Mental Health Wallet is not a replacement for therapy or
              professional mental health care. This app is designed as a personal
              toolkit to complement professional support, not replace it. If you
              are experiencing a mental health crisis, please reach out to a
              qualified professional or crisis service.
            </Text>
          </View>

          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Version</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
        </View>

        {/* Dev-only tools — hidden in production */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer</Text>

            {/* Flush interval selector */}
            <View style={styles.menuItem}>
              <Text style={styles.menuItemIcon}>⏱️</Text>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>Queue Flush Interval</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {[
                    { label: '5s', ms: 5_000 },
                    { label: '30s', ms: 30_000 },
                    { label: '1m', ms: 60_000 },
                    { label: '5m', ms: 300_000 },
                  ].map(({ label, ms }) => (
                    <TouchableOpacity
                      key={ms}
                      onPress={() => {
                        setFlushIntervalMs(ms);
                        setCurrentFlushInterval(ms);
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor: currentFlushInterval === ms ? '#4A90D9' : '#E8E8E8',
                        minHeight: 32,
                        justifyContent: 'center',
                      }}
                      accessibilityLabel={`Set flush interval to ${label}`}
                      accessibilityRole="button"
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: currentFlushInterval === ms ? '#FFFFFF' : '#333333',
                        }}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleResetOnboarding}
              accessibilityLabel="Reset onboarding"
              accessibilityRole="button"
            >
              <Text style={styles.menuItemIcon}>🔄</Text>
              <Text style={[styles.menuItemText, styles.destructiveText]}>
                Reset Onboarding
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleResetEntireApp}
              accessibilityLabel="Reset entire app"
              accessibilityRole="button"
            >
              <Text style={styles.menuItemIcon}>💣</Text>
              <Text style={[styles.menuItemText, styles.destructiveText]}>
                Reset Entire App
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headerTitleTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 12,
    paddingHorizontal: 4,
    lineHeight: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#888888',
    marginTop: 2,
  },
  toggleContent: {
    flex: 1,
    marginRight: 12,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: '#888888',
    marginTop: 4,
    lineHeight: 18,
  },
  resetGroup: {
    marginTop: 16,
  },
  destructiveText: {
    color: '#E53935',
  },
  menuItemChevron: {
    fontSize: 22,
    color: '#CCCCCC',
    fontWeight: '300',
  },
  menuItemSpinner: {
    marginLeft: 8,
  },
  disclaimerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  disclaimerText: {
    fontSize: 14,
    color: '#4E342E',
    lineHeight: 20,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  versionLabel: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  versionValue: {
    fontSize: 16,
    color: '#888888',
  },
});
