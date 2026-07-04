import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/data/database';
import type { AnalyticsEvent, QueuedEvent } from '@/types/analytics';

/**
 * Inserts an analytics event into the event queue with status 'pending'.
 * Serializes the event to JSON and generates a UUID for the queue record ID.
 */
export async function insertEvent(event: AnalyticsEvent): Promise<void> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const payload = JSON.stringify(event);
  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO analytics_event_queue (id, payload, created_at, status) VALUES (?, ?, ?, 'pending')`,
    [id, payload, createdAt]
  );
}

/**
 * Retrieves pending events ordered by created_at ascending, limited to the specified count.
 */
export async function getPendingEvents(limit: number): Promise<QueuedEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<QueuedEvent>(
    `SELECT id, payload, created_at, status FROM analytics_event_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
    [limit]
  );
}

/**
 * Marks the specified events as 'sending' status.
 */
export async function markAsSending(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE analytics_event_queue SET status = 'sending' WHERE id IN (${placeholders})`,
    ids
  );
}

/**
 * Marks the specified events back to 'pending' status (e.g., after transmission failure).
 */
export async function markAsPending(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE analytics_event_queue SET status = 'pending' WHERE id IN (${placeholders})`,
    ids
  );
}

/**
 * Deletes events by their IDs.
 */
export async function deleteEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `DELETE FROM analytics_event_queue WHERE id IN (${placeholders})`,
    ids
  );
}

/**
 * Deletes all records from the analytics event queue.
 */
export async function deleteAllEvents(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM analytics_event_queue`);
}

/**
 * Deletes pending behavioral events — events where event_type is NOT
 * 'app_opened' or 'session_ended'. Parses the JSON payload to check.
 */
export async function deleteBehavioralPendingEvents(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM analytics_event_queue WHERE status = 'pending' AND json_extract(payload, '$.event_type') NOT IN ('app_opened', 'session_ended')`
  );
}

/**
 * Resets all events with status 'sending' back to 'pending'.
 * Used on app launch to recover from crashes during transmission.
 */
export async function resetSendingToPending(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE analytics_event_queue SET status = 'pending' WHERE status = 'sending'`
  );
}

/**
 * Returns the total number of events in the queue (all statuses).
 */
export async function getQueueSize(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM analytics_event_queue`
  );
  return result?.count ?? 0;
}

/**
 * If the queue size is at or above maxSize, deletes the oldest pending event
 * to make room for a new one.
 */
export async function evictOldestIfFull(maxSize: number): Promise<void> {
  const size = await getQueueSize();
  if (size < maxSize) return;

  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM analytics_event_queue WHERE id = (SELECT id FROM analytics_event_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1)`
  );
}
