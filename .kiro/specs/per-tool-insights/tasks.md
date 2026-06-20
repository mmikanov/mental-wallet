# Tasks

## Task 1: Implement per-tool insights screen

- [ ] Create `src/screens/ToolInsightsScreen.tsx` with cardId route param
- [ ] Display usage chart (completions per day/week for selected period)
- [ ] Display stats: current streak, total uses, last used date
- [ ] Display average mood after use when Mood_Log data exists
- [ ] Implement time period switcher (7d, 30d, year, all time)
- [ ] Display mood trend (improving/declining/stable) when ≥3 Mood_Log entries
- [ ] Show "more entries needed" message when <3 entries
- [ ] Add "View insights" to kebab menu for all cards
- [ ] Add navigation route to RootNavigator
- _Requirements: 1.1, 1.2, 1.3, 1.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] }
  ]
}
```
