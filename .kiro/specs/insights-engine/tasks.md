# Tasks

## Task 1: Implement insights engine service

- [ ] Create `src/services/insightsService.ts` implementing getWeeklySummary, getStreakEncouragements, getToolEffectivenessInsights, getReengagementSuggestions
- [ ] Weekly summary: count distinct cards used + total completions for past 7 days
- [ ] Streak encouragement: find cards with currentStreak at milestones (3, 7, 30)
- [ ] Tool effectiveness: query MoodService for cards with ≥3 before/after pairs, format improvement value
- [ ] Re-engagement: find non-archived cards unused ≥10 days, limit to 3 results
- _Requirements: 1.2, 1.3, 1.4, 1.5_

## Task 2: Implement insights screen

- [ ] Create `src/screens/InsightsScreen.tsx` accessible from analytics dashboard
- [ ] Display generated insights as styled card-like list items
- [ ] Tap an insight with an associated cardId navigates to that card's focused view
- [ ] Add navigation route and link from AnalyticsDashboardScreen
- _Requirements: 1.1_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] }
  ]
}
```
