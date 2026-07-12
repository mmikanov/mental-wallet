import { CheckinRecord } from '@/types/checkin';
import { getDatabase } from '@/data/database';

/**
 * Persists a completed guided check-in record to the local SQLite database.
 * On failure, logs the error and allows the session to continue uninterrupted.
 * (Requirement 9.5: DB write failure must not block the user session.)
 */
export async function saveCheckinRecord(record: CheckinRecord): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO guided_checkin_records
        (id, body_energy, pleasantness, thought_pattern, context,
         derived_feeling, was_changed, final_emotion, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.bodyEnergy,
        record.pleasantness,
        record.thoughtPattern,
        record.context,
        record.derivedFeeling,
        record.wasChanged ? 1 : 0,
        record.finalEmotion,
        record.recordedAt,
      ]
    );
  } catch (error) {
    console.error('[checkinRecordService] Failed to save check-in record:', error);
    // Session continues — no error thrown to caller (Requirement 9.5)
  }
}

/**
 * Deletes all guided check-in records from the local database.
 * Provides a user-accessible option to clear their local check-in history.
 * (Requirement 6.2: user-accessible clear option.)
 */
export async function clearCheckinHistory(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM guided_checkin_records', []);
}
