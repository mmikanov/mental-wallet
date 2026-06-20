# Tech Stack

## Core

- **Runtime**: React Native 0.81 with Expo SDK 54 (New Architecture enabled)
- **Language**: TypeScript 5.9 (strict mode)
- **State Management**: Zustand 5
- **Navigation**: React Navigation 7 (native-stack + bottom-tabs)
- **Animations**: React Native Reanimated 4 + Gesture Handler 2
- **Database**: expo-sqlite (local SQLite via migrations)
- **Lists**: @shopify/flash-list

## Key Expo Modules

- expo-notifications (reminders)
- expo-image-picker (image attachments)
- expo-secure-store (secure local storage)
- expo-file-system (file operations)
- expo-sharing (social sharing)
- expo-crypto (UUID generation)

## Testing

- **Runner**: Jest via jest-expo preset
- **Property-Based Testing**: fast-check 3
- **Type Checking**: `tsc --noEmit`

## Common Commands

```bash
# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Build & Deploy

- EAS Build configured via `eas.json`
- iOS bundle ID: `com.mentalhealthwallet.app`
- Android package: `com.mentalhealthwallet.app`

## Path Aliases

- `@/*` maps to `src/*` (configured in tsconfig.json and jest.config.js)
