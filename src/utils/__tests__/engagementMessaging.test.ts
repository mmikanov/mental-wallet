/**
 * Unit tests for engagementMessaging pure function.
 * Tests specific examples and edge cases.
 *
 * Validates: Requirements 5.7
 */

import { generateEngagementMessage } from '../engagementMessaging';

describe('generateEngagementMessage', () => {
  describe('below_nascent tier', () => {
    it('returns simple count message', () => {
      const result = generateEngagementMessage('below_nascent', 4);
      expect(result.text).toBe("You've practiced 4 times this week");
      expect(result.tier).toBe('below_nascent');
    });

    it('handles zero sessions', () => {
      const result = generateEngagementMessage('below_nascent', 0);
      expect(result.text).toBe("You've practiced 0 times this week");
    });
  });

  describe('nascent tier', () => {
    it('returns simple count message', () => {
      const result = generateEngagementMessage('nascent', 3);
      expect(result.text).toBe("You've practiced 3 times this week");
      expect(result.tier).toBe('nascent');
    });

    it('handles zero sessions', () => {
      const result = generateEngagementMessage('nascent', 0);
      expect(result.text).toBe("You've practiced 0 times this week");
    });

    it('ignores previousWeekCount and rollingAverage', () => {
      const result = generateEngagementMessage('nascent', 5, 10, 8);
      expect(result.text).toBe("You've practiced 5 times this week");
    });
  });

  describe('preliminary tier', () => {
    it('shows positive comparison when this week > last week', () => {
      const result = generateEngagementMessage('preliminary', 6, 4);
      expect(result.text).toBe(
        "You've used your tools 6 times this week \u2014 that's more than last week"
      );
      expect(result.tier).toBe('preliminary');
    });

    it('shows neutral message when this week equals last week', () => {
      const result = generateEngagementMessage('preliminary', 3, 3);
      expect(result.text).toBe(
        '3 sessions this week so far \u2014 every bit counts'
      );
    });

    it('shows neutral message when this week < last week', () => {
      const result = generateEngagementMessage('preliminary', 2, 5);
      expect(result.text).toBe(
        '2 sessions this week so far \u2014 every bit counts'
      );
    });

    it('treats missing previousWeekCount as 0', () => {
      // 3 > 0, so positive comparison
      const result = generateEngagementMessage('preliminary', 3);
      expect(result.text).toBe(
        "You've used your tools 3 times this week \u2014 that's more than last week"
      );
    });

    it('treats missing previousWeekCount as 0 when current is also 0', () => {
      const result = generateEngagementMessage('preliminary', 0);
      expect(result.text).toBe(
        '0 sessions this week so far \u2014 every bit counts'
      );
    });
  });

  describe('confident tier', () => {
    it('shows positive reinforcement when current >= rolling average', () => {
      const result = generateEngagementMessage('confident', 5, undefined, 5);
      expect(result.text).toBe(
        "You've been more active this week \u2014 nice work."
      );
      expect(result.tier).toBe('confident');
    });

    it('shows positive reinforcement when current > rolling average', () => {
      const result = generateEngagementMessage('confident', 8, undefined, 4);
      expect(result.text).toBe(
        "You've been more active this week \u2014 nice work."
      );
    });

    it('shows quieter week message when 30%+ below rolling average', () => {
      // avg = 10, threshold = 10 * 0.7 = 7, current = 6 (below 7)
      const result = generateEngagementMessage('confident', 6, undefined, 10);
      expect(result.text).toBe(
        "Quieter week so far \u2014 that's okay too."
      );
    });

    it('shows neutral count when slightly below rolling average (not 30%+)', () => {
      // avg = 10, threshold = 10 * 0.7 = 7, current = 8 (above 7, below 10)
      const result = generateEngagementMessage('confident', 8, undefined, 10);
      expect(result.text).toBe("You've practiced 8 times this week");
    });

    it('treats missing rollingAverage as 0 — current >= 0 is always true', () => {
      const result = generateEngagementMessage('confident', 0);
      expect(result.text).toBe(
        "You've been more active this week \u2014 nice work."
      );
    });

    it('handles rollingAverage of 0 — current >= 0 shows positive', () => {
      const result = generateEngagementMessage('confident', 3, undefined, 0);
      expect(result.text).toBe(
        "You've been more active this week \u2014 nice work."
      );
    });

    it('shows quieter week at exactly 30% below boundary', () => {
      // avg = 10, 0.7 * 10 = 7, current = 6.9 → floors to 6, which is < 7
      const result = generateEngagementMessage('confident', 6, undefined, 10);
      expect(result.text).toBe(
        "Quieter week so far \u2014 that's okay too."
      );
    });

    it('shows neutral count at exactly the 70% boundary', () => {
      // avg = 10, 0.7 * 10 = 7, current = 7 (not < 7, but < 10)
      const result = generateEngagementMessage('confident', 7, undefined, 10);
      expect(result.text).toBe("You've practiced 7 times this week");
    });
  });

  describe('edge cases', () => {
    it('floors non-integer current week count', () => {
      const result = generateEngagementMessage('nascent', 3.7);
      expect(result.text).toBe("You've practiced 3 times this week");
    });

    it('clamps negative current week count to 0', () => {
      const result = generateEngagementMessage('nascent', -5);
      expect(result.text).toBe("You've practiced 0 times this week");
    });
  });
});
