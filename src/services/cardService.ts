import * as Crypto from 'expo-crypto';
import { getDatabase } from '../data/database';
import { AppError, ErrorCode } from '../types/errors';
import type {
  Card,
  CardShell,
  Control,
  ControlConfig,
  LinkButtonConfig,
  OriginBadge,
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
          c.created_at, c.updated_at,
          ctrl.id AS control_id, ctrl.card_id AS control_card_id,
          ctrl.type AS control_type, ctrl.position AS control_position,
          ctrl.config AS control_config, ctrl.is_required AS control_is_required
        FROM cards c
        LEFT JOIN controls ctrl ON ctrl.card_id = c.id
        WHERE c.is_archived = 0
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
          c.created_at, c.updated_at,
          ctrl.id AS control_id, ctrl.card_id AS control_card_id,
          ctrl.type AS control_type, ctrl.position AS control_position,
          ctrl.config AS control_config, ctrl.is_required AS control_is_required
        FROM cards c
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
      categoryId?: string
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
          `UPDATE cards SET stack_position = stack_position + 1 WHERE is_archived = 0`
        );

        // Insert the card
        await db.runAsync(
          `INSERT INTO cards (id, title, description, icon_type, icon_value, background_type, background_value, category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at, is_archived, archived_at, previous_stack_position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, 0, NULL, NULL, ?, ?)`,
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
          params
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
     * Archive a card: set is_archived=1, store previous_stack_position,
     * and disable associated reminders.
     * Validates: Requirement 14.1
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

        // Disable associated reminders
        await db.runAsync(
          `UPDATE reminders SET is_active = 0 WHERE card_id = ?`,
          [id]
        );

        // Reindex remaining active cards
        await db.runAsync(
          `UPDATE cards SET stack_position = (
            SELECT COUNT(*) FROM cards c2 
            WHERE c2.is_archived = 0 AND c2.stack_position < cards.stack_position
          ) WHERE is_archived = 0`
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
          `UPDATE cards SET stack_position = stack_position + 1 WHERE is_archived = 0`
        );

        // Insert duplicated card at top of stack
        await db.runAsync(
          `INSERT INTO cards (id, title, description, icon_type, icon_value, background_type, background_value, category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at, is_archived, archived_at, previous_stack_position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'my_tool', 0, 0, 0, NULL, 0, NULL, NULL, ?, ?)`,
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
      return duplicated;
    },

    /**
     * Permanently delete a card and all associated data.
     * Cascade-deletes controls, completions, control_values, and reminders.
     */
    async delete(id: string): Promise<void> {
      const db = await getDatabase();

      const existing = await this.getById(id);
      if (!existing) {
        throw AppError.persistence(ErrorCode.PERSISTENCE_NOT_FOUND, `Card not found: ${id}`);
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
      cardMap.set(cardId, {
        ...mapRowToCard(row),
        controls: [],
      });
    }

    // Add control if present (LEFT JOIN may yield null control_id)
    if (row.control_id) {
      const card = cardMap.get(cardId)!;
      card.controls.push(mapRowToControl(row));
    }
  }

  return Array.from(cardMap.values());
}
