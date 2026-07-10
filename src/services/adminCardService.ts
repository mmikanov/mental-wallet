/**
 * Admin Card Service — CRUD operations for admin library cards, static overrides,
 * and suppression management.
 *
 * Admin library cards live in the existing `cards` table distinguished by:
 * - ID prefix: `admin-lib-{uuid}`
 * - `origin_badge = 'library'`
 * - `stack_position = -1` (excluded from wallet stack)
 * - `allow_background_customization = 1`
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3, 7.6, 7.7
 */

import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/data/database';
import { validateIconType } from '@/data/migrations';
import { AppError, ErrorCode } from '@/types/errors';
import type {
  Card,
  CardShell,
  Control,
  ControlConfig,
  EmotionType,
  ContextType,
  TimeType,
} from '@/types/index';
import type { RationaleMetadata } from '@/types/rationale';
import { isValidApproach, isValidEvidenceLevel } from '@/utils/rationaleValidation';
import { CURATED_LIBRARY, type CuratedCardDefinition } from '@/data/curatedLibrary';

// ─── Helper: Map DB row to Card (without controls) ───────────────────────────

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
    originBadge: row.origin_badge as Card['originBadge'],
    stackPosition: row.stack_position as number,
    totalUses: row.total_uses as number,
    currentStreak: row.current_streak as number,
    lastUsedAt: (row.last_used_at as string) || null,
    isArchived: (row.is_archived as number) === 1,
    archivedAt: (row.archived_at as string) || null,
    previousStackPosition: (row.previous_stack_position as number) ?? null,
    allowBackgroundCustomization: (row.allow_background_customization as number) === 1,
    sourceLibraryId: (row.source_library_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Helper: Map DB row to Control ───────────────────────────────────────────

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

// ─── Helper: Assemble Card objects from JOIN rows ────────────────────────────

function assembleCardsFromRows(rows: Record<string, unknown>[]): Card[] {
  const cardMap = new Map<string, Card>();

  for (const row of rows) {
    const cardId = row.id as string;

    if (!cardMap.has(cardId)) {
      const card: Card = {
        ...mapRowToCard(row),
        controls: [],
      };
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

// ─── Admin Card Service ──────────────────────────────────────────────────────

/**
 * Create a new admin library card with the `admin-lib-{uuid}` ID convention.
 * Persists the card and its controls in a single transaction.
 * Optionally saves emotion, context, and time tags.
 * Optionally persists rationale metadata to the rationale DB columns.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 7.1, 7.2, 7.3, 8.1, 8.4
 */
export async function createLibraryCard(
  shell: CardShell,
  controls: Omit<Control, 'id' | 'cardId'>[],
  categoryId: string,
  emotionTags?: EmotionType[],
  contextTags?: ContextType[],
  timeTags?: TimeType[],
  rationale?: RationaleMetadata
): Promise<Card> {
  // Validate icon type at application layer
  if (!validateIconType(shell.iconType)) {
    throw AppError.validation(
      ErrorCode.VALIDATION_EMPTY_FIELD,
      `Invalid icon type: ${shell.iconType}`
    );
  }

  // Validate rationale fields if provided
  if (rationale) {
    if (!isValidApproach(rationale.approach)) {
      throw AppError.validation(
        ErrorCode.VALIDATION_EMPTY_FIELD,
        `Invalid rationale approach: ${rationale.approach}`,
        'approach'
      );
    }
    if (!isValidEvidenceLevel(rationale.evidenceLevel)) {
      throw AppError.validation(
        ErrorCode.VALIDATION_EMPTY_FIELD,
        `Invalid rationale evidence level: ${rationale.evidenceLevel}`,
        'evidenceLevel'
      );
    }
  }

  const db = await getDatabase();
  const cardId = `admin-lib-${Crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Insert the card with admin conventions
    await db.runAsync(
      `INSERT INTO cards (
        id, title, description, icon_type, icon_value,
        background_type, background_value, category_id,
        origin_badge, stack_position, total_uses, current_streak,
        last_used_at, is_archived, archived_at, previous_stack_position,
        allow_background_customization, source_library_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, 0, NULL, NULL, ?, NULL, ?, ?)`,
      [
        cardId,
        shell.title,
        shell.description,
        shell.iconType,
        shell.iconValue,
        shell.backgroundType,
        shell.backgroundValue,
        categoryId,
        'library',   // origin_badge
        -1,          // stack_position — excluded from wallet stack
        1,           // allow_background_customization
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

    // Insert emotion tags if provided
    if (emotionTags && emotionTags.length > 0) {
      for (const emotion of emotionTags) {
        const tagId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO emotion_tags (id, card_id, emotion) VALUES (?, ?, ?)`,
          [tagId, cardId, emotion]
        );
      }
    }

    // Insert context tags if provided
    if (contextTags && contextTags.length > 0) {
      for (const context of contextTags) {
        await db.runAsync(
          `INSERT INTO card_context_tags (card_id, context) VALUES (?, ?)`,
          [cardId, context]
        );
      }
    }

    // Insert time tags if provided
    if (timeTags && timeTags.length > 0) {
      for (const time of timeTags) {
        await db.runAsync(
          `INSERT INTO card_time_tags (card_id, time) VALUES (?, ?)`,
          [cardId, time]
        );
      }
    }

    // Persist rationale metadata if provided
    if (rationale) {
      await db.runAsync(
        `UPDATE cards SET
          rationale_approach = ?,
          rationale_in_a_nutshell = ?,
          rationale_how_it_works = ?,
          rationale_evidence_level = ?,
          rationale_research_summary = ?,
          rationale_learn_more_links = ?
        WHERE id = ?`,
        [
          rationale.approach,
          rationale.inANutshell,
          rationale.howItWorks,
          rationale.evidenceLevel,
          JSON.stringify(rationale.researchSummary),
          rationale.learnMoreLinks ? JSON.stringify(rationale.learnMoreLinks) : null,
          cardId,
        ]
      );
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_WRITE_FAILED,
      'Failed to create admin library card',
      error instanceof Error ? error : undefined
    );
  }

  // Read back the created card with controls
  const card = await getCardById(cardId);
  if (!card) {
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_READ_FAILED,
      'Failed to read created admin library card'
    );
  }
  return card;
}

