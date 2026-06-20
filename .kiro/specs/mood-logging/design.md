# Design Document

## Overview

Adds a mood logging system with database storage, a Zustand store for UI state, and a service layer for mood analytics. The mood slider is implemented as a dismissable overlay component reused across pre-use, post-use, and daily check-in contexts.

## Architecture

New service (`moodService.ts`) handles persistence and calculations. A new Zustand store (`moodStore.ts`) manages prompt visibility state. The mood_logs table stores all entries with card/completion associations.

## Components and Interfaces

### Mood Service

```typescript
interface MoodService {
  logMood(entry: MoodLogInput): Promise<MoodLog>;
  getMoodsByCard(cardId: string, period: TimePeriod): Promise<MoodLog[]>;
  getMoodsForPeriod(period: TimePeriod): Promise<MoodLog[]>;
  calculateTrend(logs: MoodLog[]): MoodTrend;
  calculateToolEffectiveness(cardId: string, period: TimePeriod): Promise<ToolEffectiveness | null>;
  hasDailyCheckIn(date: Date): Promise<boolean>;
}
```

### Mood Store

```typescript
interface MoodStore {
  showPreUseMood: boolean;
  showPostUseMood: boolean;
  showDailyCheckIn: boolean;
  submitMoodLog: (value: number, context: MoodContext, cardId?: string) => Promise<void>;
  dismissMoodPrompt: () => void;
}
```

### Mood Trend Calculation

```typescript
function calculateMoodTrend(logs: MoodLog[]): MoodTrend {
  if (logs.length < 3) return { trend: 'insufficient_data' };
  const sorted = [...logs].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
  const midpoint = Math.floor(sorted.length / 2);
  const earlierAvg = average(sorted.slice(0, midpoint).map(l => l.value));
  const recentAvg = average(sorted.slice(midpoint).map(l => l.value));
  const diff = recentAvg - earlierAvg;
  if (diff > 0.5) return { trend: 'improving', change: diff };
  if (diff < -0.5) return { trend: 'declining', change: diff };
  return { trend: 'stable', change: diff };
}
```

### Tool Effectiveness

```typescript
function calculateToolEffectiveness(cardId: string, moodLogs: MoodLog[]): ToolEffectiveness | null {
  const beforeLogs = moodLogs.filter(l => l.context === 'before_use' && l.cardId === cardId);
  const afterLogs = moodLogs.filter(l => l.context === 'after_use' && l.cardId === cardId);
  const pairs: { before: number; after: number }[] = [];
  for (const after of afterLogs) {
    const before = beforeLogs.find(b => b.completionId === after.completionId);
    if (before) pairs.push({ before: before.value, after: after.value });
  }
  if (pairs.length < 3) return null;
  return { cardId, avgMoodAfter: average(pairs.map(p => p.after)), avgImprovement: average(pairs.map(p => p.after)) - average(pairs.map(p => p.before)), sampleSize: pairs.length };
}
```

## Data Models

```sql
CREATE TABLE mood_logs (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  completion_id TEXT REFERENCES completions(id) ON DELETE SET NULL,
  value INTEGER NOT NULL CHECK(value >= 1 AND value <= 10),
  context TEXT NOT NULL CHECK(context IN ('before_use', 'after_use', 'standalone')),
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mood_logs_card ON mood_logs(card_id);
CREATE INDEX idx_mood_logs_date ON mood_logs(logged_at);
```

## Testing Strategy

- Unit test: `calculateMoodTrend` with <3 entries returns insufficient_data
- Unit test: trend calculation returns correct classification for edge cases around ±0.5
- Unit test: `calculateToolEffectiveness` returns null when <3 pairs
- Integration test: logMood persists and reads back correctly
