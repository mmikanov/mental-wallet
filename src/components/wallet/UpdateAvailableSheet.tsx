/**
 * UpdateAvailableSheet — bottom-sheet modal shown when the user taps the
 * "Update available" pill on an outdated library card (Req 2.3).
 *
 * Mirrors RationaleSheet's structure: a slide-up Modal with a dimmed backdrop
 * (tap to dismiss), a drag handle wired to a swipe-down PanResponder, and a
 * close (X) affordance. The content is short, so the sheet sizes to its content
 * (capped at ~90% screen height as a safety ceiling) rather than filling the
 * screen.
 *
 * Copy is plain-language and reassuring: updating refreshes the tool while
 * keeping the user's history. Two actions: a primary "Update" (busy/disabled
 * while `updating`) and a secondary "Not now".
 *
 * Validates: Requirements 2.3, 2.4
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  StyleSheet,
  PanResponder,
  ActivityIndicator,
} from 'react-native';

interface UpdateAvailableSheetProps {
  visible: boolean;
  /** Card title shown in the sheet header. */
  cardTitle: string;
  /** Apply the update. */
  onUpdate: () => void;
  /** Dismiss without updating (records session suppression in the parent). */
  onNotNow: () => void;
  /** Optional backdrop/swipe/close dismiss (treated like "Not now" by the parent). */
  onDismiss?: () => void;
  /** True while the update is in flight — disables buttons + shows a spinner. */
  updating?: boolean;
  /** Optional non-blocking error message shown inline when an update failed. */
  errorMessage?: string | null;
  /**
   * Per-card, plain-language "what changed" lines (from `summarizeUpdate`).
   * Rendered as a bulleted list above the reassurance copy. When empty/undefined,
   * the "What's new" section is omitted and only the reassurance copy shows.
   */
  changeSummary?: string[];
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.9;
const SWIPE_THRESHOLD = 80;

/**
 * Plain-language body copy (exact — see design "UpdateAvailableSheet copy").
 * Keep in sync with Req 2.3 if the wording changes.
 */
export const UPDATE_SHEET_BODY =
  "Updating keeps all your history — streak, past entries, reminder, and custom background stay.";

export function UpdateAvailableSheet({
  visible,
  cardTitle,
  onUpdate,
  onNotNow,
  onDismiss,
  updating = false,
  errorMessage = null,
  changeSummary,
}: UpdateAvailableSheetProps) {
  // Backdrop / swipe / close all behave like "Not now" (dismiss without
  // mutating) when no explicit onDismiss is provided.
  const dismiss = onDismiss ?? onNotNow;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 10 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > SWIPE_THRESHOLD) {
          dismiss();
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        {/* Backdrop — tap to dismiss */}
        <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel="Dismiss" />

        {/* Sheet content — sizes to content, capped at 90% height */}
        <View style={styles.sheet}>
          {/* Drag handle — swipe-to-dismiss only from here */}
          <View {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Heading */}
          <Text style={styles.heading} accessibilityRole="header">
            Update {cardTitle}
          </Text>

          {/* Per-card "what's new" summary (Req 8.5) — above the reassurance copy.
              Omitted entirely when there's nothing to show. */}
          {changeSummary && changeSummary.length > 0 ? (
            <View style={styles.summarySection}>
              <Text style={styles.summaryHeading}>What&apos;s new in this update:</Text>
              {changeSummary.map((line, i) => (
                <View key={i} style={styles.summaryItem}>
                  <Text style={styles.summaryBullet}>•</Text>
                  <Text style={styles.summaryText}>{line}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Body copy */}
          <Text style={styles.body}>{UPDATE_SHEET_BODY}</Text>

          {/* Non-blocking error message (update failed; card left as-is) */}
          {errorMessage ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {errorMessage}
            </Text>
          ) : null}

          {/* Actions */}
          <TouchableOpacity
            style={[styles.primaryButton, updating && styles.primaryButtonDisabled]}
            onPress={onUpdate}
            disabled={updating}
            accessibilityRole="button"
            accessibilityLabel="Update"
            accessibilityState={{ disabled: updating, busy: updating }}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Update</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onNotNow}
            disabled={updating}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={styles.secondaryButtonText}>Not now</Text>
          </TouchableOpacity>
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
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    paddingRight: 40,
  },
  body: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 20,
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  summaryBullet: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginRight: 8,
  },
  summaryText: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
});
