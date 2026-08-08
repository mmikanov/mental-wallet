/**
 * AboutScreen — App information, disclaimers, attributions, and version.
 *
 * Accessible from Settings → About Mental Health Wallet.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { APP_NAME, getAppVersion } from '@/config/appInfo';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export default function AboutScreen({ navigation }: Props) {
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
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* App Identity */}
        <View style={styles.appIdentitySection}>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.versionText}>{getAppVersion()}</Text>
        </View>

        {/* Disclaimer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disclaimer</Text>
          <View style={styles.disclaimerBox}>
            <Text style={styles.bodyText}>
              {APP_NAME} is not a replacement for therapy or
              professional mental health care. This app is designed as a personal
              toolkit to complement professional support, not replace it. If you
              are experiencing a mental health crisis, please reach out to a
              qualified professional or crisis service.
            </Text>
          </View>
        </View>

        {/* Attributions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attributions</Text>
          <View style={styles.card}>
            <Text style={styles.bodyText}>
              Tools in this app are inspired by evidence-based therapeutic
              approaches including:
            </Text>

            <View style={styles.attributionList}>
              <Text style={styles.attributionItem}>
                <Text style={styles.bold}>Cognitive Behavioral Therapy (CBT)</Text>
                {' — developed by Aaron T. Beck'}
              </Text>
              <Text style={styles.attributionItem}>
                <Text style={styles.bold}>Dialectical Behavior Therapy (DBT)</Text>
                {' — developed by Dr. Marsha M. Linehan'}
              </Text>
              <Text style={styles.attributionItem}>
                <Text style={styles.bold}>Mindful Self-Compassion</Text>
                {' — developed by Dr. Kristin Neff and Dr. Christopher Germer'}
              </Text>
              <Text style={styles.attributionItem}>
                <Text style={styles.bold}>Acceptance and Commitment Therapy (ACT)</Text>
                {' — developed by Dr. Steven C. Hayes'}
              </Text>
              <Text style={styles.attributionItem}>
                <Text style={styles.bold}>Positive Psychology</Text>
                {' — pioneered by Dr. Martin Seligman'}
              </Text>
              <Text style={styles.attributionItem}>
                <Text style={styles.bold}>Interpersonal Neurobiology</Text>
                {' — popularized by Dr. Dan Siegel'}
              </Text>
              <Text style={styles.attributionItem}>
                <Text style={styles.bold}>Mindfulness-Based Stress Reduction (MBSR)</Text>
                {' — developed by Jon Kabat-Zinn'}
              </Text>
              <Text style={styles.attributionItem}>
                <Text style={styles.bold}>Progressive Muscle Relaxation</Text>
                {' — developed by Dr. Edmund Jacobson'}
              </Text>
            </View>
          </View>
        </View>

        {/* Trademark Notice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trademark Notice</Text>
          <View style={styles.card}>
            <Text style={styles.bodyText}>
              DBT is a registered trademark of Marsha M. Linehan.
            </Text>
            <Text style={[styles.bodyText, styles.spacedTop]}>
              This app is not affiliated with or endorsed by any of the
              researchers or organizations mentioned above.
            </Text>
          </View>
        </View>

        {/* Open-Source Licenses */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.licensesLink}
            onPress={() => navigation.navigate('Licenses')}
            accessibilityLabel="Open-Source Licenses"
            accessibilityRole="button"
          >
            <Text style={styles.licensesLinkText}>Open-Source Licenses</Text>
            <Text style={styles.licensesChevron}>›</Text>
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
  appIdentitySection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  versionText: {
    fontSize: 14,
    color: '#888888',
  },
  section: {
    marginBottom: 20,
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
  disclaimerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  bodyText: {
    fontSize: 14,
    color: '#4E342E',
    lineHeight: 21,
  },
  spacedTop: {
    marginTop: 10,
  },
  attributionList: {
    marginTop: 12,
  },
  attributionItem: {
    fontSize: 14,
    color: '#4E342E',
    lineHeight: 21,
    marginBottom: 8,
    paddingLeft: 8,
  },
  bold: {
    fontWeight: '600',
  },
  licensesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    minHeight: 52,
  },
  licensesLinkText: {
    flex: 1,
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  licensesChevron: {
    fontSize: 22,
    color: '#CCCCCC',
    fontWeight: '300',
  },
});
