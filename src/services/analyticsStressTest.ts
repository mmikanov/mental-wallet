/**
 * Stress Test Generator for the anonymous analytics system.
 *
 * Generates realistic synthetic analytics events and inserts them into the
 * event queue with status 'pending'. Used for development testing of the
 * batch transmitter, queue management, and the mock backend dashboard.
 *
 * Only intended for __DEV__ builds.
 *
 * Validates: Requirements 12.1–12.7
 */

import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/data/database';
import type { AnalyticsEventType, AnalyticsEvent } from '@/types/analytics';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';

// --- Config ---

export interface StressTestConfig {
  /** Number of simulated users (1–100, default 20) */
  userCount: number;
  /** Events per user (10–500, default 50) */
  eventsPerUser: number;
  /** Time span to spread events across, in days (1–90, default 30) */
  timeSpanDays: number;
}

export interface StressTestResult {
  totalEvents: number;
  simulatedUsers: number;
  queueSize: number;
}

export type ProgressCallback = (current: number, total: number) => void;

// --- Constants ---

const DEFAULT_CONFIG: StressTestConfig = {
  userCount: 20,
  eventsPerUser: 50,
  timeSpanDays: 30,
};

const CARD_IDS = CURATED_LIBRARY.map((c) => c.id);
const CARD_CATEGORIES = [...new Set(CURATED_LIBRARY.map((c) => c.categoryId))];
const ORIGIN_BADGES = ['library', 'community', 'my_tool'] as const;
const ONBOARDING_STEPS = ['welcome', 'privacy_notice', 'kpi_selection', 'tutorial'];
const EMOTIONS = ['stressed', 'anxious', 'sad', 'overwhelmed', 'angry', 'numb', 'hopeful'];
const OUTCOME_RESPONSES = ['calmer', 'clearer', 'hopeful', 'same', 'worse'] as const;

// Distribution weights for outcome responses: ~60% positive, ~25% same, ~15% worse
const OUTCOME_WEIGHTS: { response: typeof OUTCOME_RESPONSES[number]; weight: number }[] = [
  { response: 'calmer', weight: 0.25 },
  { response: 'clearer', weight: 0.2 },
  { response: 'hopeful', weight: 0.15 },
  { response: 'same', weight: 0.25 },
  { response: 'worse', weight: 0.15 },
];

// --- Helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function weightedRandom<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let rand = Math.random() * total;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function generateUUID(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // Fallback for environments where Crypto isn't available
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

function generateTimestamp(baseDate: Date, timeSpanDays: number): string {
  const offsetMs = Math.random() * timeSpanDays * 24 * 60 * 60 * 1000;
  const eventDate = new Date(baseDate.getTime() - offsetMs);
  return eventDate.toISOString();
}

// --- Event Generators ---

function generateAppOpened(userId: string, sessionId: string, timestamp: string, daysSinceInstall: number): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'app_opened',
    timestamp,
    properties: { days_since_install: daysSinceInstall },
  };
}

function generateOnboardingStep(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'onboarding_step_viewed',
    timestamp,
    properties: { step_name: randomElement(ONBOARDING_STEPS) },
  };
}

function generateOnboardingCompleted(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'onboarding_completed',
    timestamp,
  };
}

function generateStartModeSelected(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'start_mode_selected',
    timestamp,
    properties: { mode: Math.random() > 0.5 ? 'wallet_first' : 'emotion_first' },
  };
}

function generateEmotionSelected(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'emotion_selected',
    timestamp,
    properties: { emotion: randomElement(EMOTIONS) },
  };
}

function generateSessionStarted(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'session_started',
    timestamp,
  };
}

function generateToolOpened(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'tool_opened',
    timestamp,
    properties: {
      card_id: randomElement(CARD_IDS),
      card_category: randomElement(CARD_CATEGORIES),
      origin_badge: randomElement(ORIGIN_BADGES),
    },
  };
}

