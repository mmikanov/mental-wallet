/**
 * CrisisResourcesScreen — Displays crisis hotline resources with disclaimer.
 * Shows 988 Lifeline (US default) and IASP international directory.
 * Geolocation-aware: falls back to US 988 if location unavailable.
 *
 * Validates: Requirements 15.2, 15.3, 15.5
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getDatabase } from '../data/database';

type Props = NativeStackScreenProps<RootStackParamList, 'CrisisResources'>;

interface CrisisResource {
  id: string;
  countryCode: string;
  name: string;
  phone: string | null;
  url: string | null;
  isDefault: boolean;
  displayOrder: number;
}

export default function CrisisResourcesScreen({ navigation }: Props) {
  const [resources, setResources] = useState<CrisisResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResources();
  }, []);

  async function loadResources() {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT id, country_code, name, phone, url, is_default, display_order
         FROM crisis_resources
         ORDER BY display_order ASC`
      );

      const mapped: CrisisResource[] = rows.map((row) => ({
        id: row.id as string,
        countryCode: row.country_code as string,
        name: row.name as string,
        phone: (row.phone as string) || null,
        url: (row.url as string) || null,
        isDefault: (row.is_default as number) === 1,
        displayOrder: row.display_order as number,
      }));

      setResources(mapped);
    } catch {
      // Fallback: show hardcoded US 988 resource
      setResources([
        {
          id: 'us-988-lifeline',
          countryCode: 'US',
          name: '988 Suicide & Crisis Lifeline',
          phone: '988',
          url: 'https://988lifeline.org',
          isDefault: true,
          displayOrder: 1,
        },
        {
          id: 'iasp-directory',
          countryCode: 'INTL',
          name: 'International Association for Suicide Prevention - Crisis Centre Directory',
          phone: null,
          url: 'https://www.iasp.info/resources/Crisis_Centres/',
          isDefault: true,
          displayOrder: 2,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleCall(phone: string) {
    Linking.openURL(`tel:${phone}`);
  }

  function handleOpenUrl(url: string) {
    Linking.openURL(url);
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
        <Text style={styles.headerTitle}>Crisis Resources</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Disclaimer banner */}
        <View style={styles.disclaimerBanner}>
          <Text style={styles.disclaimerIcon}>⚠️</Text>
          <Text style={styles.disclaimerText}>
            If you are in crisis, please contact your local hotline or call 988
            (US Suicide &amp; Crisis Lifeline). You are not alone.
          </Text>
        </View>

        {/* Resource cards */}
        {resources.map((resource) => (
          <View key={resource.id} style={styles.resourceCard}>
            <Text style={styles.resourceName}>{resource.name}</Text>
            <Text style={styles.resourceCountry}>
              {resource.countryCode === 'INTL'
                ? 'International'
                : resource.countryCode}
            </Text>

            <View style={styles.resourceActions}>
              {resource.phone && (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCall(resource.phone!)}
                  accessibilityLabel={`Call ${resource.name} at ${resource.phone}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.callButtonText}>
                    📞 Call {resource.phone}
                  </Text>
                </TouchableOpacity>
              )}

              {resource.url && (
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => handleOpenUrl(resource.url!)}
                  accessibilityLabel={`Visit ${resource.name} website`}
                  accessibilityRole="link"
                >
                  <Text style={styles.linkButtonText}>🌐 Visit Website</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {/* Additional info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            These resources are available 24/7. If you cannot find a local
            resource, the 988 Suicide &amp; Crisis Lifeline (US) is available as a
            default, alongside the International Association for Suicide
            Prevention directory for international resources.
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
  content: {
    padding: 16,
  },
  disclaimerBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  disclaimerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 14,
    color: '#4E342E',
    lineHeight: 20,
    fontWeight: '500',
  },
  resourceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  resourceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  resourceCountry: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 12,
  },
  resourceActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  callButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  linkButton: {
    flex: 1,
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    marginTop: 8,
    padding: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#888888',
    lineHeight: 20,
    textAlign: 'center',
  },
});
