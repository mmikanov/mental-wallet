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
  | 'link_button'
  | 'display_media'
  | 'upload_media';

export type MediaSourceType = 'local_file' | 'direct_url' | 'platform_url';
export type MediaFileType = 'image' | 'video' | 'audio';
export type PlatformType = 'youtube' | 'vimeo' | 'soundcloud' | 'spotify' | 'unknown';

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

export interface DisplayMediaConfig {
  label: string;
  mediaSourceType: MediaSourceType;
  mediaFileType: MediaFileType;
  /** For local_file: relative path in app file system. For URLs: the URL string. */
  source: string;
  /** Recognized platform (null for local files and direct URLs) */
  platform: PlatformType | null;
  /** Local cache path after download (populated at runtime for direct_url sources) */
  cachedPath: string | null;
}

export interface UploadMediaConfig {
  label: string;
  /** Accepted media types the user can upload */
  acceptedTypes: MediaFileType[];
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
  | LinkButtonConfig
  | DisplayMediaConfig
  | UploadMediaConfig;

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
  allowBackgroundCustomization: boolean;
  sourceLibraryId?: string | null;
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

// --- Background Overlay ---

export interface BackgroundOverlay {
  id: string;
  cardId: string;
  backgroundType: BackgroundType;
  backgroundValue: string;
  createdAt: string;
  updatedAt: string;
}

// --- Emotion-First Session Types ---

export type EmotionType =
  | 'stressed'
  | 'overwhelmed'
  | 'anxious'
  | 'sad'
  | 'angry'
  | 'numb';

export type ContextType =
  | 'at_work'
  | 'with_family'
  | 'with_friends'
  | 'alone_at_home'
  | 'not_sure';

export type TimeType = '1_2_min' | '5_10_min';

export type StartMode = 'wallet' | 'emotion' | 'last_used';

export type CardType = 'standard' | 'session_launcher';

export interface EmotionTag {
  id: string;
  cardId: string;
  emotion: EmotionType;
}

export interface CardContextTag {
  cardId: string;
  context: ContextType;
}

export interface CardTimeTag {
  cardId: string;
  time: TimeType;
}

export interface EmotionSessionRecord {
  id: string;
  selectedEmotion: EmotionType;
  selectedContexts: ContextType[];
  selectedTime: TimeType | null;
  toolCardIds: string[];
  startedAt: string;
  endedAt: string | null;
}
