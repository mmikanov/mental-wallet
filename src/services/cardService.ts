import * as Crypto from 'expo-crypto';
import { getDatabase } from '../data/database';
import { AppError, ErrorCode } from '../types/errors';
import { copyOverlayToCard } from './backgroundOverlayService';
import { validateThirdPartyUri } from '../utils/validateThirdPartyUri';
import { evaluateOutdated, diffControls } from './librarySyncService';
import { KPI_CARD_DEFINITION, formatKpiMoodLabel } from '../data/kpiCardDefinition';
import type {
  Card,
  CardShell,
  Control,
  ControlConfig,
  DisplayMediaConfig,
  LinkButtonConfig,
  OriginBadge,
  UploadMediaConfig,
  ValidationResult,
} from '../types/index';
import type { CardService } from '../types/services';

/**
 * Checks if a string is non-empty and not whitespace-only.
 */
function isNonEmpty(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates a CardShell's fields: Title (≤80), Description (≤300),
 * Icon, and Background must all be non-empty/non-whitespace.
 *
 * Validates: Requirements 5.6, 5.7
 */
export function validateShell(shell: CardShell): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  if (!isNonEmpty(shell.title)) {
    errors.push({ field: 'title', message: 'Title is required and cannot be whitespace only' });
  } else if (shell.title.length > 80) {
    errors.push({ field: 'title', message: 'Title must be 80 characters or less' });
  }

  if (!isNonEmpty(shell.description)) {
    errors.push({
      field: 'description',
      message: 'Description is required and cannot be whitespace only',
    });
  } else if (shell.description.length > 300) {
    errors.push({ field: 'description', message: 'Description must be 300 characters or less' });
  }

  if (!isNonEmpty(shell.iconValue)) {
    errors.push({ field: 'iconValue', message: 'Icon selection is required' });
  }

  // Validate third-party icon URI uses HTTPS or local asset path
  if (shell.iconType === 'third_party' && isNonEmpty(shell.iconValue)) {
    const uriResult = validateThirdPartyUri(shell.iconValue);
    if (!uriResult.valid) {
      errors.push({ field: 'iconValue', message: uriResult.error || 'URI must use HTTPS or reference a local asset.' });
    }
  }

  if (!isNonEmpty(shell.backgroundValue)) {
    errors.push({ field: 'backgroundValue', message: 'Background selection is required' });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates a list of controls: must have between 1–10 controls.
 * Also validates link_button URLs have an allowed scheme.
 *
 * Validates: Requirements 7.7
 */
export function validateControls(controls: Control[]): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  if (controls.length === 0) {
    errors.push({ field: 'controls', message: 'At least one control is required' });
  } else if (controls.length > 10) {
    errors.push({ field: 'controls', message: 'Maximum of 10 controls allowed per card' });
  }

  // Validate link_button URLs
  for (let i = 0; i < controls.length; i++) {
    const control = controls[i];
    if (control.type === 'link_button') {
      const config = control.config as LinkButtonConfig;
      if (!isValidLinkUrl(config.targetUrl)) {
        errors.push({
          field: `controls[${i}].targetUrl`,
          message:
            'Link URL must start with https://, http://, or a custom scheme containing "://"',
        });
      }
    }
    if (control.type === 'display_media') {
      const config = control.config as DisplayMediaConfig;
      if (!config.source || config.source.trim().length === 0) {
        errors.push({
          field: `controls[${i}].source`,
          message: 'Media source is required',
        });
      }
      if (
        (config.mediaSourceType === 'direct_url' || config.mediaSourceType === 'platform_url') &&
        config.source &&
        !config.source.startsWith('https://')
      ) {
        errors.push({
          field: `controls[${i}].source`,
          message: 'Media URL must use HTTPS',
        });
      }
    }
    if (control.type === 'upload_media') {
      const config = control.config as UploadMediaConfig;
      if (!config.acceptedTypes || config.acceptedTypes.length === 0) {
        errors.push({
          field: `controls[${i}].acceptedTypes`,
          message: 'At least one accepted media type is required',
        });
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Checks if a URL has an allowed scheme: https://, http://, or custom "://"
 */
function isValidLinkUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return true;
  // Custom scheme: must contain "://" with a non-empty scheme prefix
  const schemeIndex = trimmed.indexOf('://');
  return schemeIndex > 0;
}

/**
 * Maps a database row to a Card object (without controls).
 */
function mapRowToCard(row: Record<string, unknown>): Omit<Card, 'controls'> {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    iconType: row.icon_type as Card['iconType'],
    iconValue: row.icon_value as string,
    backgroundType: row.background_type as Card['backgroundType'],
    backgroundValue: row.background_value as string,
    categoryId: row.category_id as string,
    originBadge: row.origin_badge as OriginBadge,
    stackPosition: row.stack_position as number,
    totalUses: row.total_uses as number,
    currentStreak: row.current_streak as number,
    lastUsedAt: (row.last_used_at as string) || null,
    isArchived: (row.is_archived as number) === 1,
    archivedAt: (row.archived_at as string) || null,
    previousStackPosition: (row.previous_stack_position as number) ?? null,
    allowBackgroundCustomization: (row.allow_background_customization as number) === 1,
    sourceLibraryId: (row.source_library_id as string) ?? null,
    sourceLibraryVersion: (row.source_library_version as number) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Maps a database row to a Control object.
 */
function mapRowToControl(row: Record<string, unknown>): Control {
  return {
    id: row.control_id as string,
    cardId: row.control_card_id as string,
    type: row.control_type as Control['type'],
    position: row.control_position as number,
    config: JSON.parse((row.control_config as string) || '{}') as ControlConfig,
    isRequired: (row.control_is_required as number) === 1,
  };
}

/**
 * Creates the concrete CardService implementation.
 */
export function createCardService(): CardService {
  return {
    /**
     * Get all active (non-archived) cards with their controls via JOIN query.
     * Validates: Requirement 9.2
     */
    async getAll(): Promise<Card[]> {
      const db = await getDatabase();

      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT
          c.id, c.title, c.description, c.icon_type, c.icon_value,
          c.background_type, c.background_value, c.category_id,
          c.origin_badge, c.stack_position, c.total_uses, c.current_streak,
          c.last_used_at, c.is_archived, c.archived_at, c.previous_stack_position,
          c.allow_background_customization, c.source_library_id, c.source_library_version,
          c.created_at, c.updated_at,
          bo.background_type AS overlay_background_type,
          bo.background_value AS overlay_background_value,
          ctrl.id AS control_id, ctrl.card_id AS control_card_id,
          ctrl.type AS control_type, ctrl.position AS control_position,
          ctrl.config AS control_config, ctrl.is_required AS control_is_required
        FROM cards c
        LEFT JOIN background_overlays bo ON bo.card_id = c.id
        LEFT JOIN controls ctrl ON ctrl.card_id = c.id
        WHERE c.is_archived = 0 AND c.stack_position >= 0
        ORDER BY c.stack_position ASC, ctrl.position ASC`
      );

      return assembleCardsFromRows(rows);
    },

    /**
     * Get a single card by ID, including its controls.
     */
    async getById(id: string): Promise<Card | null> {
      const db = await getDatabase();

      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT
          c.id, c.title, c.description, c.icon_type, c.icon_value,
          c.background_type, c.background_value, c.category_id,
          c.origin_badge, c.stack_position, c.total_uses, c.current_streak,
          c.last_used_at, c.is_archived, c.archived_at, c.previous_stack_position,
          c.allow_background_customization, c.source_library_id, c.source_library_version,
          c.created_at, c.updated_at,
          bo.background_type AS overlay_background_type,
          bo.background_value AS overlay_background_value,
          ctrl.id AS control_id, ctrl.card_id AS control_card_id,
          ctrl.type AS control_type, ctrl.position AS control_position,
          ctrl.config AS control_config, ctrl.is_required AS control_is_required
        FROM cards c
        LEFT JOIN background_overlays bo ON bo.card_id = c.id
        LEFT JOIN controls ctrl ON ctrl.card_id = c.id
        WHERE c.id = ?
        ORDER BY ctrl.position ASC`,
        [id]
      );

      if (rows.length === 0) return null;

      const cards = assembleCardsFromRows(rows);
      return cards[0] || null;
    },

    /**
     * Create a new card with shell, controls, and origin badge.
     * Validates: Requirement 5.1
     */
    async create(
      shell: CardShell,
      controls: Omit<Control, 'id' | 'cardId'>[],
      originBadge: OriginBadge,
      categoryId?: string,
      sourceLibraryId?: string,
      sourceLibraryVersion?: number | null
    ): Promise<Card> {
      const shellValidation = validateShell(shell);
      if (!shellValidation.isValid) {
        throw AppError.validation(
          ErrorCode.VALIDATION_EMPTY_FIELD,
          `Card shell validation failed: ${shellValidation.errors.map((e) => e.message).join(', ')}`
        );
      }

      const controlsAsFullControls = controls.map((c, i) => ({
        ...c,
        id: 'temp',
        cardId: 'temp',
        position: c.position ?? i,
      })) as Control[];

      const controlsValidation = validateControls(controlsAsFullControls);
      if (!controlsValidation.isValid) {
        throw AppError.validation(
          ErrorCode.VALIDATION_CONTROLS_COUNT,
          `Controls validation failed: ${controlsValidation.errors.map((e) => e.message).join(', ')}`
        );
      }

      const db = await getDatabase();
      const cardId = Crypto.randomUUID();
      const now = new Date().toISOString();

      // Determine stack position (top = 0, push others down)
      const maxPosResult = await db.getFirstAsync<{ max_pos: number | null }>(
        `SELECT MAX(stack_position) as max_pos FROM cards WHERE is_archived = 0`
      );
      const stackPosition = 0;

      await db.execAsync('BEGIN TRANSACTION');

      try {
        // Shift existing cards down
        await db.runAsync(
          `UPDATE cards SET stack_position = stack_position + 1 WHERE is_archived = 0 AND stack_position >= 0`
        );

        // Insert the card
        await db.runAsync(
          `INSERT INTO cards (id, title, description, icon_type, icon_value, background_type, background_value, category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at, is_archived, archived_at, previous_stack_position, allow_background_customization, source_library_id, source_library_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, 0, NULL, NULL, ?, ?, ?, ?, ?)`,
          [
            cardId,
            shell.title,
            shell.description,
            shell.iconType,
            shell.iconValue,
            shell.backgroundType,
            shell.backgroundValue,
            categoryId || 'grounding-calming',
            originBadge,
            stackPosition,
            originBadge === 'library' || originBadge === 'community' ? 1 : 0,
            sourceLibraryId || null,
            sourceLibraryVersion ?? null,
            now,
            now,
          ]
        );

        // Insert controls
        for (let i = 0; i < controls.length; i++) {
          const control = controls[i];
          const controlId = Crypto.randomUUID();
          await db.runAsync(
            `INSERT INTO controls (id, card_id, type, position, config, is_required, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              controlId,
              cardId,
              control.type,
              control.position ?? i,
              JSON.stringify(control.config),
              control.isRequired ? 1 : 0,
              now,
            ]
          );
        }

        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to create card',
          error instanceof Error ? error : undefined
        );
      }

      const card = await this.getById(cardId);
      if (!card) {
        throw AppError.persistence(ErrorCode.PERSISTENCE_READ_FAILED, 'Failed to read created card');
      }
      return card;
    },

    /**
     * History-preserving in-place update of a wallet card from its current
     * curated definition. Refreshes shell + controls + category + version on the
     * SAME `cards.id`, preserving stats, completions/control_values (surviving
     * controls keep their UUIDs), custom background overlays, and reminders.
     *
     * Guards (all BEFORE opening any transaction):
     *  - No `sourceLibraryId` / curated missing / not outdated ⇒ return the card
     *    unchanged (idempotent no-op, Req 3.8 / Req 1.4).
     *
     * The mutation runs in a SINGLE transaction: shell `UPDATE cards` FIRST, then
     * the control reconciliation (UPDATE surviving / INSERT new / DELETE removed).
     * Any failure ROLLBACKs the whole thing, leaving the card in its prior state
     * (Req 3.7).
     *
     * AFTER a successful COMMIT, if the update changed the card TITLE and the card
     * has an ACTIVE reminder, the reminder is rescheduled so the notification body
     * reflects the new title (Req 3.5). This runs outside the transaction (async
     * notification I/O must never sit inside an open SQLite transaction — same rule
     * archive/restore follow) and is best-effort: a notification failure NEVER fails
     * the update, which has already committed.
     *
     * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
     */
    async updateFromLibrary(cardId: string): Promise<Card> {
      const db = await getDatabase();

      // 1. Load the card (with controls).
      const card = await this.getById(cardId);
      if (!card) {
        throw AppError.persistence(ErrorCode.PERSISTENCE_NOT_FOUND, `Card not found: ${cardId}`);
      }

      // 2 + 3. Detection (covers: no sourceLibraryId, curated missing/unversioned,
      // already-current). Guard BEFORE opening any transaction — a not-outdated
      // card (including genuinely not-updatable ones) is a no-op that returns the
      // card unchanged (Req 3.8, Req 1.4).
      const { isOutdated, curated, curatedVersion } = evaluateOutdated(card);
      if (!isOutdated || !curated) {
        return card;
      }

      // 4. Compute the control reconciliation plan (matched by position).
      const plan = diffControls(card.controls, curated.controls);

      // Capture the pre-update title so, after COMMIT, we can tell whether the
      // update changed it and only then reschedule the reminder (Req 3.5).
      const previousTitle = card.title;

      // Determine whether a custom background overlay exists. When it does, the
      // user's background wins (Req 3.4) — we must NOT overwrite the card's own
      // background_* columns (the overlay row itself is never touched here).
      const overlay = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM background_overlays WHERE card_id = ?`,
        [cardId]
      );
      const hasOverlay = overlay != null;

      const now = new Date().toISOString();

      // 5. Single transaction: shell UPDATE first, then control reconciliation.
      await db.execAsync('BEGIN TRANSACTION');

      try {
        // Shell + category + version. NEVER touch stats columns (total_uses,
        // current_streak, last_used_at, stack_position, created_at). Skip
        // background_* when a custom overlay exists.
        const shellSet: string[] = [
          'title = ?',
          'description = ?',
          'icon_type = ?',
          'icon_value = ?',
        ];
        const shellParams: (string | number | null)[] = [
          curated.title,
          curated.description,
          curated.iconType,
          curated.iconValue,
        ];

        if (!hasOverlay) {
          shellSet.push('background_type = ?', 'background_value = ?');
          shellParams.push(curated.backgroundType, curated.backgroundValue);
        }

        shellSet.push('category_id = ?', 'source_library_version = ?', 'updated_at = ?');
        shellParams.push(curated.categoryId, curatedVersion, now);
        shellParams.push(cardId);

        await db.runAsync(`UPDATE cards SET ${shellSet.join(', ')} WHERE id = ?`, shellParams);

        // Controls reconciliation — the critical, history-preserving part. Runs
        // AFTER the shell UPDATE inside the SAME txn (required by the P7 fault seam).
        // toUpdate: keep the existing UUID so control_values references stay valid.
        for (const { id, target } of plan.toUpdate) {
          await db.runAsync(
            `UPDATE controls SET type = ?, config = ?, is_required = ?, position = ? WHERE id = ?`,
            [
              target.type,
              JSON.stringify(target.config),
              target.isRequired ? 1 : 0,
              target.position,
              id,
            ]
          );
        }

        // toInsert: genuinely new controls get a fresh UUID.
        for (const target of plan.toInsert) {
          const newControlId = Crypto.randomUUID();
          await db.runAsync(
            `INSERT INTO controls (id, card_id, type, position, config, is_required, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              newControlId,
              cardId,
              target.type,
              target.position,
              JSON.stringify(target.config),
              target.isRequired ? 1 : 0,
              now,
            ]
          );
        }

        // toDeleteIds: targeted DELETE for positions the new definition dropped.
        // Cascades control_values for those specific controls only.
        for (const removedId of plan.toDeleteIds) {
          await db.runAsync(`DELETE FROM controls WHERE id = ?`, [removedId]);
        }

        // Check-in label preservation (Req 7.1, 7.2, 7.3). The generic
        // reconciliation above just wrote KPI_CARD_DEFINITION's TEMPLATE mood_slider
        // label ('How are you doing with your goal?') to position 0, clobbering the
        // user's personalized label. For the check-in card only, re-derive the label
        // from the user's CURRENT personal-KPI setting (authoritative — not a
        // stale carry-over, not the template) and overwrite it here, inside the same
        // transaction so it participates in the ROLLBACK-on-error semantics (P7).
        //
        // Design decision (A): read the personal_kpi setting DIRECTLY from the DB
        // (the same settings row kpiService.getPersonalKpi reads) and format locally
        // via formatKpiMoodLabel — no dependency on kpiService, avoiding a
        // cardService → kpiService cycle.
        if (card.sourceLibraryId === KPI_CARD_DEFINITION.id) {
          const kpiRow = await db.getFirstAsync<{ value: string }>(
            `SELECT value FROM settings WHERE key = ?`,
            ['personal_kpi']
          );
          const kpi = kpiRow?.value?.trim();
          // Null/empty setting: leave the label as-is (the template the reconciliation
          // wrote) rather than formatting an empty goal into
          // 'How are you doing with: ?'. The 8.4 tests always set the setting; this
          // branch just keeps the update crash-safe and free of nonsense labels when
          // no goal has been chosen yet.
          if (kpi) {
            // Target the mood_slider robustly: the surviving control at position 0 of
            // type 'mood_slider' for this card (keeps its original UUID through the
            // in-place UPDATE above). Re-read its current config so we preserve the
            // rest of it (minLabel/maxLabel) and only change the label.
            const moodRow = await db.getFirstAsync<{ id: string; config: string }>(
              `SELECT id, config FROM controls WHERE card_id = ? AND type = 'mood_slider' AND position = 0`,
              [cardId]
            );
            if (moodRow) {
              let moodConfig: Record<string, unknown> = {};
              try {
                moodConfig = JSON.parse(moodRow.config) as Record<string, unknown>;
              } catch {
                moodConfig = {};
              }
              moodConfig.label = formatKpiMoodLabel(kpi);
              await db.runAsync(`UPDATE controls SET config = ? WHERE id = ?`, [
                JSON.stringify(moodConfig),
                moodRow.id,
              ]);
            }
          }
        }

        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to update card from library',
          error instanceof Error ? error : undefined
        );
      }

      // 6. Reminder reschedule (Req 3.5) — AFTER the transaction, best-effort.
      // Only needed when the update actually changed the TITLE (the reminder's
      // notification body embeds the card title). If the title is unchanged, there
      // is no reminder work to do at all.
      if (curated.title !== previousTitle) {
        try {
          // Lazy require (see archive/restore) to keep expo-notifications out of
          // cardService's static import graph for store/unit-test consumers.
          const { createReminderService } = require('./reminderService');
          const reminderService = createReminderService();
          const reminder = await reminderService.getReminder(cardId);
          if (reminder) {
            // Reschedule via updateReminder (NOT scheduleNotification): scheduleNotification
            // only schedules NEW notifications and overwrites notification_id, orphaning the
            // previously scheduled OS notifications (which still carry the OLD title) — they
            // would keep firing. updateReminder CANCELS the old notifications first, then
            // reschedules from the current (now-updated) DB title, so the user sees exactly
            // one reminder carrying the new title and no stale duplicate.
            await reminderService.updateReminder(reminder.id, {
              time: reminder.time,
              frequency: reminder.frequency,
            });
          }
        } catch {
          // Non-fatal: the card update already committed. A stale reminder degrades
          // gracefully; launch reconciliation re-arms active reminders whose OS
          // notifications are missing. Matches the archive/restore convention.
        }
      }

      // 7. Re-read and return the reloaded card.
      const reloaded = await this.getById(cardId);
      if (!reloaded) {
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_READ_FAILED,
          'Failed to read updated card'
        );
      }
      return reloaded;
    },

    /**
     * Update an existing card's fields.
     * Validates: Requirement 9.2, 9.3
     */
    async update(id: string, updates: Partial<Card>): Promise<Card> {
      const db = await getDatabase();

      const existing = await this.getById(id);
      if (!existing) {
        throw AppError.persistence(ErrorCode.PERSISTENCE_NOT_FOUND, `Card not found: ${id}`);
      }

      const now = new Date().toISOString();
      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (updates.title !== undefined) {
        setClauses.push('title = ?');
        params.push(updates.title);
      }
      if (updates.description !== undefined) {
        setClauses.push('description = ?');
        params.push(updates.description);
      }
      if (updates.iconType !== undefined) {
        setClauses.push('icon_type = ?');
        params.push(updates.iconType);
      }
      if (updates.iconValue !== undefined) {
        setClauses.push('icon_value = ?');
        params.push(updates.iconValue);
      }

      // Validate third-party icon URI on update
      const effectiveIconType = updates.iconType ?? existing.iconType;
      const effectiveIconValue = updates.iconValue ?? existing.iconValue;
      if (effectiveIconType === 'third_party' && effectiveIconValue) {
        const uriResult = validateThirdPartyUri(effectiveIconValue);
        if (!uriResult.valid) {
          throw AppError.validation(
            ErrorCode.VALIDATION_EMPTY_FIELD,
            uriResult.error || 'URI must use HTTPS or reference a local asset.'
          );
        }
      }
      if (updates.backgroundType !== undefined) {
        setClauses.push('background_type = ?');
        params.push(updates.backgroundType);
      }
      if (updates.backgroundValue !== undefined) {
        setClauses.push('background_value = ?');
        params.push(updates.backgroundValue);
      }
      if (updates.categoryId !== undefined) {
        setClauses.push('category_id = ?');
        params.push(updates.categoryId);
      }
      if (updates.totalUses !== undefined) {
        setClauses.push('total_uses = ?');
        params.push(updates.totalUses);
      }
      if (updates.currentStreak !== undefined) {
        setClauses.push('current_streak = ?');
        params.push(updates.currentStreak);
      }
      if (updates.lastUsedAt !== undefined) {
        setClauses.push('last_used_at = ?');
        params.push(updates.lastUsedAt);
      }

      if (setClauses.length === 0) {
        return existing;
      }

      setClauses.push('updated_at = ?');
      params.push(now);
      params.push(id);

      try {
        await db.runAsync(
          `UPDATE cards SET ${setClauses.join(', ')} WHERE id = ?`,
          params as (string | number | null)[]
        );
      } catch (error) {
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to update card',
          error instanceof Error ? error : undefined
        );
      }

      const updated = await this.getById(id);
      if (!updated) {
        throw AppError.persistence(ErrorCode.PERSISTENCE_READ_FAILED, 'Failed to read updated card');
      }
      return updated;
    },

    /**
     * Persist a new card order given an array of card IDs in desired order.
     * Validates: Requirement 9.4
     */
    async reorder(orderedIds: string[]): Promise<void> {
      const db = await getDatabase();

      await db.execAsync('BEGIN TRANSACTION');

      try {
        for (let i = 0; i < orderedIds.length; i++) {
          await db.runAsync(
            `UPDATE cards SET stack_position = ?, updated_at = ? WHERE id = ?`,
            [i, new Date().toISOString(), orderedIds[i]]
          );
        }
        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_TRANSACTION_FAILED,
          'Failed to reorder cards',
          error instanceof Error ? error : undefined
        );
      }
    },

    /**
     * Archive a card: set is_archived=1, store previous_stack_position, and
     * disable associated reminders (cancel their OS notifications but PRESERVE
     * the reminder definition so restore can re-arm it).
     * Validates: Requirement 14.1; Bug 2 (1.0.4-user-reported-fixes-round-2)
     */
    async archive(id: string): Promise<void> {
      const db = await getDatabase();

      const existing = await this.getById(id);
      if (!existing) {
        throw AppError.persistence(ErrorCode.PERSISTENCE_NOT_FOUND, `Card not found: ${id}`);
      }

      const now = new Date().toISOString();

      await db.execAsync('BEGIN TRANSACTION');

      try {
        // Archive the card, storing its current stack position
        await db.runAsync(
          `UPDATE cards SET is_archived = 1, archived_at = ?, previous_stack_position = ?, stack_position = -1, updated_at = ? WHERE id = ?`,
          [now, existing.stackPosition, now, id]
        );

        // Reindex remaining active cards (exclude library cards with stack_position = -1)
        await db.runAsync(
          `UPDATE cards SET stack_position = (
            SELECT COUNT(*) FROM cards c2 
            WHERE c2.is_archived = 0 AND c2.stack_position >= 0 AND c2.stack_position < cards.stack_position
          ) WHERE is_archived = 0 AND stack_position >= 0`
        );

        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to archive card',
          error instanceof Error ? error : undefined
        );
      }

      // Disable the card's reminders AFTER the card transaction (never inside it):
      // disableForCard cancels the scheduled OS notifications AND marks the reminder
      // inactive, while keeping the row so restore can re-arm it. Notification I/O is
      // async and must not sit inside an open SQLite transaction. Best-effort: the
      // card is already archived; a notification-cancel hiccup shouldn't fail archive.
      try {
        // Lazy require so cardService's static import graph doesn't pull in
        // reminderService → expo-notifications for every consumer (keeps store/unit
        // tests that import cardService free of the native notifications module).
        const { createReminderService } = require('./reminderService');
        await createReminderService().disableForCard(id);
      } catch {
        // Non-fatal: launch reconciliation only reschedules active reminders, and
        // this reminder is being marked inactive; a stale OS notification (rare)
        // degrades gracefully (tapping it lands on the wallet, card not focused).
      }
    },

    /**
     * Restore an archived card to the active wallet.
     * Returns to previous_stack_position if valid, or top otherwise.
     */
    async restore(id: string): Promise<void> {
      const db = await getDatabase();

      const existing = await this.getById(id);
      if (!existing) {
        throw AppError.persistence(ErrorCode.PERSISTENCE_NOT_FOUND, `Card not found: ${id}`);
      }

      if (!existing.isArchived) {
        return; // Already active
      }

      const now = new Date().toISOString();

      // Count active cards to determine valid position range
      const countResult = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM cards WHERE is_archived = 0`
      );
      const activeCount = countResult?.count ?? 0;

      // Determine target position
      let targetPosition = 0; // Default to top
      if (
        existing.previousStackPosition !== null &&
        existing.previousStackPosition >= 0 &&
        existing.previousStackPosition <= activeCount
      ) {
        targetPosition = existing.previousStackPosition;
      }

      await db.execAsync('BEGIN TRANSACTION');

      try {
        // Shift cards at or after target position down
        await db.runAsync(
          `UPDATE cards SET stack_position = stack_position + 1 WHERE is_archived = 0 AND stack_position >= ?`,
          [targetPosition]
        );

        // Restore the card
        await db.runAsync(
          `UPDATE cards SET is_archived = 0, archived_at = NULL, previous_stack_position = NULL, stack_position = ?, updated_at = ? WHERE id = ?`,
          [targetPosition, now, id]
        );

        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to restore card',
          error instanceof Error ? error : undefined
        );
      }

      // Re-arm the card's preserved reminder AFTER the card transaction (never inside
      // it): reactivateForCard reschedules the OS notifications from the preserved
      // time/frequency and marks the reminder active again. No-op if the card had no
      // reminder. Notification I/O is async and must not sit inside a SQLite
      // transaction. Best-effort: the card is already restored either way.
      try {
        // Lazy require (see archive) to keep expo-notifications out of the static
        // import graph of cardService's consumers.
        const { createReminderService } = require('./reminderService');
        await createReminderService().reactivateForCard(id);
      } catch {
        // Non-fatal: if rescheduling fails, launch reconciliation will re-arm the
        // now-active reminder on next launch (it reschedules active reminders whose
        // OS notifications are missing).
      }
    },

    /**
     * Duplicate a card: deep-copy shell + controls, set title to
     * "[Original] - Copy", origin_badge to "my_tool", reset stats.
     */
    async duplicate(id: string): Promise<Card> {
      const db = await getDatabase();

      const existing = await this.getById(id);
      if (!existing) {
        throw AppError.persistence(ErrorCode.PERSISTENCE_NOT_FOUND, `Card not found: ${id}`);
      }

      const newCardId = Crypto.randomUUID();
      const now = new Date().toISOString();
      const newTitle =
        existing.title.length + 7 > 80
          ? `${existing.title.substring(0, 73)} - Copy`
          : `${existing.title} - Copy`;

      await db.execAsync('BEGIN TRANSACTION');

      try {
        // Shift existing cards down to make room at top
        await db.runAsync(
          `UPDATE cards SET stack_position = stack_position + 1 WHERE is_archived = 0 AND stack_position >= 0`
        );

        // Insert duplicated card at top of stack
        await db.runAsync(
          `INSERT INTO cards (id, title, description, icon_type, icon_value, background_type, background_value, category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at, is_archived, archived_at, previous_stack_position, allow_background_customization, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'my_tool', 0, 0, 0, NULL, 0, NULL, NULL, 0, ?, ?)`,
          [
            newCardId,
            newTitle,
            existing.description,
            existing.iconType,
            existing.iconValue,
            existing.backgroundType,
            existing.backgroundValue,
            existing.categoryId,
            now,
            now,
          ]
        );

        // Deep-copy controls
        for (const control of existing.controls) {
          const newControlId = Crypto.randomUUID();
          await db.runAsync(
            `INSERT INTO controls (id, card_id, type, position, config, is_required, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              newControlId,
              newCardId,
              control.type,
              control.position,
              JSON.stringify(control.config),
              control.isRequired ? 1 : 0,
              now,
            ]
          );
        }

        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to duplicate card',
          error instanceof Error ? error : undefined
        );
      }

      const duplicated = await this.getById(newCardId);
      if (!duplicated) {
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_READ_FAILED,
          'Failed to read duplicated card'
        );
      }

      // Copy background overlay from source card if present (Req 5.10)
      await copyOverlayToCard(id, newCardId);

      return duplicated;
    },

    /**
     * Permanently delete a card and all associated data.
     * Cascade-deletes controls, completions, control_values, and reminders.
     * Session_launcher cards cannot be permanently deleted (Req 4.6).
     */
    async delete(id: string): Promise<void> {
      const db = await getDatabase();

      const existing = await this.getById(id);
      if (!existing) {
        throw AppError.persistence(ErrorCode.PERSISTENCE_NOT_FOUND, `Card not found: ${id}`);
      }

      // Block permanent deletion of session_launcher cards
      const typeCheck = await db.getFirstAsync<{ card_type: string }>(
        'SELECT card_type FROM cards WHERE id = ?',
        [id]
      );
      if (typeCheck?.card_type === 'session_launcher') {
        throw AppError.validation(
          ErrorCode.VALIDATION_REQUIRED_FIELD,
          'Cannot permanently delete the session launcher card'
        );
      }

      await db.execAsync('BEGIN TRANSACTION');

      try {
        // Delete control_values linked to this card's completions
        await db.runAsync(
          `DELETE FROM control_values WHERE completion_id IN (SELECT id FROM completions WHERE card_id = ?)`,
          [id]
        );

        // Delete completions
        await db.runAsync(`DELETE FROM completions WHERE card_id = ?`, [id]);

        // Delete reminders
        await db.runAsync(`DELETE FROM reminders WHERE card_id = ?`, [id]);

        // Delete controls
        await db.runAsync(`DELETE FROM controls WHERE card_id = ?`, [id]);

        // Delete the card itself
        await db.runAsync(`DELETE FROM cards WHERE id = ?`, [id]);

        await db.execAsync('COMMIT');
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw AppError.persistence(
          ErrorCode.PERSISTENCE_WRITE_FAILED,
          'Failed to delete card',
          error instanceof Error ? error : undefined
        );
      }
    },

    validateShell,
    validateControls,
  };
}

/**
 * Assembles Card objects from JOIN query rows, grouping controls per card.
 */
function assembleCardsFromRows(rows: Record<string, unknown>[]): Card[] {
  const cardMap = new Map<string, Card>();

  for (const row of rows) {
    const cardId = row.id as string;

    if (!cardMap.has(cardId)) {
      const card: Card = {
        ...mapRowToCard(row),
        controls: [],
      };

      // Apply background overlay if present
      if (row.overlay_background_type && row.overlay_background_value) {
        card.backgroundType = row.overlay_background_type as Card['backgroundType'];
        card.backgroundValue = row.overlay_background_value as string;
      }

      cardMap.set(cardId, card);
    }

    // Add control if present (LEFT JOIN may yield null control_id)
    if (row.control_id) {
      const card = cardMap.get(cardId)!;
      card.controls.push(mapRowToControl(row));
    }
  }

  return Array.from(cardMap.values());
}
