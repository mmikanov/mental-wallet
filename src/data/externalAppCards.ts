/**
 * External App Cards — Static definitions for third-party wellness apps
 * that users can discover in the library, add to their wallet, and launch
 * via deep links.
 *
 * Brand colors and app store IDs are sourced from official app listings.
 * Rationale text is sourced from each app's own published materials (see Task 8.1).
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import type { CuratedCardDefinition } from './curatedLibrary';

/**
 * 7 external app cards for v1 launch.
 */
export const EXTERNAL_APP_CARDS: CuratedCardDefinition[] = [
  // ─── Headspace ─────────────────────────────────────────────────────────────
  {
    id: 'app-headspace',
    title: 'Headspace',
    description: 'Guided meditation, sleep, and focus exercises for everyday mindfulness.',
    iconType: 'third_party',
    iconValue: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/5f/07/3b/5f073b8e-573b-19dd-4a7b-ff9ecb58e2d0/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.jpg',
    backgroundType: 'color',
    backgroundValue: '#FFF0E6',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false,
    controls: [
      {
        type: 'link_button',
        position: 0,
        config: {
          label: 'Open in Headspace',
          targetUrl: 'headspace://home',
          fallbackUrl: 'https://www.headspace.com',
          isAffiliate: true,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'anxious', 'overwhelmed'],
    contextTags: ['alone_at_home', 'at_work'],
    timeTags: ['5_10_min'],
    externalApp: {
      appName: 'Headspace',
      deepLinkUrl: 'headspace://home',
      webUrl: 'https://www.headspace.com',
      hasAffiliateLink: false, // Flip to true once affiliate link is set as fallback URL
      appStoreId: '493145008',
      playStoreId: 'com.getsomeheadspace.android',
      affiliateNetwork: 'Acceleration Partners',
      monogram: 'H',
    },
    // Rationale sourced from headspace.com/science (accessed Aug 2026)
    rationale: {
      approach: 'mindfulness-based stress reduction',
      inANutshell: 'Headspace offers guided meditations designed to help reduce stress, improve focus, and support better sleep.',
      howItWorks: 'The app provides structured meditation courses and single sessions guided by experienced teachers. Sessions use mindfulness-based techniques including breath awareness, body scans, and visualization.',
      evidenceLevel: 'strong',
      researchSummary: [
        'Headspace has published multiple peer-reviewed studies showing improvements in stress, focus, and compassion.',
        'Research conducted with Northeastern University found 3 weeks of Headspace increased compassion by 23% and reduced aggression by 57%.',
        'If stress or anxiety persists, a licensed therapist can provide personalized support alongside meditation practice.',
      ],
      learnMoreLinks: [
        { title: 'Headspace Research & Science', url: 'https://www.headspace.com/science' },
        { title: 'Headspace Meditation Research', url: 'https://www.headspace.com/science/meditation-research' },
      ],
    },
  },

  // ─── Calm ──────────────────────────────────────────────────────────────────
  {
    id: 'app-calm',
    title: 'Calm',
    description: 'Meditation, sleep stories, and breathing exercises for better sleep and less stress.',
    iconType: 'third_party',
    iconValue: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/9c/83/7c/9c837c3b-d062-55a7-d864-8109a91d4a72/AppIcon-0-0-1x_U007emarketing-0-11-0-85-220.png/512x512bb.jpg',
    backgroundType: 'color',
    backgroundValue: '#E8F0FA',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false,
    controls: [
      {
        type: 'link_button',
        position: 0,
        config: {
          label: 'Open in Calm',
          targetUrl: 'calm://open',
          fallbackUrl: 'https://www.calm.com',
          isAffiliate: false,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'anxious', 'sad'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
    externalApp: {
      appName: 'Calm',
      deepLinkUrl: 'calm://open',
      webUrl: 'https://www.calm.com',
      // No affiliate program available
      appStoreId: '571800810',
      playStoreId: 'com.calm.android',
      monogram: 'C',
    },
    // Rationale sourced from calm.com and calm.com/research (accessed Aug 2026)
    rationale: {
      approach: 'mindfulness-based stress reduction',
      inANutshell: 'Calm helps users manage stress, sleep better, and build mindfulness habits through guided sessions and soothing audio content.',
      howItWorks: 'The app provides guided meditations, Sleep Stories narrated by well-known voices, breathing exercises, and calming music. Content is designed to fit into daily routines from 3 to 25 minutes.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Calm has published research showing improvements in stress, sleep quality, and self-compassion among regular users.',
        'A randomized controlled trial found Calm reduced stress and improved mindfulness in college students.',
        'For persistent anxiety or sleep difficulties, consider consulting a therapist alongside using mindfulness tools.',
      ],
      learnMoreLinks: [
        { title: 'Calm Science & Clinical Studies', url: 'https://www.calm.com/blog/clinical-studies' },
      ],
    },
  },

  // ─── Talkspace ─────────────────────────────────────────────────────────────
  {
    id: 'app-talkspace',
    title: 'Talkspace',
    description: 'Online therapy with licensed therapists via text, audio, and video messaging.',
    iconType: 'third_party',
    iconValue: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/52/58/45/52584563-38cb-1312-37af-000b295afea6/AppIcon-Production-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg',
    backgroundType: 'color',
    backgroundValue: '#E8F4FF',
    categoryId: 'lightweight-connection',
    allowBackgroundCustomization: false,
    controls: [
      {
        type: 'link_button',
        position: 0,
        config: {
          label: 'Open Talkspace',
          targetUrl: 'talkspace://home',
          fallbackUrl: 'https://www.talkspace.com',
          isAffiliate: false,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['sad', 'anxious', 'overwhelmed', 'lonely'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
    externalApp: {
      appName: 'Talkspace',
      deepLinkUrl: 'talkspace://home',
      webUrl: 'https://www.talkspace.com',
      hasAffiliateLink: false, // Flip to true once affiliate link is set as fallback URL
      appStoreId: '661829386',
      playStoreId: 'com.talkspace.talkspaceapp',
      affiliateNetwork: 'FlexOffers',
      monogram: 'T',
    },
    // Rationale sourced from talkspace.com/research (accessed Aug 2026)
    rationale: {
      approach: 'CBT',
      inANutshell: 'Talkspace connects you with a licensed therapist you can message anytime, making professional mental health support more accessible.',
      howItWorks: 'After a brief assessment, you are matched with a licensed therapist. You communicate through text, audio, or video messages in a private room. Your therapist responds daily during business days.',
      evidenceLevel: 'strong',
      researchSummary: [
        'Peer-reviewed research on Talkspace has shown significant reductions in depression and anxiety symptoms.',
        'Studies indicate online text-based therapy can be as effective as in-person therapy for many conditions.',
        'Talkspace connects you directly with a licensed therapist for ongoing professional mental health support.',
      ],
      learnMoreLinks: [
        { title: 'Talkspace Research & Outcomes', url: 'https://www.talkspace.com/research' },
      ],
    },
  },

  // ─── BetterHelp ────────────────────────────────────────────────────────────
  {
    id: 'app-betterhelp',
    title: 'BetterHelp',
    description: 'Affordable online therapy and counseling with licensed professionals.',
    iconType: 'third_party',
    iconValue: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/97/79/c9/9779c996-26e5-a6f0-3bf3-9a6ddf9dc87f/BetterHelp-AppIcon-0-0-1x_U007emarketing-0-10-0-85-220.png/512x512bb.jpg',
    backgroundType: 'color',
    backgroundValue: '#E6F4EA',
    categoryId: 'lightweight-connection',
    allowBackgroundCustomization: false,
    controls: [
      {
        type: 'link_button',
        position: 0,
        config: {
          label: 'Open BetterHelp',
          targetUrl: 'betterhelp://home',
          fallbackUrl: 'https://www.betterhelp.com',
          isAffiliate: false,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['sad', 'anxious', 'overwhelmed', 'lonely', 'hopeless'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
    externalApp: {
      appName: 'BetterHelp',
      deepLinkUrl: 'betterhelp://home',
      webUrl: 'https://www.betterhelp.com',
      hasAffiliateLink: false, // Flip to true once affiliate link is set as fallback URL
      appStoreId: '995252384',
      playStoreId: 'com.betterhelp',
      affiliateNetwork: 'Impact',
      monogram: 'B',
    },
    // Rationale sourced from betterhelp.com/research (accessed Aug 2026)
    rationale: {
      approach: 'CBT',
      inANutshell: 'BetterHelp provides convenient access to licensed therapists via messaging, phone, and video, making professional support available from anywhere.',
      howItWorks: 'Complete a questionnaire to get matched with a therapist suited to your needs. Communicate through unlimited messaging, live chat, phone calls, or video sessions — all from your device.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Research published in peer-reviewed journals has found BetterHelp users experience significant improvements in depression and anxiety.',
        'Online therapy platforms like BetterHelp have been shown to improve access to care for underserved populations.',
        'BetterHelp connects you with a licensed therapist who can provide personalized professional guidance.',
      ],
      learnMoreLinks: [
        { title: 'Is Therapy on BetterHelp Effective?', url: 'https://www.betterhelp.com/advice/therapy/is-therapy-on-betterhelp-effective/' },
      ],
    },
  },

  // ─── Wysa ──────────────────────────────────────────────────────────────────
  {
    id: 'app-wysa',
    title: 'Wysa',
    description: 'AI-powered mental health chatbot using CBT and DBT techniques for mood support.',
    iconType: 'third_party',
    iconValue: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/41/7b/c6/417bc6e6-da9d-08d4-007a-3fecbde1e6a2/AppIcon-0-0-1x_U007emarketing-0-6-0-85-220.png/512x512bb.jpg',
    backgroundType: 'color',
    backgroundValue: '#E0F7FA',
    categoryId: 'cognitive-reframing',
    allowBackgroundCustomization: false,
    controls: [
      {
        type: 'link_button',
        position: 0,
        config: {
          label: 'Open Wysa',
          targetUrl: 'wysa://open',
          fallbackUrl: 'https://www.wysa.com',
          isAffiliate: false,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'anxious', 'sad', 'angry', 'lonely'],
    contextTags: ['alone_at_home', 'at_work'],
    timeTags: ['5_10_min'],
    externalApp: {
      appName: 'Wysa',
      deepLinkUrl: 'wysa://open',
      webUrl: 'https://www.wysa.com',
      hasAffiliateLink: false, // Flip to true once affiliate link is set as fallback URL
      appStoreId: '1166585565',
      playStoreId: 'bot.touchkin',
      affiliateNetwork: 'Impact',
      monogram: 'W',
    },
    // Rationale sourced from wysa.com/clinical-evidence (accessed Aug 2026)
    rationale: {
      approach: 'CBT',
      inANutshell: 'Wysa is an AI chatbot that uses evidence-based CBT and DBT techniques to help you manage stress, anxiety, and low mood through guided conversations.',
      howItWorks: 'Chat with Wysa anytime to work through difficult emotions. The AI guides you through therapeutic exercises including thought reframing, mindfulness, and breathing techniques. Human coaching is available as an upgrade.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Wysa has more than 36 peer-reviewed publications demonstrating efficacy across multiple clinical concerns.',
        'Research in partnership with Cambridge and Harvard universities has shown improvements in depression and anxiety symptoms.',
        'For moderate to severe symptoms, a licensed clinician can provide additional support alongside AI-based tools.',
      ],
      learnMoreLinks: [
        { title: 'Wysa Clinical Evidence', url: 'https://www.wysa.com/clinical-evidence' },
      ],
    },
  },

  // ─── Mindfulness.com ───────────────────────────────────────────────────────
  {
    id: 'app-mindfulness-com',
    title: 'Mindfulness.com',
    description: 'Meditation and mindfulness library with courses from world-renowned teachers.',
    iconType: 'third_party',
    iconValue: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/5d/f9/85/5df985bd-1854-9902-e153-222f7674a9fa/AppIcon-MCOM-0-0-1x_U007epad-0-9-0-85-220.png/512x512bb.jpg',
    backgroundType: 'color',
    backgroundValue: '#F0EBFF',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false,
    controls: [
      {
        type: 'link_button',
        position: 0,
        config: {
          label: 'Open Mindfulness.com',
          targetUrl: 'https://www.mindfulness.com',
          fallbackUrl: 'https://www.mindfulness.com',
          isAffiliate: false,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'anxious', 'numb'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min'],
    externalApp: {
      appName: 'Mindfulness.com',
      // No known custom URI scheme — web URL only
      webUrl: 'https://www.mindfulness.com',
      hasAffiliateLink: false, // Flip to true once affiliate link is set as fallback URL
      appStoreId: '1466046486',
      playStoreId: 'com.mindfulness.android',
      affiliateNetwork: 'Direct',
      monogram: 'M',
    },
    // Rationale sourced from mindfulness.com/about (accessed Aug 2026)
    rationale: {
      approach: 'mindfulness-based stress reduction',
      inANutshell: 'Mindfulness.com offers thousands of guided meditations and courses from experienced mindfulness teachers to build a daily practice.',
      howItWorks: 'Browse a library of guided meditations, talks, and courses organized by topic and duration. Track your progress and build streaks. A portion of subscription revenue is donated to bring mindfulness to underserved communities.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Mindfulness meditation has strong research support for reducing stress, anxiety, and improving emotional regulation.',
        'Regular mindfulness practice is associated with structural changes in brain regions related to attention and emotional processing.',
        'If stress or anxiety significantly impacts daily functioning, a mental health professional can help complement mindfulness practice.',
      ],
      learnMoreLinks: [
        { title: 'Mindfulness.com About', url: 'https://www.mindfulness.com/about' },
      ],
    },
  },

  // ─── Insight Timer ─────────────────────────────────────────────────────────
  {
    id: 'app-insight-timer',
    title: 'Insight Timer',
    description: 'Free meditation timer and the world\'s largest library of guided meditations.',
    iconType: 'third_party',
    iconValue: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/09/ba/c9/09bac984-2a75-51eb-0296-9a84c02552d1/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.jpg',
    backgroundType: 'color',
    backgroundValue: '#FFF4E0',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false,
    controls: [
      {
        type: 'link_button',
        position: 0,
        config: {
          label: 'Open Insight Timer',
          targetUrl: 'insight-timer://open',
          fallbackUrl: 'https://insighttimer.com',
          isAffiliate: false,
        },
        isRequired: false,
      },
    ],
    emotionTags: ['stressed', 'anxious', 'numb', 'overwhelmed'],
    contextTags: ['alone_at_home'],
    timeTags: ['5_10_min', '1_2_min'],
    externalApp: {
      appName: 'Insight Timer',
      deepLinkUrl: 'insight-timer://open',
      webUrl: 'https://insighttimer.com',
      // No affiliate program available
      appStoreId: '337472899',
      playStoreId: 'com.spotlightsix.zentimerlite2',
      monogram: 'IT',
    },
    // Rationale sourced from insighttimer.com/about (accessed Aug 2026)
    rationale: {
      approach: 'mindfulness-based stress reduction',
      inANutshell: 'Insight Timer provides free access to the world\'s largest library of guided meditations, music, and talks from thousands of teachers.',
      howItWorks: 'Choose from over 200,000 free guided meditations or use the customizable timer for silent meditation. Join live events, track your practice, and connect with a global community of meditators.',
      evidenceLevel: 'moderate',
      researchSummary: [
        'Insight Timer is used by millions worldwide and recommended by therapists as a complement to treatment.',
        'Research supports meditation apps as effective tools for building consistent mindfulness habits.',
      ],
      learnMoreLinks: [
        { title: 'Insight Timer About', url: 'https://insighttimer.com/about' },
      ],
    },
  },
];
