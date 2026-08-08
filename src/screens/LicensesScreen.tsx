/**
 * LicensesScreen — Displays open-source licenses for all production dependencies.
 *
 * - Scrollable list of packages with name, license type badge, and copyright
 * - Tap to expand/collapse full license text
 * - Data sourced from build-time generated licenses.json
 * - Standard screen layout with back button header
 *
 * Validates: Requirement 6
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import licensesData from '@/data/licenses.json';

type Props = NativeStackScreenProps<RootStackParamList, 'Licenses'>;

interface LicensePackage {
  name: string;
  version: string;
  license: string;
  copyright: string;
  licenseText: string;
}

const packages = licensesData.packages as LicensePackage[];

export default function LicensesScreen({ navigation }: Props) {
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);

  const toggleExpand = (packageName: string) => {
    setExpandedPackage((current) => (current === packageName ? null : packageName));
  };

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
        <Text style={styles.headerTitle}>Open-Source Licenses</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.introText}>
          This app uses the following open-source packages. Tap any entry to view
          the full license text.
        </Text>

        {packages.map((pkg) => {
          const isExpanded = expandedPackage === pkg.name;

          return (
            <TouchableOpacity
              key={pkg.name}
              style={styles.packageCard}
              onPress={() => toggleExpand(pkg.name)}
              accessibilityLabel={`${pkg.name}, ${pkg.license} license. ${isExpanded ? 'Collapse' : 'Expand'} details`}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <View style={styles.packageHeader}>
                <View style={styles.packageNameRow}>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <View style={styles.licenseBadge}>
                    <Text style={styles.licenseBadgeText}>{pkg.license}</Text>
                  </View>
                </View>
                <Text style={styles.copyrightText}>{pkg.copyright}</Text>
              </View>

              {isExpanded && pkg.licenseText ? (
                <View style={styles.licenseTextContainer}>
                  <Text style={styles.licenseText}>{pkg.licenseText}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
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
  introText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 16,
  },
  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  packageHeader: {
    gap: 6,
  },
  packageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  packageName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    flexShrink: 1,
  },
  licenseBadge: {
    backgroundColor: '#E8F4FD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  licenseBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4A90D9',
  },
  copyrightText: {
    fontSize: 13,
    color: '#888888',
    lineHeight: 18,
  },
  licenseTextContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  licenseText: {
    fontSize: 12,
    color: '#555555',
    lineHeight: 18,
    fontFamily: 'monospace',
  },
});
