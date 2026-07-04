/**
 * Analytics type definitions for the anonymous analytics system.
 * Covers event types, queue management, transmitter configuration,
 * and store state.
 */

// --- Event Type Union ---

export type AnalyticsEventType =
  | 'app_opened'
  | 'onboarding_step_viewed'
  | 'onboarding_completed'
  | 'start_mode_selected'
  | 'session_started'
  | 'tool_added'
  | 'tool_archived'
  | 'tool_unarchived'
  | 'tool_created'
  | 'tool_copied'
  | 'tool_opened'
  | 'tool_completed'
  | 'tool_history_viewed'
  | 'reminder_set'
  | 'reminder_deleted'
  | 'outcome_response'
  | 'external_resource_opened'
  | 'session_ended';

// --- Base Event Interface ---

export interface AnalyticsEventBase {
  anonymous_user_id: string;
  session_id: string;
  event_type: AnalyticsEventType;
  timestamp: string; // ISO 8601 with ms precision
}

// --- Discriminated Event Types ---

export type AppOpenedEvent = AnalyticsEventBase & {
  event_type: 'app_opened';
  properties: { days_since_install: number };
};

export type OnboardingStepViewedEvent = AnalyticsEventBase & {
  event_type: 'onboarding_step_viewed';
  properties: { step_name: string };
};

export type OnboardingCompletedEvent = AnalyticsEventBase & {
  event_type: 'onboarding_completed';
};

export type StartModeSelectedEvent = AnalyticsEventBase & {
  event_type: 'start_mode_selected';
  properties: { mode: 'wallet_first' | 'emotion_first' };
};

export type SessionStartedEvent = AnalyticsEventBase & {
  event_type: 'session_started';
};

export type ToolAddedEvent = AnalyticsEventBase & {
  event_type: 'tool_added';
  properties: { card_id: string; card_category: string; origin_badge: string };
};

export type ToolArchivedEvent = AnalyticsEventBase & {
  event_type: 'tool_archived';
  properties: { card_id: string; card_category: string; origin_badge: string };
};

export type ToolUnarchivedEvent = AnalyticsEventBase & {
  event_type: 'tool_unarchived';
  properties: { card_id: string; card_category: string; origin_badge: string };
};

export type ToolCreatedEvent = AnalyticsEventBase & {
  event_type: 'tool_created';
  properties: { card_id: string; card_category: string; origin_badge: 'my_tool' };
};

export type ToolCopiedEvent = AnalyticsEventBase & {
  event_type: 'tool_copied';
  properties: { card_id: string; card_category: string; origin_badge: string };
};

export type ToolOpenedEvent = AnalyticsEventBase & {
  event_type: 'tool_opened';
  properties: { card_id: string; card_category: string; origin_badge: string };
};

export type ToolCompletedEvent = AnalyticsEventBase & {
  event_type: 'tool_completed';
  properties: {
    card_id: string;
    card_category: string;
    origin_badge: string;
    duration_ms: number;
  };
};

export type ToolHistoryViewedEvent = AnalyticsEventBase & {
  event_type: 'tool_history_viewed';
  properties: { card_id: string; card_category: string; origin_badge: string };
};

export type ReminderSetEvent = AnalyticsEventBase & {
  event_type: 'reminder_set';
  properties: { card_id: string; frequency: string };
};

export type ReminderDeletedEvent = AnalyticsEventBase & {
  event_type: 'reminder_deleted';
  properties: { card_id: string };
};

export type OutcomeResponseEvent = AnalyticsEventBase & {
  event_type: 'outcome_response';
  properties: {
    response: 'calmer' | 'clearer' | 'hopeful' | 'same' | 'worse';
  };
};

export type ExternalResourceOpenedEvent = AnalyticsEventBase & {
  event_type: 'external_resource_opened';
  properties: { resource_url: string; resource_name: string };
};

export type SessionEndedEvent = AnalyticsEventBase & {
  event_type: 'session_ended';
  properties: {
    session_duration_ms: number;
    emotion?: string;
    contexts?: string;
    time?: string;
  };
};

// --- Discriminated Union of All Analytics Events ---

export type AnalyticsEvent =
  | AppOpenedEvent
  | OnboardingStepViewedEvent
  | OnboardingCompletedEvent
  | StartModeSelectedEvent
  | SessionStartedEvent
  | ToolAddedEvent
  | ToolArchivedEvent
  | ToolUnarchivedEvent
  | ToolCreatedEvent
  | ToolCopiedEvent
  | ToolOpenedEvent
  | ToolCompletedEvent
  | ToolHistoryViewedEvent
  | ReminderSetEvent
  | ReminderDeletedEvent
  | OutcomeResponseEvent
  | ExternalResourceOpenedEvent
  | SessionEndedEvent;

// --- Event Queue ---

export interface QueuedEvent {
  id: string;
  payload: string; // JSON-serialized AnalyticsEvent
  created_at: string; // UTC ISO 8601
  status: 'pending' | 'sending' | 'failed';
}

// --- Transmitter Configuration ---

export interface TransmitterConfig {
  baseUrl: string;
  batchSize: number; // default 50
  flushThreshold: number; // default 10
  flushIntervalMs: number; // default 60_000
  retryBaseMs: number; // default 120_000
  retryCapMs: number; // default 900_000 (15 min)
}

// --- Analytics Store State ---

export interface AnalyticsStoreState {
  optIn: boolean;
  isIdentityReady: boolean;
  anonymousUserId: string | null;

  // Actions
  initialize: () => Promise<void>;
  setOptIn: (value: boolean) => Promise<void>;
  resetData: () => Promise<void>;
}