function generateToolCompleted(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'tool_completed',
    timestamp,
    properties: {
      card_id: randomElement(CARD_IDS),
      card_category: randomElement(CARD_CATEGORIES),
      origin_badge: randomElement(ORIGIN_BADGES),
      duration_ms: randomInt(5000, 300000), // 5s to 5min
    },
  };
}

function generateToolCreated(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'tool_created',
    timestamp,
    properties: {
      card_id: `user-card-${generateUUID().slice(0, 8)}`,
      card_category: randomElement(CARD_CATEGORIES),
      origin_badge: 'my_tool',
    },
  };
}

function generateToolAdded(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'tool_added',
    timestamp,
    properties: {
      card_id: randomElement(CARD_IDS),
      card_category: randomElement(CARD_CATEGORIES),
      origin_badge: randomElement(ORIGIN_BADGES),
    },
  };
}

function generateToolArchived(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'tool_archived',
    timestamp,
    properties: {
      card_id: randomElement(CARD_IDS),
      card_category: randomElement(CARD_CATEGORIES),
      origin_badge: randomElement(ORIGIN_BADGES),
    },
  };
}

function generateToolUnarchived(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'tool_unarchived',
    timestamp,
    properties: {
      card_id: randomElement(CARD_IDS),
      card_category: randomElement(CARD_CATEGORIES),
      origin_badge: randomElement(ORIGIN_BADGES),
    },
  };
}

function generateToolCopied(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'tool_copied',
    timestamp,
    properties: {
      card_id: randomElement(CARD_IDS),
      card_category: randomElement(CARD_CATEGORIES),
      origin_badge: randomElement(ORIGIN_BADGES),
    },
  };
}

function generateToolHistoryViewed(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'tool_history_viewed',
    timestamp,
    properties: {
      card_id: randomElement(CARD_IDS),
      card_category: randomElement(CARD_CATEGORIES),
      origin_badge: randomElement(ORIGIN_BADGES),
    },
  };
}

function generateOutcomeResponse(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  const response = weightedRandom(
    OUTCOME_WEIGHTS.map((w) => ({ value: w.response, weight: w.weight }))
  );
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'outcome_response',
    timestamp,
    properties: { response },
  };
}

function generateExternalResourceOpened(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  const resources = [
    { url: 'https://988lifeline.org', name: '988 Suicide & Crisis Lifeline' },
    { url: 'https://crisistextline.org', name: 'Crisis Text Line' },
    { url: 'https://nami.org', name: 'NAMI' },
  ];
  const resource = randomElement(resources);
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'external_resource_opened',
    timestamp,
    properties: { resource_url: resource.url, resource_name: resource.name },
  };
}

function generateSessionEnded(userId: string, sessionId: string, timestamp: string): AnalyticsEvent {
  return {
    anonymous_user_id: userId,
    session_id: sessionId,
    event_type: 'session_ended',
    timestamp,
    properties: { session_duration_ms: randomInt(30000, 1800000) }, // 30s to 30min
  };
}

// --- Event type distribution (weighted) ---

interface EventGenerator {
  type: AnalyticsEventType;
  weight: number;
  generate: (userId: string, sessionId: string, timestamp: string, daysSinceInstall: number) => AnalyticsEvent;
}

