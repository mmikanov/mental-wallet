# Tasks

## Task 1: Implement analytics dashboard

- [ ] Create `src/stores/analyticsStore.ts` with selectedPeriod, walletStats, setPeriod, loadWalletStats
- [ ] Create `src/screens/AnalyticsDashboardScreen.tsx` accessible from wallet kebab menu
- [ ] Display stats: total tools in wallet, total completions for period, top 3 most-used tools, tools unused 14+ days
- [ ] Implement time period switcher (7d default, 30d, year, all time)
- [ ] Add mood analytics section (trend chart, tool effectiveness ranking) using MoodService
- [ ] Display mental health disclaimer at top
- [ ] Display empty state when zero completions for selected period
- [ ] Add navigation route and wallet kebab menu entry
- _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] }
  ]
}
```
