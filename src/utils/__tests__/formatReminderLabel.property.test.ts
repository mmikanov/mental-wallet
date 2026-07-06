/**
 * Property-based tests for formatReminderLabel utility.
 *
 * Feature: card-ux-enhancements, Property 2: Reminder day abbreviations are in Monday-to-Sunday calendar order
 *
 * **Validates: Requirements 2.4, 2.5, 2.8**
 */

import * as fc from 'fast-check';
import { formatReminderLabel } from '../formatReminderLabel';
import type { Reminder } from '@/types';

/** The canonical Mon–Sun calendar order for day abbreviations */
const CALENDAR_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'test-reminder',
    cardId: 'test-card',
    type: 'per_card',
    time: '09:00',
    frequency: { type: 'daily' },
    isActive: true,
    notificationId: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Checks that `items` appear as a subsequence of `ordered`.
 * A subsequence means each item in `items` appears in `ordered`,
 * and their relative order matches `ordered`.
 */
function isSubsequenceOf(items: string[], ordered: string[]): boolean {
  let idx = 0;
  for (const item of items) {
    const found = ordered.indexOf(item, idx);
    if (found === -1) return false;
    idx = found + 1;
  }
  return true;
}

describe('formatReminderLabel - Property 2: Day ordering', () => {
  it('day abbreviations are in strict Monday-to-Sunday calendar order for any non-empty subset of days', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { minLength: 1 }),
        fc.constantFrom('3x_week' as const, 'custom' as const),
        (days, frequencyType) => {
          const reminder = makeReminder({
            frequency: { type: frequencyType, days },
          });

          const label = formatReminderLabel(reminder);

          // Extract the frequency part after " · "
          const parts = label.split(' · ');
          expect(parts.length).toBe(2);
          const frequencyPart = parts[1];

          // Parse the day abbreviations from the output
          const outputDays = frequencyPart.split(', ').map((d) => d.trim());

          // All output days must be valid abbreviations
          for (const day of outputDays) {
            expect(CALENDAR_ORDER).toContain(day);
          }

          // Output days must be a subsequence of the Mon–Sun calendar order
          expect(isSubsequenceOf(outputDays, CALENDAR_ORDER)).toBe(true);

          // Output should contain exactly the expected number of days
          expect(outputDays.length).toBe(days.length);
        }
      ),
      { numRuns: 150 }
    );
  });
});
