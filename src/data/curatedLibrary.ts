/**
 * Curated Library — Static seed data for the 10–12 hand-selected
 * mental health tools available in the Library Browser.
 *
 * These definitions are NOT persisted in the database until a user
 * explicitly adds them to their wallet via "Add to wallet".
 *
 * Validates: Requirements 8.1, 8.5
 */

import type { ControlType, ControlConfig } from '@/types/index';

export interface CuratedControlDefinition {
  type: ControlType;
  position: number;
  config: ControlConfig;
  isRequired: boolean;
}

export interface CuratedCardDefinition {
  id: string;
  title: string;
  description: string;
  iconType: 'emoji';
  iconValue: string;
  backgroundType: 'color';
  backgroundValue: string;
  categoryId: string;
  allowBackgroundCustomization: boolean;
  controls: CuratedControlDefinition[];
}

/**
 * 11 curated cards across the 6 categories.
 */
export const CURATED_LIBRARY: CuratedCardDefinition[] = [
  // ─── Grounding & Calming (3) ───────────────────────────────────────────────
  {
    id: 'lib-grounding-54321',
    title: '5-4-3-2-1 Grounding',
    description: 'Use your senses to anchor yourself in the present moment when anxiety rises.',
    iconType: 'emoji',
    iconValue: '🌿',
    backgroundType: 'color',
    backgroundValue: '#E8F4F8',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'Instructions',
          body: '5 things you can SEE\n4 things you can TOUCH\n3 things you can HEAR\n2 things you can SMELL\n1 thing you can TASTE',
          fontSize: 'medium',
        },
        isRequired: false,
      },
      {
        type: 'text_input',
        position: 1,
        config: {
          label: 'Reflection',
          placeholder: 'How do you feel now?',
          maxLength: 200,
        },
        isRequired: false,
      },
    ],
  },
  {
    id: 'lib-box-breathing',
    title: 'Box Breathing',
    description: 'A simple 4-4-4-4 breathing pattern to calm your nervous system.',
    iconType: 'emoji',
    iconValue: '🫁',
    backgroundType: 'color',
    backgroundValue: '#EDE7F6',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'Box Breathing Steps',
          body: '1. Breathe IN for 4 seconds\n2. HOLD for 4 seconds\n3. Breathe OUT for 4 seconds\n4. HOLD for 4 seconds\n\nRepeat 4 cycles.',
          fontSize: 'large',
        },
        isRequired: false,
      },
    ],
  },
  {
    id: 'lib-pmr',
    title: 'Progressive Muscle Relaxation',
    description: 'Systematically tense and release muscle groups to release physical stress.',
    iconType: 'emoji',
    iconValue: '💆',
    backgroundType: 'color',
    backgroundValue: '#E0F2F1',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'Body Areas',
          body: '• Feet & calves — tense 5s, release\n• Thighs & hips — tense 5s, release\n• Stomach & chest — tense 5s, release\n• Hands & arms — tense 5s, release\n• Shoulders & neck — tense 5s, release\n• Face & jaw — tense 5s, release',
          fontSize: 'medium',
        },
        isRequired: false,
      },
    ],
  },

  // ─── Cognitive Reframing (2) ───────────────────────────────────────────────
  {
    id: 'lib-thought-feeling-action',
    title: 'Thought – Feeling – Action',
    description: 'Map the CBT triad to understand how thoughts drive emotions and behavior.',
    iconType: 'emoji',
    iconValue: '🧠',
    backgroundType: 'color',
    backgroundValue: '#F3E5F5',
    categoryId: 'cognitive-reframing',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'text_input',
        position: 0,
        config: {
          label: 'Thought',
          placeholder: 'What thought triggered this?',
          maxLength: 200,
        },
        isRequired: true,
      },
      {
        type: 'text_input',
        position: 1,
        config: {
          label: 'Feeling',
          placeholder: 'What emotion came up?',
          maxLength: 200,
        },
        isRequired: true,
      },
      {
        type: 'text_input',
        position: 2,
        config: {
          label: 'Action',
          placeholder: 'What did you do (or want to do)?',
          maxLength: 200,
        },
        isRequired: true,
      },
    ],
  },
  {
    id: 'lib-decatastrophizing',
    title: 'Decatastrophizing',
    description: 'Challenge catastrophic thinking by examining the worst and most likely outcomes.',
    iconType: 'emoji',
    iconValue: '⚖️',
    backgroundType: 'color',
    backgroundValue: '#FFF3E0',
    categoryId: 'cognitive-reframing',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'text_area',
        position: 0,
        config: {
          label: 'Worst-case scenario',
          placeholder: 'What is the absolute worst that could happen?',
        },
        isRequired: true,
      },
      {
        type: 'text_area',
        position: 1,
        config: {
          label: 'Most likely outcome',
          placeholder: 'What will probably actually happen?',
        },
        isRequired: true,
      },
    ],
  },

  // ─── Body & Sensory (1) ────────────────────────────────────────────────────
  {
    id: 'lib-body-scan',
    title: 'Body Scan in 3 Minutes',
    description: 'A quick guided body scan to check in with physical sensations and release tension.',
    iconType: 'emoji',
    iconValue: '🧘',
    backgroundType: 'color',
    backgroundValue: '#FBE9E7',
    categoryId: 'body-sensory',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'Quick Body Scan',
          body: '1. Close your eyes and take 3 deep breaths\n2. Notice your feet on the ground\n3. Scan upward: legs, hips, belly, chest\n4. Notice shoulders, arms, hands\n5. Relax your jaw and forehead\n6. Take one final deep breath',
          fontSize: 'medium',
        },
        isRequired: false,
      },
      {
        type: 'checkbox',
        position: 1,
        config: {
          label: 'Completed the body scan',
        },
        isRequired: false,
      },
    ],
  },

  // ─── Daily Check-In & Journaling (2) ──────────────────────────────────────
  {
    id: 'lib-daily-mood',
    title: 'Daily Mood Check-In',
    description: 'Track your mood each day and reflect on what is on your mind.',
    iconType: 'emoji',
    iconValue: '🌤️',
    backgroundType: 'color',
    backgroundValue: '#E8F5E9',
    categoryId: 'daily-checkin-journaling',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'mood_slider',
        position: 0,
        config: {
          label: 'How are you feeling?',
          minLabel: 'Low',
          maxLabel: 'Great',
        },
        isRequired: true,
      },
      {
        type: 'text_input',
        position: 1,
        config: {
          label: "What's on your mind?",
          placeholder: 'A brief thought or word...',
          maxLength: 200,
        },
        isRequired: false,
      },
    ],
  },
  {
    id: 'lib-win-of-day',
    title: 'Win of the Day',
    description: 'Celebrate one positive thing from today, no matter how small.',
    iconType: 'emoji',
    iconValue: '🏆',
    backgroundType: 'color',
    backgroundValue: '#FFFDE7',
    categoryId: 'daily-checkin-journaling',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'text_area',
        position: 0,
        config: {
          label: "Today's win",
          placeholder: 'What went well today?',
        },
        isRequired: true,
      },
    ],
  },

  // ─── Self-Compassion & Reminders (2) ──────────────────────────────────────
  {
    id: 'lib-self-compassion-pause',
    title: 'Self-Compassion Pause',
    description: 'Three steps to respond to yourself with kindness during difficult moments.',
    iconType: 'emoji',
    iconValue: '💛',
    backgroundType: 'color',
    backgroundValue: '#FCE4EC',
    categoryId: 'self-compassion-reminders',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'Three Steps',
          body: '1. Acknowledge: "This is a moment of suffering."\n2. Common humanity: "Others feel this way too."\n3. Kindness: "May I give myself compassion."',
          fontSize: 'large',
        },
        isRequired: false,
      },
    ],
  },
  {
    id: 'lib-not-alone',
    title: 'You Are Not Alone',
    description: 'A gentle reminder that your struggles are shared and your worth is unconditional.',
    iconType: 'emoji',
    iconValue: '🤝',
    backgroundType: 'color',
    backgroundValue: '#F8E8F0',
    categoryId: 'self-compassion-reminders',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          body: 'You are not broken. You are not too much. You are not alone.\n\nWhatever you are going through right now is temporary. You have survived hard days before, and you will again.\n\nYou deserve the same kindness you give to others.',
          fontSize: 'large',
        },
        isRequired: false,
      },
    ],
  },

  // ─── Lightweight Connection (1) ───────────────────────────────────────────
  {
    id: 'lib-reach-out',
    title: 'Reach Out',
    description: 'Take one small step toward connection today — a message, a call, or a plan.',
    iconType: 'emoji',
    iconValue: '📱',
    backgroundType: 'color',
    backgroundValue: '#FFF8E1',
    categoryId: 'lightweight-connection',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'choice_buttons',
        position: 0,
        config: {
          label: 'Pick one action',
          options: [
            { text: 'Send a message', icon: '💬' },
            { text: 'Call someone', icon: '📞' },
            { text: 'Plan time together', icon: '📅' },
          ],
        },
        isRequired: true,
      },
      {
        type: 'checkbox',
        position: 1,
        config: {
          label: 'Did it',
        },
        isRequired: false,
      },
    ],
  },
];
