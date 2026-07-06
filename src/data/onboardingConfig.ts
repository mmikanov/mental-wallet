/**
 * Onboarding Configuration — Starter card mappings per user intent.
 *
 * Each intent maps to a set of curated library card IDs that are seeded
 * into the user's wallet during onboarding. The configuration can be
 * updated without code changes to adjust the default starter experience.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8
 */

export type IntentId = 'overwhelm' | 'routine' | 'organize' | 'explore';

export interface StarterCardMapping {
  intentId: IntentId;
  label: string; // Display label for the intent option
  description: string; // Subtext shown below the label
  cardIds: string[]; // References to CURATED_LIBRARY card IDs
}

export const INTENT_OPTIONS: StarterCardMapping[] = [
  {
    intentId: 'overwhelm',
    label: 'I need quick tools for overwhelm',
    description: 'Fast exercises to calm your mind in the moment',
    cardIds: ['lib-grounding-54321', 'lib-box-breathing', 'lib-name-it-tame-it'],
  },
  {
    intentId: 'routine',
    label: 'I want to build a daily routine',
    description: 'Tools to check in with yourself each day',
    cardIds: ['lib-gratitude-three', 'lib-win-of-day', 'lib-evening-gratitude'],
  },
  {
    intentId: 'organize',
    label: 'I have tools already — help me organize',
    description: 'An example to get you started — add your own from the library',
    cardIds: ['lib-grounding-54321'],
  },
  {
    intentId: 'explore',
    label: "I'm just exploring",
    description: 'A mix of popular tools to try',
    cardIds: ['lib-box-breathing', 'lib-thought-feeling-action', 'lib-win-of-day'],
  },
];

export const DEFAULT_STARTER_CARD_IDS: string[] = [
  'lib-grounding-54321',
  'lib-box-breathing',
  'lib-self-compassion-pause',
];