/**
 * Get all admin library cards (admin-lib-* prefix, not archived).
 *
 * Validates: Requirements 7.2, 7.4
 */
export async function getAdminLibraryCards(): Promise<Card[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT
      c.id, c.title, c.description, c.icon_type, c.icon_value,
      c.background_type, c.background_value, c.category_id,
      c.origin_badge, c.stack_position, c.total_uses, c.current_streak,
      c.last_used_at, c.is_archived, c.archived_at, c.previous_stack_position,
      c.allow_background_customization, c.source_library_id,
      c.created_at, c.updated_at,
      ctrl.id AS control_id, ctrl.card_id AS control_card_id,
      ctrl.type AS control_type, ctrl.position AS control_position,
      ctrl.config AS control_config, ctrl.is_required AS control_is_required
    FROM cards c
    LEFT JOIN controls ctrl ON ctrl.card_id = c.id
    WHERE c.id LIKE 'admin-lib-%' AND c.stack_position = -1
    ORDER BY c.created_at DESC, ctrl.position ASC`
  );

  return assembleCardsFromRows(rows);
}

/**
 * Get all static overrides — cards with origin_badge='library',
 * stack_position=-1, whose ID does NOT start with 'admin-lib-'.
 * These are DB copies of static library cards that the admin has edited.
 *
 * Validates: Requirements 7.6
 */
export async function getStaticOverrides(): Promise<Card[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT
      c.id, c.title, c.description, c.icon_type, c.icon_value,
      c.background_type, c.background_value, c.category_id,
      c.origin_badge, c.stack_position, c.total_uses, c.current_streak,
      c.last_used_at, c.is_archived, c.archived_at, c.previous_stack_position,
      c.allow_background_customization, c.source_library_id,
      c.created_at, c.updated_at,
      ctrl.id AS control_id, ctrl.card_id AS control_card_id,
      ctrl.type AS control_type, ctrl.position AS control_position,
      ctrl.config AS control_config, ctrl.is_required AS control_is_required
    FROM cards c
    LEFT JOIN controls ctrl ON ctrl.card_id = c.id
    WHERE c.origin_badge = 'library'
      AND c.stack_position = -1
      AND c.id NOT LIKE 'admin-lib-%'
    ORDER BY c.created_at DESC, ctrl.position ASC`
  );

  return assembleCardsFromRows(rows);
}

