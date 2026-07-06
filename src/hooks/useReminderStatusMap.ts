/**
 * useReminderStatusMap — Loads a map of card IDs that have active reminders.
 *
 * Executes a single query to avoid N+1 lookups when rendering the stacked
 * card list. Refreshes automatically when the screen regains focus (e.g.,
 * after the user returns from ReminderConfigScreen).
 *
 * Validates: Requirements 3.1, 3.6
 */

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getDatabase } from '@/data/database';

/**
 * Returns a Map<string, boolean> where each key is a card ID that has
 * at least one active reminder. Consumers check `map.has(cardId)` to
 * determine whether a reminder indicator should be shown.
 */
export function useReminderStatusMap(): Map<string, boolean> {
  const [statusMap, setStatusMap] = useState<Map<string, boolean>>(new Map());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadReminderStatus() {
        try {
          const db = await getDatabase();
          const rows = await db.getAllAsync<{ card_id: string }>(
            'SELECT card_id FROM reminders WHERE is_active = 1'
          );

          if (cancelled) return;

          const map = new Map<string, boolean>();
          for (const row of rows) {
            map.set(row.card_id, true);
          }
          setStatusMap(map);
        } catch {
          // Non-fatal — if query fails, indicators simply won't show
          if (!cancelled) {
            setStatusMap(new Map());
          }
        }
      }

      loadReminderStatus();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  return statusMap;
}
