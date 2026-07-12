import { EmotionType } from '@/types';

export interface EmotionConfig {
  type: EmotionType;
  label: string; // User-facing display name
  icon: string; // Emoji for chip
}

export const EMOTION_OPTIONS: EmotionConfig[] = [
  { type: 'stressed', label: 'Stressed', icon: '😰' },
  { type: 'overwhelmed', label: 'Overwhelmed', icon: '🌊' },
  { type: 'anxious', label: 'Anxious', icon: '😟' },
  { type: 'sad', label: 'Sad', icon: '😢' },
  { type: 'angry', label: 'Angry', icon: '😤' },
  { type: 'numb', label: 'Numb', icon: '😶' },
  { type: 'lonely', label: 'Lonely', icon: '🫂' },
  { type: 'ashamed', label: 'Ashamed', icon: '😣' },
  { type: 'guilty', label: 'Guilty', icon: '😔' },
  { type: 'hopeless', label: 'Hopeless', icon: '🕳️' },
  { type: 'calm', label: 'Calm', icon: '😌' },
  { type: 'curious', label: 'Curious', icon: '🤔' },
];

/**
 * Returns the display name for an emotion.
 * Used in session history, usage screens, and the soft label.
 */
export function getEmotionDisplayName(emotion: EmotionType): string {
  const config = EMOTION_OPTIONS.find((opt) => opt.type === emotion);
  if (config) {
    return config.label;
  }
  // Fallback: capitalize the emotion type value
  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
}

/**
 * Generates the soft label message for a derived feeling.
 * Format: "It sounds like you might be feeling [label] right now"
 * The [label] portion uses the lowercase display name from EMOTION_OPTIONS.
 */
export function formatSoftLabel(emotion: EmotionType): string {
  const displayName = getEmotionDisplayName(emotion).toLowerCase();
  return `It sounds like you might be feeling ${displayName} right now`;
}
