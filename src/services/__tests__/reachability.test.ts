/**
 * Reachability test — ensures all 12 emotions can actually be reached
 * through at least one valid combination of inputs.
 *
 * This guards against scoring table changes that accidentally make an emotion unreachable.
 */
import { deriveFeeling, SCORING_TABLE } from '@/services/mappingEngine';
import type { BodyEnergyLevel, Pleasantness, ThoughtPattern, SocialContext } from '@/types/checkin';
import type { EmotionType } from '@/types/index';

const bodyEnergies: BodyEnergyLevel[] = ['very_low', 'low', 'medium', 'high', 'very_high'];
const pleasantnesses: Pleasantness[] = ['unpleasant', 'mixed', 'pleasant'];
const thoughtPatterns: ThoughtPattern[] = ['racing', 'stuck_worries', 'stuck_mistakes', 'blank', 'numb', 'curious_interested', 'okay'];
const contexts: SocialContext[] = ['alone_at_home', 'at_work', 'with_family', 'with_friends'];

const ALL_EMOTIONS: EmotionType[] = ['stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb', 'lonely', 'ashamed', 'guilty', 'hopeless', 'calm', 'curious'];

test('all 12 emotions are reachable via at least one input combination', () => {
  const reachable = new Set<string>();

  for (const bodyEnergy of bodyEnergies) {
    for (const pleasantness of pleasantnesses) {
      for (const thoughtPattern of thoughtPatterns) {
        for (const context of contexts) {
          const result = deriveFeeling({ bodyEnergy, pleasantness, thoughtPattern, context });
          for (const feeling of result.topFeelings) {
            reachable.add(feeling);
          }
        }
      }
    }
  }

  const unreachable = ALL_EMOTIONS.filter(e => !reachable.has(e));
  expect(unreachable).toEqual([]);
  expect(reachable.size).toBe(12);
});

test('report emotion coverage across all input combinations', () => {
  // For each emotion, count how many input combinations produce it as a top feeling
  const emotionHits: Map<EmotionType, number> = new Map();
  for (const emotion of ALL_EMOTIONS) {
    emotionHits.set(emotion, 0);
  }

  for (const bodyEnergy of bodyEnergies) {
    for (const pleasantness of pleasantnesses) {
      for (const thoughtPattern of thoughtPatterns) {
        for (const context of contexts) {
          const result = deriveFeeling({ bodyEnergy, pleasantness, thoughtPattern, context });
          for (const feeling of result.topFeelings) {
            emotionHits.set(feeling, (emotionHits.get(feeling) ?? 0) + 1);
          }
        }
      }
    }
  }

  // Log for visibility
  for (const [emotion, hits] of emotionHits.entries()) {
    console.log(`  ${emotion}: ${hits} input combinations`);
  }

  // Every emotion in the scoring table should be reachable
  const deadEmotions: EmotionType[] = [];
  for (const [emotion, hits] of emotionHits.entries()) {
    if (hits === 0) {
      deadEmotions.push(emotion);
    }
  }

  expect(deadEmotions).toEqual([]);
});
