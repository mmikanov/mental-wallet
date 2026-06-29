import * as fc from 'fast-check';
import { getStartMode, setStartMode } from '../settingsService';

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

const VALID_START_MODES = ['wallet', 'emotion', 'last_used'] as const;

/**
 * Creates an in-memory settings store and a mock database that operates on it.
 */
function createMockDbWithStore() {
  const store: Record<string, string> = {};

  const mockDb = {
    getFirstAsync: jest.fn(async (_sql: string, params: string[]) => {
      const key = params[0];
      if (key in store) {
        return { value: store[key] };
      }
      return null;
    }),
    runAsync: jest.fn(async (_sql: string, params: string[]) => {
      const key = params[0];
      const value = params[1];
      store[key] = value;
    }),
  };

  return { store, mockDb };
}

describe('settingsService - Property Tests', () => {
  describe('Feature: emotion-first-onboarding, Property 1: Invalid Start_Mode resolves to "wallet"', () => {
    /**
     * **Validates: Requirements 2.5**
     *
     * For any string value stored in the start_mode settings key that is NOT
     * one of the valid values ("wallet", "emotion", "last_used"), reading
     * start mode returns "wallet" and persists "wallet" (self-healing).
     */
    it('for any non-valid string, reading start mode returns "wallet" and self-heals', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter((s) => !VALID_START_MODES.includes(s as any)),
          async (invalidValue) => {
            const { store, mockDb } = createMockDbWithStore();
            mockGetDatabase.mockResolvedValue(mockDb as any);

            // Pre-populate store with the invalid value
            store['start_mode'] = invalidValue;

            const result = await getStartMode();

            // Should resolve to 'wallet'
            expect(result).toBe('wallet');

            // Should self-heal by persisting 'wallet'
            expect(store['start_mode']).toBe('wallet');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('when no value exists (null row), reading start mode returns "wallet"', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const { store, mockDb } = createMockDbWithStore();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          // Store has no 'start_mode' key — getFirstAsync returns null
          const result = await getStartMode();

          expect(result).toBe('wallet');
          expect(store['start_mode']).toBe('wallet');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 2: Start_Mode persistence round-trip', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For any valid StartMode value ("wallet", "emotion", "last_used"),
     * persisting it via setStartMode and then reading it back via getStartMode
     * returns the same value.
     */
    it('for any valid StartMode, write then read returns same value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('wallet', 'emotion', 'last_used'),
          async (validMode) => {
            const { mockDb } = createMockDbWithStore();
            mockGetDatabase.mockResolvedValue(mockDb as any);

            await setStartMode(validMode as any);
            const result = await getStartMode();

            expect(result).toBe(validMode);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
