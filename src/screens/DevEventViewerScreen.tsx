/**
 * DevEventViewerScreen — Developer-only screen for inspecting analytics events in real time.
 *
 * Only registered in navigation when `__DEV__` is true.
 * Accessed via triple-tap on the Settings screen header title.
 *
 * Displays:
 * - Current Anonymous_User_ID, Session_ID, opt-in status
 * - Live reverse-chronological event feed
 * - Event queue status (total count + breakdown by status)
 * - Export Queue (JSON → system share sheet)
 * - Clear Queue with confirmation
 *
 * Validates: Requirement 10.3
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { getSessionState } from '@/services/analyticsSession';
import { onEventLogged } from '@/services/analyticsEventLogger';
import { getDatabase } from '@/data/database';
import { deleteAllEvents } from '@/data/analyticsEventQueue';
import { runStressTest, type StressTestConfig } from '@/services/analyticsStressTest';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { AnalyticsEvent, QueuedEvent } from '@/types/analytics';

// --- Types ---

interface QueueStatus {
  total: number;
  pending: number;
  sending: number;
}

type Props = NativeStackScreenProps<RootStackParamList, 'DevEventViewer'>;

// --- Component ---

export default function DevEventViewerScreen({ navigation }: Props) {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ total: 0, pending: 0, sending: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const [stressTestProgress, setStressTestProgress] = useState<{ current: number; total: number } | null>(null);
  const [showStressConfig, setShowStressConfig] = useState(false);
  const [stressConfig, setStressConfig] = useState<StressTestConfig>({
    userCount: 20,
    eventsPerUser: 50,
    timeSpanDays: 30,
  });

  const anonymousUserId = useAnalyticsStore((state) => state.anonymousUserId);
  const optIn = useAnalyticsStore((state) => state.optIn);
  const sessionState = getSessionState();

  // Poll queue status
  const loadQueueStatus = useCallback(async () => {
    try {
      const db = await getDatabase();
      const totalRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM analytics_event_queue`
      );
      const pendingRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM analytics_event_queue WHERE status = 'pending'`
      );
      const sendingRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM analytics_event_queue WHERE status = 'sending'`
      );
      setQueueStatus({
        total: totalRow?.count ?? 0,
        pending: pendingRow?.count ?? 0,
        sending: sendingRow?.count ?? 0,
      });
    } catch {
      // Non-critical — just leave status as-is
    }
  }, []);

  // Load recent events from queue on mount + subscribe to new ones
  useEffect(() => {
    // Load existing events from the queue
    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.getAllAsync<{ payload: string }>(
          `SELECT payload FROM analytics_event_queue ORDER BY created_at DESC LIMIT 100`
        );
        const parsed = rows
          .map((r) => {
            try { return JSON.parse(r.payload) as AnalyticsEvent; } catch { return null; }
          })
          .filter((e): e is AnalyticsEvent => e !== null);
        setEvents(parsed);
      } catch {
        // Non-critical
      }
    })();

    // Also subscribe to live events that come in while screen is open
    const unsubscribe = onEventLogged((event: AnalyticsEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 200));
    });
    return unsubscribe;
  }, []);

  // Poll queue status every 2 seconds and on mount
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    loadQueueStatus();
    intervalRef.current = setInterval(loadQueueStatus, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadQueueStatus]);

  // Subscribe to analytics store changes (opt-in, userId)
  useEffect(() => {
    const unsubscribe = useAnalyticsStore.subscribe(() => {
      // Force re-render on store changes — handled by selectors above
    });
    return unsubscribe;
  }, []);

  // --- Actions ---

  async function handleExportQueue() {
    setIsExporting(true);
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<QueuedEvent>(
        `SELECT id, payload, created_at, status FROM analytics_event_queue ORDER BY created_at DESC`
      );
      const jsonContent = JSON.stringify(rows, null, 2);
      const file = new File(Paths.cache, 'analytics_queue_export.json');
      file.write(jsonContent);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Analytics Queue',
      });
    } catch {
      Alert.alert('Export Failed', 'Unable to export queue data.');
    } finally {
      setIsExporting(false);
    }
  }

  function handleClearQueue() {
    Alert.alert(
      'Clear Event Queue',
      'This will permanently delete all queued analytics events. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllEvents();
              setEvents([]);
              await loadQueueStatus();
            } catch {
              Alert.alert('Error', 'Failed to clear the queue.');
            }
          },
        },
      ]
    );
  }

  async function handleRunStressTest() {
    setIsStressTesting(true);
    setStressTestProgress({ current: 0, total: stressConfig.userCount * stressConfig.eventsPerUser });
    try {
      const result = await runStressTest(stressConfig, (current, total) => {
        setStressTestProgress({ current, total });
      });
      await loadQueueStatus();
      Alert.alert(
        'Stress Test Complete',
        `Generated ${result.totalEvents} events from ${result.simulatedUsers} users.\nQueue size: ${result.queueSize}`
      );
      // Reload event list to show generated events
      try {
        const db = await getDatabase();
        const rows = await db.getAllAsync<{ payload: string }>(
          `SELECT payload FROM analytics_event_queue ORDER BY created_at DESC LIMIT 100`
        );
        const parsed = rows
          .map((r) => {
            try { return JSON.parse(r.payload) as AnalyticsEvent; } catch { return null; }
          })
          .filter((e): e is AnalyticsEvent => e !== null);
        setEvents(parsed);
      } catch {
        // Non-critical
      }
    } catch {
      Alert.alert('Stress Test Failed', 'An error occurred while generating events.');
    } finally {
      setIsStressTesting(false);
      setStressTestProgress(null);
      setShowStressConfig(false);
    }
  }

  // --- Formatting ---

  function formatTimestamp(iso: string): string {
    try {
      const date = new Date(iso);
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      const ms = String(date.getMilliseconds()).padStart(3, '0');
      return `${h}:${m}:${s}.${ms}`;
    } catch {
      return iso;
    }
  }

  function formatProperties(event: AnalyticsEvent): string {
    if ('properties' in event && event.properties) {
      return JSON.stringify(event.properties);
    }
    return '—';
  }

  // --- Render ---

  function renderEventItem({ item }: { item: AnalyticsEvent }) {
    return (
      <View style={styles.eventItem}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventType}>{item.event_type}</Text>
          <Text style={styles.eventTimestamp}>{formatTimestamp(item.timestamp)}</Text>
        </View>
        <Text style={styles.eventProperties} numberOfLines={3}>
          {formatProperties(item)}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Viewer</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Identity Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>User ID</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {anonymousUserId ?? 'Not resolved'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Session ID</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {sessionState.sessionId}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Opt-in</Text>
          <Text style={[styles.infoValue, { color: optIn ? '#4CAF50' : '#E53935' }]}>
            {optIn ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      {/* Queue Status */}
      <View style={styles.queueSection}>
        <Text style={styles.sectionTitle}>Queue Status</Text>
        <View style={styles.queueStats}>
          <View style={styles.queueStat}>
            <Text style={styles.queueStatValue}>{queueStatus.total}</Text>
            <Text style={styles.queueStatLabel}>Total</Text>
          </View>
          <View style={styles.queueStat}>
            <Text style={styles.queueStatValue}>{queueStatus.pending}</Text>
            <Text style={styles.queueStatLabel}>Pending</Text>
          </View>
          <View style={styles.queueStat}>
            <Text style={styles.queueStatValue}>{queueStatus.sending}</Text>
            <Text style={styles.queueStatLabel}>Sending</Text>
          </View>
        </View>
        <View style={styles.queueActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleExportQueue}
            disabled={isExporting}
            accessibilityLabel="Export queue as JSON"
            accessibilityRole="button"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>Export Queue</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.destructiveButton]}
            onPress={handleClearQueue}
            accessibilityLabel="Clear event queue"
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>Clear Queue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.stressButton]}
            onPress={() => setShowStressConfig(true)}
            accessibilityLabel="Open stress test configuration"
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>Stress Test</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Event Feed */}
      <View style={styles.feedSection}>
        <Text style={styles.sectionTitle}>
          Queue Contents ({events.length})
        </Text>
        <FlatList
          data={events}
          keyExtractor={(_, index) => String(index)}
          renderItem={renderEventItem}
          contentContainerStyle={styles.feedContent}
          ListHeaderComponent={
            showStressConfig ? (
              <View style={styles.stressConfigPanel}>
                <Text style={styles.sectionTitle}>Stress Test</Text>
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>Users (1–100)</Text>
                  <Text style={styles.configValue}>{stressConfig.userCount}</Text>
                </View>
                <View style={styles.sliderRow}>
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => setStressConfig((c) => ({ ...c, userCount: Math.max(1, c.userCount - 5) }))}
                    accessibilityLabel="Decrease user count"
                  >
                    <Text style={styles.sliderButtonText}>−</Text>
                  </TouchableOpacity>
                  <View style={[styles.sliderBar, { width: `${(stressConfig.userCount / 100) * 100}%` }]} />
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => setStressConfig((c) => ({ ...c, userCount: Math.min(100, c.userCount + 5) }))}
                    accessibilityLabel="Increase user count"
                  >
                    <Text style={styles.sliderButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>Events/User (10–500)</Text>
                  <Text style={styles.configValue}>{stressConfig.eventsPerUser}</Text>
                </View>
                <View style={styles.sliderRow}>
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => setStressConfig((c) => ({ ...c, eventsPerUser: Math.max(10, c.eventsPerUser - 10) }))}
                    accessibilityLabel="Decrease events per user"
                  >
                    <Text style={styles.sliderButtonText}>−</Text>
                  </TouchableOpacity>
                  <View style={[styles.sliderBar, { width: `${(stressConfig.eventsPerUser / 500) * 100}%` }]} />
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => setStressConfig((c) => ({ ...c, eventsPerUser: Math.min(500, c.eventsPerUser + 10) }))}
                    accessibilityLabel="Increase events per user"
                  >
                    <Text style={styles.sliderButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>Time Span Days (1–90)</Text>
                  <Text style={styles.configValue}>{stressConfig.timeSpanDays}</Text>
                </View>
                <View style={styles.sliderRow}>
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => setStressConfig((c) => ({ ...c, timeSpanDays: Math.max(1, c.timeSpanDays - 5) }))}
                    accessibilityLabel="Decrease time span"
                  >
                    <Text style={styles.sliderButtonText}>−</Text>
                  </TouchableOpacity>
                  <View style={[styles.sliderBar, { width: `${(stressConfig.timeSpanDays / 90) * 100}%` }]} />
                  <TouchableOpacity
                    style={styles.sliderButton}
                    onPress={() => setStressConfig((c) => ({ ...c, timeSpanDays: Math.min(90, c.timeSpanDays + 5) }))}
                    accessibilityLabel="Increase time span"
                  >
                    <Text style={styles.sliderButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.configSummary}>
                  Total: {stressConfig.userCount * stressConfig.eventsPerUser} events
                </Text>

                {isStressTesting && stressTestProgress ? (
                  <View style={styles.progressContainer}>
                    <ActivityIndicator size="small" color="#53C9B6" />
                    <Text style={styles.progressText}>
                      {stressTestProgress.current} / {stressTestProgress.total}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.stressActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.stressRunButton]}
                      onPress={handleRunStressTest}
                      accessibilityLabel="Run stress test"
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionButtonText}>Run</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#666' }]}
                      onPress={() => setShowStressConfig(false)}
                      accessibilityLabel="Cancel stress test"
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No events in queue yet.
            </Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213E',
    borderBottomWidth: 1,
    borderBottomColor: '#0F3460',
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
    color: '#E8E8E8',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  infoSection: {
    backgroundColor: '#16213E',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#A0A0A0',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    color: '#E8E8E8',
    fontFamily: 'monospace',
    maxWidth: '65%',
  },
  queueSection: {
    backgroundColor: '#16213E',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 10,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A0A0A0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  queueStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  queueStat: {
    alignItems: 'center',
  },
  queueStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E8E8E8',
    fontFamily: 'monospace',
  },
  queueStatLabel: {
    fontSize: 11,
    color: '#A0A0A0',
    marginTop: 2,
  },
  queueActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  destructiveButton: {
    backgroundColor: '#E53935',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  feedSection: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 12,
  },
  feedContent: {
    paddingBottom: 20,
  },
  eventItem: {
    backgroundColor: '#16213E',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#53C9B6',
    fontFamily: 'monospace',
  },
  eventTimestamp: {
    fontSize: 12,
    color: '#A0A0A0',
    fontFamily: 'monospace',
  },
  eventProperties: {
    fontSize: 12,
    color: '#C0C0C0',
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: 14,
    color: '#606060',
    textAlign: 'center',
    marginTop: 40,
  },
  stressButton: {
    backgroundColor: '#FF9800',
  },
  stressConfigPanel: {
    backgroundColor: '#16213E',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  configLabel: {
    fontSize: 12,
    color: '#A0A0A0',
    fontWeight: '500',
  },
  configValue: {
    fontSize: 14,
    color: '#E8E8E8',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sliderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F3460',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E8E8E8',
  },
  sliderBar: {
    height: 4,
    backgroundColor: '#4A90D9',
    borderRadius: 2,
    minWidth: 4,
  },
  configSummary: {
    fontSize: 13,
    color: '#53C9B6',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  progressText: {
    fontSize: 13,
    color: '#E8E8E8',
    fontFamily: 'monospace',
  },
  stressActions: {
    flexDirection: 'row',
    gap: 10,
  },
  stressRunButton: {
    backgroundColor: '#FF9800',
  },
});
