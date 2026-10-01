/**
 * FocusedCardView — Apple Wallet-style focused card displayed when a card is tapped.
 *
 * The selected card expands to fill ~65% of the screen height, positioned at the top.
 * Shows full card content: icon, title, description, stats, action button.
 * Nice rounded corners, shadow, swipe-down to dismiss.
 *
 * When isExpanded = true, shows ExpandedContent (ControlRenderer + submit button)
 * instead of the "Tap to expand" hint and standalone action button.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 13.4, 17.1
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Card } from '@/types/index';
import type { RootStackParamList } from '@/navigation/types';
import { isLightBackground } from '@/utils/cardColors';
import { renderCardIcon } from '@/utils/renderCardIcon';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import { evaluateOutdated, summarizeUpdate } from '@/services/librarySyncService';
import { RationaleEntryPoint } from '@/components/rationale/RationaleEntryPoint';
import { RationaleSheet } from '@/components/rationale/RationaleSheet';
import { UpdateAvailableSheet } from './UpdateAvailableSheet';
import { UpdateAvailableBanner } from './UpdateAvailableBanner';
import { createCardService } from '@/services/cardService';
import { useWalletStore } from '@/stores/walletStore';
import OriginBadge from './OriginBadge';
import StatsRow from './StatsRow';
import ReminderDisplayRow from './ReminderDisplayRow';
import PrimaryActionButton from './PrimaryActionButton';
import ExpandedContent from './ExpandedContent';
import { BadgeExplanationBanner } from './BadgeExplanationBanner';
import { useCardReminder } from '@/hooks/useCardReminder';
import { useKpiStore } from '@/stores/kpiStore';
import { computeDaysElapsed } from '@/utils/kpiBadgeUtils';
import { announceCardTransition } from '@/utils/accessibility';

export interface FocusedCardViewProps {
  card: Card;
  categoryColor: string;
  categoryName?: string;
  isExpanded?: boolean;
  onExpand: () => void;
  onDismiss: () => void;
  onCollapse?: () => void;
  onPrimaryAction: () => void;
  onMenuPress: () => void;
  /** Optional custom content renderer for the expanded state (e.g. SessionLauncherContent) */
  renderExpandedContent?: () => React.ReactNode;
  /** Optional footer rendered below the expanded content (e.g. settings link) */
  renderFooter?: () => React.ReactNode;
  /** Optional inline suffix rendered inside the description text (e.g. info icon) */
  renderDescriptionSuffix?: (color: string) => React.ReactNode;
  /** Optional tooltip content rendered below the description (inside the card layout) */
  renderTooltip?: () => React.ReactNode;
}

const KPI_CARD_SOURCE_ID = 'lib-personal-kpi';

// Lazy singleton CardService for the update-from-library flow. Kept module-level
// (not per-render) so we don't recreate it on every render; tests mock
// `@/services/cardService`'s `createCardService`.
let sharedCardService: import('@/types/services').CardService | null = null;
function getCardService(): import('@/types/services').CardService {
  if (!sharedCardService) {
    sharedCardService = createCardService();
  }
  return sharedCardService;
}

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 80,
  mass: 1.2,
};

const DISMISS_THRESHOLD = 100;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const FOCUSED_CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

/** Emotion tags that indicate a distress-related card */
const DISTRESS_EMOTIONS = ['anxious', 'angry', 'stressed'] as const;

