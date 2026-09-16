/**
 * BoxBreathingAnimation — a calm, code-drawn 4-4-4-4 breathing pacer.
 *
 * Renders an expanding/contracting rounded square with a synced phase label
 * ("Breathe in" / "Hold" / "Breathe out" / "Hold"). Built with Reanimated so it
 * animates identically on iOS and Android (RN <Image> does NOT animate GIFs on
 * Android, and the app has no video-playback library; this component sidesteps
 * both). The asset is our own code, so it is IP-free by construction.
 *
 * Display-only: no value, not part of completion capture. Curated-only for
 * 1.0.4 (not offered in the creator control picker).
 *
 * Starts PAUSED: the pacer does not auto-run when the card expands, so a
 * first-time user can read the steps above it first, then tap Play to begin
 * when ready. There is no pause/stop (the exercise is ~1 minute); to restart,
 * the user closes and reopens the card.
 *
 * Accessibility: respects the OS "reduce motion" setting (renders a static
 * square instead of looping) and exposes a descriptive accessibility label. The
 * card's textual steps remain the authoritative instructions.
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 2.1, 2.4, 3.1, 3.2, 3.3, 3.4
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

// Brand palette (see src/utils/cardColors.ts conventions)
const SAGE = '#788d75';
const CREAM = '#f5f2eb';

// 4-4-4-4: each phase is 4 seconds.
const PHASE_MS = 4000;

// Gentle scale range — calm, not flashy (Req 1.2).
const MIN_SCALE = 0.6;
const MAX_SCALE = 1;

const PHASES = ['Breathe in (nose)', 'Hold', 'Breathe out (mouth)', 'Hold'] as const;

const SECONDS_PER_PHASE = 4;
const PHASES_PER_CYCLE = PHASES.length; // 4
const CYCLES = 4; // 4 full box-breathing cycles, then it stops (Completed)
const TICK_MS = 1000;

// Total run length: 4 cycles x 4 phases x 4s = 64s. The pacer stops here (shows
// "Completed") instead of looping back to cycle 1.
const TOTAL_SECONDS = PHASES_PER_CYCLE * CYCLES * SECONDS_PER_PHASE; // 64

// Whether a phase counts up (1→4) or down (4→1). Alternating up/down/up/down
// reads naturally: fill up on inhale/first hold, wind down on exhale/second hold.
const PHASE_COUNTS_UP = [true, false, true, false] as const;

/** The number shown for a given phase + second (1-based second, 0..3). */
export function countForPhase(phaseIndex: number, second: number): number {
  return PHASE_COUNTS_UP[phaseIndex] ? second + 1 : SECONDS_PER_PHASE - second;
}

/**
 * Derives the pacer's display state from the elapsed whole-seconds count.
 * Pure and exported so the timing math (counter direction, phase, cycle) can be
 * unit-tested without the component's async reduce-motion lifecycle.
 */
export function derivePacerState(elapsedSec: number): {
  phaseIndex: number;
  cycleIndex: number;
  secondInPhase: number;
  count: number;
} {
  const totalPhases = PHASES_PER_CYCLE * CYCLES; // 16
  const phaseOrdinal = Math.floor(elapsedSec / SECONDS_PER_PHASE) % totalPhases;
  const phaseIndex = phaseOrdinal % PHASES_PER_CYCLE;
  const cycleIndex = Math.floor(phaseOrdinal / PHASES_PER_CYCLE); // 0..3
  const secondInPhase = elapsedSec % SECONDS_PER_PHASE; // 0..3
  return { phaseIndex, cycleIndex, secondInPhase, count: countForPhase(phaseIndex, secondInPhase) };
}

const A11Y_LABEL =
  'Box breathing pacer. Breathe in through your nose for 4 seconds, hold for 4 seconds, ' +
  'breathe out through your mouth for 4 seconds, hold for 4 seconds. Four cycles, then it completes.';

interface BoxBreathingAnimationProps {
  label?: string;
}

