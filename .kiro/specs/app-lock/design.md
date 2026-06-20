# Design Document

## Overview

A new service (`authLockService.ts`) manages authentication state. A new screen (`AuthGateScreen.tsx`) presents biometric or PIN challenges. The lock triggers when the app returns to the foreground.

## Architecture

New service layer component using `expo-local-authentication` for biometrics and `expo-secure-store` for PIN hash storage. A new Zustand store (`authStore.ts`) tracks authentication state and lockout.

## Components and Interfaces

### Auth/Lock Service

```typescript
interface AuthLockService {
  isLockEnabled(): Promise<boolean>;
  enableLock(method: 'biometric' | 'pin', pin?: string): Promise<void>;
  disableLock(): Promise<void>;
  authenticate(): Promise<boolean>;
  recordFailedAttempt(): Promise<{ locked: boolean; remainingSeconds: number }>;
  isLockedOut(): Promise<boolean>;
}
```

### Auth Store

```typescript
interface AuthStore {
  isAuthenticated: boolean;
  lockEnabled: boolean;
  failedAttempts: number;
  lockedUntil: number | null;
  authenticate: () => Promise<boolean>;
}
```

### App Lock Mechanism

| Mechanism | Implementation |
|-----------|----------------|
| Biometric (Face ID / Fingerprint) | `expo-local-authentication` with fallback to PIN |
| PIN (4–6 digits) | Hashed with PBKDF2, stored in expo-secure-store |
| Lockout | 5 failed PIN attempts → 60-second lockout (timestamp in secure store) |
| Trigger | App returns to foreground via AppState listener |

## Data Models

No database tables. PIN hash and lockout timestamp stored in expo-secure-store. Failed attempt count stored in memory (resets on app kill, which is acceptable for security).

## Testing Strategy

- Unit test: PBKDF2 hash generation and verification
- Unit test: lockout triggers at exactly 5 failed attempts
- Unit test: lockout expires after 60 seconds
- Unit test: successful auth resets failed attempt counter
