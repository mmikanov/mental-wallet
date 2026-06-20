# Tasks

## Task 1: Add badges database migration and service

- [ ] Create migration adding badges table with card_id, badge_type, badge_name, earned_at
- [ ] Create `src/services/badgeService.ts` implementing evaluateBadges, getAllBadges, getBadgesForCard
- [ ] Award streak badges (7-day, 30-day), variety badges (5 categories, all categories), consistency badges (10 per card, 50 total, 100 total)
- [ ] Prevent duplicate badge awards (check if badge already exists before inserting)
- _Requirements: 1.1, 1.2, 1.3_

## Task 2: Implement badge display and sharing

- [ ] Integrate evaluateBadges call into CompletionStore after each successful completion
- [ ] Create `src/components/wallet/BadgeCelebration.tsx` (animated overlay for new badge)
- [ ] Update BadgeRow on FocusedCardView to display actual earned badges for that card
- [ ] Create `src/screens/AchievementsScreen.tsx` (all badges in a grid, accessible from wallet kebab)
- [ ] Implement "Share this achievement" using expo-sharing with pre-filled post text + #MentalHealthWallet
- [ ] Add navigation route for AchievementsScreen
- _Requirements: 1.4, 1.5, 1.6_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] }
  ]
}
```
