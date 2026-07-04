import { resolveAnonymousUserId, resetAnonymousUserId } from '../analyticsIdentity';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => VALID_UUID),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const mockedRandomUUID = Crypto.randomUUID as jest.MockedFunction<typeof Crypto.randomUUID>;
const mockedGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockedSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockedDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;

describe('analyticsIdentity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveAnonymousUserId', () => {
    describe('first-launch generation', () => {
      it('generates a UUID and persists it when no ID exists in SecureStore', async () => {
        mockedGetItemAsync.mockResolvedValue(null);
        mockedSetItemAsync.mockResolvedValue(undefined);

        const result = await resolveAnonymousUserId();

        expect(result).toBe(VALID_UUID);
        expect(mockedGetItemAsync).toHaveBeenCalledWith('anonymous_user_id');
        expect(mockedRandomUUID).toHaveBeenCalled();
        expect(mockedSetItemAsync).toHaveBeenCalledWith('anonymous_user_id', VALID_UUID);
      });
    });

    describe('existing ID retrieval', () => {
      it('returns the existing valid UUID without generating a new one', async () => {
        mockedGetItemAsync.mockResolvedValue(VALID_UUID_2);

        const result = await resolveAnonymousUserId();

        expect(result).toBe(VALID_UUID_2);
        expect(mockedRandomUUID).not.toHaveBeenCalled();
        expect(mockedSetItemAsync).not.toHaveBeenCalled();
      });

      it('generates a new ID if the stored value is not a valid UUID v4', async () => {
        mockedGetItemAsync.mockResolvedValue('not-a-valid-uuid');
        mockedSetItemAsync.mockResolvedValue(undefined);

        const result = await resolveAnonymousUserId();

        expect(result).toBe(VALID_UUID);
        expect(mockedRandomUUID).toHaveBeenCalled();
        expect(mockedSetItemAsync).toHaveBeenCalledWith('anonymous_user_id', VALID_UUID);
      });
    });

    describe('SecureStore failure recovery', () => {
      it('generates a new ID when getItemAsync throws', async () => {
        mockedGetItemAsync.mockRejectedValue(new Error('SecureStore read error'));
        mockedSetItemAsync.mockResolvedValue(undefined);

        const result = await resolveAnonymousUserId();

        expect(result).toBe(VALID_UUID);
        expect(mockedRandomUUID).toHaveBeenCalled();
        expect(mockedSetItemAsync).toHaveBeenCalledWith('anonymous_user_id', VALID_UUID);
      });

      it('still returns the generated ID when setItemAsync throws', async () => {
        mockedGetItemAsync.mockResolvedValue(null);
        mockedSetItemAsync.mockRejectedValue(new Error('SecureStore write error'));

        const result = await resolveAnonymousUserId();

        expect(result).toBe(VALID_UUID);
        expect(mockedRandomUUID).toHaveBeenCalled();
      });
    });

    describe('invalid UUID retry', () => {
      it('retries once if first generation produces invalid format', async () => {
        mockedGetItemAsync.mockResolvedValue(null);
        mockedSetItemAsync.mockResolvedValue(undefined);
        // First call returns invalid UUID, second returns valid
        mockedRandomUUID
          .mockReturnValueOnce('invalid-uuid' as any)
          .mockReturnValueOnce(VALID_UUID);

        const result = await resolveAnonymousUserId();

        expect(result).toBe(VALID_UUID);
        expect(mockedRandomUUID).toHaveBeenCalledTimes(2);
        expect(mockedSetItemAsync).toHaveBeenCalledWith('anonymous_user_id', VALID_UUID);
      });

      it('throws if both generation attempts produce invalid UUIDs', async () => {
        mockedGetItemAsync.mockResolvedValue(null);
        mockedRandomUUID
          .mockReturnValueOnce('bad-1' as any)
          .mockReturnValueOnce('bad-2' as any);

        await expect(resolveAnonymousUserId()).rejects.toThrow(
          'Failed to generate a valid UUID v4 for anonymous user ID after retry'
        );
      });

      it('retries once if randomUUID throws on first attempt', async () => {
        mockedGetItemAsync.mockResolvedValue(null);
        mockedSetItemAsync.mockResolvedValue(undefined);
        mockedRandomUUID
          .mockImplementationOnce(() => { throw new Error('crypto failure'); })
          .mockReturnValueOnce(VALID_UUID);

        const result = await resolveAnonymousUserId();

        expect(result).toBe(VALID_UUID);
        expect(mockedRandomUUID).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('resetAnonymousUserId', () => {
    it('deletes existing ID, generates a new one, and persists it', async () => {
      mockedDeleteItemAsync.mockResolvedValue(undefined);
      mockedSetItemAsync.mockResolvedValue(undefined);

      const result = await resetAnonymousUserId();

      expect(result).toBe(VALID_UUID);
      expect(mockedDeleteItemAsync).toHaveBeenCalledWith('anonymous_user_id');
      expect(mockedRandomUUID).toHaveBeenCalled();
      expect(mockedSetItemAsync).toHaveBeenCalledWith('anonymous_user_id', VALID_UUID);
    });

    it('proceeds with generation even if deletion fails', async () => {
      mockedDeleteItemAsync.mockRejectedValue(new Error('delete failed'));
      mockedSetItemAsync.mockResolvedValue(undefined);

      const result = await resetAnonymousUserId();

      expect(result).toBe(VALID_UUID);
      expect(mockedRandomUUID).toHaveBeenCalled();
      expect(mockedSetItemAsync).toHaveBeenCalledWith('anonymous_user_id', VALID_UUID);
    });

    it('returns the generated ID even if persist fails', async () => {
      mockedDeleteItemAsync.mockResolvedValue(undefined);
      mockedSetItemAsync.mockRejectedValue(new Error('persist failed'));

      const result = await resetAnonymousUserId();

      expect(result).toBe(VALID_UUID);
    });
  });
});
