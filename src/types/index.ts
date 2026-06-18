/**
 * Core domain types for Mental Health Wallet MVP.
 * Based on the Universal Card Model, Control Types, and data entities from the design document.
 */

// --- Enums and Literal Types ---

export type OriginBadge = 'library' | 'community' | 'my_tool';

export type ControlType =
  | 'static_text'
  | 'text_input'
  | 'text_area'
  | 'mood_slider'
  | 'choice_buttons'
  | 'checkbox'
  | 'counter'
  | 'datetime_stamp'
  | 'image_attachment'
  | 'link_button';

export type ReminderFrequencyType = 'daily' | '3x_week' | 'custom';

export type IconType = 'library' | 'emoji' | 'custom_image';

export type BackgroundType = 'color' | 'gradient' | 'image';

// --- Control Config Variants ---

export interface StaticTextConfig {
  title?: string;
  body: string;
  fontSize: 'small' | 'medium' | 'large';
}

export interface TextInputConfig {
  label: string;
  placeholder?: string;
  maxLength: number; // max 200
}

export interface TextAreaConfig {
  label: string;
  placeholder?: string;
}

export interface MoodSliderConfig {
  label: string;
  minLabel?: string;
  maxLabel?: string;
}

export interface ChoiceButtonsConfig {
  label: string;
  options: { text: string; icon?: string }[]; // 1–8 options
}

export interface CheckboxConfig {
  label: string;
}

export interface CounterConfig {
  label: string;
  min?: number;
  max?: number;
}

export interface DateTimeStampConfig {
  displayMode: 'visible' | 'hidden';
}

export interface ImageAttachmentConfig {
  label: string;
}

export interface LinkButtonConfig {
  label: string;
  targetUrl: string;
  fallbackUrl?: string;
}

export type ControlConfig =
  | StaticTextConfig
  | TextInputConfig
  | TextAreaConfig
  | MoodSliderConfig
  | ChoiceButtonsConfig
  | CheckboxConfig
  | CounterConfig
  | DateTimeStampConfig
  | ImageAttachmentConfig
  | LinkButtonConfig;

// --- Core Domain Models ---

export interface Control {
  id: string;
  cardId: string;
  type: ControlType;
  position: number;
  config: ControlConfig;
  isRequired: boolean;
}

export interface CardShell {
  title: string; // max 80 chars
  description: string; // max 300 chars
  iconType: IconType;
  iconValue: string;
  backgroundType: BackgroundType;
  backgroundValue: string;
}

export interface Card extends CardShell {
  id: string;
  categoryId: string;
  originBadge: OriginBadge;
  stackPosition: number;
  totalUses: number;
  currentStreak: number;
  lastUsedAt: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  previousStackPosition: number | null;
  controls: Control[];
  createdAt: string;
  updatedAt: string;
}

export interface Completion {
  id: string;
  cardId: string;
  completedAt: string;
  values: ControlValue[];
}

export interface ControlValue {
  id: string;
  completionId: string;
  controlId: string;
  controlType: ControlType;
  value: string;
}

export interface ReminderFrequency {
  type: ReminderFrequencyType;
  days?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
}

export interface Reminder {
  id: string;
  cardId: string;
  type: 'per_card';
  time: string; // HH:mm format
  frequency: ReminderFrequency;
  isActive: boolean;
  notificationId: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  colorHex: string;
  displayOrder: number;
}

// --- Supporting Types ---

export interface StreakInfo {
  currentStreak: number;
  totalUses: number;
  lastUsedAt: string | null;
}

export interface StreakUpdate {
  currentStreak: number;
  totalUses: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

export interface ReminderConfig {
  time: string; // HH:mm format
  frequency: ReminderFrequency;
}

export interface NotificationConfig {
  title: string;
  body: string;
  data: NotificationData;
  trigger: {
    hour: number;
    minute: number;
    repeats: boolean;
    weekday?: number; // 1=Sunday ... 7=Saturday (expo-notifications format)
  };
}

export interface NotificationData {
  type: 'card_reminder';
  cardId: string;
}

// --- Validation Types ---

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
