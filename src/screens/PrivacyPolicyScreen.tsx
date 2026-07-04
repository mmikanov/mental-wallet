/**
 * PrivacyPolicyScreen — Displays the app's full privacy policy document.
 *
 * - Scrollable with min 14pt readable text
 * - Supports Dynamic Type accessibility scaling on iOS (React Native built-in text scaling)
 * - Includes "Last updated" date at top
 * - Policy stored as local constant (bundled, not remote)
 * - 44×44 min tap targets for interactive elements
 * - Back navigation button
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

const LAST_UPDATED = 'June 15, 2025';

const PRIVACY_POLICY_SECTIONS = [
  {
    title: '1. Data Controller',
    body: `Mental Health Wallet ("we", "us", or "our") is the data controller responsible for your information when you use this application.\n\nContact: privacy@mentalhealthwallet.app`,
  },
  {
    title: '2. What Data We Collect',
    body: `We collect only anonymous usage events. These include:\n\n• App open and session timing events\n• Onboarding step views and completion\n• Tool opens, completions, and durations\n• Outcome responses (e.g., "calmer", "clearer")\n• Start mode selections\n\nWe do NOT collect:\n• Names, emails, or phone numbers\n• GPS or location data\n• Free-text journal content or notes\n• Device advertising identifiers\n• Contact lists or personal files\n\nEach device is assigned a random anonymous identifier (UUID) that cannot be linked back to you personally.`,
  },
  {
    title: '3. Purpose of Data Collection',
    body: `We collect anonymous usage data solely for product improvement purposes, including:\n\n• Understanding which coping tools are most helpful\n• Improving the onboarding experience\n• Measuring feature adoption and retention\n• Identifying areas where users need better support\n\nWe do not use this data for advertising, profiling, or any purpose unrelated to improving the app experience.`,
  },
  {
    title: '4. Data Retention',
    body: `Anonymous usage events are retained on our servers for a maximum of 24 months from the date of collection. After this period, data is permanently deleted.\n\nLocally stored events on your device are transmitted to our servers and then removed from your device. You may delete all local data at any time using the "Reset my app data" control in Settings.`,
  },
  {
    title: '5. Third-Party Data Sharing',
    body: `We do not sell, rent, or share your anonymous usage data with third parties for their own purposes.\n\nWe may use third-party infrastructure providers (cloud hosting, analytics aggregation) to process and store anonymous events. These providers are bound by data processing agreements and may not use the data for any purpose other than providing services to us.\n\nNo personally identifiable information is ever shared because none is collected.`,
  },
  {
    title: '6. Your Rights',
    body: `You have the following rights regarding your data:\n\n• Opt out: You can disable anonymous usage data collection at any time via the toggle in Settings > Privacy & Data. When opted out, only minimal session timing events are collected.\n\n• Data reset: You can erase all locally stored analytics data and generate a new anonymous identity using "Reset my app data" in Settings. This severs any link between your past and future usage.\n\n• Deletion: Since we collect no personally identifiable information, there is no personal data to delete. Resetting your app data removes all local records and generates a new anonymous ID.\n\n• Access: The anonymous data we collect cannot be attributed to any individual, making subject access requests inapplicable.`,
  },
  {
    title: "7. Children's Privacy",
    body: `Mental Health Wallet is not directed at children under the age of 13. We do not knowingly collect data from children under 13. If you believe a child under 13 has used this app, please contact us and we will take appropriate steps to remove any associated anonymous data.\n\nUsers between 13 and 18 should review this policy with a parent or guardian.`,
  },
  {
    title: '8. Data Security',
    body: `We implement appropriate technical and organizational measures to protect your data:\n\n• Encryption in transit: All data transmitted from your device to our servers uses HTTPS with TLS 1.2 or higher.\n\n• Encryption at rest: Data stored on our servers is encrypted at rest using industry-standard encryption algorithms.\n\n• Local security: Your anonymous identifier is stored in your device's secure keychain/keystore (expo-secure-store).\n\n• Minimal data: By collecting only anonymous events with no personal identifiers, we minimize the impact of any potential data breach.`,
  },
  {
    title: '9. Policy Updates',
    body: `We may update this Privacy Policy from time to time. When we make changes:\n\n• The "Last updated" date at the top of this policy will be revised.\n• For significant changes, we will display a notice within the app on your next launch.\n• Continued use of the app after changes constitutes acceptance of the updated policy.\n\nWe encourage you to review this policy periodically for any changes.`,
  },
] as const;

export default function PrivacyPolicyScreen({ navigation }: Props) {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

        <Text style={styles.introText}>
          This Privacy Policy describes how Mental Health Wallet handles your information.
          We are committed to protecting your privacy and maintaining your trust.
        </Text>

        {PRIVACY_POLICY_SECTIONS.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            If you have questions about this Privacy Policy, please contact us at
            privacy@mentalhealthwallet.app.
          </Text>
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
  lastUpdated: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  introText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  footerText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});
