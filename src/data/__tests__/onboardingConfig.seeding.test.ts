import { INTENT_OPTIONS, DEFAULT_STARTER_CARD_IDS } from '../onboardingConfig';

/**
 * Bug Condition Exploration Test — Redundant Seeding (Bug 4)
 *
 * **Validates: Requirements 1.7, 1.8**
 *
 * This test asserts the EXPECTED (fixed) behavior:
 * - "routine" intent does NOT include `lib-daily-mood` and DOES include `lib-gratitude-three`
 * - Default starter cards do NOT include `lib-daily-mood` and DO include `lib-box-breathing`
 *
 * On UNFIXED code, `lib-daily-mood` IS present in both — so this test FAILS,
 * confirming the bug exists.
 */
describe('Bug 4 Exploration: lib-daily-mood NOT in routine or default seed arrays', () => {
  const routineMapping = INTENT_OPTIONS.find((opt) => opt.intentId === 'routine');

  it('routine intent does NOT include lib-daily-mood', () => {
    expect(routineMapping).toBeDefined();
    expect(routineMapping!.cardIds).not.toContain('lib-daily-mood');
  });

  it('routine intent includes lib-gratitude-three', () => {
    expect(routineMapping).toBeDefined();
    expect(routineMapping!.cardIds).toContain('lib-gratitude-three');
  });

  it('DEFAULT_STARTER_CARD_IDS does NOT include lib-daily-mood', () => {
    expect(DEFAULT_STARTER_CARD_IDS).not.toContain('lib-daily-mood');
  });

  it('DEFAULT_STARTER_CARD_IDS includes lib-box-breathing', () => {
    expect(DEFAULT_STARTER_CARD_IDS).toContain('lib-box-breathing');
  });
});
