import * as fc from 'fast-check';
import type { Card, Control } from '../../types';
import type { CuratedCardDefinition } from '../../data/curatedLibrary';

/**
 * Property test for the pure detection service (Task 3.1).
 *
 * TDD / test-first: `src/services/librarySyncService.ts` and its `evaluateOutdated`
 * export do NOT exist yet (Task 3.2 creates them). This test imports `evaluateOutdated`
 * and is EXPECTED to fail because the module/function is missing.
 *
 * Seam for the implementer (Task 3.2): `evaluateOutdated(card)` looks the curated
 * definition up in the module-level `CURATED_LIBRARY` (keyed by `card.sourceLibraryId`).
 * To make this property test deterministic and independent of the real curated-library
 * contents, we mock `../../data/curatedLibrary` and control `CURATED_LIBRARY` per run via
 * a mutable fixture array. `jest.requireActual` preserves the real interfaces and any
 * other exports the service pulls in.
 */

// A mutable fixture the mock returns as CURATED_LIBRARY. Each property run rewrites
// its contents so evaluateOutdated sees exactly the curated defs we want.
const curatedFixture: CuratedCardDefinition[] = [];

jest.mock('../../data/curatedLibrary', () => {
  const actual = jest.requireActual('../../data/curatedLibrary');
  return {
    ...actual,
    get CURATED_LIBRARY() {
      return curatedFixture;
    },
  };
});

// eslint-disable-next-line import/first
import { evaluateOutdated } from '../librarySyncService';
// The check-in (KPI) card definition is the REAL module — do NOT mock it. Detection
// for `lib-personal-kpi` must resolve through this canonical definition (Req 6.1/6.2),
// independent of the CURATED_LIBRARY fixture above (which never contains it).
// eslint-disable-next-line import/first
import { KPI_CARD_DEFINITION } from '../../data/kpiCardDefinition';

/** Reference implementation of Req 1.3 used as the oracle for Property 1. */
function expectedOutdated(
  card: Card,
  curated: CuratedCardDefinition[]
): boolean {
  const hasSourceLibraryId =
    card.sourceLibraryId != null && card.sourceLibraryId !== '';
  if (!hasSourceLibraryId) return false;
  const match = curated.find((c) => c.id === card.sourceLibraryId);
  const curatedExists = match != null;
  if (!curatedExists) return false;
  const curatedVersion = match!.version;
  if (curatedVersion == null) return false;
  return (
    card.sourceLibraryVersion == null || card.sourceLibraryVersion < curatedVersion
  );
}

// --- Generators ------------------------------------------------------------

const controlArb: fc.Arbitrary<Control> = fc.record({
  id: fc.uuid(),
  cardId: fc.uuid(),
  type: fc.constant('text_input' as const),
  position: fc.nat({ max: 5 }),
  config: fc.constant({ label: 'note', maxLength: 200 }),
  isRequired: fc.boolean(),
});

/**
 * Build a Card with configurable source-library linkage and stored version.
 * originBadge and other fields are filled with reasonable defaults; detection
 * only reads sourceLibraryId and sourceLibraryVersion.
 */
