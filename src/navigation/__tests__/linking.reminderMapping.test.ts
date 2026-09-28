/**
 * Regression test for the reminder-notification → deep-link URL MAPPING layer
 * (1.0.5-fixes, Bug 1b).
 *
 * This targets the layer the bug was actually in: turning a tapped notification's
 * `data` payload into `mentalwallet://wallet?focusCardId=<cardId>`. The existing
 * linking.test.ts covers route PARSING (getStateFromPath) and URL delivery
 * (getInitialURL/subscribe) — both were already green while this mapping was the
 * broken seam. Per the steering ("add a regression test that covers the layer the
 * bug was actually in, not just the layer that was already green"), this file
 * exercises `reminderNotificationDataToUrl` directly.
 *
 * Note on verification level: this proves the mapping layer at the UNIT level only.
 * It does NOT prove the on-device delivery path — whether the OS actually delivers
 * the notification response to the JS handler with `data` intact, cold and warm, on
 * a physical Android device. That is task 1.9 and can only be confirmed on-device.
 *
 * Validates: 1.0.5-fixes Requirement 3.3.
 */

// expo-notifications is imported by the linking module (for getInitialURL/subscribe);
// mock it so importing the module under test doesn't require native bindings.
jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

import { reminderNotificationDataToUrl } from '../linking';

describe('reminderNotificationDataToUrl — notification data → deep-link URL mapping', () => {
  describe('happy path', () => {
    it('maps a well-formed card_reminder payload to the focus URL', () => {
      expect(
        reminderNotificationDataToUrl({ type: 'card_reminder', cardId: 'abc-123' })
      ).toBe('mentalwallet://wallet?focusCardId=abc-123');
    });

    it('interpolates a UUID-form cardId as-is', () => {
      const cardId = '550e8400-e29b-41d4-a716-446655440000';
      expect(
        reminderNotificationDataToUrl({ type: 'card_reminder', cardId })
      ).toBe(`mentalwallet://wallet?focusCardId=${cardId}`);
    });

    // Documents CURRENT behavior: the helper interpolates cardId verbatim and does
    // NOT URL-encode it. If encoding is ever added, this assertion should change to
    // the encoded form. Per-install card ids are UUIDs in practice, so this is safe
    // today; the test captures the actual output rather than an idealized one.
    it('interpolates a cardId with special characters verbatim (no URL-encoding)', () => {
      expect(
        reminderNotificationDataToUrl({ type: 'card_reminder', cardId: 'a b&c=d' })
      ).toBe('mentalwallet://wallet?focusCardId=a b&c=d');
    });

    // A truthy non-string cardId (e.g. a legacy numeric id) is still interpolated
    // via template-string coercion — documents current behavior.
    it('coerces a truthy numeric cardId via string interpolation', () => {
      expect(
        reminderNotificationDataToUrl({ type: 'card_reminder', cardId: 42 })
      ).toBe('mentalwallet://wallet?focusCardId=42');
    });
  });

  describe('graceful degradation — returns null for malformed / absent data', () => {
    const cases: Array<[string, unknown]> = [
      ['undefined', undefined],
      ['null', null],
      ['empty object (no type)', {}],
      ['card_reminder with no cardId', { type: 'card_reminder' }],
      ['card_reminder with empty-string cardId', { type: 'card_reminder', cardId: '' }],
      ['card_reminder with null cardId', { type: 'card_reminder', cardId: null }],
      ['wrong type', { type: 'other', cardId: 'x' }],
      ['a string (non-object)', 'card_reminder'],
      ['a number (non-object)', 123],
      ['a boolean (non-object)', true],
    ];

    it.each(cases)('returns null for %s', (_label, input) => {
      expect(reminderNotificationDataToUrl(input)).toBeNull();
    });
  });

  describe('purity / side-effect-free', () => {
    it('never throws on malformed input', () => {
      const inputs: unknown[] = [
        undefined,
        null,
        {},
        { type: 'card_reminder' },
        { type: 'card_reminder', cardId: '' },
        { type: 'card_reminder', cardId: null },
        { type: 'other', cardId: 'x' },
        'card_reminder',
        123,
        true,
        [],
      ];
      for (const input of inputs) {
        expect(() => reminderNotificationDataToUrl(input)).not.toThrow();
      }
    });

    it('does not mutate the input payload', () => {
      const input = { type: 'card_reminder', cardId: 'abc-123' };
      const snapshot = { ...input };
      reminderNotificationDataToUrl(input);
      expect(input).toEqual(snapshot);
    });
  });
});
