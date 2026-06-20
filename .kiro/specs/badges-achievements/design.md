# Design Document

## Overview

A badge service evaluates badge criteria after each card completion. Badges are persisted in a new `badges` table and displayed on the FocusedCardView and a new AchievementsScreen.

## Architecture

New service (`badgeService.ts`) called by CompletionStore after each successful completion. A new database table stores earned badges. Badge evaluation is a pure function that checks thresholds against current card/wallet state.

## Components and Interfaces

### Badge Service

```typescript
interface BadgeService {
  evaluateBadges(card: Card, allCards: Card[], totalGlobalUses: number): Badge[];
  getAllBadges(): Promise<Badge[]>;
  getBadgesForCard(cardId: string): Promise<Badge[]>;
}
```

### Badge Evaluation Logic

```typescript
function evaluateBadges(card: Card, allCards: Card[], totalGlobalUses: number): Badge[] {
  const newBadges: Badge[] = [];
  if (card.currentStreak === 7) newBadges.push(createBadge(card.id, 'streak', '7-Day Streak'));
  if (card.currentStreak === 30) newBadges.push(createBadge(card.id, 'streak', '30-Day Streak'));
  if (card.totalUses === 10) newBadges.push(createBadge(card.id, 'consistency', '10 Uses'));
  if (totalGlobalUses === 50) newBadges.push(createBadge(null, 'consistency', '50 Total Uses'));
  if (totalGlobalUses === 100) newBadges.push(createBadge(null, 'consistency', '100 Total Uses'));
  const usedCategories = new Set(allCards.filter(c => c.totalUses > 0).map(c => c.categoryId));
  if (usedCategories.size === 5) newBadges.push(createBadge(null, 'variety', 'Tried 5 Different Tools'));
  return newBadges;
}
```

### UI Components

- `BadgeCelebration.tsx`: animated overlay shown when badge earned
- `BadgeRow.tsx` (existing): update to show actual earned badges on FocusedCardView
- `AchievementsScreen.tsx`: grid of all earned badges with tap-to-share

## Data Models

```sql
CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK(badge_type IN ('streak', 'variety', 'consistency')),
  badge_name TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_badges_card ON badges(card_id);
```

## Testing Strategy

- Unit test: `evaluateBadges` awards at exact thresholds (7, 30 streak; 10, 50, 100 uses; 5 categories)
- Unit test: no duplicate badges awarded for same threshold
- Unit test: sharing generates correct pre-filled text
