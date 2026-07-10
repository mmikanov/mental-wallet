/**
 * RationaleSheet — Bottom sheet displaying structured rationale and evidence for a tool card.
 *
 * Content sections in order:
 * 1. Card title header
 * 2. "In a nutshell" section
 * 3. "How it works" section
 * 4. Evidence level badge
 * 5. "What we know from research" bullets
 * 6. Disclaimer (conditional: only for not_specifically_studied)
 * 7. "Learn more" links (conditional: only when learnMoreLinks is non-empty)
 *
 * Dismissible via: swipe-down gesture, close button (X), or backdrop tap.
 * Max height: 90% of screen height.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.3
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Linking,
  Dimensions,
  StyleSheet,
  PanResponder,
} from 'react-native';
import type { RationaleMetadata } from '@/types/rationale';
import { getEvidenceLevelLabel } from '@/utils/evidenceLevelLabels';

interface RationaleSheetProps {
  visible: boolean;
  rationale: RationaleMetadata;
  /** Card title for the sheet header */
  cardTitle: string;
  /** Whether the card's emotion tags include distress emotions */
  isDistressRelated: boolean;
  onDismiss: () => void;
  /** Navigate to Crisis Resources screen */
  onCrisisResourcesPress: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.9;
const SWIPE_THRESHOLD = 80;

export function RationaleSheet({
  visible,
  rationale,
  cardTitle,
  isDistressRelated,
  onDismiss,
  onCrisisResourcesPress,
}: RationaleSheetProps) {
  const [linkError, setLinkError] = useState<string | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 10 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > SWIPE_THRESHOLD) {
          onDismiss();
        }
      },
    })
  ).current;

  const handleLinkPress = useCallback(async (url: string) => {
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError("This link couldn't be opened.");
    }
  }, []);

  const evidenceLabel = getEvidenceLevelLabel(rationale.evidenceLevel);
  const showDisclaimer = rationale.evidenceLevel === 'not_specifically_studied';
  const hasLearnMoreLinks =
    rationale.learnMoreLinks != null && rationale.learnMoreLinks.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        {/* Backdrop — tap to dismiss */}
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        
        {/* Sheet content */}
        <View style={styles.sheet}>
          {/* Drag handle — swipe-to-dismiss only from here */}
          <View {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={true}
            bounces={true}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled={true}
          >
            {/* Card title header */}
            <Text style={styles.cardTitle} accessibilityRole="header">
              {cardTitle}
            </Text>

            {/* In a nutshell */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>In a nutshell</Text>
              <Text style={styles.sectionBody}>{rationale.inANutshell}</Text>
            </View>

            {/* How it works */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>How it works</Text>
              <Text style={styles.sectionBody}>{rationale.howItWorks}</Text>
            </View>

            {/* Evidence level badge */}
            <View style={styles.badgeContainer}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{evidenceLabel}</Text>
              </View>
            </View>

            {/* What we know from research */}
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>What we know from research</Text>
              {rationale.researchSummary.map((bullet, index) => (
                <View key={index} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}

              {/* Crisis resources callout for distress-related cards */}
              {isDistressRelated && (
                <TouchableOpacity
                  style={styles.crisisCallout}
                  onPress={onCrisisResourcesPress}
                  accessibilityRole="link"
                  accessibilityLabel="Crisis support resources"
                >
                  <Text style={styles.crisisCalloutText}>
                    In crisis? Get support →
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Disclaimer (only for not_specifically_studied) */}
            {showDisclaimer && (
              <View style={styles.disclaimerContainer}>
                <Text style={styles.disclaimerText}>
                  This tool draws on general wellbeing principles. It has not been
                  specifically studied in this exact form.
                </Text>
              </View>
            )}

            {/* Further reading links */}
            {hasLearnMoreLinks && (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>Further reading</Text>
                {rationale.learnMoreLinks!.map((link, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.learnMoreLink}
                    onPress={() => handleLinkPress(link.url)}
                    accessibilityRole="link"
                    accessibilityLabel={link.title}
                  >
                    <Text style={styles.learnMoreLinkText}>{link.title} ↗</Text>
                  </TouchableOpacity>
                ))}
                {linkError && (
                  <Text style={styles.linkErrorText}>{linkError}</Text>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
    maxHeight: MAX_SHEET_HEIGHT,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  scrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    paddingRight: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  badgeContainer: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingRight: 4,
  },
  bulletDot: {
    fontSize: 15,
    color: '#6B7280',
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  crisisCallout: {
    marginTop: 14,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  crisisCalloutText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
    lineHeight: 20,
  },
  disclaimerContainer: {
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  disclaimerText: {
    fontSize: 13,
    color: '#92400E',
    fontStyle: 'italic',
    lineHeight: 19,
  },
  learnMoreLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    marginBottom: 8,
  },
  learnMoreLinkText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  linkErrorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 8,
  },
});
