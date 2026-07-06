# Implementation Plan: Card UX Enhancements

## Overview

This plan implements four independent UX enhancements to the card system: library card preview, reminder display on focused cards, reminder icon on stacked cards, and third-party app card branding. The enhancements share no data dependencies and are grouped logically to enable parallel implementation where possible.

## Tasks

- [x] 1. Library Card Preview
  - [x] 1.1 Create the `CardPreviewSheet` component
    - Create `src/components/wallet/CardPreviewSheet.tsx`
    - Implement as a React Native `Modal` with `presentationStyle="pageSheet"`
    - Render the card shell (icon, title, description, background) using existing background color/image logic from `CardEdge`/`FocusedCardView`
    - Render controls via `ControlRenderer` with `readOnly={true}` and empty values
    - Include a footer with the action button (Add to wallet / In wallet / Restore from archive) and a dismiss handle
    - Implement loading state during add/restore operations
    - Display inline error message on failure, keeping the action button available for retry
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.9_

  - [x] 1.2 Integrate `CardPreviewSheet` into `LibraryBrowserScreen`
    - Add `onPress` handler to each card row in `LibraryBrowserScreen` that opens the preview sheet
    - Pass the tapped `CuratedCardDefinition` and computed `buttonState` to the sheet
    - Wire `onAddToWallet` to existing `handleAddToWallet` logic
    - Wire `onRestore` to existing `handleRestoreFromArchive` logic
    - Ensure dismissing the preview preserves prior state (category filter, search query, sort mode, scroll position)
    - After successful add, update button to show "In wallet" indicator
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.8_

  - [x] 1.3 Write unit tests for `CardPreviewSheet`
    - Test shell fields render correctly (icon, title, description, background)
    - Test controls render in position order with readOnly state
    - Test all three button states (add / in_wallet / restore)
    - Test loading state during operations
    - Test error display and retry
    - Test dismiss behavior
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9_

