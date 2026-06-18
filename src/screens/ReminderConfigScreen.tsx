/**
 * ReminderConfigScreen — Allows users to configure per-card reminders
 * with time of day and frequency selection. Handles permission requests.
 *
 * Validates: Requirements 12.1, 12.2, 12.5
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { createReminderService } from '../services/reminderService';
import { createNotificationService } from '../services/notificationService';
import type { Reminder, ReminderFrequencyType } from '../types/index';

type Props = NativeStackScreenProps<RootStackParamList, 'ReminderConfig'>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FREQUENCY_OPTIONS: { type: ReminderFrequencyType; label: string }[] = [
  { type: 'daily', label: 'Daily' },
  { type: '3x_week', label: '3x / week' },
  { type: 'custom', label: 'Custom' },
];

export default function ReminderConfigScreen({ route, navigation }: Props) {
  const { cardId } = route.params;
  const [isLoading, setIsLoading] = useState(true);
  const [existingReminder, setExistingReminder] = useState<Reminder | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Form state
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [frequency, setFrequency] = useState<ReminderFrequencyType>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri

  const reminderService = createReminderService();
  const notificationService = createNotificationService();

  useEffect(() => {
    loadExistingReminder();
  }, []);

  async function loadExistingReminder() {
    setIsLoading(true);
    try {
      const [reminder, permission] = await Promise.all([
        reminderService.getReminder(cardId),
        notificationService.hasPermission(),
      ]);

      setHasPermission(permission);

      if (reminder) {
        setExistingReminder(reminder);
        // Populate form with existing values
        const [h, m] = reminder.time.split(':').map(Number);
        setSelectedHour(h);
        setSelectedMinute(m);
        setFrequency(reminder.frequency.type);
        if (reminder.frequency.days) {
          setSelectedDays(reminder.frequency.days);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRequestPermission() {
    const granted = await notificationService.requestPermission();
    setHasPermission(granted);
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Notifications are needed to remind you about your tools. Please enable notifications in your device settings.',
        [{ text: 'OK' }]
      );
    }
  }

  async function handleSave() {
    if (!hasPermission) {
      const granted = await notificationService.requestPermission();
      setHasPermission(granted);
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Notifications need to be enabled to set reminders. Please enable notifications in your device settings.'
        );
        return;
      }
    }

    const time = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
    const config = {
      time,
      frequency: {
        type: frequency,
        ...(frequency !== 'daily' ? { days: selectedDays } : {}),
      },
    };

    try {
      if (existingReminder) {
        await reminderService.updateReminder(existingReminder.id, config);
      } else {
        await reminderService.setCardReminder(cardId, config);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save reminder. Please try again.');
    }
  }

  async function handleDelete() {
    if (!existingReminder) return;

    Alert.alert(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await reminderService.deleteReminder(existingReminder.id);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to delete reminder.');
            }
          },
        },
      ]
    );
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        // Don't allow deselecting if it would leave 0 days
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      // For 3x_week, limit to 3 days
      if (frequency === '3x_week' && prev.length >= 3) {
        return [...prev.slice(1), day];
      }
      return [...prev, day];
    });
  }

  function adjustHour(delta: number) {
    setSelectedHour((prev) => (prev + delta + 24) % 24);
  }

  function adjustMinute(delta: number) {
    setSelectedMinute((prev) => (prev + delta + 60) % 60);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      </SafeAreaView>
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
        <Text style={styles.headerTitle}>
          {existingReminder ? 'Edit Reminder' : 'Set Reminder'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
        {/* Permission explainer */}
        {hasPermission === false && (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionIcon}>🔔</Text>
            <Text style={styles.permissionTitle}>Enable Notifications</Text>
            <Text style={styles.permissionMessage}>
              We need notification permissions to send you reminders for your coping tools. Your data stays on your device.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={handleRequestPermission}
              accessibilityLabel="Enable notifications"
              accessibilityRole="button"
            >
              <Text style={styles.permissionButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Time picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time</Text>
          <View style={styles.timePicker}>
            <View style={styles.timeColumn}>
              <TouchableOpacity
                onPress={() => adjustHour(1)}
                accessibilityLabel="Increase hour"
                style={styles.timeArrow}
              >
                <Text style={styles.timeArrowText}>▲</Text>
              </TouchableOpacity>
              <Text style={styles.timeValue}>
                {selectedHour.toString().padStart(2, '0')}
              </Text>
              <TouchableOpacity
                onPress={() => adjustHour(-1)}
                accessibilityLabel="Decrease hour"
                style={styles.timeArrow}
              >
                <Text style={styles.timeArrowText}>▼</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeColumn}>
              <TouchableOpacity
                onPress={() => adjustMinute(5)}
                accessibilityLabel="Increase minute"
                style={styles.timeArrow}
              >
                <Text style={styles.timeArrowText}>▲</Text>
              </TouchableOpacity>
              <Text style={styles.timeValue}>
                {selectedMinute.toString().padStart(2, '0')}
              </Text>
              <TouchableOpacity
                onPress={() => adjustMinute(-5)}
                accessibilityLabel="Decrease minute"
                style={styles.timeArrow}
              >
                <Text style={styles.timeArrowText}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Frequency selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequency</Text>
          <View style={styles.frequencyRow}>
            {FREQUENCY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.type}
                style={[
                  styles.frequencyOption,
                  frequency === option.type && styles.frequencyOptionActive,
                ]}
                onPress={() => setFrequency(option.type)}
                accessibilityLabel={`Set frequency to ${option.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: frequency === option.type }}
              >
                <Text
                  style={[
                    styles.frequencyOptionText,
                    frequency === option.type && styles.frequencyOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Day selector (for 3x_week and custom) */}
        {frequency !== 'daily' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {frequency === '3x_week' ? 'Select 3 days' : 'Select days'}
            </Text>
            <View style={styles.dayRow}>
              {WEEKDAYS.map((dayName, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    selectedDays.includes(index) && styles.dayButtonActive,
                  ]}
                  onPress={() => toggleDay(index)}
                  accessibilityLabel={`${dayName}, ${selectedDays.includes(index) ? 'selected' : 'not selected'}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedDays.includes(index) }}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      selectedDays.includes(index) && styles.dayButtonTextActive,
                    ]}
                  >
                    {dayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Save button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          accessibilityLabel="Save reminder"
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>
            {existingReminder ? 'Update Reminder' : 'Save Reminder'}
          </Text>
        </TouchableOpacity>

        {/* Delete button (edit mode only) */}
        {existingReminder && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            accessibilityLabel="Delete reminder"
            accessibilityRole="button"
          >
            <Text style={styles.deleteButtonText}>Delete Reminder</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  permissionCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 8,
  },
  permissionMessage: {
    fontSize: 14,
    color: '#4E342E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#FB8C00',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  timeColumn: {
    alignItems: 'center',
  },
  timeArrow: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeArrowText: {
    fontSize: 18,
    color: '#4A90D9',
  },
  timeValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A1A',
    minWidth: 60,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1A1A1A',
    marginHorizontal: 8,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyOption: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8E8E8',
    minHeight: 44,
    justifyContent: 'center',
  },
  frequencyOptionActive: {
    borderColor: '#4A90D9',
    backgroundColor: '#EBF5FF',
  },
  frequencyOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  frequencyOptionTextActive: {
    color: '#4A90D9',
    fontWeight: '700',
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8E8E8',
  },
  dayButtonActive: {
    borderColor: '#4A90D9',
    backgroundColor: '#4A90D9',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  dayButtonTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E53935',
    minHeight: 44,
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: '600',
  },
});
