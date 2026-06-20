# Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── controls/        # Control-type renderers (mood slider, text input, etc.)
│   ├── creator/         # Card creation/editing UI
│   └── wallet/          # Wallet stack and card display components
├── data/                # Database layer
│   ├── database.ts      # SQLite connection and initialization
│   ├── migrations.ts    # Schema migrations
│   ├── seeds.ts         # Seed data for curated library
│   └── curatedLibrary.ts # Curated card definitions
├── navigation/          # React Navigation config
│   ├── RootNavigator.tsx
│   ├── MainTabNavigator.tsx
│   ├── linking.ts       # Deep linking config
│   └── types.ts         # Navigation param types
├── screens/             # Top-level screen components
│   ├── WalletScreen.tsx
│   ├── CardCreatorScreen.tsx
│   ├── LibraryBrowserScreen.tsx
│   ├── ArchiveScreen.tsx
│   ├── UsageHistoryScreen.tsx
│   ├── ReminderConfigScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── DisclaimerScreen.tsx
│   └── CrisisResourcesScreen.tsx
├── services/            # Business logic layer
│   ├── cardService.ts
│   ├── completionService.ts
│   ├── reminderService.ts
│   ├── notificationService.ts
│   ├── exportService.ts
│   └── __tests__/       # Service unit tests
├── stores/              # Zustand state stores
│   ├── walletStore.ts
│   ├── completionStore.ts
│   └── __tests__/       # Store unit tests
├── types/               # TypeScript type definitions
│   ├── index.ts         # Core domain models (Card, Control, Completion, etc.)
│   ├── services.ts      # Service interfaces
│   └── errors.ts        # Error types
└── utils/               # Shared utilities
    ├── accessibility.ts
    ├── imageUtils.ts
    └── __tests__/       # Utility unit tests
```

## Architecture Pattern

- **Screens** handle layout and user interaction
- **Services** contain business logic and database operations
- **Stores** (Zustand) manage reactive UI state, calling services for persistence
- **Types** define the domain model; the Universal Card Model is the central data structure
- **Data layer** uses SQLite with explicit migration files for schema evolution

## Conventions

- Tests live in `__tests__/` directories adjacent to the code they test, or as `.test.ts` files alongside their module
- All imports use the `@/` path alias pointing to `src/`
- Entry point is `App.tsx` at the project root
