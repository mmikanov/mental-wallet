/**
 * FirstActionChecklist — Collapsible 3-item checklist guiding new users to their "aha moment."
 *
 * Rendered in the wallet content area after the Micro-Tutorial is dismissed.
 * Collapses to a compact progress bar to avoid blocking card content.
 * Shows a celebration state when all items are done, then auto-dismisses.
 *
 * Validates: Requirements 6.1, 6.2, 6.6, 6.7, 9.5
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const FADE_DURATION = 300;
const CELEBRATION_DISMISS_DELAY = 12000;
const REINFORCEMENT_DISPLAY_DURATION = 3000;

export interface ChecklistItem {
  id: 'open_tool' | 'try_exercise' | 'add_tool';
  label: string;
  isDone: boolean;
}

export interface FirstActionChecklistProps {
  items: ChecklistItem[];
  onItemPress: (id: ChecklistItem['id']) => void;
  onDismiss: () => void;
}

export default function FirstActionChecklist({
  items,
  onItemPress,
  onDismiss,
}: FirstActionChecklistProps) {
  const opacity = useSharedValue(1);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showReinforcement, setShowReinforcement] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevTryExerciseDone, setPrevTryExerciseDone] = useState(
    items.find((i) => i.id === 'try_exercise')?.isDone ?? false,
  );

  const allDone = items.every((item) => item.isDone);
  const doneCount = items.filter((item) => item.isDone).length;

  // Detect when try_exercise transitions from not-done to done
  const currentTryExerciseDone =
    items.find((i) => i.id === 'try_exercise')?.isDone ?? false;

  useEffect(() => {
    if (!prevTryExerciseDone && currentTryExerciseDone) {
      setShowReinforcement(true);
      setIsExpanded(true); // Expand to show reinforcement
      const timer = setTimeout(() => {
        setShowReinforcement(false);
      }, REINFORCEMENT_DISPLAY_DURATION);
      return () => clearTimeout(timer);
    }
    setPrevTryExerciseDone(currentTryExerciseDone);
  }, [currentTryExerciseDone, prevTryExerciseDone]);

  // Show celebration when all done, then auto-dismiss
  useEffect(() => {
    if (allDone) {
      setShowCelebration(true);
      setIsExpanded(true); // Expand to show celebration
      const timer = setTimeout(() => {
        opacity.value = withTiming(
          0,
          { duration: FADE_DURATION, easing: Easing.inOut(Easing.ease) },
          (finished) => {
            if (finished) {
              runOnJS(onDismiss)();
            }
          },
        );
      }, CELEBRATION_DISMISS_DELAY);
      return () => clearTimeout(timer);
    }
  }, [allDone, onDismiss, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleToggle = () => {
    if (!showCelebration) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
      accessibilityRole="list"
      accessibilityLabel="First actions checklist"
    >
      {showCelebration ? (
        <View style={styles.celebrationContainer}>
          <TouchableOpacity
            style={styles.celebrationDismiss}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.celebrationDismissIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.celebrationEmoji} accessibilityElementsHidden>
            🎉
          </Text>
          <Text style={styles.celebrationText}>
            Great start! You've taken your first step toward organizing your mental health. Come back regularly to keep the momentum going.
          </Text>
        </View>
      ) : isExpanded ? (
        <>
          {/* Collapse handle */}
          <Pressable
            onPress={handleToggle}
            style={styles.collapseHandle}
            accessibilityRole="button"
            accessibilityLabel="Collapse checklist"
          >
            <Text style={styles.headerText}>Getting started</Text>
            <Text style={styles.progressText}>{doneCount}/3</Text>
            <Text style={styles.collapseIcon}>▲</Text>
          </Pressable>

          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemRow}
              onPress={() => onItemPress(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.isDone }}
              accessibilityLabel={item.label}
              accessibilityHint={
                item.isDone
                  ? 'Completed'
                  : `Tap to ${item.id === 'open_tool' ? 'open your first tool' : item.id === 'try_exercise' ? 'try the exercise' : 'add a tool from the library'}`
              }
            >
              <View
                style={[
                  styles.checkbox,
                  item.isDone && styles.checkboxDone,
                ]}
              >
                {item.isDone && (
                  <Text style={styles.checkmark} accessibilityElementsHidden>
                    ✓
                  </Text>
                )}
              </View>
              <Text
                style={[styles.itemLabel, item.isDone && styles.itemLabelDone]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          {showReinforcement && (
            <View
              style={styles.reinforcementContainer}
              accessibilityRole="alert"
              accessibilityLabel="Nice! You've just used your first tool."
            >
              <Text style={styles.reinforcementText}>
                Nice! You've just used your first tool.
              </Text>
            </View>
          )}
        </>
      ) : (
        /* Collapsed state — compact progress bar */
        <Pressable
          onPress={handleToggle}
          style={styles.collapsedRow}
          accessibilityRole="button"
          accessibilityLabel={`Getting started: ${doneCount} of 3 complete. Tap to expand.`}
        >
          <Text style={styles.headerText}>Getting started</Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${(doneCount / 3) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{doneCount}/3</Text>
          <Text style={styles.collapseIcon}>▼</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  collapseHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginRight: 8,
  },
  progressText: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 'auto',
    marginRight: 8,
  },
  collapseIcon: {
    fontSize: 10,
    color: '#8E8E93',
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginRight: 8,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#34C759',
    borderRadius: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxDone: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  itemLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: '#1C1C1E',
    flex: 1,
  },
  itemLabelDone: {
    color: '#8E8E93',
    textDecorationLine: 'line-through',
  },
  celebrationContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  celebrationDismiss: {
    position: 'absolute',
    top: 4,
    right: 0,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationDismissIcon: {
    fontSize: 16,
    color: '#636366',
    fontWeight: '600',
  },
  celebrationEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  celebrationText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  reinforcementContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  reinforcementText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
    textAlign: 'center',
  },
});
