import {
  hasLinkingConsent,
  grantLinkingConsent,
  declineLinkingConsent,
  getConsentPromptConfig,
} from '../analyticsAccountLinking';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const SESSION_UUID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const ACCOUNT_ID = 'account-abc-123';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'queue-event-id-1234'),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const mockRunAsync = jest.fn();
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(() => Promise.resolve({ runAsync: mockRunAsync })),
}));

jest.mock('@/stores/analyticsStore', () => ({
  useAnalyticsStore: {
    getState: jest.fn(() => ({ anonymousUserId: VALID_UUID })),
  },
}));

jest.mock('@/services/analyticsSession', () => ({
  getSessionState: jest.fn(() => ({
    sessionId: SESSION_UUID,
    sessionStartTime: '2025-01-15T10:00:00.000Z',
    backgroundEntryTime: null,
  })),
}));

import * as SecureStore from 'expo-secure-store';
import { useAnalyticsStore } from '@/stores/analyticsStore';

const mockedGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockedSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;

describe('analyticsAccountLinking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue(undefined);
  });

  describe('hasLinkingConsent', () => {
    it('returns true when consent was granted', async () => {
      mockedGetItemAsync.mockResolvedValue('granted');
      expect(await hasLinkingConsent()).toBe(true);
    });

    it('returns true when consent was declined', async () => {
      mockedGetItemAsync.mockResolvedValue('declined');
      expect(await hasLinkingConsent()).toBe(true);
    });

    it('returns false when no consent value exists', async () => {
      mockedGetItemAsync.mockResolvedValue(null);
      expect(await hasLinkingConsent()).toBe(false);
    });

    it('returns false when SecureStore throws', async () => {
      mockedGetItemAsync.mockRejectedValue(new Error('read error'));
      expect(await hasLinkingConsent()).toBe(false);
    });
  });

  describe('grantLinkingConsent', () => {
    it('persists granted consent to SecureStore', async () => {
      await grantLinkingConsent(ACCOUNT_ID);

      expect(mockedSetItemAsync).toHaveBeenCalledWith(
        'identity_link_consent',
        'granted'
      );
    });

    it('inserts identity_linked event into the queue', async () => {
      await grantLinkingConsent(ACCOUNT_ID);

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO analytics_event_queue'),
        expect.arrayContaining([
          'queue-event-id-1234',
          expect.stringContaining('"event_type":"identity_linked"'),
          expect.any(String),
        ])
      );
    });

    it('includes anonymous_user_id and account_id in event properties', async () => {
      await grantLinkingConsent(ACCOUNT_ID);

      const insertCall = mockRunAsync.mock.calls[0];
      const payload = JSON.parse(insertCall[1][1]);

      expect(payload.properties.anonymous_user_id).toBe(VALID_UUID);
      expect(payload.properties.account_id).toBe(ACCOUNT_ID);
      expect(payload.anonymous_user_id).toBe(VALID_UUID);
      expect(payload.session_id).toBe(SESSION_UUID);
      expect(payload.event_type).toBe('identity_linked');
    });

    it('does nothing if anonymousUserId is null', async () => {
      (useAnalyticsStore.getState as jest.Mock).mockReturnValueOnce({
        anonymousUserId: null,
      });

      await grantLinkingConsent(ACCOUNT_ID);

      expect(mockedSetItemAsync).not.toHaveBeenCalled();
      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('still inserts event if SecureStore persist fails', async () => {
      mockedSetItemAsync.mockRejectedValue(new Error('write error'));

      await grantLinkingConsent(ACCOUNT_ID);

      expect(mockRunAsync).toHaveBeenCalled();
    });

    it('does not throw if queue insert fails', async () => {
      mockRunAsync.mockRejectedValue(new Error('db error'));

      await expect(grantLinkingConsent(ACCOUNT_ID)).resolves.toBeUndefined();
    });
  });

  describe('declineLinkingConsent', () => {
    it('persists declined consent to SecureStore', async () => {
      await declineLinkingConsent();

      expect(mockedSetItemAsync).toHaveBeenCalledWith(
        'identity_link_consent',
        'declined'
      );
    });

    it('does not insert any event into the queue', async () => {
      await declineLinkingConsent();

      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('does not throw if SecureStore persist fails', async () => {
      mockedSetItemAsync.mockRejectedValue(new Error('write error'));

      await expect(declineLinkingConsent()).resolves.toBeUndefined();
    });
  });

  describe('getConsentPromptConfig', () => {
    it('returns prompt configuration with required elements', () => {
      const config = getConsentPromptConfig();

      expect(config.title).toBeDefined();
      expect(config.body).toBeDefined();
      expect(config.acceptLabel).toBeDefined();
      expect(config.declineLabel).toBeDefined();
    });

    it('includes statement that linking is optional', () => {
      const config = getConsentPromptConfig();
      expect(config.body.toLowerCase()).toContain('optional');
    });

    it('includes statement that declining does not affect functionality', () => {
      const config = getConsentPromptConfig();
      expect(config.body.toLowerCase()).toContain(
        'does not affect app functionality'
      );
    });

    it('prompt body does not exceed 80 words', () => {
      const config = getConsentPromptConfig();
      const totalWords = (config.title + ' ' + config.body).split(/\s+/).length;
      expect(totalWords).toBeLessThanOrEqual(80);
    });
  });
});