export default function FocusedCardView({
  card,
  categoryColor,
  categoryName,
  isExpanded = false,
  onExpand,
  onDismiss,
  onCollapse,
  onPrimaryAction,
  onMenuPress,
  renderExpandedContent,
  renderFooter,
  renderDescriptionSuffix,
  renderTooltip,
}: FocusedCardViewProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const reminder = useCardReminder(card.id);
  const [bgImageFailed, setBgImageFailed] = useState(false);
  const [rationaleSheetVisible, setRationaleSheetVisible] = useState(false);
  const [updateSheetVisible, setUpdateSheetVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  // Per-card session suppression for the update sheet. "Not now" records the
  // card id here so any auto-open logic won't re-open the sheet for it this
  // session (Req 2.4). Manual pill taps are always honored — this only gates
  // automatic re-opening (there is none yet, but the ref + gate exist so the
  // suppression state is respected).
  const dismissedThisSession = useRef<Set<string>>(new Set());
  const translateY = useSharedValue(50);
  const opacity = useSharedValue(0.3);
  const prevExpanded = useRef(isExpanded);

  // KPI badge explanation banner state
  const isKpiCard = card.sourceLibraryId === KPI_CARD_SOURCE_ID;
  const lastCheckInDate = useKpiStore((s) => s.lastCheckInDate);
  const hasEverCheckedIn = card.totalUses > 0;

  // Snapshot: capture daysElapsed on first render / card change, and don't update
  // while the card is open. Computed synchronously during render (keyed by card.id)
  // rather than in an effect, so the amber banner is present on the very first
  // paint (a ref set in an effect wouldn't trigger a re-render). Still recalculated
  // only when the focused card changes — preserving the "don't update while open"
  // intent.
  const daysElapsedSnapshot = useRef<number | null>(null);
  const daysElapsedSnapshotCardId = useRef<string | null>(null);
  if (isKpiCard && daysElapsedSnapshotCardId.current !== card.id) {
    daysElapsedSnapshot.current = computeDaysElapsed(lastCheckInDate, new Date());
    daysElapsedSnapshotCardId.current = card.id;
  }

  // Track check-in completion: if lastCheckInDate becomes "today" while the card is open
  const [checkInCompleted, setCheckInCompleted] = useState(false);
  useEffect(() => {
    if (isKpiCard && lastCheckInDate) {
      const elapsed = computeDaysElapsed(lastCheckInDate, new Date());
      if (elapsed === 0) {
        setCheckInCompleted(true);
      }
    }
  }, [lastCheckInDate, isKpiCard]);

  // Reset when card changes
  useEffect(() => {
    setCheckInCompleted(false);
  }, [card.id]);

  // Look up curated card definition for rationale and emotion tags
  const curatedCard = useMemo(() => {
    if (!card.sourceLibraryId) return null;
    return CURATED_LIBRARY.find((c) => c.id === card.sourceLibraryId) ?? null;
  }, [card.sourceLibraryId]);

  // Is this wallet card's copy behind the current curated definition?
  // Single source of truth (librarySyncService); returns false for my_tool,
  // community, removed-curated, and current cards.
  const outdated = useMemo(() => evaluateOutdated(card), [card]);

  // Per-card, plain-language "what changed" lines shown in the update sheet
  // (Req 8.5). Only meaningful when outdated + curated resolved; empty otherwise.
  const changeSummary = useMemo(
    () =>
      outdated.isOutdated && outdated.curated
        ? summarizeUpdate(card, outdated.curated)
        : [],
    [card, outdated]
  );

  // Tapping the banner always opens the sheet — a manual action is never
  // suppressed. Session suppression (Req 2.4) only blocks *automatic* re-opening.
  const handleUpdateBannerPress = useCallback(() => {
    setUpdateError(null);
    setUpdateSheetVisible(true);
  }, []);

  // "Not now": close without mutating, and record the card id so any auto-open
  // stays suppressed for this session. The pill remains visible (card is still
  // outdated), so the user can act later without repeated nagging (Req 2.4).
  const handleUpdateNotNow = useCallback(() => {
    dismissedThisSession.current.add(card.id);
    setUpdateSheetVisible(false);
  }, [card.id]);

  // "Update": apply the in-place update, then reload the wallet so the caught-up
  // card replaces this one and the pill disappears (Req 3.7, 4.2). On failure,
  // show a non-blocking inline message and leave the card + pill as-is (no
  // mutation) — the card stays usable.
  const handleUpdateConfirm = useCallback(async () => {
    setUpdating(true);
    setUpdateError(null);
    try {
      await getCardService().updateFromLibrary(card.id);
      await useWalletStore.getState().loadCards();
      setUpdateSheetVisible(false);
    } catch {
      setUpdateError("We couldn't update this tool right now. Your tool is unchanged — please try again.");
    } finally {
      setUpdating(false);
    }
  }, [card.id]);

  const rationale = curatedCard?.rationale ?? null;
  const isDistressRelated = useMemo(() => {
    if (!curatedCard?.emotionTags) return false;
    return curatedCard.emotionTags.some((tag) =>
      DISTRESS_EMOTIONS.includes(tag as typeof DISTRESS_EMOTIONS[number])
    );
  }, [curatedCard]);

  const handleRationalePress = useCallback(() => {
    setRationaleSheetVisible(true);
  }, []);

  const handleRationaleDismiss = useCallback(() => {
    setRationaleSheetVisible(false);
  }, []);

  const handleCrisisResourcesPress = useCallback(() => {
    setRationaleSheetVisible(false);
    navigation.navigate('CrisisResources');
  }, [navigation]);

  useEffect(() => {
    translateY.value = withSpring(0, SPRING_CONFIG);
    opacity.value = withSpring(1, SPRING_CONFIG);
    announceCardTransition('focused', card.title);
  }, [translateY, opacity, card.title]);

  useEffect(() => {
    if (isExpanded && !prevExpanded.current) {
      announceCardTransition('expanded');
    } else if (!isExpanded && prevExpanded.current) {
      announceCardTransition('collapsed');
    }
    prevExpanded.current = isExpanded;
  }, [isExpanded]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Swipe down gesture to dismiss
  // Only enabled when card is NOT expanded (expanded cards need ScrollView to work freely)
  // activeOffsetY: only activate after 20px downward drag
  // failOffsetY: fail immediately on upward drag
  const panGesture = Gesture.Pan()
    .enabled(!isExpanded)
    .activeOffsetY(20)
    .failOffsetY(-10)
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        opacity.value = 1 - event.translationY / 400;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD) {
        translateY.value = withSpring(600, SPRING_CONFIG);
        opacity.value = withSpring(0, SPRING_CONFIG, () => {
          runOnJS(onDismiss)();
        });
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
        opacity.value = withSpring(1, SPRING_CONFIG);
      }
    });

  const bgColor =
    card.backgroundType === 'color'
      ? card.backgroundValue || '#FFFFFF'
      : card.backgroundType === 'gradient'
        ? card.backgroundValue?.split(',')[0] || '#FFFFFF'
        : '#FFFFFF';

  const backgroundStyle = { backgroundColor: bgColor };
  const hasBackgroundImage = card.backgroundType === 'image' && card.backgroundValue && !bgImageFailed;
  const isLight = isLightBackground(bgColor);
  const textColor = isLight ? '#1C1C1E' : '#FFFFFF';
  const subtitleColor = isLight ? '#4B5563' : 'rgba(255,255,255,0.7)';

  const headerContent = (
    <View style={styles.headerContent}>
      {/* Top row: category pill + kebab menu */}
      <View style={styles.topRow}>
        <View style={[styles.categoryTag, { backgroundColor: categoryColor }]}>
          {categoryName ? (
            <Text style={styles.categoryText}>{categoryName}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.kebabButton}
          onPress={onMenuPress}
          accessibilityRole="button"
          accessibilityLabel="Card menu"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.kebabIcon, { color: textColor }]}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Icon */}
      <View style={styles.iconRow}>
        {renderCardIcon({
          iconType: card.iconType,
          iconValue: card.iconValue,
          size: 48,
          fallbackEmoji: card.iconValue || '📋',
          sourceId: card.sourceLibraryId || card.id,
        })}
      </View>

      {/* Title */}
      <Text
        style={[styles.title, { color: textColor }]}
        numberOfLines={2}
        accessibilityRole="header"
      >
        {card.title}
      </Text>

      {/* Description with inline "Learn more" link */}
      <Text style={[styles.description, { color: subtitleColor }]} numberOfLines={4}>
        {card.description}
        {renderDescriptionSuffix?.(subtitleColor)}
        <RationaleEntryPoint
          inANutshell={rationale?.inANutshell}
          onPress={handleRationalePress}
          color={isLight ? undefined : '#93C5FD'}
        />
      </Text>

      {/* Optional tooltip rendered below description */}
      {renderTooltip?.()}

      {/* Origin badge. The "Update available" affordance is now the prominent
          UpdateAvailableBanner at the top of the card body (both collapsed and
          expanded), not a pill here — see Addendum 2. */}
      <View style={styles.badgeRow}>
        <OriginBadge origin={card.originBadge} />
      </View>
    </View>
  );

  // When expanded with custom content (e.g. SessionLauncherContent),
  // render a compact header + full-height custom content instead of the
  // normal card layout which wastes too much vertical space.
  if (isExpanded && renderExpandedContent) {
    return (
      <>
        <Animated.View style={[styles.container, animatedStyle]}>
            <View style={styles.cardOuter}>
              <View
                style={[
                  styles.cardShell,
                  { minHeight: FOCUSED_CARD_HEIGHT },
                  backgroundStyle,
                ]}
              >
                {/* Compact header: category pill + icon + title + kebab */}
                <View style={styles.compactHeader}>
                  <View style={styles.compactHeaderLeft}>
                    <View style={styles.compactIconWrapper}>
                      {renderCardIcon({
                        iconType: card.iconType,
                        iconValue: card.iconValue,
                        size: 24,
                        fallbackEmoji: card.iconValue || '📋',
                        sourceId: card.sourceLibraryId || card.id,
                      })}
                    </View>
                    <Text
                      style={[styles.compactTitle, { color: textColor }]}
                      numberOfLines={1}
                    >
                      {card.title}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.kebabButton}
                    onPress={onMenuPress}
                    accessibilityRole="button"
                    accessibilityLabel="Card menu"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={[styles.kebabIcon, { color: textColor }]}>⋮</Text>
                  </TouchableOpacity>
                </View>
                {/* Full-height custom expanded content */}
                <KeyboardAvoidingView
                  style={styles.customExpandedContent}
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                  {renderExpandedContent()}
                </KeyboardAvoidingView>
              </View>
            </View>
          </Animated.View>
        {rationale && (
          <RationaleSheet
            visible={rationaleSheetVisible}
            rationale={rationale}
            cardTitle={card.title}
            isDistressRelated={isDistressRelated}
            showAffiliateDisclosure={!!curatedCard?.externalApp?.hasAffiliateLink || card.controls.some((c) => c.type === 'link_button' && (c.config as any).isAffiliate) || curatedCard?.controls.some((c) => c.type === 'link_button' && (c.config as any).isAffiliate)}
            onDismiss={handleRationaleDismiss}
            onCrisisResourcesPress={handleCrisisResourcesPress}
          />
        )}
        <UpdateAvailableSheet
          visible={updateSheetVisible}
          cardTitle={card.title}
          updating={updating}
          errorMessage={updateError}
          changeSummary={changeSummary}
          onUpdate={handleUpdateConfirm}
          onNotNow={handleUpdateNotNow}
        />
      </>
    );
  }

  return (
    <>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <View style={styles.cardOuter}>
            <View
              style={[
                styles.cardShell,
                backgroundStyle,
                { minHeight: FOCUSED_CARD_HEIGHT },
                isExpanded && Platform.OS === 'android' ? { height: FOCUSED_CARD_HEIGHT, minHeight: undefined } : undefined,
              ]}
            >
              {/* Use gesture-handler ScrollView when expanded on Android for proper scroll coordination */}
              {isExpanded && Platform.OS === 'android' ? (
              <KeyboardAvoidingView style={styles.keyboardAvoidingContainer} behavior="height">
              <GHScrollView
                style={styles.cardShellInner}
                contentContainerStyle={[styles.cardShellInnerContent, backgroundStyle]}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
              >
              {/* Prominent update notice — shows collapsed AND expanded (Req 8.1,
                  8.2). Stacked ABOVE the amber check-in banner on the KPI card
                  (Req 8.3). */}
              {outdated.isOutdated && (
                <View style={styles.bannerContainer}>
                  <UpdateAvailableBanner onPress={handleUpdateBannerPress} />
                </View>
              )}
              {isKpiCard && (
                <BadgeExplanationBanner
                  daysElapsedSnapshot={daysElapsedSnapshot.current}
                  checkInCompleted={checkInCompleted}
                  hasEverCheckedIn={hasEverCheckedIn}
                />
              )}
              {hasBackgroundImage ? (
                <ImageBackground
                  source={{ uri: card.backgroundValue }}
                  style={styles.imageBackground}
                  imageStyle={styles.imageStyle}
                  onError={() => setBgImageFailed(true)}
                >
                  <View style={styles.imageOverlay}>{headerContent}</View>
                </ImageBackground>
              ) : (
                headerContent
              )}

              {/* Stats Row inside the card */}
              <View style={styles.statsContainer}>
                <StatsRow
                  totalUses={card.totalUses}
                  currentStreak={card.currentStreak}
                  lastUsedAt={card.lastUsedAt}
                />
              </View>

              {/* Reminder display between stats and expand arrow */}
              <ReminderDisplayRow reminder={reminder} textColor={textColor} />

              {/* Actions inside the card */}
              <View style={styles.expandedContainer}>
                <ExpandedContent card={card} />
                {renderFooter?.()}
              </View>
              </GHScrollView>
              </KeyboardAvoidingView>
              ) : (
              (() => {
                // Non-expanded (both platforms) and expanded-iOS share this branch.
                // Use gesture-handler ScrollView on Android so the content scrolls
                // under the swipe-to-dismiss GestureDetector (a plain RN ScrollView
                // is blocked by the gesture parent on Android — this left the expand
                // arrow unreachable). Only stretch content (flexGrow) when expanded;
                // when collapsed, let content sit at natural height so the arrow sits
                // directly under it and there's no wasted vertical space.
                const ScrollComponent = Platform.OS === 'android' ? GHScrollView : ScrollView;
                return (
              <ScrollComponent
                style={styles.cardShellInner}
                contentContainerStyle={[
                  isExpanded ? styles.cardShellInnerContent : styles.cardShellInnerContentCollapsed,
                  backgroundStyle,
                ]}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                automaticallyAdjustKeyboardInsets={isExpanded}
                keyboardShouldPersistTaps="handled"
              >
              {/* Prominent update notice — shows collapsed AND expanded (Req 8.1,
                  8.2). Stacked ABOVE the amber check-in banner on the KPI card
                  (Req 8.3). */}
              {outdated.isOutdated && (
                <View style={styles.bannerContainer}>
                  <UpdateAvailableBanner onPress={handleUpdateBannerPress} />
                </View>
              )}
              {isKpiCard && (
                <BadgeExplanationBanner
                  daysElapsedSnapshot={daysElapsedSnapshot.current}
                  checkInCompleted={checkInCompleted}
                  hasEverCheckedIn={hasEverCheckedIn}
                />
              )}
              {hasBackgroundImage ? (
                <ImageBackground
                  source={{ uri: card.backgroundValue }}
                  style={styles.imageBackground}
                  imageStyle={styles.imageStyle}
                  onError={() => setBgImageFailed(true)}
                >
                  <View style={styles.imageOverlay}>{headerContent}</View>
                </ImageBackground>
              ) : (
                headerContent
              )}

              {/* Stats Row inside the card */}
              <View style={styles.statsContainer}>
                <StatsRow
                  totalUses={card.totalUses}
                  currentStreak={card.currentStreak}
                  lastUsedAt={card.lastUsedAt}
                />
              </View>

              {/* Reminder display between stats and expand arrow */}
              <ReminderDisplayRow reminder={reminder} textColor={textColor} />

              {/* Actions inside the card */}
              {isExpanded ? (
                <View style={styles.expandedContainer}>
                  <ExpandedContent card={card} />
                  {renderFooter?.()}
                </View>
              ) : (
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={styles.expandArrow}
                    onPress={onExpand}
                    accessibilityRole="button"
                    accessibilityLabel="Expand card to see full content"
                  >
                    <Text style={[styles.expandArrowText, { color: textColor }]}>▼</Text>
                  </TouchableOpacity>
                </View>
              )}
              </ScrollComponent>
                );
              })()
              )}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
      {rationale && (
        <RationaleSheet
          visible={rationaleSheetVisible}
          rationale={rationale}
          cardTitle={card.title}
          isDistressRelated={isDistressRelated}
          showAffiliateDisclosure={!!curatedCard?.externalApp?.hasAffiliateLink || card.controls.some((c) => c.type === 'link_button' && (c.config as any).isAffiliate) || curatedCard?.controls.some((c) => c.type === 'link_button' && (c.config as any).isAffiliate)}
          onDismiss={handleRationaleDismiss}
          onCrisisResourcesPress={handleCrisisResourcesPress}
        />
      )}
      <UpdateAvailableSheet
        visible={updateSheetVisible}
        cardTitle={card.title}
        updating={updating}
        errorMessage={updateError}
        changeSummary={changeSummary}
        onUpdate={handleUpdateConfirm}
        onNotNow={handleUpdateNotNow}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cardOuter: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  cardShell: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  cardShellInner: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardShellInnerContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  // Non-expanded: no flexGrow so short content stays compact (no wasted space)
  // and the expand arrow sits directly under the content instead of being
  // stretched to the bottom / pushed off the visible card.
  cardShellInnerContentCollapsed: {
    paddingBottom: 16,
  },
  headerContent: {
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  kebabButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kebabIcon: {
    fontSize: 24,
    fontWeight: '700',
  },
  iconRow: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  // Horizontal inset so the full-width update banner aligns with the card body
  // padding (headerContent uses padding: 20). The banner supplies its own
  // vertical spacing (marginBottom).
  bannerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  affiliateDisclosure: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 6,
    marginBottom: 4,
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  expandArrow: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandArrowText: {
    fontSize: 22,
    opacity: 0.7,
  },
  expandedContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  customExpandedContent: {
    flex: 1,
    overflow: 'hidden',
  },
  keyboardAvoidingContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  compactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactIconWrapper: {
    marginRight: 10,
  },
  compactTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  imageBackground: {
    width: '100%',
  },
  imageStyle: {
    borderRadius: 16,
  },
  imageOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});
