/**
 * TipDetailScreen — native rendering of a single tip (Bug 1, 1.0.6 — tip consistency).
 *
 * Replaces the old "open the website article in an in-app browser" delegation. Rendering the
 * tip NATIVELY is what lets the CTA be a native in-process navigation call: when the reader is
 * already inside the app, an in-app browser cannot hand a Universal Link back to the presenting
 * app (it falls through to the /app/* not-installed fallback — a dead end). So the tip is
 * rendered here and its CTA navigates in-app via `tipCtaToNavigation`.
 *
 * Renders: title, the hero image (when `heroImage` is set), the full `body` as markdown (via
 * react-native-markdown-display — prose, lists, bold), and a native CTA button labeled from
 * `tip.cta.label`.
 *
 * Deliberate per-surface exception (Req 1.6): embedded raw-HTML `<figure class="tip-media">`
 * blocks in the body are NOT rendered natively — the markdown renderer renders prose only, and
 * the top hero carries that media. Same hero media as the website/email; only placement differs.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { tipCtaToNavigation } from '@/services/tipCtaNavigation';
import { logEvent } from '@/services/analyticsEventLogger';

type Props = NativeStackScreenProps<RootStackParamList, 'TipDetail'>;

export default function TipDetailScreen({ route, navigation }: Props) {
  const { tip } = route.params;

  const onCtaPress = useCallback(() => {
    if (!tip.cta) return;
    void logEvent('tip_opened', { slug: tip.slug });
    const mapped = tipCtaToNavigation(tip.cta.url);
    if (mapped) {
      // Native in-app navigation — never a browser (Req 1.8, 1.9). The destination is
      // computed dynamically (pure mapper), so the strict two-arg navigate overload can't
      // narrow it; dispatch through a loosely-typed navigate for the runtime call.
      const navigate = navigation.navigate as (screen: string, params?: object) => void;
      navigate(mapped.screen, mapped.params);
    } else {
      // External / unmapped URL — fall back to the OS (rare; keeps a sane default).
      void Linking.openURL(tip.cta.url);
    }
  }, [tip, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          Tip
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {tip.title}
        </Text>

        {!!tip.heroImage && (
          <Image
            testID="tip-hero-image"
            source={{ uri: tip.heroImage }}
            style={styles.hero}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            accessible={false}
          />
        )}

        {tip.body ? (
          <Markdown style={markdownStyles}>{tip.body}</Markdown>
        ) : (
          <Text style={styles.summary}>{tip.summary}</Text>
        )}

        {tip.cta && (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={onCtaPress}
            accessibilityRole="button"
            accessibilityLabel={tip.cta.label}
          >
            <Text style={styles.ctaButtonText}>{tip.cta.label}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backButtonText: { fontSize: 16, color: '#4A90D9', fontWeight: '500' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  headerSpacer: { width: 44 },

  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginBottom: 16, lineHeight: 30 },
  hero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: '#E8E8E8',
    marginBottom: 16,
  },
  summary: { fontSize: 16, color: '#444444', lineHeight: 24 },

  ctaButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 28,
  },
  ctaButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

// Markdown prose styling (keeps parity with the article's readable body).
const markdownStyles = StyleSheet.create({
  body: { fontSize: 16, color: '#333333', lineHeight: 24 },
  heading1: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginTop: 8, marginBottom: 8 },
  heading2: { fontSize: 19, fontWeight: '700', color: '#1A1A1A', marginTop: 8, marginBottom: 6 },
  heading3: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginTop: 6, marginBottom: 4 },
  paragraph: { marginTop: 0, marginBottom: 12 },
  strong: { fontWeight: '700' },
  bullet_list: { marginBottom: 12 },
  ordered_list: { marginBottom: 12 },
  list_item: { marginBottom: 4 },
  link: { color: '#4A90D9' },
});
