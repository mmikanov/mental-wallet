/**
 * PrivacyExplanationScreen — Detailed privacy explanation accessible from
 * the "Learn more" link on the PrivacyNotice onboarding screen.
 *
 * Lists:
 * - Event types collected
 * - Base data fields each event contains
 * - What is NOT collected
 * - How to opt out
 * - How to reset
 * - Link to full Privacy Policy
 *
 * Back navigation returns to the privacy notice at the same position.
 *
 * Validates: Requirements 8.4, 10.4
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type PrivacyExplanationNavProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'PrivacyExplanation'
>;

const EVENT_TYPES = [
  'app_opened',
  'onboarding_step_viewed',
  'onboarding_completed',
  'start_mode_selected',
  'emotion_selected',
  'session_started',
  'tool_created',
  'tool_opened',
  'tool_completed',
  'outcome_response',
  'external_resource_opened',
  'session_ended',
] as const;

const BASE_DATA_FIELDS = [
  { name: 'anonymous_user_id', description: 'A random ID that cannot identify you' },
  { name: 'session_id', description: 'Groups events within a single app session' },
  { name: 'event_type', description: 'Which action occurred' },
  { name: 'timestamp', description: 'When the action occurred' },
] as const;

const NOT_COLLECTED = [
  'Names',
  'Email addresses',
  'Phone numbers',
  'GPS coordinates or location data',
  'Free-text journal content or notes',
  'Device IDs',
  'Advertising identifiers',
  'Contact lists',
] as const;

export default function PrivacyExplanationScreen() {
  const navigation = useNavigation<PrivacyExplanationNavProp>();

  const handleViewPrivacyPolicy = () => {
    // Navigate to the PrivacyPolicy screen on the root stack
    (navigation as any).navigate('PrivacyPolicy');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back to privacy notice"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* Section 1: Event types collected */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event types we collect</Text>
          <Text style={styles.sectionIntro}>
            We record these types of anonymous events to understand how the app is used:
          </Text>
          {EVENT_TYPES.map((eventType) => (
            <View key={eventType} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{eventType}</Text>
            </View>
          ))}
        </View>

        {/* Section 2: Base data fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What each event contains</Text>
          <Text style={styles.sectionIntro}>
            Every event includes only these base fields:
          </Text>
          {BASE_DATA_FIELDS.map((field) => (
            <View key={field.name} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.fieldName}>{field.name}</Text> — {field.description}
              </Text>
            </View>
          ))}
        </View>

        {/* Section 3: What is NOT collected */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What we do NOT collect</Text>
          <Text style={styles.sectionIntro}>
            We never collect any personal or identifying information:
          </Text>
          {NOT_COLLECTED.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bulletNo}>✗</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Section 4: How to opt out */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to opt out</Text>
          <Text style={styles.sectionBody}>
            You can stop anonymous data collection at any time:{'\n\n'}
            Go to <Text style={styles.bold}>Settings</Text> →{' '}
            <Text style={styles.bold}>Privacy & Data</Text> → toggle off{' '}
            <Text style={styles.bold}>"Help improve the app"</Text>{'\n\n'}
            When opted out, only minimal session timing events are recorded with no
            details about what you do in the app.
          </Text>
        </View>

        {/* Section 5: How to reset */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to reset your data</Text>
          <Text style={styles.sectionBody}>
            You can erase all stored anonymous data and get a fresh identity:{'\n\n'}
            Go to <Text style={styles.bold}>Settings</Text> →{' '}
            <Text style={styles.bold}>Privacy & Data</Text> →{' '}
            <Text style={styles.bold}>"Reset my app data"</Text>{'\n\n'}
            This deletes all locally stored usage data and generates a new anonymous
            identity so your past and future usage cannot be linked.
          </Text>
        </View>

        {/* Link to full Privacy Policy */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={handleViewPrivacyPolicy}
            accessibilityLabel="View full privacy policy"
            accessibilityRole="link"
            style={styles.policyLink}
            activeOpacity={0.7}
          >
            <Text style={styles.policyLinkText}>View full Privacy Policy →</Text>
          </TouchableOpacity>
        </View>
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
  headerSpacer: {
    width: 44,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sectionIntro: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 15,
    color: '#4A90D9',
    width: 18,
    lineHeight: 22,
  },
  bulletNo: {
    fontSize: 15,
    color: '#DC2626',
    width: 18,
    lineHeight: 22,
  },
  bulletText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    flex: 1,
  },
  fieldName: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  bold: {
    fontWeight: '600',
  },
  policyLink: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  policyLinkText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
});
