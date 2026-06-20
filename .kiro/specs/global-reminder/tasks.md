# Tasks

## Task 1: Implement global wellness check-in reminder

- [ ] Add "Set global reminder" option to wallet kebab menu
- [ ] Create reminder configuration UI for selecting time of day
- [ ] Implement `selectReminderCard` logic: find least-used card in past 14 days (random if tied)
- [ ] Schedule daily local notification via expo-notifications with card name in message
- [ ] Handle notification tap: navigate to suggested card in Focused_Card view
- [ ] Store global reminder in reminders table with type='global' and cardId=null
- _Requirements: 1.1, 1.2, 1.3_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] }
  ]
}
```