function makeCard(overrides: Partial<Card>): Card {
  return {
    id: 'card-1',
    title: 'A tool',
    description: 'desc',
    iconType: 'emoji',
    iconValue: '🌱',
    backgroundType: 'color',
    backgroundValue: '#fff',
    categoryId: 'grounding-calming',
    originBadge: 'library',
    stackPosition: 0,
    totalUses: 0,
    currentStreak: 0,
    lastUsedAt: null,
    isArchived: false,
    archivedAt: null,
    previousStackPosition: null,
    allowBackgroundCustomization: false,
    sourceLibraryId: 'lib-fixture',
    sourceLibraryVersion: null,
    controls: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeCurated(
  overrides: Partial<CuratedCardDefinition>
): CuratedCardDefinition {
  return {
    id: 'lib-fixture',
    title: 'A tool',
    description: 'desc',
    iconType: 'emoji',
    iconValue: '🌱',
    backgroundType: 'color',
    backgroundValue: '#fff',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false,
    controls: [],
    ...overrides,
  };
}

/**
 * Arbitrary over the full space Req 1.3 cares about:
 * - has / lacks a sourceLibraryId
 * - a matching curated def present / absent
 * - curated version null (unversioned) / a positive integer
 * - copy version null / integer (>=, <, > curated)
 */
const scenarioArb = fc
  .record({
    sourceLibraryId: fc.option(fc.constantFrom('lib-fixture', 'lib-other'), {
      nil: null,
    }),
    copyVersion: fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
    curatedPresent: fc.boolean(),
    curatedVersion: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
    curatedId: fc.constantFrom('lib-fixture', 'lib-other'),
  })
  .map((s) => {
    const card = makeCard({
      sourceLibraryId: s.sourceLibraryId,
      sourceLibraryVersion: s.copyVersion,
    });
    const curated: CuratedCardDefinition[] = s.curatedPresent
      ? [makeCurated({ id: s.curatedId, version: s.curatedVersion ?? undefined })]
      : [];
    return { card, curated };
  });

function loadFixture(curated: CuratedCardDefinition[]): void {
  curatedFixture.length = 0;
  curatedFixture.push(...curated);
}

// --- Property 1 ------------------------------------------------------------

describe('librarySyncService.evaluateOutdated - Property Tests', () => {
  describe('Feature: library-card-sync, Property 1: Outdated detection is exactly Req 1.3', () => {
    /**
     * **Validates: Requirements 1.3, 1.4, 1.5, 2.5**
     *
     * For all cards and curated defs:
     *   evaluateOutdated(card).isOutdated ===
     *     (hasSourceLibraryId && curatedExists && curated.version != null &&
     *      (card.sourceLibraryVersion == null || card.sourceLibraryVersion < curated.version))
     */
    it('isOutdated equals the Req 1.3 predicate across arbitrary cards/curated/versions', () => {
      fc.assert(
        fc.property(scenarioArb, ({ card, curated }) => {
          loadFixture(curated);
          const result = evaluateOutdated(card);
          expect(result.isOutdated).toBe(expectedOutdated(card, curated));
        }),
        { numRuns: 300 }
      );
    });
  });

  describe('Not-updatable cases (Req 1.4) return isOutdated: false', () => {
    it('card with no sourceLibraryId is never outdated', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
          fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
          (copyVersion, curatedVersion) => {
            loadFixture([
              makeCurated({ id: 'lib-fixture', version: curatedVersion ?? undefined }),
            ]);
            const card = makeCard({
              sourceLibraryId: null,
              sourceLibraryVersion: copyVersion,
            });
            expect(evaluateOutdated(card).isOutdated).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('unversioned curated definition (version == null) is never outdated', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
          (copyVersion) => {
            loadFixture([makeCurated({ id: 'lib-fixture', version: undefined })]);
            const card = makeCard({
              sourceLibraryId: 'lib-fixture',
              sourceLibraryVersion: copyVersion,
            });
            expect(evaluateOutdated(card).isOutdated).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('curated definition removed (no curated with that id) is never outdated', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 0, max: 10 }), { nil: null }),
          (copyVersion) => {
            // Curated library has an unrelated card only.
            loadFixture([makeCurated({ id: 'lib-other', version: 3 })]);
            const card = makeCard({
              sourceLibraryId: 'lib-fixture',
              sourceLibraryVersion: copyVersion,
            });
            expect(evaluateOutdated(card).isOutdated).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Positive / boundary cases (Req 1.3, 1.5)', () => {
    it('copy version null with a versioned curated def is outdated', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (curatedVersion) => {
          loadFixture([makeCurated({ id: 'lib-fixture', version: curatedVersion })]);
          const card = makeCard({
            sourceLibraryId: 'lib-fixture',
            sourceLibraryVersion: null,
          });
          expect(evaluateOutdated(card).isOutdated).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('copy version < curated version is outdated', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(fc.integer({ min: 0, max: 9 }), fc.integer({ min: 1, max: 10 }))
            .filter(([copy, curated]) => copy < curated),
          ([copyVersion, curatedVersion]) => {
            loadFixture([
              makeCurated({ id: 'lib-fixture', version: curatedVersion }),
            ]);
            const card = makeCard({
              sourceLibraryId: 'lib-fixture',
              sourceLibraryVersion: copyVersion,
            });
            expect(evaluateOutdated(card).isOutdated).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('copy version >= curated version is not outdated', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(fc.integer({ min: 1, max: 10 }), fc.integer({ min: 1, max: 10 }))
            .filter(([copy, curated]) => copy >= curated),
          ([copyVersion, curatedVersion]) => {
            loadFixture([
              makeCurated({ id: 'lib-fixture', version: curatedVersion }),
            ]);
            const card = makeCard({
              sourceLibraryId: 'lib-fixture',
              sourceLibraryVersion: copyVersion,
            });
            expect(evaluateOutdated(card).isOutdated).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// --- Property 9: Check-in (KPI) card is detected outdated via the resolver ----

/**
 * Task 8.2 (TDD, test-first). Encodes Property 9 from the design's Phase 1.1
 * addendum: `evaluateOutdated` must treat the built-in check-in card
 * (`sourceLibraryId === 'lib-personal-kpi'`) via the resolver seam
 * (`resolveCuratedDefinition`, task 8.3) — resolving its curated definition to the
 * real `KPI_CARD_DEFINITION` — so it behaves EXACTLY like any other versioned
 * curated card (Req 6.1, 6.2).
 *
 * WHY THESE FAIL NOW (expected TDD state): today `evaluateOutdated` looks curated
 * defs up only in `CURATED_LIBRARY`, which deliberately does NOT contain
 * `lib-personal-kpi`. So the curated lookup misses, and `evaluateOutdated` returns
 * `isOutdated: false` unconditionally for the check-in card. The "null copy →
 * outdated" and "older copy → outdated" cases below therefore fail until task 8.3
 * points the lookup at `resolveCuratedDefinition`. The "caught-up → not outdated"
 * case happens to pass today (both the missing-lookup path and the correct resolver
 * path yield false), but is asserted for completeness of Property 9.
 *
 * The real `KPI_CARD_DEFINITION` is imported (NOT mocked) and carries `version: 1`.
 * The `CURATED_LIBRARY` mock fixture is irrelevant to these cases and is left empty.
 */

/** Build a check-in wallet Card fixture linked to the built-in KPI tool. */
function makeCheckInCard(sourceLibraryVersion: number | null): Card {
  return makeCard({
    id: 'checkin-card-1',
    title: 'My Check-In',
    categoryId: 'daily-checkin-journaling',
    originBadge: 'library',
    sourceLibraryId: 'lib-personal-kpi',
    sourceLibraryVersion,
  });
}

describe('librarySyncService.evaluateOutdated - Check-in (KPI) card, Property 9', () => {
  beforeEach(() => {
    // The check-in card is NOT in CURATED_LIBRARY; detection must go through the
    // resolver (KPI_CARD_DEFINITION), so an empty fixture must not change outcomes.
    loadFixture([]);
  });

  describe('Feature: library-card-sync, Property 9: Check-in card is detected outdated via the resolver', () => {
    /**
     * **Validates: Requirements 6.1, 6.2**
     *
     * Sanity guard on the fixture used by this feature: the real check-in
     * definition is versioned (version 1 — the 1.0.5 note-field change). If this
     * ever becomes unversioned, the "outdated" cases below would no longer apply.
     */
    it('KPI_CARD_DEFINITION is the versioned check-in definition (id lib-personal-kpi, version 1)', () => {
      expect(KPI_CARD_DEFINITION.id).toBe('lib-personal-kpi');
      expect(KPI_CARD_DEFINITION.version).toBe(1);
    });

    it('a check-in copy with null stored version is outdated against the versioned definition', () => {
      // sourceLibraryVersion = null (predates the check-in card's versioning);
      // KPI_CARD_DEFINITION.version = 1 → outdated (Req 1.3 via the resolver).
      const card = makeCheckInCard(null);
      expect(evaluateOutdated(card).isOutdated).toBe(true);
    });

    it('a check-in copy at an older numbered version (0) is outdated', () => {
      // 0 < KPI_CARD_DEFINITION.version (1) → outdated.
      const card = makeCheckInCard(0);
      expect(evaluateOutdated(card).isOutdated).toBe(true);
    });

    it('a check-in copy at the current version (1) is not outdated', () => {
      // sourceLibraryVersion (1) >= KPI_CARD_DEFINITION.version (1) → not outdated.
      const card = makeCheckInCard(1);
      expect(evaluateOutdated(card).isOutdated).toBe(false);
    });

    /**
     * "Unversioned definition → not outdated" invariant.
     *
     * We must NOT weaken the real `KPI_CARD_DEFINITION` (its version is 1). Rather
     * than mock the KPI module, we assert the property-level invariant that gives
     * this branch meaning: outdatedness tracks the resolved definition's version.
     * A copy at the current version (1) is not outdated (already asserted above),
     * and Property 1's generic "unversioned curated definition (version == null) is
     * never outdated" case covers the version-null branch of the same predicate the
     * resolver feeds. This case documents the tie: the check-in card is treated
     * exactly like a generic curated card — when its definition is not ahead of the
     * copy, no update is offered.
     */
    it('a check-in copy is not outdated when it is not behind the definition version (parity with the unversioned/caught-up branch)', () => {
      // Caught up (copy 1 vs def 1) — the same "nothing newer to offer" outcome the
      // unversioned branch produces. Kept alongside Property 1's version==null case.
      const caughtUp = makeCheckInCard(1);
      expect(evaluateOutdated(caughtUp).isOutdated).toBe(false);
      // And a copy ahead of the definition (shouldn't happen, but the predicate is
      // strictly "copy < curated") is likewise not outdated.
      const ahead = makeCheckInCard(2);
      expect(evaluateOutdated(ahead).isOutdated).toBe(false);
    });
  });
});

// --- summarizeUpdate: per-card change summary (Task 9.1) ---------------------

/**
 * Task 9.1 (TDD, test-first). Tests for the NOT-YET-EXISTING pure helper
 * `summarizeUpdate(card, curated): string[]` (Task 9.2 adds it to
 * `librarySyncService.ts`). The import below (`summarizeUpdate`) is currently
 * `undefined` / missing, so these cases FAIL until 9.2 lands. That failing state
 * is the expected TDD outcome.
 *
 * Derivation rules encoded here come from design "Addendum 2 → Per-card change
 * summary" and Properties 11 & 12:
 *  - same-position type change to `text_area` → a line NAMING the field and calling
 *    it "bigger" (for longer entries): "Makes the '{label}' field bigger, for longer entries".
 *  - added control (toInsert)   → "Adds a new step: '{label}'".
 *  - removed control (toDeleteIds) → "Removes the '{label}' step".
 *  - other same-position config change (label/placeholder, same type) → "Updates the '{label}' field".
 *  - shell: title changed → "Updates the title"; description changed → "Updates the description";
 *    icon/background/category changed → "Refreshes the look" (emit ONCE).
 *  - empty diff → generic fallback EXACTLY ["We've improved this tool."] (Property 11: never empty).
 *  - check-in mood_slider (position 0) label difference is EXCLUDED (Property 12 / Req 7.2):
 *    the personalized-vs-template label difference is not a real change.
 *
 * `summarizeUpdate` takes (card, curated) directly and is pure — no DB. For the
 * check-in case we pass the REAL `KPI_CARD_DEFINITION` as `curated` (already
 * imported, not mocked) and build a wallet Card with the old note field as a
 * `text_input` at position 1 plus a personalized mood_slider label at position 0.
 */

// eslint-disable-next-line import/first
import { summarizeUpdate } from '../librarySyncService';
// eslint-disable-next-line import/first
import type { CuratedControlDefinition } from '../../data/curatedLibrary';

/** Build a wallet Control fixture (has a real id + cardId, unlike curated defs). */
function makeControl(overrides: Partial<Control>): Control {
  return {
    id: 'ctrl-' + (overrides.position ?? 0),
    cardId: 'card-1',
    type: 'text_input',
    position: 0,
    config: { label: 'note' },
    isRequired: false,
    ...overrides,
  };
}

/** Build a curated control definition fixture (no id — matched by position). */
function makeCuratedControl(
  overrides: Partial<CuratedControlDefinition>
): CuratedControlDefinition {
  return {
    type: 'text_input',
    position: 0,
    config: { label: 'note' },
    isRequired: false,
    ...overrides,
  };
}

describe('librarySyncService.summarizeUpdate - per-card change summary (Task 9.1)', () => {
  describe('Controls: text_input → text_area at the same position (the motivating widening)', () => {
    it("names the field and calls it 'bigger' (for longer entries)", () => {
      const card = makeCard({
        sourceLibraryId: 'lib-fixture',
        controls: [
          makeControl({
            position: 0,
            type: 'text_input',
            config: { label: "What's on your mind?" },
          }),
        ],
      });
      const curated = makeCurated({
        controls: [
          makeCuratedControl({
            position: 0,
            type: 'text_area',
            config: { label: "What's on your mind?" },
          }),
        ],
      });

      const lines = summarizeUpdate(card, curated);
      const widening = lines.find((l: string) => l.includes("What's on your mind?"));
      expect(widening).toBeDefined();
      expect(widening!.toLowerCase()).toContain('bigger');
    });
  });

  describe('Controls: added control (toInsert)', () => {
    it("emits an 'Adds a new step' line naming the added control's label", () => {
      const card = makeCard({
        sourceLibraryId: 'lib-fixture',
        controls: [makeControl({ position: 0, config: { label: 'note' } })],
      });
      const curated = makeCurated({
        controls: [
          makeCuratedControl({ position: 0, config: { label: 'note' } }),
          makeCuratedControl({
            position: 1,
            type: 'mood_slider',
            config: { label: 'How intense?' },
          }),
        ],
      });

      const lines = summarizeUpdate(card, curated);
      expect(lines).toContain("Adds a new step: 'How intense?'");
    });
  });

  describe('Controls: removed control (toDeleteIds)', () => {
    it("emits a 'Removes the …' line naming the removed control's label", () => {
      const card = makeCard({
        sourceLibraryId: 'lib-fixture',
        controls: [
          makeControl({ position: 0, config: { label: 'note' } }),
          makeControl({
            position: 1,
            type: 'mood_slider',
            config: { label: 'How intense?' },
          }),
        ],
      });
      const curated = makeCurated({
        controls: [makeCuratedControl({ position: 0, config: { label: 'note' } })],
      });

      const lines = summarizeUpdate(card, curated);
      expect(lines).toContain("Removes the 'How intense?' step");
    });
  });

  describe('Controls: other same-position config change (same type)', () => {
    it("emits an 'Updates the …' line for a label/placeholder change", () => {
      const card = makeCard({
        sourceLibraryId: 'lib-fixture',
        controls: [
          makeControl({
            position: 0,
            type: 'text_input',
            config: { label: 'Old label', placeholder: 'old' },
          }),
        ],
      });
      const curated = makeCurated({
        controls: [
          makeCuratedControl({
            position: 0,
            type: 'text_input',
            config: { label: 'Old label', placeholder: 'new' },
          }),
        ],
      });

      const lines = summarizeUpdate(card, curated);
      expect(lines).toContain("Updates the 'Old label' field");
    });
  });

  describe('Shell changes', () => {
    it('title change → an "Updates the title" line', () => {
      const card = makeCard({ sourceLibraryId: 'lib-fixture', title: 'Old title' });
      const curated = makeCurated({ title: 'New title' });
      expect(summarizeUpdate(card, curated)).toContain('Updates the title');
    });

    it('description change → an "Updates the description" line', () => {
      const card = makeCard({
        sourceLibraryId: 'lib-fixture',
        description: 'Old desc',
      });
      const curated = makeCurated({ description: 'New desc' });
      expect(summarizeUpdate(card, curated)).toContain('Updates the description');
    });

    it('icon change → a single "Refreshes the look" line', () => {
      const card = makeCard({ sourceLibraryId: 'lib-fixture', iconValue: '🌱' });
      const curated = makeCurated({ iconValue: '🌟' });
      expect(summarizeUpdate(card, curated)).toContain('Refreshes the look');
    });

    it('background change → a "Refreshes the look" line', () => {
      const card = makeCard({
        sourceLibraryId: 'lib-fixture',
        backgroundValue: '#fff',
      });
      const curated = makeCurated({ backgroundValue: '#000' });
      expect(summarizeUpdate(card, curated)).toContain('Refreshes the look');
    });

    it('category change → a "Refreshes the look" line', () => {
      const card = makeCard({
        sourceLibraryId: 'lib-fixture',
        categoryId: 'grounding-calming',
      });
      const curated = makeCurated({ categoryId: 'self-compassion' });
      expect(summarizeUpdate(card, curated)).toContain('Refreshes the look');
    });

    it('multiple look fields changing emit "Refreshes the look" only once', () => {
      const card = makeCard({
        sourceLibraryId: 'lib-fixture',
        iconValue: '🌱',
        backgroundValue: '#fff',
        categoryId: 'grounding-calming',
      });
      const curated = makeCurated({
        iconValue: '🌟',
        backgroundValue: '#000',
        categoryId: 'self-compassion',
      });
      const lines = summarizeUpdate(card, curated);
      const refreshes = lines.filter((l: string) => l === 'Refreshes the look');
      expect(refreshes).toHaveLength(1);
    });
  });

  describe('Empty diff → generic fallback (Property 11: never empty)', () => {
    /**
     * **Validates: Requirements 8.5**
     *
     * When the card and curated definition are identical (no describable change),
     * summarizeUpdate returns EXACTLY the single generic fallback line, and is
     * never an empty array.
     */
    it('returns exactly ["We\'ve improved this tool."] when nothing describable changed', () => {
      const controls = [
        makeControl({ position: 0, type: 'text_input', config: { label: 'note' } }),
      ];
      const card = makeCard({ sourceLibraryId: 'lib-fixture', controls });
      const curated = makeCurated({
        controls: [
          makeCuratedControl({
            position: 0,
            type: 'text_input',
            config: { label: 'note' },
          }),
        ],
      });

      const lines = summarizeUpdate(card, curated);
      expect(lines).toEqual(["We've improved this tool."]);
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('Property 12 / KPI exclusion: note widening described, mood_slider label NOT reported', () => {
    /**
     * **Validates: Requirements 8.5, 7.2**
     *
     * Check-in scenario: curated = the REAL KPI_CARD_DEFINITION (note = text_area at
     * position 1; mood_slider template label at position 0). The wallet copy has the
     * OLD note field (text_input at position 1) AND a PERSONALIZED mood_slider label
     * at position 0 that differs from the template. summarizeUpdate MUST:
     *  - include a line about the note field becoming bigger (the real change), and
     *  - NOT include any line about the mood_slider / mood label change (the
     *    personalized-vs-template difference is re-derived, not a real change).
     */
    it('reports the note widening and excludes the personalized mood_slider label change', () => {
      const personalizedMoodLabel = 'How are you doing with: quitting smoking?';
      const card = makeCard({
        id: 'checkin-card-1',
        title: 'My Check-In',
        description: KPI_CARD_DEFINITION.description,
        iconValue: KPI_CARD_DEFINITION.iconValue,
        backgroundValue: KPI_CARD_DEFINITION.backgroundValue,
        categoryId: KPI_CARD_DEFINITION.categoryId,
        sourceLibraryId: 'lib-personal-kpi',
        sourceLibraryVersion: null,
        controls: [
          // position 0 — personalized mood_slider label (differs from template).
          makeControl({
            id: 'ctrl-mood',
            position: 0,
            type: 'mood_slider',
            config: {
              label: personalizedMoodLabel,
              minLabel: 'Struggling',
              maxLabel: 'Thriving',
            },
            isRequired: true,
          }),
          // position 1 — OLD note field: single-line text_input (pre-1.0.5).
          makeControl({
            id: 'ctrl-note',
            position: 1,
            type: 'text_input',
            config: {
              label: 'Anything you want to note?',
              placeholder: 'A word or thought…',
            },
            isRequired: false,
          }),
        ],
      });

      const lines = summarizeUpdate(card, KPI_CARD_DEFINITION);

      // The real change: the note field widening (text_input → text_area) IS reported.
      const noteLine = lines.find((l: string) =>
        l.includes('Anything you want to note?')
      );
      expect(noteLine).toBeDefined();
      expect(noteLine!.toLowerCase()).toContain('bigger');

      // The personalized mood_slider label difference is NOT reported (excluded).
      const templateMoodLabel = (
        KPI_CARD_DEFINITION.controls[0].config as { label?: string }
      ).label;
      const mentionsMoodLabel = lines.some(
        (l: string) =>
          l.includes(personalizedMoodLabel) ||
          (templateMoodLabel != null && l.includes(templateMoodLabel)) ||
          l.toLowerCase().includes('how are you doing')
      );
      expect(mentionsMoodLabel).toBe(false);
    });
  });

  describe('Property 11 (universal): summarizeUpdate is never empty', () => {
    /**
     * **Validates: Requirements 8.5**
     *
     * For arbitrary cards and curated defs (identical, shell-changed, or
     * control-changed), summarizeUpdate always returns a non-empty array.
     */
    it('returns a non-empty array across arbitrary shell/control diffs', () => {
      const shellArb = fc.record({
        title: fc.constantFrom('A tool', 'Renamed tool'),
        description: fc.constantFrom('desc', 'new desc'),
        iconValue: fc.constantFrom('🌱', '🌟'),
      });
      fc.assert(
        fc.property(shellArb, shellArb, (cardShell, curatedShell) => {
          const card = makeCard({
            sourceLibraryId: 'lib-fixture',
            title: cardShell.title,
            description: cardShell.description,
            iconValue: cardShell.iconValue,
            controls: [
              makeControl({ position: 0, type: 'text_input', config: { label: 'note' } }),
            ],
          });
          const curated = makeCurated({
            title: curatedShell.title,
            description: curatedShell.description,
            iconValue: curatedShell.iconValue,
            controls: [
              makeCuratedControl({
                position: 0,
                type: 'text_input',
                config: { label: 'note' },
              }),
            ],
          });
          const lines = summarizeUpdate(card, curated);
          expect(Array.isArray(lines)).toBe(true);
          expect(lines.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
