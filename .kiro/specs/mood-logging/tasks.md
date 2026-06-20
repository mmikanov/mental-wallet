# Tasks

## Task 1: Add mood_logs database migration

- [ ] Create migration adding mood_logs table with card_id, completion_id, value, context, logged_at columns and indexes
- [ ] Add MoodLog, MoodLogInput, MoodTrend, ToolEffectiveness type definitions to `src/types/`
- _Requirements: 1.6_

## Task 2: Implement Mood Service

- [ ] Create `src/services/moodService.ts` implementing logMood, getMoodsByCard, getMoodsForPeriod, calculateTrend, calculateToolEffectiveness, hasDailyCheckIn
- [ ] Validate mood values (1–10) and context labels (before_use, after_use, standalone)
- [ ] Implement trend calculation: split chronologically sorted logs at midpoint, compare averages, threshold ±0.5
- [ ] Implement tool effectiveness: match before/after pairs by completionId, require ≥3 pairs
- _Requirements: 1.1, 1.6, 1.8, 1.9, 1.10_

## Task 3: Implement mood slider prompts

- [ ] Create `src/components/mood/MoodSliderPrompt.tsx` (dismissable overlay with 1–10 slider and emoji anchors)
- [ ] Create `src/stores/moodStore.ts` with prompt visibility state and actions
- [ ] Integrate pre-use mood prompt: show when user taps primary action to start card use
- [ ] Integrate post-completion mood prompt: show after completion is recorded
- [ ] Implement daily check-in prompt: show on app open if enabled and no mood logged today
- [ ] Add daily check-in enable/disable toggle in SettingsScreen
- _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] }
  ]
}
```
