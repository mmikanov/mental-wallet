/**
 * Service layer interfaces for Mental Health Wallet MVP.
 * These define the contracts for the business logic layer.
 */

import type {
  Card,
  CardShell,
  Completion,
  Control,
  ControlValue,
  NotificationConfig,
  NotificationData,
  OriginBadge,
  Pagination,
  Reminder,
  ReminderConfig,
  StreakInfo,
  ValidationResult,
} from './index';

// --- Card Service ---

export interface CardService {
  /** Get all active (non-archived) cards ordered by stack position. */
  getAll(): Promise<Card[]>;

  /** Get a single card by ID, including its controls. */
  getById(id: string): Promise<Card | null>;

  /** Create a new card with the given shell, controls, and origin badge. */
  create(
    shell: CardShell,
    controls: Omit<Control, 'id' | 'cardId'>[],
    originBadge: OriginBadge,
    categoryId?: string,
    sourceLibraryId?: string
  ): Promise<Card>;

  /** Update an existing card's fields. */
  update(id: string, updates: Partial<Card>): Promise<Card>;

  /** Persist a new card order given an array of card IDs in desired order. */
  reorder(orderedIds: string[]): Promise<void>;

  /** Archive a card: hide from active wallet, disable reminders. */
  archive(id: string): Promise<void>;

  /** Restore an archived card to the active wallet. */
  restore(id: string): Promise<void>;

  /** Duplicate a card with reset statistics and "My tool" badge. */
  duplicate(id: string): Promise<Card>;

  /** Permanently delete a card and all associated data. */
  delete(id: string): Promise<void>;

  /** Validate a CardShell's fields (non-empty, within length limits). */
  validateShell(shell: CardShell): ValidationResult;

  /** Validate a list of controls (1–10 controls per card). */
  validateControls(controls: Control[]): ValidationResult;
}

// --- Completion Service ---

export interface CompletionService {
  /** Record a completion for a card with control values. */
  record(cardId: string, values: Omit<ControlValue, 'id' | 'completionId'>[]): Promise<Completion>;

  /** Get completions for a card, paginated, newest first. */
  getByCard(cardId: string, pagination?: Pagination): Promise<Completion[]>;

  /** Delete a single completion entry. */
  deleteEntry(completionId: string): Promise<void>;

  /** Get streak information for a card. */
  getStreakInfo(cardId: string): Promise<StreakInfo>;

  /** Update the streak for a card based on the current completion. */
  updateStreak(cardId: string): Promise<void>;
}

// --- Reminder Service ---

export interface ReminderService {
  /** Set a reminder for a card. */
  setCardReminder(cardId: string, config: ReminderConfig): Promise<Reminder>;

  /** Get the active reminder for a card, if any. */
  getReminder(cardId: string): Promise<Reminder | null>;

  /** Update an existing reminder's configuration. */
  updateReminder(reminderId: string, config: ReminderConfig): Promise<Reminder>;

  /** Delete a reminder. */
  deleteReminder(reminderId: string): Promise<void>;

  /** Disable all reminders for a card (used when archiving). */
  disableForCard(cardId: string): Promise<void>;

  /** Schedule a system notification for a reminder. */
  scheduleNotification(reminder: Reminder): Promise<void>;
}

// --- Notification Service ---

export interface NotificationService {
  /** Request push notification permission from the user. */
  requestPermission(): Promise<boolean>;

  /** Check if notification permission is currently granted. */
  hasPermission(): Promise<boolean>;

  /** Schedule a local notification and return its identifier. */
  scheduleLocal(config: NotificationConfig): Promise<string>;

  /** Cancel a previously scheduled notification by its identifier. */
  cancelScheduled(notificationId: string): Promise<void>;

  /** Handle a notification tap and navigate to the appropriate card. */
  handleNotificationTap(data: NotificationData): void;
}

// --- Export Service ---

export interface ExportService {
  /** Export all user data in the specified format. */
  exportData(format: 'json' | 'csv'): Promise<string>;

  /** Delete all user data and reset app to initial state. */
  deleteAllData(): Promise<void>;
}