const EVENT_GENERATORS: EventGenerator[] = [
  { type: 'app_opened', weight: 0.10, generate: generateAppOpened },
  { type: 'onboarding_step_viewed', weight: 0.04, generate: (u, s, t) => generateOnboardingStep(u, s, t) },
  { type: 'onboarding_completed', weight: 0.02, generate: (u, s, t) => generateOnboardingCompleted(u, s, t) },
  { type: 'start_mode_selected', weight: 0.06, generate: (u, s, t) => generateStartModeSelected(u, s, t) },
  { type: 'session_started', weight: 0.07, generate: (u, s, t) => generateSessionStarted(u, s, t) },
  { type: 'tool_added', weight: 0.05, generate: (u, s, t) => generateToolAdded(u, s, t) },
  { type: 'tool_archived', weight: 0.03, generate: (u, s, t) => generateToolArchived(u, s, t) },
  { type: 'tool_unarchived', weight: 0.02, generate: (u, s, t) => generateToolUnarchived(u, s, t) },
  { type: 'tool_opened', weight: 0.13, generate: (u, s, t) => generateToolOpened(u, s, t) },
  { type: 'tool_completed', weight: 0.10, generate: (u, s, t) => generateToolCompleted(u, s, t) },
  { type: 'tool_created', weight: 0.03, generate: (u, s, t) => generateToolCreated(u, s, t) },
  { type: 'tool_copied', weight: 0.03, generate: (u, s, t) => generateToolCopied(u, s, t) },
  { type: 'tool_history_viewed', weight: 0.04, generate: (u, s, t) => generateToolHistoryViewed(u, s, t) },
  { type: 'outcome_response', weight: 0.08, generate: (u, s, t) => generateOutcomeResponse(u, s, t) },
  { type: 'external_resource_opened', weight: 0.03, generate: (u, s, t) => generateExternalResourceOpened(u, s, t) },
  { type: 'session_ended', weight: 0.08, generate: (u, s, t) => generateSessionEnded(u, s, t) },
];

function pickRandomEventGenerator(): EventGenerator {
  return weightedRandom(
    EVENT_GENERATORS.map((g) => ({ value: g, weight: g.weight }))
  );
}

// --- Main Stress Test Function ---

/**
 * Runs the analytics stress test by generating synthetic events and
 * inserting them directly into the SQLite event queue with 'pending' status.
 *
 * @param config - Test configuration (userCount, eventsPerUser, timeSpanDays)
 * @param onProgress - Optional callback reporting (currentEvent, totalEvents)
 * @returns Summary of the stress test results
 */
export async function runStressTest(
  config: Partial<StressTestConfig> = {},
  onProgress?: ProgressCallback
): Promise<StressTestResult> {
  const resolvedConfig: StressTestConfig = {
    userCount: clamp(config.userCount ?? DEFAULT_CONFIG.userCount, 1, 100),
    eventsPerUser: clamp(config.eventsPerUser ?? DEFAULT_CONFIG.eventsPerUser, 10, 500),
    timeSpanDays: clamp(config.timeSpanDays ?? DEFAULT_CONFIG.timeSpanDays, 1, 90),
  };

  const { userCount, eventsPerUser, timeSpanDays } = resolvedConfig;
  const totalEvents = userCount * eventsPerUser;
  const now = new Date();
  const db = await getDatabase();

  let currentEvent = 0;

  // Process users in batches to avoid overwhelming the DB
  for (let u = 0; u < userCount; u++) {
    const userId = generateUUID();
    const daysSinceInstall = randomInt(0, timeSpanDays);

    // Build events for this user
    const userEvents: { id: string; payload: string; created_at: string }[] = [];
    for (let e = 0; e < eventsPerUser; e++) {
      const sessionId = generateUUID();
      const timestamp = generateTimestamp(now, timeSpanDays);
      const generator = pickRandomEventGenerator();
      const event = generator.generate(userId, sessionId, timestamp, daysSinceInstall);
      
      userEvents.push({
        id: generateUUID(),
        payload: JSON.stringify(event),
        created_at: timestamp,
      });

      currentEvent++;
      // Report progress every 50 events to avoid callback overhead
      if (onProgress && currentEvent % 50 === 0) {
        onProgress(currentEvent, totalEvents);
      }
    }

    // Batch insert user's events in a single transaction
    await db.withTransactionAsync(async () => {
      for (const row of userEvents) {
        await db.runAsync(
          `INSERT INTO analytics_event_queue (id, payload, created_at, status) VALUES (?, ?, ?, 'pending')`,
          [row.id, row.payload, row.created_at]
        );
      }
    });
  }

  // Final progress callback
  if (onProgress) {
    onProgress(totalEvents, totalEvents);
  }

  // Get final queue size
  const sizeResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM analytics_event_queue`
  );

  return {
    totalEvents,
    simulatedUsers: userCount,
    queueSize: sizeResult?.count ?? totalEvents,
  };
}
