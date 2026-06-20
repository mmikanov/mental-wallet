# Design Document

## Overview

A new screen (`AnalyticsDashboardScreen.tsx`) accessible from the wallet kebab menu. Queries existing data through aggregate SQL and the MoodService.

## Architecture

New Zustand store (`analyticsStore.ts`) manages the selected time period and cached stats. Queries use aggregate SQL (COUNT, AVG, GROUP BY with date filters) against existing completions and mood_logs tables.

## Components and Interfaces

### Analytics Store

```typescript
interface AnalyticsStore {
  selectedPeriod: TimePeriod;
  walletStats: WalletStats | null;
  setPeriod: (period: TimePeriod) => void;
  loadWalletStats: () => Promise<void>;
}

interface WalletStats {
  totalTools: number;
  totalCompletions: number;
  topTools: { cardId: string; title: string; count: number }[];
  unusedTools: { cardId: string; title: string; lastUsedAt: string }[];
}
```

### Analytics Engine

```typescript
interface AnalyticsEngine {
  getWalletStats(period: TimePeriod): Promise<WalletStats>;
  getMoodAnalytics(period: TimePeriod): Promise<MoodAnalytics>;
  getToolEffectivenessRanking(period: TimePeriod): Promise<ToolRanking[]>;
}
```

## Data Models

No new tables. Queries existing `cards`, `completions`, and `mood_logs` tables with aggregate SQL.

## Testing Strategy

- Unit test: wallet stats return correct counts for various time periods
- Unit test: top 3 tools sorted correctly by completion count
- Unit test: unused tools correctly identifies cards with no completions in 14 days
- Unit test: empty state rendered when zero completions