- [x] 2. Reminder Display on Focused Card
  - [x] 2.1 Implement `formatReminderLabel` utility
    - Create `src/utils/formatReminderLabel.ts`
    - Format time as-is (HH:mm from stored value)
    - Format frequency: `daily` → "Daily"; `3x_week`/`custom` → day abbreviations in Mon–Sun calendar order, comma-separated
    - Day ordering uses index weights: `{ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }` (Monday first, Sunday last)
    - Use three-letter abbreviations: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    - Return format: `"HH:mm · Daily"` or `"HH:mm · Mon, Wed, Fri"`
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.8_

  - [x] 2.2 Write property test for time preservation (Property 1)
    - **Property 1: Reminder time preservation in formatted label**
    - Generate random valid HH:mm strings (hours 00–23, minutes 00–59), create Reminder objects, verify time appears as substring in `formatReminderLabel` output
    - Use fast-check `fc.integer({min:0,max:23})` and `fc.integer({min:0,max:59})` to generate time components
    - **Validates: Requirements 2.6**

  - [x] 2.3 Write property test for day ordering (Property 2)
    - **Property 2: Reminder day abbreviations are in Monday-to-Sunday calendar order**
    - Generate random non-empty subsets of [0,1,2,3,4,5,6], create Reminder with `3x_week` or `custom` frequency, verify output days appear in strict Mon–Sun order
    - Use fast-check `fc.uniqueArray(fc.integer({min:0,max:6}), {minLength:1})`
    - **Validates: Requirements 2.4, 2.5, 2.8**

  - [x] 2.4 Create `ReminderDisplayRow` component
    - Create `src/components/wallet/ReminderDisplayRow.tsx`
    - Render bell icon (🔔) + formatted label from `formatReminderLabel`
    - Accept `reminder: Reminder | null` and `textColor: string` props
    - Render nothing when reminder is null or `isActive` is false
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 2.5 Create `useCardReminder` hook and integrate into `FocusedCardView`
    - Create a `useCardReminder(cardId: string)` hook that fetches the active reminder via `ReminderService.getReminder()`
    - Integrate `ReminderDisplayRow` into `FocusedCardView` between `StatsRow` and the expand arrow
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 2.6 Write unit tests for `ReminderDisplayRow`
    - Test renders when active reminder exists
    - Test hidden when no reminder or isActive=false
    - Test correct formatting output
    - _Requirements: 2.1, 2.2_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Reminder Icon on Stacked Cards
  - [x] 4.1 Create `useReminderStatusMap` hook
    - Create `src/hooks/useReminderStatusMap.ts`
    - Execute a single query: `SELECT card_id FROM reminders WHERE is_active = 1`
    - Return a `Map<string, boolean>` of card IDs with active reminders
    - Refresh when reminders change (subscribe to reminder updates)
    - _Requirements: 3.1, 3.6_

  - [x] 4.2 Create `ReminderIndicator` component
    - Create `src/components/wallet/ReminderIndicator.tsx`
    - Render a bell icon (🔔) at minimum 16×16pt
    - Accept `isLight: boolean` prop to adapt color for ≥3:1 contrast ratio
    - Use dark color (#1C1C1E) on light backgrounds, light color (#FFFFFF) on dark backgrounds
    - Set `accessibilityLabel="Reminder set"` for screen readers
    - Non-interactive (display only, no onPress)
    - _Requirements: 3.4, 3.5_

  - [x] 4.3 Write property test for contrast ratio (Property 3)
    - **Property 3: Reminder indicator contrast ratio against any card background**
    - Generate random hex colors (#000000–#FFFFFF), compute `isLight` via existing `isLightBackground` utility, determine indicator color, compute WCAG contrast ratio, verify ≥3:1
    - Use fast-check `fc.integer({min:0,max:0xFFFFFF})` to generate colors
    - **Validates: Requirements 3.4**

  - [x] 4.4 Integrate `ReminderIndicator` into `CardEdge`
    - Add `hasReminder: boolean` prop to `CardEdge`
    - When `hasReminder` is true, render `ReminderIndicator` in the top row between the title and category dot
    - Ensure indicator is within top 60pt of card (visible in stacked overlap)
    - Wire `useReminderStatusMap` in `WalletScreen` to pass `hasReminder` prop to each `CardEdge`
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [x] 4.5 Write unit tests for `ReminderIndicator` and `CardEdge` integration
    - Test indicator present when hasReminder=true
    - Test indicator absent when hasReminder=false
    - Test accessibilityLabel="Reminder set"
    - Test non-interactive (no onPress handler)
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 5. Third-Party App Card Branding
  - [x] 5.1 Extend `IconType` and create `validateThirdPartyUri` utility
    - Update `src/types/index.ts` to add `'third_party'` to the `IconType` union
    - Create `src/utils/validateThirdPartyUri.ts`
    - Accept URIs starting with `https://` or local asset paths (`./`, `../`, or `file://`)
    - Reject `http://`, data URIs, empty strings, and other schemes
    - Return `{ valid: boolean; error?: string }`
    - _Requirements: 4.7, 4.8_

  - [x] 5.2 Write property test for URI validation (Property 4)
    - **Property 4: Third-party URI validation accepts only HTTPS or local asset paths**
    - Generate random strings including valid HTTPS URLs, local paths (`./`, `../`), http URLs, data URIs, empty strings
    - Verify `validateThirdPartyUri` returns `valid: true` only for HTTPS or local asset paths
    - Use fast-check `fc.oneof(fc.constant('https://'), fc.constant('http://'), fc.constant('./'), fc.constant('data:'), fc.constant(''))` combined with `fc.string()`
    - **Validates: Requirements 4.7, 4.8**

  - [x] 5.3 Create `ThirdPartyIcon` component
    - Create `src/components/wallet/ThirdPartyIcon.tsx`
    - Use React Native `Image` with `resizeMode="contain"`
    - Implement `onError` handler that switches to emoji fallback
    - Implement 10-second loading timeout that triggers emoji fallback
    - Accept `uri`, `fallbackEmoji`, `size`, and optional `timeoutMs` props
    - _Requirements: 4.1, 4.5_

  - [x] 5.4 Update icon rendering in `CardEdge` and `FocusedCardView`
    - Create a shared `renderCardIcon(iconType, iconValue)` function or utility
    - Handle `'third_party'` case by rendering `ThirdPartyIcon` with the URI from `iconValue`
    - Handle background overrides: if `backgroundType` is `'image'` and URI fails, fall back to background color
    - Wire validation via `validateThirdPartyUri` at the service layer before card persistence
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.5 Write unit tests for `ThirdPartyIcon` and `validateThirdPartyUri`
    - Test image renders with valid HTTPS URI
    - Test emoji fallback on image load error
    - Test emoji fallback on 10s timeout
    - Test background image fallback to color on failure
    - Test URI validation accepts HTTPS and local paths
    - Test URI validation rejects http, data, empty, other schemes
    - _Requirements: 4.1, 4.5, 4.6, 4.7, 4.8_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All four enhancements are independent — tasks in different groups can execute in parallel
- The `@/*` path alias maps to `src/*` for all imports
- fast-check 3 is already available in the project for property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "4.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3", "2.4", "4.2", "5.2", "5.3"] },
    { "id": 2, "tasks": ["1.3", "2.5", "4.3", "4.4", "5.4"] },
    { "id": 3, "tasks": ["2.6", "4.5", "5.5"] }
  ]
}
```
