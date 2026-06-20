# Tasks

## Task 1: Implement auth lock service

- [ ] Create `src/services/authLockService.ts` implementing AuthLockService interface
- [ ] Implement biometric authentication via expo-local-authentication
- [ ] Implement PIN setup: validate 4–6 digits, hash with PBKDF2, store hash in expo-secure-store
- [ ] Implement PIN verification: hash input and compare with stored hash
- [ ] Implement lockout: track consecutive failures, impose 60-second lockout at 5 failures
- [ ] Create `src/stores/authStore.ts` with isAuthenticated, lockEnabled, failedAttempts, lockedUntil
- _Requirements: 1.1, 1.3, 1.4_

## Task 2: Implement auth gate screen and foreground trigger

- [ ] Create `src/screens/AuthGateScreen.tsx` with biometric prompt and PIN input fallback
- [ ] Register AppState listener to trigger auth check when app returns to foreground
- [ ] Add lock enable/disable toggle in SettingsScreen
- [ ] Integrate AuthGateScreen into RootNavigator (shown before main content when lock enabled and not authenticated)
- _Requirements: 1.1, 1.2_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] }
  ]
}
```
