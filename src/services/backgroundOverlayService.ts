/**
 * BackgroundOverlayService — Manages per-user background personalizations
 * for Library and Community cards without modifying the original card data.
 *
 * Validates: Requirements 5.5, 5.6, 5.9, 5.10, 6.1–6.4
 */

import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/data/database';
import type { BackgroundOverlay, BackgroundType } from '@/types/index';

/**
 * Maps a database row to a BackgroundOverlay object.
 */
function mapRowToOverlay(row: Record<string, unknown>): BackgroundOverlay {
  return {
    id: row.id as string,
    cardId: row.card_id as string,
    backgroundType: row.background_type as BackgroundType,
    backgroundValue: row.background_value as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Get the background overlay for a specific card.
 */
export async function getOverlay(cardId: string): Promise<BackgroundOverlay | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM background_overlays WHERE card_id = ?`,
    [cardId]
  );
  if (!row) return null;
  return mapRowToOverlay(row);
}

/**
 * Get all background overlays (for batch loading on app start).
 */
export async function getAllOverlays(): Promise<BackgroundOverlay[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM background_overlays`
  );
  return rows.map(mapRowToOverlay);
}

/**
 * Create or update a background overlay for a card.
 * Uses INSERT OR REPLACE since card_id is UNIQUE.
 */
export async function upsertOverlay(
  cardId: string,
  backgroundType: BackgroundType,
  backgroundValue: string
): Promise<BackgroundOverlay> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Check if overlay already exists
  const existing = await getOverlay(cardId);

  if (existing) {
    await db.runAsync(
      `UPDATE background_overlays SET background_type = ?, background_value = ?, updated_at = ? WHERE card_id = ?`,
      [backgroundType, backgroundValue, now, cardId]
    );
    return {
      ...existing,
      backgroundType,
      backgroundValue,
      updatedAt: now,
    };
  }

  const id = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO background_overlays (id, card_id, background_type, background_value, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, cardId, backgroundType, backgroundValue, now, now]
  );

  return {
    id,
    cardId,
    backgroundType,
    backgroundValue,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Remove a background overlay (reset to original background).
 */
export async function removeOverlay(cardId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM background_overlays WHERE card_id = ?`,
    [cardId]
  );
}

/**
 * Copy an overlay from one card to another (used during card duplication).
 * The target card gets the overlay values as a direct copy.
 */
export async function copyOverlayToCard(
  sourceCardId: string,
  targetCardId: string
): Promise<void> {
  const sourceOverlay = await getOverlay(sourceCardId);
  if (!sourceOverlay) return;

  await upsertOverlay(
    targetCardId,
    sourceOverlay.backgroundType,
    sourceOverlay.backgroundValue
  );
}
