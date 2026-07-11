/**
 * Pure utility functions for KPI Days-Since Badge computation and display.
 */

/**
 * Computes the number of full calendar days between a UTC timestamp
 * and the current local date.
 *
 * Returns null if lastCheckInDateUtc is null (no records).
 * Returns 0 if the last check-in was today (local time).
 * Returns positive integer for past days.
 * Clamps to >= 0 to handle clock drift.
 */
export function computeDaysElapsed(
  lastCheckInDateUtc: string | null,
  now: Date = new Date()
): number | null {
  if (lastCheckInDateUtc === null) return null;

  // Convert UTC ISO string to local date (year, month, day only)
  const lastDate = new Date(lastCheckInDateUtc);
  const lastLocalDate = new Date(
    lastDate.getFullYear(),
    lastDate.getMonth(),
    lastDate.getDate()
  );

  // Current local date (strip time)
  const nowLocalDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  // Calendar day difference
  const diffMs = nowLocalDate.getTime() - lastLocalDate.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);

  return Math.max(0, diffDays);
}

/**
 * Formats the days-elapsed number for badge display.
 * Caps at "99+" for values > 99.
 */
export function formatBadgeText(daysElapsed: number): string {
  if (daysElapsed > 99) return '99+';
  return String(daysElapsed);
}

/**
 * Returns the font size for the badge number.
 * 12pt for single-digit, 10pt for multi-digit.
 */
export function getBadgeFontSize(daysElapsed: number): number {
  return daysElapsed < 10 ? 12 : 10;
}

/**
 * Computes badge width. Minimum 20pt diameter.
 * Single digit: 20pt circle.
 * Two digits: 22pt capsule.
 * "99+" (over 99): 28pt fixed capsule.
 */
export function getBadgeWidth(daysElapsed: number): number {
  if (daysElapsed < 10) return 20;
  if (daysElapsed > 99) return 28;
  return 22;
}

/**
 * Builds the FAB's accessibility label based on badge state.
 * Appends days count when daysElapsed >= 1, returns base label otherwise.
 */
export function getAccessibilityLabel(daysElapsed: number | null): string {
  const base = 'Check in on how you\'re doing';
  if (daysElapsed === null || daysElapsed === 0) return base;
  const dayWord = daysElapsed === 1 ? 'day' : 'days';
  return `${base}, ${daysElapsed} ${dayWord} since last check-in`;
}

/**
 * Generates the badge explanation message shown at the top of the focused
 * Daily Check-in card. Returns null when no message should be displayed.
 *
 * Uses singular "day" for 1, plural "days" for 2+.
 */
export function formatExplanationMessage(daysElapsed: number | null): string | null {
  if (daysElapsed === null || daysElapsed === 0) return null;
  const dayWord = daysElapsed === 1 ? 'day' : 'days';
  return `It's been ${daysElapsed} ${dayWord} since your last check-in`;
}

/**
 * Validates admin input for "create fake record" action.
 * Returns an error message string if invalid, or null if valid.
 *
 * Valid: positive integer (1 or greater).
 * Invalid: 0, negative, non-numeric, empty string, decimals.
 */
export function validateDaysAgoInput(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return 'Please enter a number of days';
  const num = Number(trimmed);
  if (isNaN(num)) return 'Please enter a valid number';
  if (!Number.isInteger(num)) return 'Please enter a whole number';
  if (num <= 0) return 'Must be at least 1 day';
  return null;
}

/**
 * Computes the recorded_at ISO timestamp for a fake KPI record,
 * set to the specified number of days before the reference date.
 */
export function computeFakeRecordTimestamp(
  daysAgo: number,
  now: Date = new Date()
): string {
  const target = new Date(now);
  target.setDate(target.getDate() - daysAgo);
  return target.toISOString();
}
