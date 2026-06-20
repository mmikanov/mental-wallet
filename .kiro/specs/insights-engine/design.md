# Design Document

## Overview

A service (`insightsService.ts`) generates insights on-demand when the user opens the insights screen. Each insight type has a trigger condition and content template.

## Architecture

New service that queries completions, cards, and mood_logs to produce insight objects. A new screen displays them as a list.

## Components and Interfaces

### Insights Service

```typescript
interface InsightsService {
  getWeeklySummary(): Promise<Insight>;
  getStreakEncouragements(): Promise<Insight[]>;
  getToolEffectivenessInsights(period: TimePeriod): Promise<Insight[]>;
  getReengagementSuggestions(): Promise<Insight[]>;
}

interface Insight {
  id: string;
  type: 'weekly_summary' | 'streak_encouragement' | 'tool_effectiveness' | 're_engagement';
  title: string;
  body: string;
  cardId?: string;
  generatedAt: string;
}
```

### Insight Generation Rules

| Insight Type | Trigger | Content |
|---|---|---|
| Weekly Summary | Always (7 days) | "You used X tools and completed Y sessions this week" |
| Streak Encouragement | Streak reaches 3, 7, or 30 | "Amazing! Z days in a row with [Card Title]" |
| Tool Effectiveness | ≥3 before/after pairs | "[Card Title] improved your mood by +N points" |
| Re-engagement | Card unused ≥10 days, not archived, max 3 | "You haven't used [Card Title] in N days" |

## Data Models

No new tables. Insights are computed on-the-fly from existing data.

## Testing Strategy

- Unit test: weekly summary counts correctly for past 7 days
- Unit test: streak encouragement generated only at milestones 3, 7, 30
- Unit test: re-engagement limited to max 3 suggestions
- Unit test: tool effectiveness requires ≥3 pairs
