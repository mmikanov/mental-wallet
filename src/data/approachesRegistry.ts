/**
 * Approaches Registry — single source of truth for approach-level evidence descriptions.
 * When updated here, all cards referencing the approach reflect
 * the change on next render/load.
 *
 * Validates: Requirements 6.1, 6.3
 */

import type { TherapeuticApproach } from '@/types/rationale';

export interface ApproachDescription {
  approach: TherapeuticApproach;
  shortDescription: string;
  fullDescription: string;
}

/**
 * Single source of truth for approach-level evidence descriptions.
 * Each entry uses conditional language and avoids banned terms.
 * Descriptions reference established research at the approach level,
 * not claiming specific efficacy for any app implementation.
 */
export const APPROACHES_REGISTRY: Record<TherapeuticApproach, ApproachDescription> = {
  'CBT': {
    approach: 'CBT',
    shortDescription:
      'Cognitive Behavioral Therapy techniques may help identify and reframe unhelpful thought patterns. Research suggests CBT-based approaches can support people experiencing anxiety and low mood.',
    fullDescription:
      'Cognitive Behavioral Therapy (CBT) is a structured, evidence-based approach that focuses on the relationship between thoughts, feelings, and behaviors. Developed by Aaron Beck in the 1960s, CBT has been extensively studied across hundreds of randomized controlled trials. Research suggests it may be effective for a range of difficulties including anxiety disorders, depression, and stress-related conditions. CBT-based self-help tools draw on these principles to help individuals recognize cognitive distortions and develop more balanced thinking patterns.',
  },
  'DBT': {
    approach: 'DBT',
    shortDescription:
      'Dialectical Behavior Therapy skills may help with emotional regulation and distress tolerance. Many people find DBT-informed techniques useful for managing intense emotions.',
    fullDescription:
      'Dialectical Behavior Therapy (DBT), developed by Marsha Linehan, integrates cognitive-behavioral techniques with mindfulness practices and acceptance strategies. Originally developed for borderline personality disorder, research suggests DBT skills training may also support emotional regulation in broader populations. The four skill modules — mindfulness, distress tolerance, emotion regulation, and interpersonal effectiveness — offer structured approaches that many people find helpful for navigating overwhelming feelings.',
  },
  'ACT': {
    approach: 'ACT',
    shortDescription:
      'Acceptance and Commitment Therapy encourages psychological flexibility by helping people observe thoughts without being controlled by them. Research suggests ACT-based exercises may reduce the impact of difficult emotions.',
    fullDescription:
      'Acceptance and Commitment Therapy (ACT) is a behavioral therapy approach that uses acceptance, mindfulness, and values-based action to increase psychological flexibility. Developed by Steven Hayes, ACT encourages individuals to notice and accept internal experiences rather than struggling against them. A growing body of research, including meta-analyses, suggests ACT-based interventions may help with anxiety, depression, chronic pain, and stress. ACT exercises focus on defusion, present-moment awareness, and committed action aligned with personal values.',
  },
  'mindfulness-based stress reduction': {
    approach: 'mindfulness-based stress reduction',
    shortDescription:
      'Mindfulness-Based Stress Reduction (MBSR) practices may help cultivate present-moment awareness. Research suggests regular mindfulness practice can support stress management and emotional wellbeing.',
    fullDescription:
      'Mindfulness-Based Stress Reduction (MBSR), developed by Jon Kabat-Zinn at the University of Massachusetts Medical Center, is a structured program combining mindfulness meditation, body awareness, and gentle movement. Numerous studies suggest that mindfulness-based practices may reduce perceived stress, improve attention regulation, and support emotional balance. MBSR-informed exercises encourage non-judgmental observation of thoughts and sensations, which many participants report helps them respond to stressors with greater calm.',
  },
  'positive psychology': {
    approach: 'positive psychology',
    shortDescription:
      'Positive psychology interventions focus on building strengths, gratitude, and positive experiences. Research suggests these practices may support overall wellbeing and life satisfaction.',
    fullDescription:
      'Positive psychology, pioneered by Martin Seligman and Mihaly Csikszentmihalyi, studies what enables individuals and communities to thrive. Rather than focusing solely on reducing distress, positive psychology interventions aim to build strengths, cultivate gratitude, and foster positive emotions. Research, including randomized controlled trials, suggests that exercises like gratitude journaling and strengths identification may contribute to increased wellbeing and life satisfaction. These approaches complement traditional therapeutic methods by expanding the focus to include flourishing.',
  },
  'somatic techniques': {
    approach: 'somatic techniques',
    shortDescription:
      'Somatic techniques use body-based practices to help regulate the nervous system. Research suggests body-oriented approaches may support stress relief and emotional regulation.',
    fullDescription:
      'Somatic techniques encompass body-based therapeutic practices that address the connection between physical sensations and emotional states. Drawing on research in neuroscience and body psychotherapy, these approaches suggest that physical interventions — such as progressive muscle relaxation, breathwork, and body scanning — may help regulate the autonomic nervous system. Studies indicate that body-oriented practices can reduce physiological markers of stress and may support individuals in managing tension, anxiety, and trauma-related responses.',
  },
  'grounding': {
    approach: 'grounding',
    shortDescription:
      'Grounding techniques redirect attention to present-moment sensory input, which may help interrupt anxious thought patterns. These approaches are widely used in trauma-informed care.',
    fullDescription:
      'Grounding techniques are sensory-based exercises that direct attention to the immediate physical environment. Widely used in trauma-informed care and anxiety management protocols, grounding exercises engage the prefrontal cortex by asking it to categorize sensory data, which research suggests may reduce amygdala activation associated with acute distress. While specific grounding exercises vary in form, the underlying principle — redirecting cognitive resources to present-moment sensation — is supported by research on attention and emotion regulation.',
  },
  'behavioral activation': {
    approach: 'behavioral activation',
    shortDescription:
      'Behavioral activation encourages engagement in meaningful activities to counteract withdrawal and low mood. Research suggests scheduling positive activities may help improve emotional state.',
    fullDescription:
      'Behavioral activation is a structured therapeutic approach that addresses depression and low mood by increasing engagement with rewarding and meaningful activities. Based on learning theory, it suggests that avoidance and withdrawal perpetuate low mood, while re-engagement with valued activities may interrupt this cycle. Multiple randomized controlled trials and meta-analyses indicate that behavioral activation may be as effective as more complex cognitive interventions for mild to moderate depression, offering an accessible framework for self-guided use.',
  },
  'psychoeducation': {
    approach: 'psychoeducation',
    shortDescription:
      'Psychoeducation provides structured information about mental health processes and coping strategies. Research suggests that understanding one\'s experiences may support self-management and reduce distress.',
    fullDescription:
      'Psychoeducation involves providing individuals with structured information about psychological processes, mental health conditions, and coping strategies. Research suggests that when people understand the mechanisms behind their experiences — such as the stress response or cognitive biases — they may feel more empowered to manage them. Psychoeducational interventions are widely incorporated into clinical practice and self-help programs, with studies indicating they can reduce anxiety about symptoms, improve treatment adherence, and support informed decision-making about wellbeing strategies.',
  },
  'self-compassion': {
    approach: 'self-compassion',
    shortDescription:
      'Self-compassion practices encourage treating oneself with the same kindness offered to a friend. Research by Kristin Neff and others suggests self-compassion may reduce self-criticism and support emotional resilience.',
    fullDescription:
      'Self-compassion, as conceptualized by researcher Kristin Neff, involves three core components: self-kindness (versus self-judgment), common humanity (versus isolation), and mindfulness (versus over-identification with suffering). A growing body of research, including randomized controlled trials, suggests that self-compassion practices may reduce rumination, decrease anxiety and depressive symptoms, and support emotional resilience. Self-compassion exercises encourage individuals to respond to personal difficulties with warmth and understanding rather than harsh self-criticism.',
  },
};