export default function BoxBreathingAnimation({ label }: BoxBreathingAnimationProps) {
  const scale = useSharedValue(MIN_SCALE);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Start PAUSED so the pacer doesn't auto-run before the user has read the
  // instructions. The user taps Play to begin (Req: user starts when ready).
  const [playing, setPlaying] = useState(false);
  // Set true after all 4 cycles finish. Shows a "Completed" state with the Play
  // button so the user can restart if they want (instead of looping forever).
  const [completed, setCompleted] = useState(false);
  // elapsedSec advances once per second while playing; phase, second-in-phase,
  // and cycle are all derived from it so the counter, phase label, and cycle
  // indicator stay in lockstep.
  const [elapsedSec, setElapsedSec] = useState(0);

  const { phaseIndex, cycleIndex, count } = derivePacerState(elapsedSec);

  // Detect + subscribe to the OS reduce-motion setting.
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        /* default to animating */
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Drive the looping scale animation. Only runs while playing (and motion is on).
  // When not playing, the square rests at MIN_SCALE (idle) so the Play button reads
  // as "not started yet". Reduce-motion shows a static settled square.
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(scale);
      scale.value = MAX_SCALE; // static "settled" state
      return;
    }
    if (!playing) {
      cancelAnimation(scale);
      scale.value = MIN_SCALE; // idle "ready" state
      return;
    }
    // inhale (expand) -> hold -> exhale (contract) -> hold, repeated for exactly
    // CYCLES cycles, then it settles (no infinite loop — the JS clock flips to
    // the Completed state at TOTAL_SECONDS).
    scale.value = MIN_SCALE;
    scale.value = withRepeat(
      withSequence(
        withTiming(MAX_SCALE, { duration: PHASE_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(MAX_SCALE, { duration: PHASE_MS }),
        withTiming(MIN_SCALE, { duration: PHASE_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(MIN_SCALE, { duration: PHASE_MS })
      ),
      CYCLES,
      false
    );
    return () => {
      cancelAnimation(scale);
    };
  }, [reduceMotion, playing, scale]);

  // Advance the 1-second clock that drives the counter, phase label, and cycle
  // indicator (JS side; keeps them readable/testable without reading the shared
  // value on the JS thread). Only ticks while playing. Stops at TOTAL_SECONDS and
  // flips to the Completed state (rather than looping back to cycle 1).
  useEffect(() => {
    if (reduceMotion || !playing) return;
    const id = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        if (next >= TOTAL_SECONDS) {
          // All cycles done: stop the clock, mark complete.
          setPlaying(false);
          setCompleted(true);
          return TOTAL_SECONDS;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [reduceMotion, playing]);

  const handlePlay = useCallback(() => {
    setElapsedSec(0);
    setCompleted(false);
    setPlaying(true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={styles.container}
      accessibilityLabel={A11Y_LABEL}
    >
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.stage}>
        {/* Decorative animated square — hidden from the accessibility tree so it
            doesn't add noise; the container's label describes the pacer and the
            interactive Play button (a sibling) stays its own accessible element. */}
        <View
          style={styles.stageInner}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {reduceMotion ? (
            <View style={styles.square}>
              <Text style={styles.count}>4</Text>
            </View>
          ) : playing ? (
            // Playing: the solid sage square that scales with the breath.
            <Animated.View style={[styles.square, animatedStyle]}>
              <Text style={styles.count}>{count}</Text>
            </Animated.View>
          ) : null /* Idle/Completed: nothing behind the Play button (clean stage). */}
        </View>
        {/* Play button — shown when not playing (idle before start, or after all
            cycles complete so the user can restart). Hidden while playing and for
            reduce-motion. Sibling of the hidden square so it stays accessible. */}
        {!reduceMotion && !playing && (
          <Pressable
            style={styles.playOverlay}
            onPress={handlePlay}
            accessibilityRole="button"
            accessibilityLabel={completed ? 'Restart breathing exercise' : 'Start breathing exercise'}
          >
            <View style={styles.playButton}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
            <Text style={styles.playHint}>{completed ? 'Tap to restart' : 'Tap to start'}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.phase}>
        {reduceMotion
          ? 'Breathe slowly, 4 in, 4 hold, 4 out, 4 hold'
          : playing
            ? PHASES[phaseIndex]
            : completed
              ? 'Completed'
              : 'Ready when you are'}
      </Text>
      {!reduceMotion && playing && (
        <View style={styles.cycleRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: CYCLES }).map((_, i) => (
            <View
              key={i}
              style={[styles.cycleDot, i === cycleIndex && styles.cycleDotActive]}
            />
          ))}
        </View>
      )}
      {!reduceMotion && playing && (
        <Text style={styles.cycleLabel}>{`Cycle ${cycleIndex + 1} of ${CYCLES}`}</Text>
      )}
    </View>
  );
}

const STAGE_SIZE = 180;
const SQUARE_SIZE = 140;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  stage: {
    width: '100%',
    height: STAGE_SIZE,
    borderRadius: 12,
    backgroundColor: CREAM,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stageInner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  square: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    borderRadius: 20,
    backgroundColor: SAGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  count: {
    fontSize: 44,
    fontWeight: '700',
    color: CREAM,
  },
  phase: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: SAGE,
    letterSpacing: 0.3,
  },
  cycleRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  cycleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d6cfc2', // muted cream/taupe for inactive
  },
  cycleDotActive: {
    backgroundColor: SAGE,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cycleLabel: {
    marginTop: 6,
    fontSize: 13,
    color: '#8a8577',
  },
  // Idle play overlay — sits on top of the (resting) square inside the stage.
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // High-contrast solid sage circle with a cream icon, on a subtle shadow, so it
  // pops against the muted idle square and the cream stage.
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: SAGE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  playIcon: {
    fontSize: 28,
    color: CREAM,
    // Nudge the triangle glyph to look optically centered in the circle.
    marginLeft: 4,
  },
  playHint: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: SAGE,
  },
});
