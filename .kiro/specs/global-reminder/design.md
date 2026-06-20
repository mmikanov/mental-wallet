# Design Document

## Overview

Extends the existing reminder/notification system with a global reminder type. The reminder is stored in the existing `reminders` table with `type='global'` and `card_id=NULL`. Card selection happens at notification trigger time.

## Architecture

Uses existing ReminderService and NotificationService. Adds a `setGlobalReminder` method to ReminderService and card selection logic.

## Components and Interfaces

### Card Selection Logic

```typescript
function selectReminderCard(cards: Card[]): Card {
  const activeCards = cards.filter(c => !c.isArchived);
  const sorted = activeCards.sort((a, b) => getUsesLast14Days(a) - getUsesLast14Days(b));
  const leastUsed = sorted.filter(c => getUsesLast14Days(c) === getUsesLast14Days(sorted[0]));
  return leastUsed[Math.floor(Math.random() * leastUsed.length)];
}
```

### Reminder Service Extension

```typescript
interface ReminderService {
  // ... existing methods
  setGlobalReminder(time: string): Promise<Reminder>;
  getLeastUsedCard(days: number): Promise<Card | null>;
}
```

## Data Models

No schema changes. Global reminders stored in existing `reminders` table with `type='global'`, `card_id=NULL`.

## Testing Strategy

- Unit test: `selectReminderCard` picks least-used card correctly
- Unit test: equal-usage cards produce random selection
- Unit test: notification tap navigates to correct card