/**
 * Get all suppressed static card IDs.
 *
 * Validates: Requirements 5.5, 7.7
 */
export async function getSuppressedIds(): Promise<string[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM suppressed_library_cards`
  );

  return rows.map((row) => row.id);
}

/**
 * Create a static override by cloning a CuratedCardDefinition into the DB
 * with the same ID. This makes the DB version take precedence over the
 * static version in the merged library.
 *
 * Validates: Requirements 4.3, 7.6
 */
export async function createStaticOverride(
  staticCard: CuratedCardDefinition
): Promise<Card> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Insert the card with the same ID as the static card
    await db.runAsync(
      `INSERT INTO cards (
        id, title, description, icon_type, icon_value,
        background_type, background_value, category_id,
        origin_badge, stack_position, total_uses, current_streak,
        last_used_at, is_archived, archived_at, previous_stack_position,
        allow_background_customization, source_library_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, 0, NULL, NULL, ?, NULL, ?, ?)`,
      [
        staticCard.id,
        staticCard.title,
        staticCard.description,
        staticCard.iconType,
        staticCard.iconValue,
        staticCard.backgroundType,
        staticCard.backgroundValue,
        staticCard.categoryId,
        'library',   // origin_badge
        -1,          // stack_position
        staticCard.allowBackgroundCustomization ? 1 : 0,
        now,
        now,
      ]
    );

    // Insert controls
    for (let i = 0; i < staticCard.controls.length; i++) {
      const control = staticCard.controls[i];
      const controlId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO controls (id, card_id, type, position, config, is_required, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          controlId,
          staticCard.id,
          control.type,
          control.position,
          JSON.stringify(control.config),
          control.isRequired ? 1 : 0,
          now,
        ]
      );
    }

    // Insert emotion tags if provided
    if (staticCard.emotionTags && staticCard.emotionTags.length > 0) {
      for (const emotion of staticCard.emotionTags) {
        const tagId = Crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO emotion_tags (id, card_id, emotion) VALUES (?, ?, ?)`,
          [tagId, staticCard.id, emotion]
        );
      }
    }

    // Insert context tags if provided
    if (staticCard.contextTags && staticCard.contextTags.length > 0) {
      for (const context of staticCard.contextTags) {
        await db.runAsync(
          `INSERT INTO card_context_tags (card_id, context) VALUES (?, ?)`,
          [staticCard.id, context]
        );
      }
    }

    // Insert time tags if provided
    if (staticCard.timeTags && staticCard.timeTags.length > 0) {
      for (const time of staticCard.timeTags) {
        await db.runAsync(
          `INSERT INTO card_time_tags (card_id, time) VALUES (?, ?)`,
          [staticCard.id, time]
        );
      }
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_WRITE_FAILED,
      'Failed to create static override',
      error instanceof Error ? error : undefined
    );
  }

  // Read back the created override with controls
  const card = await getCardById(staticCard.id);
  if (!card) {
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_READ_FAILED,
      'Failed to read created static override'
    );
  }
  return card;
}

/**
 * Delete an admin library card (admin-lib-* prefix).
 * Removes the card and all associated data (controls cascade via FK).
 *
 * Validates: Requirements 5.3
 */
