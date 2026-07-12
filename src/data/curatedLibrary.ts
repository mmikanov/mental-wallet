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
import type { RationaleMetadata } from '@/types/rationale';

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
  iconType: 'emoji' | 'third_party';
  iconValue: string;
  backgroundType: 'color' | 'image';
  backgroundValue: string;
  categoryId: string;
  allowBackgroundCustomization: boolean;
  controls: CuratedControlDefinition[];
  emotionTags?: EmotionType[];
  contextTags?: ContextType[];
  timeTags?: TimeType[];
  rationale?: RationaleMetadata;
}

/**
 * 20 curated cards across the 6 categories.
 */
export const CURATED_LIBRARY: CuratedCardDefinition[] = [
  // ─── Grounding & Calming (3) ───────────────────────────────────────────────
{
  id: "lib-grounding-54321",
  title: "5-4-3-2-1 Grounding",
  description: "Use your senses to anchor yourself in the present moment when anxiety rises.",
  iconType: "emoji",
  iconValue: "🌿",
  backgroundType: "color",
  backgroundValue: "#E8F4F8",
  categoryId: "grounding-calming",
  allowBackgroundCustomization: true,
  controls: [
    {
      type: "static_text",
      position: 0,
      config: {
        title: "Instructions",
        body: "5 things you can SEE\n4 things you can TOUCH\n3 things you can HEAR\n2 things you can SMELL\n1 thing you can TASTE",
        fontSize: "medium",
      },
      isRequired: false,
    },
    {
      type: "text_input",
      position: 1,
      config: {
        label: "Reflection",
        placeholder: "How do you feel now?",
        maxLength: 200,
      },
      isRequired: false,
    },
  ],
  emotionTags: ["stressed", "overwhelmed", "anxious"],
  contextTags: ["at_work"],
  timeTags: ["5_10_min"],
  rationale: {
    approach: "somatic techniques",
    inANutshell: "Redirects attention from anxious thoughts to present-moment sensory input, which may help interrupt the stress response.",
    howItWorks: "Grounding exercises engage the prefrontal cortex by asking it to categorize sensory data. This shift in attention may reduce amygdala activation associated with anxiety. The 5-4-3-2-1 structure provides a simple framework that works even when concentration is low.",
    evidenceLevel: "moderate",
    researchSummary: [
      "Grounding techniques are widely used in trauma-informed care and anxiety management protocols.",
      "Research suggests sensory-based interventions may reduce acute distress by redirecting cognitive resources.",
      "If symptoms persist or worsen, consider speaking with a therapist or mental health professional.",
    ],
    learnMoreLinks: [
      { title: "5-4-3-2-1 Coping Technique for Anxiety – University of Rochester Medical Center", url: "https://www.urmc.rochester.edu/behavioral-health-partners/bhp-blog/april-2018/5-4-3-2-1-coping-technique-for-anxiety" },
      { title: "Feeling Anxious? Try the 5-4-3-2-1 Grounding Technique – Verywell Mind", url: "https://www.verywellmind.com/5-4-3-2-1-grounding-technique-8639390" },
      { title: "Coping Skill Spotlight: 5 4 3 2 1 Grounding Technique – Coping Skills for Kids", url: "https://copingskillsforkids.com/blog/2016/4/27/coping-skill-spotlight-5-4-3-2-1-grounding-technique" },
    ],
  },
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
    rationale: {
      approach: 'somatic techniques',
      inANutshell: 'A structured breathing pattern that may help activate the parasympathetic nervous system, promoting a sense of calm during stressful moments.',
      howItWorks: 'Slow, rhythmic breathing with equal intervals stimulates the vagus nerve, which research suggests can shift the body from a fight-or-flight state toward rest-and-digest. The counting structure provides a mental anchor that may reduce racing thoughts.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Controlled breathing practices are associated with reduced physiological markers of stress in multiple studies.',
        'Research suggests paced breathing may lower cortisol levels and heart rate in acutely stressed individuals.',
        'If anxiety or stress becomes overwhelming, a mental health professional can offer personalized support.',
      ],
      learnMoreLinks: [
        {
          title: 'Box breathing: How to do it, benefits, and tips – Medical News Today',
          url: 'https://www.medicalnewstoday.com/articles/321805',
        },
        {
          title: 'Box breathing relaxation technique – Sunnybrook Hospital',
          url: 'https://www.youtube.com/watch?v=tEmt1Znux58',
        },
      ],
    },
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
    rationale: {
      approach: 'somatic techniques',
      inANutshell: 'Systematically tensing and releasing muscles may help reduce physical tension and promote awareness of where stress is held in the body.',
      howItWorks: 'Progressive Muscle Relaxation guides you through deliberately tensing each muscle group for a few seconds, then releasing. This contrast may help the nervous system recognize and let go of chronic tension. Many people find the technique useful for calming both body and mind.',
      evidenceLevel: 'strong',
      researchSummary: [
        'PMR is one of the most studied relaxation techniques, with research suggesting benefits for anxiety and stress reduction.',
        'Clinical guidelines include PMR as a recommended intervention for generalized anxiety and insomnia.',
        'If physical tension or anxiety significantly impacts your daily life, consider consulting a clinician.',
      ],
      learnMoreLinks: [
        {
          title: 'Progressive muscle relaxation – NHS Inform',
          url: 'https://www.nhsinform.scot/healthy-living/mental-wellbeing/breathing-and-relaxation-exercises/progressive-muscle-relaxation/',
        },
        {
          title: 'Grounding Techniques – University of Prince Edward Island',
          url: 'https://files.upei.ca/vpaf/svpro/grounding_techniques_peirsac.pdf',
        },
        {
          title: 'Grounding techniques for anxiety: 10 evidence-based strategies – Therapist.com',
          url: 'https://www.therapist.com/disorders/anxiety/grounding-techniques-for-anxiety/',
        },
      ],
    },
  },

  {
    id: 'lib-name-it-tame-it',
    title: 'Name It to Tame It',
    description: 'Label your emotions to reduce their intensity — naming a feeling activates the rational brain and calms the emotional brain.',
    iconType: 'emoji',
    iconValue: '🏷️',
    backgroundType: 'color',
    backgroundValue: '#E0F2F1',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'How It Works',
          body: '1. Pause and notice what you are feeling\n2. Give the feeling a specific name (e.g., "frustration," "dread," "loneliness")\n3. Say to yourself: "I notice I am feeling ___"\n4. Observe if the intensity shifts once you label it',
          fontSize: 'medium',
        },
        isRequired: false,
      },
      {
        type: 'text_input',
        position: 1,
        config: {
          label: 'What emotion are you feeling right now?',
          placeholder: 'Name the feeling...',
          maxLength: 200,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'overwhelmed', 'anxious', 'angry'],
    contextTags: ['at_work', 'alone_at_home'],
    timeTags: ['1_2_min'],
    rationale: {
      approach: 'psychoeducation',
      inANutshell: 'Labeling emotions by name may help reduce their intensity — putting feelings into words can activate the rational brain and calm the emotional response.',
      howItWorks: 'Affect labeling engages the prefrontal cortex, which research suggests can dampen amygdala reactivity. By naming what you feel, you create a small cognitive distance from the emotion, which many people find helps them respond rather than react.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Neuroimaging studies suggest that putting feelings into words may reduce amygdala activation during emotional distress.',
        'Affect labeling is a core component of several evidence-based therapies including DBT and mindfulness practices.',
        'If emotions feel unmanageable or persistent, a therapist can help develop personalized coping strategies.',
      ],
      learnMoreLinks: [
        {
          title: 'Name It to Tame It: Label Your Emotions to Overcome ... – Mindfulness.com',
          url: 'https://mindfulness.com/mindful-living/name-it-to-tame-it',
        },
        {
          title: 'Grounding Techniques – University of Prince Edward Island',
          url: 'https://files.upei.ca/vpaf/svpro/grounding_techniques_peirsac.pdf',
        },
        {
          title: 'Grounding Techniques To Help Calm Anxiety – Cleveland Clinic',
          url: 'https://health.clevelandclinic.org/grounding-techniques',
        },
      ],
    },
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
    emotionTags: ['anxious', 'sad', 'angry', 'curious'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
    rationale: {
      approach: 'CBT',
      inANutshell: 'Mapping the thought–feeling–action cycle may help you see how automatic thoughts influence emotions and behavior, creating space to respond differently.',
      howItWorks: 'CBT proposes that thoughts, feelings, and behaviors are interconnected. By separating them on paper, you may notice patterns — such as a catastrophic thought triggering anxiety and avoidance. This awareness can be the first step toward choosing a different response.',
      evidenceLevel: 'strong',
      researchSummary: [
        'CBT-based techniques have substantial research support for reducing symptoms of anxiety and depression in clinical populations.',
        'Structured thought records are a core CBT skill that research suggests may help individuals identify and modify unhelpful thinking patterns.',
        'If distress persists or worsens, consider discussing these patterns with a therapist or mental health professional.',
      ],
      learnMoreLinks: [
        {
          title: 'Cognitive Behavioral Therapy overview — NHS',
          url: 'https://nhs.uk/mental-health/talking-therapies-medicine-treatments/talking-therapies-and-counselling/cognitive-behavioural-therapy-cbt/overview/',
        },
      ],
    },
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
    rationale: {
      approach: 'CBT',
      inANutshell: 'Decatastrophizing may help you challenge worst-case thinking by comparing feared outcomes with more realistic ones, which can reduce anxiety intensity.',
      howItWorks: 'When anxious, the mind tends to overestimate threat and underestimate coping ability. By writing out the worst case alongside the most likely outcome, you engage the rational mind to evaluate probability rather than reacting to fear alone. This technique is a standard CBT intervention for catastrophic thinking.',
      evidenceLevel: 'strong',
      researchSummary: [
        'Decatastrophizing is a well-established CBT technique that research suggests may reduce anxiety by correcting probability overestimation.',
        'Studies indicate cognitive restructuring methods like this one can help individuals develop more balanced appraisals of threatening situations.',
        'If catastrophic thoughts are frequent or interfere with daily life, a therapist can provide structured support.',
      ],
      learnMoreLinks: [
        {
          title: 'Cognitive restructuring techniques — PubMed',
          url: 'https://pubmed.ncbi.nlm.nih.gov/28527096/',
        },
      ],
    },
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
    rationale: {
      approach: 'mindfulness-based stress reduction',
      inANutshell: 'A brief body scan may help you notice and release physical tension by directing attention inward, which can interrupt the stress cycle.',
      howItWorks: 'Body scan meditation guides awareness systematically through body regions, encouraging a non-judgmental noticing of sensations. This practice may reduce stress reactivity by shifting attention from ruminative thoughts to present-moment physical experience, allowing the nervous system to settle.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Mindfulness-based body scans are a core component of MBSR, which research suggests may reduce perceived stress and improve emotional regulation.',
        'Studies indicate brief body awareness practices can help individuals recognize early signs of tension before it escalates.',
        'If stress or numbness significantly affects your daily life, a therapist or clinician can provide personalized guidance.',
      ],
      learnMoreLinks: [
        {
          title: 'Mindfulness-based stress reduction overview — PMC',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6312586/',
        },
      ],
    },
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
    emotionTags: ['sad', 'numb', 'calm', 'curious'],
    contextTags: ['alone_at_home'],
    timeTags: ['1_2_min'],
    rationale: {
      approach: 'psychoeducation',
      inANutshell: 'Regularly checking in with your mood may help build emotional awareness, making it easier to notice patterns and respond to how you feel.',
      howItWorks: 'Mood tracking encourages you to pause and name your current emotional state. Over time, this practice may strengthen interoceptive awareness — your ability to notice internal signals. Recognizing mood patterns can help you identify triggers and choose supportive responses earlier.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Self-monitoring of mood is a core component of several evidence-based therapies including CBT and behavioral activation.',
        'Research suggests that regular mood tracking may improve emotional awareness and support early detection of mood shifts.',
      ],
      learnMoreLinks: [
        {
          title: 'Self-monitoring in behavioral interventions — PMC',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5568610/',
        },
      ],
    },
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
    emotionTags: ['sad', 'numb', 'guilty', 'calm'],
    contextTags: ['alone_at_home'],
    timeTags: ['1_2_min'],
    rationale: {
      approach: 'positive psychology',
      inANutshell: 'Noticing one positive moment each day may help counteract negativity bias and build a habit of recognizing small successes.',
      howItWorks: 'Positive psychology research suggests that deliberately recalling positive events can shift attention away from rumination. Writing down a daily win — however small — may strengthen neural pathways associated with noticing the good, which over time can support a more balanced perspective.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Positive psychology interventions focused on savoring daily successes have shown moderate effects on wellbeing in multiple studies.',
        'Research suggests that intentional focus on positive events may reduce rumination and support mood improvement over time.',
      ],
      learnMoreLinks: [
        {
          title: 'Positive psychology interventions — a meta-analysis',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4760272/',
        },
      ],
    },
  },

  {
    id: 'lib-evening-gratitude',
    title: 'Evening Gratitude',
    description: 'Wind down your day by reflecting on moments of gratitude and setting a calm intention for sleep.',
    iconType: 'emoji',
    iconValue: '🌙',
    backgroundType: 'color',
    backgroundValue: '#EDE7F6',
    categoryId: 'daily-checkin-journaling',
    allowBackgroundCustomization: true,
    controls: [
      {
        type: 'static_text',
        position: 0,
        config: {
          title: 'Evening Wind-Down',
          body: 'Take a moment before sleep to reflect on your day with kindness. There is no right or wrong answer — just notice what comes up.',
          fontSize: 'medium',
        },
        isRequired: false,
      },
      {
        type: 'text_input',
        position: 1,
        config: {
          label: 'What are you grateful for today?',
          placeholder: 'Something that made today a little better...',
          maxLength: 200,
        },
        isRequired: false,
      },
      {
        type: 'text_input',
        position: 2,
        config: {
          label: 'What can you let go of tonight?',
          placeholder: 'A worry or tension to release...',
          maxLength: 200,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'sad', 'overwhelmed', 'hopeless', 'calm'],
    contextTags: ['alone_at_home'],
    timeTags: ['1_2_min'],
    rationale: {
      approach: 'positive psychology',
      inANutshell: 'Reflecting on gratitude before sleep may help calm a busy mind and shift focus from worries to moments of appreciation.',
      howItWorks: 'Gratitude practices engage the brain in recalling positive experiences, which research suggests may reduce cortisol levels and promote relaxation. Doing this before bed may help interrupt the cycle of rumination that often interferes with sleep, supporting a calmer transition to rest.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Studies suggest that gratitude journaling before sleep may improve sleep quality and reduce pre-sleep worry.',
        'Gratitude interventions are associated with moderate improvements in subjective wellbeing across multiple research reviews.',
        'If stress or sleep difficulties persist, consider speaking with a therapist or mental health professional.',
      ],
      learnMoreLinks: [
        {
          title: 'Gratitude and sleep quality research — PMC',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6296939/',
        },
      ],
    },
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
    emotionTags: ['sad', 'overwhelmed', 'angry', 'ashamed'],
    contextTags: ['at_work', 'with_family'],
    timeTags: ['1_2_min'],
    rationale: {
      approach: 'self-compassion',
      inANutshell: 'A brief practice that may help you respond to difficult moments with kindness rather than self-criticism, drawing on three core elements of self-compassion.',
      howItWorks: 'Self-compassion practices involve acknowledging suffering, recognizing shared humanity, and offering oneself kindness. Research suggests this combination may reduce rumination and self-blame by shifting from threat-based thinking to a soothing response. The three-step structure provides a simple framework accessible even during emotional distress.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Self-compassion interventions are associated with reduced anxiety, depression, and stress in multiple meta-analyses.',
        'Research suggests self-compassion practices may lower cortisol and activate brain regions linked to caregiving and soothing.',
        'If anger or emotional distress becomes overwhelming, a therapist can help develop personalized coping strategies.',
      ],
      learnMoreLinks: [
        {
          title: 'Self-compassion and mental health — PubMed',
          url: 'https://pubmed.ncbi.nlm.nih.gov/20633387/',
        },
      ],
    },
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
    emotionTags: ['sad', 'numb', 'overwhelmed', 'lonely', 'ashamed'],
    contextTags: ['with_family', 'with_friends'],
    timeTags: ['1_2_min'],
    rationale: {
      approach: 'self-compassion',
      inANutshell: 'A gentle reminder that struggles are part of the shared human experience — recognizing common humanity may help reduce feelings of isolation during hard times.',
      howItWorks: 'Self-compassion theory emphasizes that suffering is universal, not a personal failing. Reminders of shared humanity may counteract the tendency to feel uniquely broken or alone. Reading affirming words can activate the brain\'s affiliative system, which research suggests promotes emotional regulation and a sense of safety.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Self-compassion exercises emphasizing common humanity are associated with reduced feelings of isolation and shame.',
        'Research suggests brief compassionate reminders may improve mood and reduce negative self-evaluation in distressed individuals.',
      ],
      learnMoreLinks: [
        {
          title: 'Self-compassion: theory and research — ScienceDirect',
          url: 'https://sciencedirect.com/science/article/pii/S0272735812001651',
        },
      ],
    },
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
    emotionTags: ['sad', 'numb', 'lonely', 'hopeless'],
    contextTags: ['with_family', 'with_friends'],
    timeTags: ['5_10_min'],
    rationale: {
      approach: 'behavioral activation',
      inANutshell: 'Taking one small step toward social connection may help counteract withdrawal patterns common during low mood or emotional numbness.',
      howItWorks: 'Behavioral activation encourages small, manageable actions that re-engage you with meaningful activities. When feeling sad or numb, the tendency to isolate can reinforce low mood. Reaching out — even briefly — may interrupt this cycle by generating a sense of agency and social reward, which research suggests supports mood improvement over time.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Behavioral activation is associated with reduced depression symptoms by helping individuals re-engage with rewarding activities.',
        'Research suggests that even brief social interactions may improve mood and reduce feelings of isolation in people experiencing low mood.',
      ],
      learnMoreLinks: [
        {
          title: 'Behavioral activation for depression — PubMed',
          url: 'https://pubmed.ncbi.nlm.nih.gov/24313570/',
        },
      ],
    },
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
    rationale: {
      approach: 'mindfulness-based stress reduction',
      inANutshell: 'Mindful walking combines gentle movement with focused attention, which may help calm an overactive mind and reduce physical tension from stress or anxiety.',
      howItWorks: 'Walking meditation anchors attention to the rhythm of steps and breath rather than anxious thoughts. The combination of mild physical activity and present-moment focus may engage the parasympathetic nervous system. Many people find that even a short mindful walk helps shift their mental state.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Research suggests mindful walking may reduce anxiety and improve mood, particularly when practiced regularly as part of a mindfulness routine.',
        'Walking-based mindfulness interventions have shown benefits for stress reduction in multiple community studies.',
        'If anxiety or stress becomes persistent or overwhelming, consider speaking with a mental health professional for support.',
      ],
      learnMoreLinks: [
        {
          title: 'Walking meditation and anxiety reduction — PubMed',
          url: 'https://pubmed.ncbi.nlm.nih.gov/25196403/',
        },
      ],
    },
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
    rationale: {
      approach: 'somatic techniques',
      inANutshell: 'Cold water on the face may trigger the mammalian dive reflex, which can rapidly slow heart rate and help calm intense emotions like anxiety or anger.',
      howItWorks: 'Submerging the face in cold water or applying cold to the cheeks activates the dive reflex — a physiological response that slows the heart and redirects blood flow. This technique is drawn from DBT distress tolerance skills and may provide quick relief during emotional overwhelm by interrupting the fight-or-flight response.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'The dive reflex is a well-documented physiological response that research shows can lower heart rate and promote parasympathetic activation.',
        'DBT distress tolerance protocols include cold water techniques as a recommended strategy for managing acute emotional arousal.',
        'If you experience frequent intense anger or panic, a therapist trained in DBT or somatic approaches can offer structured support.',
      ],
      learnMoreLinks: [
        {
          title: 'Dive reflex and emotional regulation — PubMed',
          url: 'https://pubmed.ncbi.nlm.nih.gov/29227558/',
        },
      ],
    },
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
    rationale: {
      approach: 'grounding',
      inANutshell: 'Engaging your senses with comforting textures, scents, or sounds may help ground you in the present moment and ease stress or emotional numbness.',
      howItWorks: 'Sensory grounding redirects attention from distressing thoughts to immediate physical experience. By deliberately choosing a soothing sensory input — a soft texture, calming scent, or pleasant sound — you may activate the brain\'s safety signals, helping to down-regulate the stress response and reconnect with your body.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Grounding through sensory engagement is widely used in trauma-informed care and may help reduce dissociation and emotional distress.',
        'Research suggests deliberate sensory stimulation can shift attention away from rumination and support present-moment awareness.',
        'If numbness or stress significantly impacts your daily functioning, a mental health professional can help identify underlying causes.',
      ],
      learnMoreLinks: [
        {
          title: 'Grounding techniques for anxiety — NHS',
          url: 'https://nhs.uk/mental-health/self-help/tips-and-support/how-to-reduce-stress/',
        },
      ],
    },
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
    rationale: {
      approach: 'CBT',
      inANutshell: 'Examining evidence for and against a belief may help you develop a more balanced perspective, reducing the grip of negative automatic thoughts.',
      howItWorks: 'Negative beliefs often feel absolutely true in the moment. By deliberately searching for both supporting and contradicting evidence, you activate analytical thinking that can weaken cognitive distortions like overgeneralization. This structured approach is a core CBT technique for building more realistic self-appraisals.',
      evidenceLevel: 'strong',
      researchSummary: [
        'Evidence-based thought challenging is a foundational CBT skill with research support for reducing depressive and anxious thinking patterns.',
        'Studies suggest that structured examination of beliefs may help individuals recognize cognitive distortions and develop alternative perspectives.',
        'If negative beliefs feel overwhelming or persistent, speaking with a professional therapist can provide additional guidance.',
      ],
      learnMoreLinks: [
        {
          title: 'Cognitive therapy for depression — PMC',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8993759/',
        },
      ],
    },
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
    emotionTags: ['sad', 'numb', 'hopeless', 'curious'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
    rationale: {
      approach: 'positive psychology',
      inANutshell: 'Writing down three good things each day may help train your brain to notice positive experiences, which can gradually shift a negative or numb outlook.',
      howItWorks: 'The Three Good Things exercise asks you to recall and record positive moments from your day. Research in positive psychology suggests this practice may counteract negativity bias by repeatedly directing attention toward what went well. Over time, many people find it becomes easier to notice good moments naturally.',
      evidenceLevel: 'strong',
      researchSummary: [
        'The Three Good Things exercise is one of the most studied positive psychology interventions, with research showing sustained improvements in happiness and reductions in depressive symptoms.',
        'A landmark study found that participants who practiced this exercise daily for one week reported increased happiness lasting up to six months.',
      ],
      learnMoreLinks: [
        {
          title: 'Three Good Things intervention research — PMC',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4760272/',
        },
      ],
    },
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
    emotionTags: ['sad', 'overwhelmed', 'angry', 'ashamed', 'guilty'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
    rationale: {
      approach: 'self-compassion',
      inANutshell: 'Rewriting harsh self-talk as if speaking to a friend may help soften the inner critic and build a more supportive relationship with yourself.',
      howItWorks: 'Self-compassion research suggests that people are often far harsher with themselves than with others. By deliberately adopting the tone you would use with a close friend, you may activate the brain\'s caregiving system instead of its threat system. This practice can reduce rumination and shift attention from self-punishment toward constructive self-support.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Compassionate self-talk exercises are associated with reduced self-criticism and improved emotional resilience.',
        'Research suggests reframing inner dialogue may lower stress hormones and reduce activation of threat-based neural pathways.',
        'If persistent self-criticism or anger becomes difficult to manage alone, a mental health professional can offer guided support.',
      ],
      learnMoreLinks: [
        {
          title: 'Self-compassion and self-criticism — PubMed',
          url: 'https://pubmed.ncbi.nlm.nih.gov/23070875/',
        },
      ],
    },
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
    emotionTags: ['stressed', 'overwhelmed', 'guilty'],
    contextTags: ['at_work', 'alone_at_home'],
    timeTags: ['1_2_min'],
    rationale: {
      approach: 'ACT',
      inANutshell: 'Giving yourself explicit permission to rest or set boundaries may help reduce guilt and align your actions with your values, even when stress says otherwise.',
      howItWorks: 'Acceptance and Commitment Therapy (ACT) encourages psychological flexibility — the ability to be present with difficult feelings while choosing actions aligned with personal values. Writing a permission slip externalizes an internal conflict, which may reduce cognitive fusion with guilt-driven thoughts and create space for self-care without self-judgment.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'ACT-based interventions are associated with improved psychological flexibility and reduced experiential avoidance.',
        'Research suggests values-aligned self-permission exercises may reduce burnout and stress-related guilt.',
        'If stress or overwhelm becomes persistent, a clinician trained in ACT can help develop personalized strategies.',
      ],
      learnMoreLinks: [
        {
          title: 'ACT and psychological flexibility — PubMed',
          url: 'https://pubmed.ncbi.nlm.nih.gov/22506909/',
        },
      ],
    },
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
    emotionTags: ['sad', 'numb', 'lonely'],
    contextTags: ['alone_at_home', 'with_friends'],
    timeTags: ['5_10_min'],
    rationale: {
      approach: 'positive psychology',
      inANutshell: 'Expressing gratitude to someone specific may help shift focus from emotional numbness toward meaningful connection and positive feelings.',
      howItWorks: 'Gratitude interventions encourage actively recognizing good things others have done. Writing and sending a thank-you message engages both reflective thinking and social connection. Research suggests this combination may boost positive emotions and strengthen relationships, which can be particularly helpful when feeling emotionally flat or disconnected.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Gratitude letter writing is associated with increased positive affect and life satisfaction in multiple studies.',
        'Research suggests expressing gratitude to others may strengthen social bonds and reduce feelings of loneliness.',
      ],
      learnMoreLinks: [
        {
          title: 'Gratitude interventions and wellbeing — PMC',
          url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6296939/',
        },
      ],
    },
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
    rationale: {
      approach: 'psychoeducation',
      inANutshell: 'Learning and practicing active listening skills may help deepen social connections, which research suggests can counteract emotional numbness and low mood.',
      howItWorks: 'Psychoeducation provides practical knowledge about helpful behaviors. Active listening techniques — such as reflecting back, asking open questions, and resisting the urge to advise — shift attention outward and create space for genuine connection. Practicing these skills may help re-engage socially when feeling withdrawn or emotionally flat.',
      evidenceLevel: 'emerging',
      researchSummary: [
        'Research suggests active listening skills are associated with improved relationship satisfaction and perceived social support.',
        'Psychoeducational interventions that teach interpersonal skills may help reduce social withdrawal in individuals experiencing low mood.',
      ],
      learnMoreLinks: [
        {
          title: 'Active listening and relationship quality — PubMed',
          url: 'https://pubmed.ncbi.nlm.nih.gov/27064394/',
        },
      ],
    },
  },
];

/**
 * Declarative mapping of the 6 new emotions to recommended tool card IDs.
 * Each emotion maps to up to 3 card IDs in priority order.
 *
 * Used by the recommendation engine to surface relevant tools for new emotions.
 *
 * Validates: Requirements 4 (Tool Recommendation Table), 5.2, 5.6
 */
export const NEW_EMOTION_TOOL_RECOMMENDATIONS: Record<
  'lonely' | 'ashamed' | 'guilty' | 'hopeless' | 'calm' | 'curious',
  string[] // card IDs in priority order
> = {
  lonely: ['lib-reach-out', 'lib-gratitude-message', 'lib-not-alone'],
  ashamed: ['lib-self-compassion-pause', 'lib-kind-inner-voice', 'lib-not-alone'],
  guilty: ['lib-permission-slip', 'lib-kind-inner-voice', 'lib-win-of-day'],
  hopeless: ['lib-three-good-things', 'lib-evening-gratitude', 'lib-reach-out'],
  calm: ['lib-daily-mood', 'lib-win-of-day', 'lib-evening-gratitude'],
  curious: ['lib-thought-feeling-action', 'lib-daily-mood', 'lib-three-good-things'],
};
