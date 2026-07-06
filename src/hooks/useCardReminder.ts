/**
 * useCardReminder — Fetches the active reminder for a single card.
 *
 * Uses ReminderService.getReminder() to load the current active reminder
 * and refreshes when the screen regains focus (e.g., after returning from
 * ReminderConfigScreen).
 *
 * Validates: Requirements 2.1, 2.2, 2.7
 */

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { createReminderService } from '@/services/reminderService';
import type { Reminder } from '@/types';

/**
 * Returns the active Reminder for the given card, or null if none exists.
 * Re-fetches on screen focus to stay current after reminder edits.
 */
export function useCardReminder(cardId: string): Reminder | null {
  const [reminder, setReminder] = useState<Reminder | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadReminder() {
        try {
          const reminderService = createReminderService();
          const result = await reminderService.getReminder(cardId);

          if (!cancelled) {
            setReminder(result);
          }
        } catch {
          // Non-fatal — if fetch fails, reminder row simply won't show
          if (!cancelled) {
            setReminder(null);
          }
        }
      }

      loadReminder();

      return () => {
        cancelled = true;
      };
    }, [cardId])
  );

  return reminder;
}