export async function deleteAdminCard(id: string): Promise<void> {
  if (!id.startsWith('admin-lib-')) {
    throw AppError.validation(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `Cannot delete non-admin card via deleteAdminCard: ${id}`
    );
  }

  const db = await getDatabase();

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Delete associated tags
    await db.runAsync(`DELETE FROM emotion_tags WHERE card_id = ?`, [id]);
    await db.runAsync(`DELETE FROM card_context_tags WHERE card_id = ?`, [id]);
    await db.runAsync(`DELETE FROM card_time_tags WHERE card_id = ?`, [id]);

    // Delete controls (also cascades via FK, but explicit for clarity)
    await db.runAsync(`DELETE FROM controls WHERE card_id = ?`, [id]);

    // Delete the card
    await db.runAsync(`DELETE FROM cards WHERE id = ?`, [id]);

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_WRITE_FAILED,
      'Failed to delete admin card',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Delete a static override (restores the original static version).
 * Removes the DB copy so the original from CURATED_LIBRARY takes precedence again.
 *
 * Validates: Requirements 5.4
 */
export async function deleteStaticOverride(id: string): Promise<void> {
  if (id.startsWith('admin-lib-')) {
    throw AppError.validation(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `Cannot delete admin card via deleteStaticOverride: ${id}`
    );
  }

  const db = await getDatabase();

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Delete associated tags
    await db.runAsync(`DELETE FROM emotion_tags WHERE card_id = ?`, [id]);
    await db.runAsync(`DELETE FROM card_context_tags WHERE card_id = ?`, [id]);
    await db.runAsync(`DELETE FROM card_time_tags WHERE card_id = ?`, [id]);

    // Delete controls
    await db.runAsync(`DELETE FROM controls WHERE card_id = ?`, [id]);

    // Delete the override card
    await db.runAsync(`DELETE FROM cards WHERE id = ?`, [id]);

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_WRITE_FAILED,
      'Failed to delete static override',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Suppress a static card (hide it from the library without creating an override).
 * Inserts a record into `suppressed_library_cards`.
 *
 * Validates: Requirements 5.5, 7.7
 */
export async function suppressStaticCard(id: string): Promise<void> {
  const db = await getDatabase();

  try {
    await db.runAsync(
      `INSERT OR IGNORE INTO suppressed_library_cards (id) VALUES (?)`,
      [id]
    );
  } catch (error) {
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_WRITE_FAILED,
      'Failed to suppress static card',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Unsuppress a previously suppressed static card (restore its visibility).
 * Removes the record from `suppressed_library_cards`.
 *
 * Validates: Requirements 5.5
 */
export async function unsuppressStaticCard(id: string): Promise<void> {
  const db = await getDatabase();

  try {
    await db.runAsync(
      `DELETE FROM suppressed_library_cards WHERE id = ?`,
      [id]
    );
  } catch (error) {
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_WRITE_FAILED,
      'Failed to unsuppress static card',
      error instanceof Error ? error : undefined
    );
  }
}

// ─── Merge Logic ─────────────────────────────────────────────────────────────

/**
 * Map a DB Card object to CuratedCardDefinition format.
 * Used by getMergedLibrary to present DB-sourced cards uniformly alongside
 * static library entries.
 *
 * Validates: Requirements 3.1, 3.2
 */
export function cardToCuratedDefinition(card: Card): CuratedCardDefinition {
  // Look up the static original's rationale and tags (override rows don't store these)
  const staticOriginal = CURATED_LIBRARY.find((c) => c.id === card.id);

  return {
    id: card.id,
    title: card.title,
    description: card.description,
    iconType: card.iconType as 'emoji' | 'third_party',
    iconValue: card.iconValue,
    backgroundType: card.backgroundType as 'color' | 'image',
    backgroundValue: card.backgroundValue,
    categoryId: card.categoryId,
    allowBackgroundCustomization: card.allowBackgroundCustomization,
    controls: card.controls.map((ctrl) => ({
      type: ctrl.type,
      position: ctrl.position,
      config: ctrl.config,
      isRequired: ctrl.isRequired,
    })),
    emotionTags: staticOriginal?.emotionTags,
    contextTags: staticOriginal?.contextTags,
    timeTags: staticOriginal?.timeTags,
    rationale: staticOriginal?.rationale,
  };
}

/**
 * Check if a DB override matches its static original (no meaningful changes).
 * Used by getMergedLibrary for auto-cleanup of stale overrides after the admin
 * exports a card and pastes it into curatedLibrary.ts.
 */
function isOverrideMatchingStatic(override: Card, staticCard: CuratedCardDefinition): boolean {
  // Compare shell fields
  if (
    override.title !== staticCard.title ||
    override.description !== staticCard.description ||
    override.iconType !== staticCard.iconType ||
    override.iconValue !== staticCard.iconValue ||
    override.backgroundType !== staticCard.backgroundType ||
    override.backgroundValue !== staticCard.backgroundValue ||
    override.categoryId !== staticCard.categoryId
  ) {
    return false;
  }

  // Compare controls
  if (override.controls.length !== staticCard.controls.length) {
    return false;
  }

  for (let i = 0; i < override.controls.length; i++) {
    const dbCtrl = override.controls[i];
    const staticCtrl = staticCard.controls[i];
    if (
      dbCtrl.type !== staticCtrl.type ||
      dbCtrl.position !== staticCtrl.position ||
      dbCtrl.isRequired !== staticCtrl.isRequired ||
      JSON.stringify(dbCtrl.config) !== JSON.stringify(staticCtrl.config)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a card row has non-null rationale data persisted in DB.
 * Used by auto-cleanup to avoid deleting overrides that only differ in rationale.
 */
async function checkOverrideHasRationale(cardId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ rationale_approach: string | null }>(
    `SELECT rationale_approach FROM cards WHERE id = ?`,
    [cardId]
  );
  return !!row?.rationale_approach;
}

/**
 * Get the merged library combining all card sources:
 * 1. Query admin-lib-* cards from DB
 * 2. Query suppressed IDs
 * 3. Query static overrides from DB
 * 4. Read CURATED_LIBRARY static array
 * 5. Filter out suppressed static cards
 * 6. Replace static cards that have DB overrides (same ID) with override version
 * 7. Append admin-lib-* cards
 * 8. Return merged CuratedCardDefinition[]
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */
export async function getMergedLibrary(): Promise<CuratedCardDefinition[]> {
  // 1. Query admin-lib-* cards from DB
  const adminCards = await getAdminLibraryCards();

  // 2. Query suppressed IDs
  const suppressedIds = await getSuppressedIds();
  const suppressedSet = new Set(suppressedIds);

  // 3. Query static overrides from DB
  const staticOverrides = await getStaticOverrides();
  const overrideMap = new Map<string, Card>();
  for (const override of staticOverrides) {
    overrideMap.set(override.id, override);
  }

  // 3.5 Auto-cleanup disabled for overrides with rationale data.
  // Previously this would delete overrides matching their static originals,
  // but rationale-only edits are invisible to isOverrideMatchingStatic.
  // Overrides are now preserved until explicitly deleted by the admin.

  // 4. Read CURATED_LIBRARY static array
  // 5. Filter out suppressed static cards
  // 6. Replace static cards that have DB overrides (same ID) with override version
  const mergedStaticCards: CuratedCardDefinition[] = [];
  for (const staticCard of CURATED_LIBRARY) {
    // Skip suppressed cards
    if (suppressedSet.has(staticCard.id)) {
      continue;
    }

    // If there's a DB override, use the override version
    const override = overrideMap.get(staticCard.id);
    if (override) {
      mergedStaticCards.push(cardToCuratedDefinition(override));
    } else {
      mergedStaticCards.push(staticCard);
    }
  }

  // 7. Append admin-lib-* cards (mapped to CuratedCardDefinition format)
  const adminDefinitions = adminCards.map(cardToCuratedDefinition);

  // 8. Return merged array
  return [...mergedStaticCards, ...adminDefinitions];
}

// ─── Public Helper ───────────────────────────────────────────────────────────

/**
 * Get a single card by ID with its controls.
 * Used after create operations to read back the persisted card,
 * and by the CardCreatorScreen for admin edit mode.
 *
 * Validates: Requirements 4.2, 4.3
 */
export async function getCardById(id: string): Promise<Card | null> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT
      c.id, c.title, c.description, c.icon_type, c.icon_value,
      c.background_type, c.background_value, c.category_id,
      c.origin_badge, c.stack_position, c.total_uses, c.current_streak,
      c.last_used_at, c.is_archived, c.archived_at, c.previous_stack_position,
      c.allow_background_customization, c.source_library_id,
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
}
