// Feature: library-card-sync (Phase 1.1), Guard: check-in card does not leak into listing surfaces
//
// This is not a universally-quantified property but a required GUARD test locking
// the Req 6.4 invariant: bringing the built-in Daily Check-in card
// (`source_library_id = 'lib-personal-kpi'`) into the version-based update flow via
// the sync-path resolver (`resolveCuratedDefinition`) and `KPI_CARD_DEFINITION` must
// NOT leak it into any `CURATED_LIBRARY`-driven listing surface.
//
// The resolver (task 8.3) is used ONLY by `evaluateOutdated` + `updateFromLibrary`.
// Listing surfaces (`adminCardService.getMergedLibrary`, `recommendationService`)
// keep reading `CURATED_LIBRARY` directly, and `KPI_CARD_DEFINITION` deliberately
// lives OUTSIDE `CURATED_LIBRARY`. This test fails if a future change accidentally
// adds the check-in card to `CURATED_LIBRARY` or routes a listing through the resolver.
//
// **Validates: Requirements 6.4**

import { getRecommendations } from '../recommendationService';
import { getMergedLibrary } from '../adminCardService';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import { KPI_CARD_DEFINITION } from '@/data/kpiCardDefinition';
import type { EmotionType } from '@/types/index';

const KPI_ID = 'lib-personal-kpi';

// --- adminCardService harness ---
// getMergedLibrary reads: admin-lib-* cards, suppressed ids, static overrides, and
// the real CURATED_LIBRARY. Mock the DB to return NO admin cards / overrides /
// suppressions, so getMergedLibrary returns exactly the real static library. That
// makes the assertion meaningful: the only way lib-personal-kpi could appear is if
// it were (wrongly) added to CURATED_LIBRARY.
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(),
}));

// recommendationService wallet path uses emotionTagService; keep it empty so only
// the library path (driven by CURATED_LIBRARY) can produce results.
jest.mock('../emotionTagService', () => ({
  getCardIdsByEmotion: jest.fn(),
  getContextTags: jest.fn(),
  getTimeTags: jest.fn(),
}));

// validateIconType is imported by adminCardService via migrations.
jest.mock('@/data/migrations', () => ({
  validateIconType: jest.fn(() => true),
}));

import { getDatabase } from '@/data/database';
import { getCardIdsByEmotion, getContextTags, getTimeTags } from '../emotionTagService';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockGetCardIdsByEmotion = getCardIdsByEmotion as jest.MockedFunction<typeof getCardIdsByEmotion>;
const mockGetContextTags = getContextTags as jest.MockedFunction<typeof getContextTags>;
const mockGetTimeTags = getTimeTags as jest.MockedFunction<typeof getTimeTags>;

const ALL_EMOTIONS: EmotionType[] = ['stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb'];

describe('KPI check-in card does not leak into listing surfaces (Req 6.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // recommendationService wallet path returns nothing.
    mockGetCardIdsByEmotion.mockResolvedValue([]);
    mockGetContextTags.mockResolvedValue([]);
    mockGetTimeTags.mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({
      getFirstAsync: jest.fn().mockResolvedValue(null),
    } as any);
  });

  // ─── Static invariant ────────────────────────────────────────────────────
  // Locks that the check-in definition is NOT in CURATED_LIBRARY. Every listing
  // surface (Library Browser, recommendations, onboarding, export, correlation
  // engine) derives from CURATED_LIBRARY, so this single assertion is the root
  // guarantee that the card can't leak into any of them.

  it('CURATED_LIBRARY does not contain the check-in card', () => {
    expect(CURATED_LIBRARY.find((c) => c.id === KPI_ID)).toBeUndefined();
  });

  it('the check-in definition lives outside CURATED_LIBRARY but keeps the shared id', () => {
    // KPI_CARD_DEFINITION exists (the sync path can resolve it) yet is absent from
    // the listing array — exactly the split Req 6.4 requires.
    expect(KPI_CARD_DEFINITION.id).toBe(KPI_ID);
    expect(CURATED_LIBRARY).not.toContain(KPI_CARD_DEFINITION);
  });

  // ─── Library Browser listing (getMergedLibrary) ──────────────────────────

  it('getMergedLibrary output never contains the check-in card', async () => {
    // DB returns no admin cards, no overrides, no suppressions → merged output is
    // exactly the real static CURATED_LIBRARY.
    const db = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
      execAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockGetDatabase.mockResolvedValue(db as any);

    const merged = await getMergedLibrary();

    // No entry may carry the check-in id (as a card id or a source library id).
    for (const card of merged) {
      expect(card.id).not.toBe(KPI_ID);
      // CuratedCardDefinition has no sourceLibraryId field, but guard defensively
      // in case a future override shape carries one.
      expect((card as { sourceLibraryId?: string }).sourceLibraryId).not.toBe(KPI_ID);
    }
    expect(merged.some((c) => c.id === KPI_ID)).toBe(false);
  });

  // ─── Tool recommendations (recommendationService) ────────────────────────

  it('recommendationService library recommendations never include the check-in card across all emotions', async () => {
    // Run the real getRecommendations for every emotion (empty wallet so the library
    // section, derived from CURATED_LIBRARY, is exercised; and with all matching
    // cards in wallet so the fallback path — also CURATED_LIBRARY-derived — runs).
    for (const emotion of ALL_EMOTIONS) {
      // (a) library section path
      const libResult = await getRecommendations(emotion, [], null, []);
      for (const tool of libResult.libraryTools) {
        expect(tool.cardId).not.toBe(KPI_ID);
      }

      // (b) fallback path: place all emotion-matching library cards in wallet so
      // both sections would be empty and the fallback (CURATED_LIBRARY-derived) runs.
      const matchingIds = CURATED_LIBRARY
        .filter((c) => c.emotionTags?.includes(emotion))
        .map((c) => c.id);
      const fallbackResult = await getRecommendations(emotion, [], null, matchingIds, matchingIds);
      for (const tool of fallbackResult.libraryTools) {
        expect(tool.cardId).not.toBe(KPI_ID);
      }
    }
  });
});
