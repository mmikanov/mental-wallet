import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/data/database';
import { AppError, ErrorCode } from '@/types/errors';
import type { EmotionTag, EmotionType, ContextType, TimeType, CardContextTag, CardTimeTag } from '@/types/index';

/**
 * Service for managing emotion, context, and time tag associations for cards.
 * Used by the recommendation engine and the card creator's emotion tagging UI.
 */

/**
 * Get all emotion tags for a given card.
 */
export async function getTagsForCard(cardId: string): Promise<EmotionTag[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; card_id: string; emotion: string }>(
    `SELECT id, card_id, emotion FROM emotion_tags WHERE card_id = ?`,
    [cardId]
  );
  return rows.map((row) => ({
    id: row.id,
    cardId: row.card_id,
    emotion: row.emotion as EmotionType,
  }));
}

/**
 * Get all card IDs that have a specific emotion tag.
 * Returns unique card IDs.
 */
export async function getCardIdsByEmotion(emotion: EmotionType): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ card_id: string }>(
    `SELECT DISTINCT card_id FROM emotion_tags WHERE emotion = ?`,
    [emotion]
  );
  return rows.map((row) => row.card_id);
}

/**
 * Set emotion tags for a card (upsert logic).
 * Validates that the emotions array has 1–6 entries.
 * Curated library cards should have 1–4 tags (enforced by seed validation),
 * but user-created cards may tag up to all 6 emotions.
 * Deletes existing tags and inserts new ones within a transaction.
 */
export async function setTagsForCard(cardId: string, emotions: EmotionType[]): Promise<void> {
  if (emotions.length < 1 || emotions.length > 6) {
    throw AppError.validation(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `Emotion tags must contain between 1 and 6 emotions, received ${emotions.length}`
    );
  }

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    // Delete existing emotion tags for this card
    await db.runAsync(`DELETE FROM emotion_tags WHERE card_id = ?`, [cardId]);

    // Insert new emotion tags
    for (const emotion of emotions) {
      const id = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO emotion_tags (id, card_id, emotion) VALUES (?, ?, ?)`,
        [id, cardId, emotion]
      );
    }
  });
}

/**
 * Clear all emotion tags for a card.
 * Used when a user deselects all emotions in edit mode.
 */
export async function clearTagsForCard(cardId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM emotion_tags WHERE card_id = ?`, [cardId]);
}

/**
 * Get all context tags for a given card.
 */
export async function getContextTags(cardId: string): Promise<ContextType[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ card_id: string; context: string }>(
    `SELECT card_id, context FROM card_context_tags WHERE card_id = ?`,
    [cardId]
  );
  return rows.map((row) => row.context as ContextType);
}

/**
 * Get all time tags for a given card.
 */
export async function getTimeTags(cardId: string): Promise<TimeType[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ card_id: string; time: string }>(
    `SELECT card_id, time FROM card_time_tags WHERE card_id = ?`,
    [cardId]
  );
  return rows.map((row) => row.time as TimeType);
}

/**
 * Set context tags for a card (upsert logic).
 * Validates that the contexts array has at most 4 entries.
 * Deletes existing context tags and inserts new ones within a transaction.
 */
export async function setContextTags(cardId: string, contexts: ContextType[]): Promise<void> {
  if (contexts.length > 4) {
    throw AppError.validation(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `Context tags must contain at most 4 contexts, received ${contexts.length}`
    );
  }

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    // Delete existing context tags for this card
    await db.runAsync(`DELETE FROM card_context_tags WHERE card_id = ?`, [cardId]);

    // Insert new context tags
    for (const context of contexts) {
      await db.runAsync(
        `INSERT INTO card_context_tags (card_id, context) VALUES (?, ?)`,
        [cardId, context]
      );
    }
  });
}

/**
 * Set time tags for a card (upsert logic).
 * Validates that the times array has at most 1 entry.
 * Deletes existing time tags and inserts new ones within a transaction.
 */
export async function setTimeTags(cardId: string, times: TimeType[]): Promise<void> {
  if (times.length > 1) {
    throw AppError.validation(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `Time tags must contain at most 1 time value, received ${times.length}`
    );
  }

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    // Delete existing time tags for this card
    await db.runAsync(`DELETE FROM card_time_tags WHERE card_id = ?`, [cardId]);

    // Insert new time tags
    for (const time of times) {
      await db.runAsync(
        `INSERT INTO card_time_tags (card_id, time) VALUES (?, ?)`,
        [cardId, time]
      );
    }
  });
}
