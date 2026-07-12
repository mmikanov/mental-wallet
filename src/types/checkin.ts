/**
 * Check-in domain types for the Guided Emotion Check-in feature.
 */

import { EmotionType } from './index';

/** Body energy levels for question 1 */
export type BodyEnergyLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

/** Pleasantness for question 2 */
export type Pleasantness = 'unpleasant' | 'mixed' | 'pleasant';

/** Thought pattern for question 3 */
export type ThoughtPattern =
  | 'racing'
  | 'stuck_worries'
  | 'stuck_mistakes'
  | 'blank'
  | 'numb'
  | 'curious_interested'
  | 'okay';

/** Social context for question 4 */
export type SocialContext = 'alone_at_home' | 'at_work' | 'with_family' | 'with_friends';

/** A completed check-in record for persistence */
export interface CheckinRecord {
  id: string;                    // UUID v4 via expo-crypto
  bodyEnergy: BodyEnergyLevel;
  pleasantness: Pleasantness;
  thoughtPattern: ThoughtPattern;
  context: SocialContext;
  derivedFeeling: EmotionType;
  wasChanged: boolean;           // true if user overrode the suggestion
  finalEmotion: EmotionType;     // the emotion actually used for the session
  recordedAt: string;            // UTC ISO 8601
}

/** Question configuration for the check-in flow */
export interface CheckinQuestion {
  step: 1 | 2 | 3 | 4;
  prompt: string;
  options: CheckinOption[];
  icon: string;                  // decorative icon above prompt
}

export interface CheckinOption {
  value: string;                 // enum value stored in answers
  label: string;                 // user-facing display text
}

export interface MappingInput {
  bodyEnergy: BodyEnergyLevel;
  pleasantness: Pleasantness;
  thoughtPattern: ThoughtPattern;
  context: SocialContext;
}

export interface MappingResult {
  topFeelings: EmotionType[];           // 1 or more tied top-scoring feelings
  scores: Record<EmotionType, number>;  // all 12 scores for debugging/analytics
}

/** Weight values for a single feeling across all 19 input dimensions */
export interface ScoringWeights {
  body_very_low: number;
  body_low: number;
  body_medium: number;
  body_high: number;
  body_very_high: number;
  pleasant_unpleasant: number;
  pleasant_mixed: number;
  pleasant_pleasant: number;
  thought_racing: number;
  thought_stuck_worries: number;
  thought_stuck_mistakes: number;
  thought_blank: number;
  thought_numb: number;
  thought_curious_interested: number;
  thought_okay: number;
  ctx_alone_at_home: number;
  ctx_at_work: number;
  ctx_with_family: number;
  ctx_with_friends: number;
}

export interface CheckinAnswers {
  bodyEnergy: BodyEnergyLevel | null;
  pleasantness: Pleasantness | null;
  thoughtPattern: ThoughtPattern | null;
  context: SocialContext | null;
}
