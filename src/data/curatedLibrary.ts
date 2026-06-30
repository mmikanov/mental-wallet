/**
 * Curated Library — Static seed data for the 18–21 hand-selected
 * mental health tools available in the Library Browser.
 *
 * These definitions are NOT persisted in the database until a user
 * explicitly adds them to their wallet via "Add to wallet".
 *
 * Validates: Requirements 8.1, 8.5, 1.4
 */

import type { ControlType, ControlConfig, EmotionType, ContextType, TimeType } from '@/types/index';

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
  emotionTags?: EmotionType[];
  contextTags?: ContextType[];
  timeTags?: TimeType[];
}

/**
 * 20 curated cards across the 6 categories.
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
    emotionTags: ['stressed', 'overwhelmed', 'anxious'],
    contextTags: ['at_work'],
    timeTags: ['5_10_min'],
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
    emotionTags: ['stressed', 'anxious'],
    contextTags: ['at_work'],
    timeTags: ['1_2_min'],
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
    emotionTags: ['stressed', 'anxious', 'angry'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
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
    emotionTags: ['anxious', 'sad', 'angry'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
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
    emotionTags: ['anxious', 'overwhelmed'],
    contextTags: ['at_work'],
    timeTags: ['5_10_min'],
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
    emotionTags: ['stressed', 'overwhelmed', 'numb'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
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
    emotionTags: ['sad', 'numb'],
    contextTags: ['alone_at_home'],
    timeTags: ['1_2_min'],
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
    emotionTags: ['sad', 'numb'],
    contextTags: ['alone_at_home'],
    timeTags: ['1_2_min'],
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
    emotionTags: ['sad', 'overwhelmed', 'angry'],
    contextTags: ['at_work', 'with_family'],
    timeTags: ['1_2_min'],
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
    emotionTags: ['sad', 'numb', 'overwhelmed'],
    contextTags: ['with_family', 'with_friends'],
    timeTags: ['1_2_min'],
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
    emotionTags: ['sad', 'numb'],
    contextTags: ['with_family', 'with_friends'],
    timeTags: ['5_10_min'],
  },

  // ─── Additional Body & Sensory (2) ────────────────────────────────────────
  {
    id: 'lib-mindful-walking',
    title: 'Mindful Walking',
    description: 'Turn a short walk into a grounding practice by focusing on each step and breath.',
    iconType: 'emoji',
    iconValue: '🚶',
    backgroundType: 'color',
    backgroundValue: '#E8F5E9',
    categoryId: 'body-sensory',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'Walking Meditation',
          body: '1. Walk slowly and deliberately\n2. Feel each foot pressing the ground\n3. Breathe in for 4 steps, out for 4 steps\n4. Notice the air on your skin\n5. If your mind wanders, return to your feet',
          fontSize: 'medium',
        },
        isRequired: false,
      },
      {
        type: 'checkbox',
        position: 1,
        config: {
          label: 'Completed mindful walk',
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'anxious', 'overwhelmed'],
    contextTags: ['alone_at_home', 'at_work'],
    timeTags: ['5_10_min'],
  },
  {
    id: 'lib-cold-water-reset',
    title: 'Cold Water Reset',
    description: 'Use the dive reflex to quickly calm your nervous system with cold water.',
    iconType: 'emoji',
    iconValue: '🧊',
    backgroundType: 'color',
    backgroundValue: '#E3F2FD',
    categoryId: 'body-sensory',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'How To',
          body: '1. Fill a bowl with cold water (or use a cold pack)\n2. Hold your breath and submerge your face for 15–30 seconds\n3. Alternatively, press a cold pack to your cheeks and forehead\n4. Notice your heart rate slowing down',
          fontSize: 'medium',
        },
        isRequired: false,
      },
      {
        type: 'checkbox',
        position: 1,
        config: {
          label: 'Completed the reset',
        },
        isRequired: false,
      },
    ],
    emotionTags: ['anxious', 'angry', 'overwhelmed'],
    contextTags: ['alone_at_home'],
    timeTags: ['1_2_min'],
  },
  {
    id: 'lib-sensory-grounding',
    title: 'Sensory Comfort Kit',
    description: 'Engage your senses intentionally with textures, scents, or sounds that soothe.',
    iconType: 'emoji',
    iconValue: '🕯️',
    backgroundType: 'color',
    backgroundValue: '#FFF3E0',
    categoryId: 'body-sensory',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'choice_buttons',
        position: 0,
        config: {
          label: 'Which sense to engage?',
          options: [
            { text: 'Touch (soft blanket, fidget)', icon: '🧸' },
            { text: 'Smell (candle, essential oil)', icon: '🌸' },
            { text: 'Sound (music, nature)', icon: '🎵' },
            { text: 'Taste (tea, mint)', icon: '☕' },
          ],
        },
        isRequired: true,
      },
      {
        type: 'text_input',
        position: 1,
        config: {
          label: 'What did you choose?',
          placeholder: 'e.g. lavender candle, rain sounds...',
          maxLength: 150,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'numb', 'overwhelmed'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
  },

  // ─── Additional Cognitive Reframing (1) ───────────────────────────────────
  {
    id: 'lib-evidence-for-against',
    title: 'Evidence For & Against',
    description: 'Challenge a negative belief by listing the evidence on both sides.',
    iconType: 'emoji',
    iconValue: '📋',
    backgroundType: 'color',
    backgroundValue: '#E8EAF6',
    categoryId: 'cognitive-reframing',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'text_input',
        position: 0,
        config: {
          label: 'The belief',
          placeholder: 'e.g. "I always fail at this"',
          maxLength: 200,
        },
        isRequired: true,
      },
      {
        type: 'text_area',
        position: 1,
        config: {
          label: 'Evidence FOR this belief',
          placeholder: 'What supports this thought?',
        },
        isRequired: true,
      },
      {
        type: 'text_area',
        position: 2,
        config: {
          label: 'Evidence AGAINST this belief',
          placeholder: 'What contradicts this thought?',
        },
        isRequired: true,
      },
    ],
    emotionTags: ['anxious', 'sad'],
    contextTags: ['alone_at_home', 'at_work'],
    timeTags: ['5_10_min'],
  },

  // ─── Additional Daily Check-In & Journaling (1) ──────────────────────────
  {
    id: 'lib-gratitude-three',
    title: 'Three Good Things',
    description: 'Write down three things you are grateful for today, big or small.',
    iconType: 'emoji',
    iconValue: '🙏',
    backgroundType: 'color',
    backgroundValue: '#F1F8E9',
    categoryId: 'daily-checkin-journaling',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'text_input',
        position: 0,
        config: {
          label: '1. First good thing',
          placeholder: 'Something that went well...',
          maxLength: 200,
        },
        isRequired: true,
      },
      {
        type: 'text_input',
        position: 1,
        config: {
          label: '2. Second good thing',
          placeholder: 'Something you appreciated...',
          maxLength: 200,
        },
        isRequired: true,
      },
      {
        type: 'text_input',
        position: 2,
        config: {
          label: '3. Third good thing',
          placeholder: 'Something that made you smile...',
          maxLength: 200,
        },
        isRequired: true,
      },
    ],
    emotionTags: ['sad', 'numb'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
  },

  // ─── Additional Self-Compassion & Reminders (2) ──────────────────────────
  {
    id: 'lib-kind-inner-voice',
    title: 'Kind Inner Voice',
    description: "Rewrite your inner critic's words as if speaking to a close friend.",
    iconType: 'emoji',
    iconValue: '💌',
    backgroundType: 'color',
    backgroundValue: '#F3E5F5',
    categoryId: 'self-compassion-reminders',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'text_area',
        position: 0,
        config: {
          label: 'What is your inner critic saying?',
          placeholder: 'The harsh thought...',
        },
        isRequired: true,
      },
      {
        type: 'text_area',
        position: 1,
        config: {
          label: 'Rewrite it with compassion',
          placeholder: 'What would you say to a friend in this situation?',
        },
        isRequired: true,
      },
    ],
    emotionTags: ['sad', 'overwhelmed', 'angry'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
  },
  {
    id: 'lib-permission-slip',
    title: 'Permission Slip',
    description: 'Give yourself explicit permission to rest, feel, or set a boundary.',
    iconType: 'emoji',
    iconValue: '🎫',
    backgroundType: 'color',
    backgroundValue: '#E0F7FA',
    categoryId: 'self-compassion-reminders',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'Your Permission',
          body: 'Today, I give myself permission to...',
          fontSize: 'large',
        },
        isRequired: false,
      },
      {
        type: 'text_input',
        position: 1,
        config: {
          label: 'I give myself permission to...',
          placeholder: 'e.g. rest without guilt, say no, feel my feelings',
          maxLength: 200,
        },
        isRequired: true,
      },
      {
        type: 'checkbox',
        position: 2,
        config: {
          label: 'I accept this permission',
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'overwhelmed'],
    contextTags: ['at_work', 'alone_at_home'],
    timeTags: ['1_2_min'],
  },

  // ─── Additional Lightweight Connection (2) ────────────────────────────────
  {
    id: 'lib-gratitude-message',
    title: 'Gratitude Message',
    description: 'Strengthen a relationship by sending a short thank-you to someone who matters.',
    iconType: 'emoji',
    iconValue: '✉️',
    backgroundType: 'color',
    backgroundValue: '#E8F5E9',
    categoryId: 'lightweight-connection',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'text_input',
        position: 0,
        config: {
          label: 'Who will you thank?',
          placeholder: 'Name or relationship...',
          maxLength: 100,
        },
        isRequired: true,
      },
      {
        type: 'text_area',
        position: 1,
        config: {
          label: 'Your message',
          placeholder: 'What do you want to thank them for?',
        },
        isRequired: true,
      },
      {
        type: 'checkbox',
        position: 2,
        config: {
          label: 'Sent it',
        },
        isRequired: false,
      },
    ],
    emotionTags: ['sad', 'numb'],
    contextTags: ['alone_at_home', 'with_friends'],
    timeTags: ['5_10_min'],
  },
  {
    id: 'lib-active-listening',
    title: 'Active Listening Practice',
    description: 'Deepen your next conversation with intentional listening techniques.',
    iconType: 'emoji',
    iconValue: '👂',
    backgroundType: 'color',
    backgroundValue: '#FCE4EC',
    categoryId: 'lightweight-connection',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'Active Listening Tips',
          body: '• Put your phone away\n• Make eye contact\n• Reflect back what they said\n• Ask open-ended questions\n• Resist the urge to fix or advise',
          fontSize: 'medium',
        },
        isRequired: false,
      },
      {
        type: 'text_input',
        position: 1,
        config: {
          label: 'Who did you listen to?',
          placeholder: 'Name or relationship...',
          maxLength: 100,
        },
        isRequired: false,
      },
      {
        type: 'checkbox',
        position: 2,
        config: {
          label: 'Practiced active listening today',
        },
        isRequired: false,
      },
    ],
    emotionTags: ['numb', 'sad'],
    contextTags: ['with_family', 'with_friends'],
    timeTags: ['5_10_min'],
  },
];
