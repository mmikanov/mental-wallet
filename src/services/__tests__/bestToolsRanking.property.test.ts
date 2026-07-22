import * as fc from 'fast-check';
import { BestToolEntry, InsightTier } from '../correlationEngine';

// Feature: usage-outcome-insights, Property 13: Best Tools ranking correctness
// Feature: usage-outcome-insights, Property 14: "Try Something Different" selection

// --- Pure logic helpers extracted from CorrelationEngine ---

/**
 * Pure logic for Best Tools ranking: filter, sort, and limit.
 * This mirrors the logic inside CorrelationEngine.getBestTools() without DB access.
 */
export function rankBestTools(
  entries: Array<{
    cardId: string;
    cardTitle: string;
    scoreDelta: number;
    avgDurationSec: number;
    usesInPeriod: number;
  }>,
  tier: 'preliminary' | 'confident'
): BestToolEntry[] {
  const minUses = tier === 'preliminary' ? 3 : 5;
  const limit = tier === 'preliminary' ? 3 : 5;
  const isHedged = tier === 'preliminary';

  // 1. Filter: exclude tools with fewer than minUses completed uses in the period
  let filtered = entries.filter((e) => e.usesInPeriod >= minUses);

  // 2. Filter: exclude tools with negative Score_Delta (< 0)
  filtered = filtered.filter((e) => e.scoreDelta >= 0);

  // 3. Sort by Score_Delta descending, with tiebreaker
  filtered.sort((a, b) => {
    // Primary: Score_Delta descending (rounded to 1 decimal)
    const aDelta = Math.round(a.scoreDelta * 10) / 10;
    const bDelta = Math.round(b.scoreDelta * 10) / 10;
    if (aDelta !== bDelta) {
      return bDelta - aDelta;
    }

    // Tiebreaker 1: Average Active_Duration descending
    if (a.avgDurationSec !== b.avgDurationSec) {
      return b.avgDurationSec - a.avgDurationSec;
    }

    // Tiebreaker 2: Tool title alphabetically ascending
    return a.cardTitle.localeCompare(b.cardTitle);
  });

  // 4. Limit results
  const limited = filtered.slice(0, limit);

  // 5. Map to BestToolEntry format
  return limited.map((e) => ({
    cardId: e.cardId,
    cardTitle: e.cardTitle,
    scoreDelta: e.scoreDelta,
    avgDurationSec: e.avgDurationSec,
    descriptorLabel: isHedged
      ? `Might be linked to +${e.scoreDelta.toFixed(1)} higher check-in days`
      : `Linked to +${e.scoreDelta.toFixed(1)} higher check-in days`,
    isHedged,
  }));
}

// --- Types for "Try Something Different" ---

export interface WalletTool {
  cardId: string;
  totalUses: number;
  lastUsedAt: string | null; // ISO 8601 or null if never used
  createdAt: string; // ISO 8601
  lastCompletionDate: string | null; // ISO 8601 or null if never completed
}

/**
 * Pure logic for "Try Something Different" selection.
 * Selects tools from the wallet that haven't been used (completed) in the last 7 days.
 */
export function selectTrySomethingDifferent(
  tools: WalletTool[],
  now: Date
): WalletTool[] {
  // Calculate the 7-day boundary
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);
  const boundary = sevenDaysAgo.toISOString();

  // 1. Filter: only tools with no completion in the last 7 days
  const candidates = tools.filter((tool) => {
    if (tool.lastCompletionDate === null) {
      // Never completed — qualifies
      return true;
    }
    // Qualifies if last completion is before the 7-day boundary
    return tool.lastCompletionDate < boundary;
  });

  // 2. If none found, return empty (section hidden)
  if (candidates.length === 0) {
    return [];
  }

  // 3. Sort by total_uses descending (most familiar first)
  candidates.sort((a, b) => {
    if (a.totalUses !== b.totalUses) {
      return b.totalUses - a.totalUses;
    }

    // Tiebreaker 1: most recently used (last_used_at DESC)
    // null last_used_at sorts last (less recently used)
    if (a.lastUsedAt !== b.lastUsedAt) {
      if (a.lastUsedAt === null && b.lastUsedAt === null) return 0;
      if (a.lastUsedAt === null) return 1;
      if (b.lastUsedAt === null) return -1;
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    }

    // Tiebreaker 2: most recently added (created_at DESC)
    return b.createdAt.localeCompare(a.createdAt);
  });

  // 4. Take top 2
  return candidates.slice(0, 2);
}

