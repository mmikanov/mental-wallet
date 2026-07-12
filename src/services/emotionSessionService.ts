import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/data/database';
import { AppError, ErrorCode } from '@/types/errors';
import type { ContextType, EmotionSessionRecord, EmotionType, TimeType } from '@/types/index';

/**
 * Maps a database row to an EmotionSessionRecord, parsing JSON fields.
 */
function mapRowToSession(row: Record<string, unknown>): EmotionSessionRecord {
  return {
    id: row.id as string,
    selectedEmotion: row.selected_emotion as EmotionType,
    selectedContexts: JSON.parse((row.selected_contexts as string) || '[]') as ContextType[],
    selectedTime: (row.selected_time as TimeType | null) ?? null,
    toolCardIds: JSON.parse((row.tool_card_ids as string) || '[]') as string[],
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? null,
    checkinId: (row.checkin_id as string | null) ?? null,
  };
}

/**
 * Creates a new emotion session, closing any unterminated sessions first.
 * Uses a transaction to ensure atomicity.
 *
 * Validates: Requirements 11.1, 11.7
 */
export async function create(emotion: EmotionType, checkinId?: string): Promise<EmotionSessionRecord> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // Close any unterminated sessions first (Req 11.7)
    await db.runAsync(
      `UPDATE emotion_sessions SET ended_at = ? WHERE ended_at IS NULL`,
      [now]
    );

    // Insert new session with optional checkin_id (Req 9.6)
    await db.runAsync(
      `INSERT INTO emotion_sessions (id, selected_emotion, selected_contexts, selected_time, tool_card_ids, started_at, ended_at, checkin_id)
       VALUES (?, ?, '[]', NULL, '[]', ?, NULL, ?)`,
      [id, emotion, now, checkinId ?? null]
    );
  });

  return {
    id,
    selectedEmotion: emotion,
    selectedContexts: [],
    selectedTime: null,
    toolCardIds: [],
    startedAt: now,
    endedAt: null,
    checkinId: checkinId ?? null,
  };
}

/**
 * Appends a tool card ID to the session's tool_card_ids JSON array.
 *
 * Validates: Requirements 11.2
 */
export async function addToolUsed(sessionId: string, cardId: string): Promise<void> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT tool_card_ids FROM emotion_sessions WHERE id = ?`,
    [sessionId]
  );

  if (!row) {
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_NOT_FOUND,
      `Emotion session not found: ${sessionId}`
    );
  }

  const toolCardIds: string[] = JSON.parse((row.tool_card_ids as string) || '[]');
  toolCardIds.push(cardId);

  await db.runAsync(
    `UPDATE emotion_sessions SET tool_card_ids = ? WHERE id = ?`,
    [JSON.stringify(toolCardIds), sessionId]
  );
}

/**
 * Ends an active session by setting the ended_at timestamp.
 * Handles gracefully if session is already ended or not found.
 *
 * Validates: Requirements 11.3
 */
export async function endSession(sessionId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE emotion_sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL`,
    [now, sessionId]
  );
}

/**
 * Closes any sessions with null ended_at.
 * Used on app launch to clean up stale sessions.
 *
 * Validates: Requirements 11.7
 */
export async function endUnterminatedSessions(): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE emotion_sessions SET ended_at = ? WHERE ended_at IS NULL`,
    [now]
  );
}

/**
 * Returns the currently active session (most recent with null ended_at),
 * or null if no active session exists.
 *
 * Validates: Requirements 11.4
 */
export async function getActive(): Promise<EmotionSessionRecord | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM emotion_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`
  );

  if (!row) {
    return null;
  }

  return mapRowToSession(row);
}

/**
 * Updates the selected contexts and time for a session.
 *
 * Validates: Requirements 11.5, 11.6
 */
export async function updateSelections(
  sessionId: string,
  contexts: ContextType[],
  time: TimeType | null
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE emotion_sessions SET selected_contexts = ?, selected_time = ? WHERE id = ?`,
    [JSON.stringify(contexts), time ?? null, sessionId]
  );
}

/**
 * Returns all completed emotion sessions ordered by start time descending.
 * Used for viewing session history.
 */
export async function getSessionHistory(): Promise<EmotionSessionRecord[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM emotion_sessions WHERE ended_at IS NOT NULL ORDER BY started_at DESC`
  );

  return rows.map(mapRowToSession);
}

/**
 * Returns a specific session by ID.
 */
export async function getSessionById(sessionId: string): Promise<EmotionSessionRecord | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM emotion_sessions WHERE id = ?`,
    [sessionId]
  );

  if (!row) return null;
  return mapRowToSession(row);
}
