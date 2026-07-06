import type { Reminder } from '@/types';

/**
 * Day abbreviation map: 0-indexed (Sunday=0) to three-letter name.
 */
const DAY_ABBREVIATIONS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

/**
 * Calendar ordering weights: Monday-first (Mon=0 through Sun=6).
 * Maps from the 0-indexed Sunday-first day number to a sort weight.
 */
const CALENDAR_ORDER_WEIGHTS: Record<number, number> = {
  1: 0, // Monday
  2: 1, // Tuesday
  3: 2, // Wednesday
  4: 3, // Thursday
  5: 4, // Friday
  6: 5, // Saturday
  0: 6, // Sunday
};

/**
 * Formats reminder time + frequency into a display string.
 *
 * Examples:
 * - "09:00 · Daily"
 * - "09:00 · Mon, Wed, Fri"
 *
 * @param reminder - Active reminder with time and frequency
 * @returns Formatted display label
 */
export function formatReminderLabel(reminder: Reminder): string {
  const time = reminder.time;
  const frequencyLabel = formatFrequency(reminder);

  return `${time} · ${frequencyLabel}`;
}

function formatFrequency(reminder: Reminder): string {
  const { frequency } = reminder;

  if (frequency.type === 'daily') {
    return 'Daily';
  }

  // For '3x_week' and 'custom', format selected days in Mon–Sun calendar order
  const days = frequency.days ?? [];

  const sorted = [...days].sort(
    (a, b) => CALENDAR_ORDER_WEIGHTS[a] - CALENDAR_ORDER_WEIGHTS[b]
  );

  return sorted.map((day) => DAY_ABBREVIATIONS[day]).join(', ');
}