// --- Generators ---

const toolEntryArb = fc.record({
  cardId: fc.uuid(),
  cardTitle: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  scoreDelta: fc.double({ min: -3.0, max: 3.0, noNaN: true }),
  avgDurationSec: fc.integer({ min: 3, max: 7200 }),
  usesInPeriod: fc.integer({ min: 0, max: 100 }),
});

const walletToolArb = fc.record({
  cardId: fc.uuid(),
  totalUses: fc.integer({ min: 0, max: 200 }),
  lastUsedAt: fc.option(
    fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map((d) => d.toISOString()),
    { nil: null }
  ),
  createdAt: fc.date({ min: new Date('2023-01-01'), max: new Date('2025-12-31') }).map((d) => d.toISOString()),
  lastCompletionDate: fc.option(
    fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map((d) => d.toISOString()),
    { nil: null }
  ),
});

// --- Property 13: Best Tools ranking correctness ---

describe('Feature: usage-outcome-insights, Property 13: Best Tools ranking correctness', () => {
  /**
   * **Validates: Requirements 6.1, 6.4, 6.5, 6.6, 6.7**
   *
   * For any array of ToolCorrelationResults at a given tier (preliminary or confident):
   * 1. All tools with negative Score_Delta (< 0) must be excluded
   * 2. Results must be sorted by Score_Delta descending
   * 3. Tiebreaker: same Score_Delta (rounded to 1 decimal) -> avg duration descending -> title alphabetically ascending
   * 4. At preliminary: max 3 results; at confident: max 5 results
   * 5. All entries must have isHedged = true at preliminary, false at confident
   */

  it('excludes all tools with negative Score_Delta', () => {
    fc.assert(
      fc.property(
        fc.array(toolEntryArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom('preliminary' as const, 'confident' as const),
        (entries, tier) => {
          const result = rankBestTools(entries, tier);

          // No entry in result should have scoreDelta < 0
          for (const entry of result) {
            expect(entry.scoreDelta).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('excludes tools below per-card use threshold for the tier', () => {
    fc.assert(
      fc.property(
        fc.array(toolEntryArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom('preliminary' as const, 'confident' as const),
        (entries, tier) => {
          const result = rankBestTools(entries, tier);
          const minUses = tier === 'preliminary' ? 3 : 5;

          // All returned entries should come from entries that had enough uses
          for (const resultEntry of result) {
            const sourceEntry = entries.find((e) => e.cardId === resultEntry.cardId);
            expect(sourceEntry).toBeDefined();
            expect(sourceEntry!.usesInPeriod).toBeGreaterThanOrEqual(minUses);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('results are sorted by Score_Delta descending with correct tiebreakers', () => {
    fc.assert(
      fc.property(
        fc.array(toolEntryArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom('preliminary' as const, 'confident' as const),
        (entries, tier) => {
          const result = rankBestTools(entries, tier);

          for (let i = 0; i < result.length - 1; i++) {
            const curr = result[i];
            const next = result[i + 1];

            const currDelta = Math.round(curr.scoreDelta * 10) / 10;
            const nextDelta = Math.round(next.scoreDelta * 10) / 10;

            if (currDelta !== nextDelta) {
              // Primary sort: descending Score_Delta
              expect(currDelta).toBeGreaterThanOrEqual(nextDelta);
            } else if (curr.avgDurationSec !== next.avgDurationSec) {
              // Tiebreaker 1: descending avg duration
              expect(curr.avgDurationSec).toBeGreaterThanOrEqual(next.avgDurationSec);
            } else {
              // Tiebreaker 2: ascending title (alphabetical)
              expect(curr.cardTitle.localeCompare(next.cardTitle)).toBeLessThanOrEqual(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('respects maximum result count: preliminary = 3, confident = 5', () => {
    fc.assert(
      fc.property(
        fc.array(toolEntryArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom('preliminary' as const, 'confident' as const),
        (entries, tier) => {
          const result = rankBestTools(entries, tier);
          const maxLimit = tier === 'preliminary' ? 3 : 5;

          expect(result.length).toBeLessThanOrEqual(maxLimit);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all entries have isHedged = true at preliminary, false at confident', () => {
    fc.assert(
      fc.property(
        fc.array(toolEntryArb, { minLength: 1, maxLength: 30 }),
        fc.constantFrom('preliminary' as const, 'confident' as const),
        (entries, tier) => {
          const result = rankBestTools(entries, tier);

          for (const entry of result) {
            if (tier === 'preliminary') {
              expect(entry.isHedged).toBe(true);
            } else {
              expect(entry.isHedged).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result contains only entries that pass all filter criteria', () => {
    fc.assert(
      fc.property(
        fc.array(toolEntryArb, { minLength: 0, maxLength: 30 }),
        fc.constantFrom('preliminary' as const, 'confident' as const),
        (entries, tier) => {
          const result = rankBestTools(entries, tier);
          const minUses = tier === 'preliminary' ? 3 : 5;

          // The number of qualifying entries in source
          const qualifyingCount = entries.filter(
            (e) => e.scoreDelta >= 0 && e.usesInPeriod >= minUses
          ).length;

          const maxLimit = tier === 'preliminary' ? 3 : 5;
          const expectedLength = Math.min(qualifyingCount, maxLimit);

          expect(result.length).toBe(expectedLength);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 14: "Try Something Different" selection ---

describe('Feature: usage-outcome-insights, Property 14: "Try Something Different" selection', () => {
  /**
   * **Validates: Requirements 6.10**
   *
   * For any set of wallet tools with usage history:
   * 1. Only tools with no completion in the last 7 days are selected
   * 2. Selection prefers highest total_uses (most familiar first)
   * 3. Tiebreaker: most recently used (last_used_at DESC), then most recently added (created_at DESC)
   * 4. Maximum 2 results
   * 5. If all tools have been used within 7 days, result is empty
   */

  const nowArb = fc.date({ min: new Date('2025-01-15'), max: new Date('2025-06-30') });

  it('only selects tools with no completion in the last 7 days', () => {
    fc.assert(
      fc.property(
        fc.array(walletToolArb, { minLength: 0, maxLength: 20 }),
        nowArb,
        (tools, now) => {
          const result = selectTrySomethingDifferent(tools, now);

          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
          sevenDaysAgo.setUTCHours(0, 0, 0, 0);
          const boundary = sevenDaysAgo.toISOString();

          // Every selected tool must have no completion in the last 7 days
          for (const tool of result) {
            if (tool.lastCompletionDate !== null) {
              expect(tool.lastCompletionDate < boundary).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty when all tools have been used within the last 7 days', () => {
    fc.assert(
      fc.property(
        nowArb,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (now, cardIds) => {
          // Create tools that all have completion within the last 7 days
          const recentDate = new Date(now);
          recentDate.setUTCDate(recentDate.getUTCDate() - 3); // 3 days ago

          const tools: WalletTool[] = cardIds.map((id) => ({
            cardId: id,
            totalUses: 5,
            lastUsedAt: recentDate.toISOString(),
            createdAt: '2024-01-01T00:00:00.000Z',
            lastCompletionDate: recentDate.toISOString(),
          }));

          const result = selectTrySomethingDifferent(tools, now);
          expect(result).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns at most 2 results', () => {
    fc.assert(
      fc.property(
        fc.array(walletToolArb, { minLength: 0, maxLength: 20 }),
        nowArb,
        (tools, now) => {
          const result = selectTrySomethingDifferent(tools, now);
          expect(result.length).toBeLessThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sorts by total_uses descending with correct tiebreakers', () => {
    fc.assert(
      fc.property(
        fc.array(walletToolArb, { minLength: 0, maxLength: 20 }),
        nowArb,
        (tools, now) => {
          const result = selectTrySomethingDifferent(tools, now);

          for (let i = 0; i < result.length - 1; i++) {
            const curr = result[i];
            const next = result[i + 1];

            if (curr.totalUses !== next.totalUses) {
              // Primary sort: total_uses descending
              expect(curr.totalUses).toBeGreaterThanOrEqual(next.totalUses);
            } else if (curr.lastUsedAt !== next.lastUsedAt) {
              // Tiebreaker 1: most recently used (last_used_at DESC)
              // null values should sort last
              if (curr.lastUsedAt === null && next.lastUsedAt === null) {
                // both null, move to next tiebreaker — already fine
              } else if (curr.lastUsedAt === null) {
                // curr is null, next is not — curr should be after next
                // This shouldn't happen because we assert the sort is correct
                fail('null lastUsedAt should sort after non-null');
              } else if (next.lastUsedAt === null) {
                // curr has value, next is null — correct order
                // no assertion needed, this is correct
              } else {
                // Both have values — curr should be >= next (DESC)
                expect(curr.lastUsedAt.localeCompare(next.lastUsedAt)).toBeGreaterThanOrEqual(0);
              }
            } else {
              // Tiebreaker 2: most recently added (created_at DESC)
              expect(curr.createdAt.localeCompare(next.createdAt)).toBeGreaterThanOrEqual(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('selects the tools with highest total_uses among eligible ones', () => {
    fc.assert(
      fc.property(
        nowArb,
        (now) => {
          // Create a deterministic scenario with clear priority
          const oldDate = new Date(now);
          oldDate.setUTCDate(oldDate.getUTCDate() - 30);

          const tools: WalletTool[] = [
            {
              cardId: 'tool-low-use',
              totalUses: 2,
              lastUsedAt: oldDate.toISOString(),
              createdAt: '2024-01-01T00:00:00.000Z',
              lastCompletionDate: oldDate.toISOString(),
            },
            {
              cardId: 'tool-high-use',
              totalUses: 20,
              lastUsedAt: oldDate.toISOString(),
              createdAt: '2024-01-01T00:00:00.000Z',
              lastCompletionDate: oldDate.toISOString(),
            },
            {
              cardId: 'tool-mid-use',
              totalUses: 10,
              lastUsedAt: oldDate.toISOString(),
              createdAt: '2024-01-01T00:00:00.000Z',
              lastCompletionDate: oldDate.toISOString(),
            },
          ];

          const result = selectTrySomethingDifferent(tools, now);

          // Should pick the top 2 by total_uses: 20 and 10
          expect(result).toHaveLength(2);
          expect(result[0].cardId).toBe('tool-high-use');
          expect(result[1].cardId).toBe('tool-mid-use');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tools with null lastCompletionDate always qualify as unused', () => {
    fc.assert(
      fc.property(
        nowArb,
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        (now, cardIds) => {
          // All tools have null lastCompletionDate (never used)
          const tools: WalletTool[] = cardIds.map((id, idx) => ({
            cardId: id,
            totalUses: 0,
            lastUsedAt: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            lastCompletionDate: null,
          }));

          const result = selectTrySomethingDifferent(tools, now);

          // All qualify, so we get min(tools.length, 2)
          expect(result.length).toBe(Math.min(tools.length, 2));
        }
      ),
      { numRuns: 100 }
    );
  });
});
