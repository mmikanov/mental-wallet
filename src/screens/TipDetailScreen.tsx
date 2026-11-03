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

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { tipCtaToNavigation } from '@/services/tipCtaNavigation';
import { stripHtmlBlocks } from '@/services/tipBodyForNative';
import { logEvent } from '@/services/analyticsEventLogger';

type Props = NativeStackScreenProps<RootStackParamList, 'TipDetail'>;

export default function TipDetailScreen({ route, navigation }: Props) {
  const { tip } = route.params;

  // Tip bodies embed raw HTML media blocks (<figure>, <img>, <figcaption>, animation <div>s)
  // for the website. The native markdown renderer passes unknown HTML through as literal text,
  // so strip those blocks here and render prose only — the hero image above carries the media
  // (deliberate per-surface exception, Req 1.6).
  const bodyMarkdown = React.useMemo(() => stripHtmlBlocks(tip.body ?? ''), [tip.body]);

  // Hero sizing: the tip media GIFs are tall, phone-shaped recordings, but we don't know each
  // image's aspect ratio ahead of time (the content index carries only the URL). Measure the
  // real pixel size at runtime and shape the hero box to match, so the GIF shows at its true
  // proportions with NO crop and NO grey letterbox. Cap the height so a tall portrait GIF never
  // dominates the screen — the title stays above it and the body starts just below.
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [heroRatio, setHeroRatio] = useState<number | null>(null); // width / height

  useEffect(() => {
    if (!tip.heroImage) return;
    let cancelled = false;
    Image.getSize(
      tip.heroImage,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setHeroRatio(w / h);
      },
      () => {
        /* measure failed — fall back to the default box below */
      }
    );
    return () => {
      cancelled = true;
    };
  }, [tip.heroImage]);

  // Content width = screen minus the 16pt horizontal padding on each side.
  const contentW = screenW - 32;
  const maxHeroH = Math.round(screenH * 0.38); // cap so text stays reasonably high
  // Until measured, use a neutral default height; once measured, honor the real ratio but clamp
  // the resulting height to maxHeroH (portrait GIFs would otherwise be very tall).
  const heroHeight = heroRatio
    ? Math.min(contentW / heroRatio, maxHeroH)
    : Math.round(contentW * 0.6);

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
            style={[styles.hero, { height: heroHeight }]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessible={false}
          />
        )}

        {bodyMarkdown ? (
          <Markdown style={markdownStyles}>{bodyMarkdown}</Markdown>
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
    // height is set dynamically from the image's measured aspect ratio (capped), so the box
    // matches the GIF — no crop, no grey letterbox. See heroHeight in the component.
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
