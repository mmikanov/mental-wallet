/**
 * Regression test — onboarding seeding persists the curated `version`
 * (library-card-sync).
 *
 * BUG: `onboardingService.seedStarterCards` called
 *   `cardService.create(shell, controls, 'library', categoryId, sourceLibraryId)`
 * WITHOUT the trailing `sourceLibraryVersion` argument, so `source_library_version`
 * was stored NULL for freshly-seeded starter cards. For a curated card carrying
 * `version: 1` (e.g. `lib-grounding-54321`), `evaluateOutdated` then saw
 * null < 1 → outdated → the "Update available" banner wrongly appeared on a
 * card that had JUST been seeded during onboarding.
 *
 * FIX: pass `curatedDef.version ?? null` as the 6th argument (mirrors
 * `LibraryBrowserScreen.handleAddToWallet`). This test captures the 6th arg of
 * every `create` call and asserts a versioned starter card is seeded at its
 * current version, and an unversioned one is seeded as null.
 *
 * Uses the REAL `CURATED_LIBRARY` (not mocked) so the real `version` values are
 * exercised, and the REAL `onboardingConfig` starter sets.
 *
 * Validates: Requirements 1.2 (persist current version at add-time)
 */

import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import { DEFAULT_STARTER_CARD_IDS, INTENT_OPTIONS, type IntentId } from '@/data/onboardingConfig';

// Capture every cardService.create call's arguments.
interface CreateCall {
  sourceLibraryId: string | undefined;
  sourceLibraryVersion: number | null | undefined;
}
const createCalls: CreateCall[] = [];

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'card-' + Math.random().toString(36).substring(2, 10)),
}));

jest.mock('@/data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
    execAsync: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@/services/cardService', () => ({
  createCardService: () => ({
    // Capture the 6th arg (sourceLibraryVersion) — the one the bug omitted.
    create: jest.fn().mockImplementation(
      async (
        _shell: unknown,
        _controls: unknown[],
        _originBadge: string,
        _categoryId: string | undefined,
        sourceLibraryId: string | undefined,
        sourceLibraryVersion: number | null | undefined
      ) => {
        createCalls.push({ sourceLibraryId, sourceLibraryVersion });
        return 'card-' + Math.random().toString(36).substring(2, 10);
      }
    ),
  }),
}));

jest.mock('@/services/kpiService', () => ({
  createKpiService: () => ({
    seedKpiCard: jest.fn().mockResolvedValue(undefined),
  }),
}));

// eslint-disable-next-line import/first
import { createOnboardingService } from '@/services/onboardingService';

/** A starter card id that is versioned in the real curated library. */
function findVersionedStarterId(cardIds: string[]): { id: string; version: number } | null {
  for (const id of cardIds) {
    const def = CURATED_LIBRARY.find((c) => c.id === id);
    if (def && typeof def.version === 'number') {
      return { id, version: def.version };
    }
  }
  return null;
}

/** A starter card id that is UNversioned in the real curated library. */
function findUnversionedStarterId(cardIds: string[]): string | null {
  for (const id of cardIds) {
    const def = CURATED_LIBRARY.find((c) => c.id === id);
    if (def && def.version == null) return id;
  }
  return null;
}

describe('onboardingService.seedStarterCards — persists curated version (regression)', () => {
  beforeEach(() => {
    createCalls.length = 0;
  });

  it('sanity: at least one default starter card is versioned and one is unversioned', () => {
    // Guards the test's premise against future config/library changes.
    expect(findVersionedStarterId(DEFAULT_STARTER_CARD_IDS)).not.toBeNull();
    expect(findUnversionedStarterId(DEFAULT_STARTER_CARD_IDS)).not.toBeNull();
  });

  it('seeds a versioned starter card at its current curated version (not null)', async () => {
    const versioned = findVersionedStarterId(DEFAULT_STARTER_CARD_IDS);
    expect(versioned).not.toBeNull();

    await createOnboardingService().seedStarterCards(null);

    const call = createCalls.find((c) => c.sourceLibraryId === versioned!.id);
    expect(call).toBeDefined();
    // The heart of the fix: the seeded copy carries the curated version, so
    // evaluateOutdated will NOT flag it outdated right after onboarding.
    expect(call!.sourceLibraryVersion).toBe(versioned!.version);
  });

  it('seeds an unversioned starter card with a null version', async () => {
    const unversionedId = findUnversionedStarterId(DEFAULT_STARTER_CARD_IDS);
    expect(unversionedId).not.toBeNull();

    await createOnboardingService().seedStarterCards(null);

    const call = createCalls.find((c) => c.sourceLibraryId === unversionedId);
    expect(call).toBeDefined();
    // `curatedDef.version ?? null` → null for unversioned cards.
    expect(call!.sourceLibraryVersion ?? null).toBeNull();
  });

  it('passes a defined 6th argument for every seeded card across all intents', async () => {
    const intents: (IntentId | null)[] = [null, ...INTENT_OPTIONS.map((o) => o.intentId)];
    for (const intentId of intents) {
      createCalls.length = 0;
      await createOnboardingService().seedStarterCards(intentId);
      // Every create call must have been given the version arg (number or null),
      // never left undefined (the bug left it undefined).
      for (const call of createCalls) {
        expect(call.sourceLibraryVersion !== undefined).toBe(true);
      }
    }
  });
});
