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

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Card } from '@/types/index';
import OriginBadge from './OriginBadge';
import StatsRow from './StatsRow';
import PrimaryActionButton from './PrimaryActionButton';
import ExpandedContent from './ExpandedContent';
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
}

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

const DISMISS_THRESHOLD = 100;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const FOCUSED_CARD_HEIGHT = SCREEN_HEIGHT * 0.65;

/**
 * Determines whether text should be light or dark based on background color brightness.
 */
function isLightBackground(color: string): boolean {
  if (!color || color === '#FFFFFF' || color === '#ffffff') return true;
  const hex = color.replace('#', '');
  if (hex.length < 6) return true;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

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
}: FocusedCardViewProps) {
  const translateY = useSharedValue(300);
  const opacity = useSharedValue(0);
  const prevExpanded = useRef(isExpanded);

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
  const panGesture = Gesture.Pan()
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
  const hasBackgroundImage = card.backgroundType === 'image' && card.backgroundValue;
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
        <Text style={styles.icon}>
          {card.iconType === 'emoji' ? card.iconValue : '📋'}
        </Text>
      </View>

      {/* Title */}
      <Text
        style={[styles.title, { color: textColor }]}
        numberOfLines={2}
        accessibilityRole="header"
      >
        {card.title}
      </Text>

      {/* Description */}
      <Text style={[styles.description, { color: subtitleColor }]} numberOfLines={4}>
        {card.description}
      </Text>

      {/* Origin badge */}
      <View style={styles.badgeRow}>
        <OriginBadge origin={card.originBadge} />
      </View>
    </View>
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.cardOuter}>
          {/* Card Shell */}
          <View
            style={[
              styles.cardShell,
              { minHeight: FOCUSED_CARD_HEIGHT },
            ]}
          >
            <ScrollView
              style={styles.cardShellInner}
              contentContainerStyle={[styles.cardShellInnerContent, backgroundStyle]}
              showsVerticalScrollIndicator={false}
            >
            {hasBackgroundImage ? (
              <ImageBackground
                source={{ uri: card.backgroundValue }}
                style={styles.imageBackground}
                imageStyle={styles.imageStyle}
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

            {/* Actions inside the card */}
            {isExpanded ? (
              <View style={styles.expandedContainer}>
                <ExpandedContent card={card} />
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
            </ScrollView>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
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
    marginBottom: 8,
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
