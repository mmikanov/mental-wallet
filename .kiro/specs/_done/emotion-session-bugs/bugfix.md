# Bugfix Requirements Document

## Introduction

This document covers three bugs in the emotion session launcher that degrade the user experience when interacting with recommended tools during a session.

**Bug 1**: When a user previews a recommended library tool during an emotion session, clicking "Back to session" returns them to the top of the page (emotion selection) instead of the recommendations section where they were browsing. This disrupts the user's flow and forces them to scroll back down.

**Bug 2**: When a user adds a recommended library tool to their wallet during an emotion session (button shows "Added ✓"), then navigates away from the session (e.g., focuses another card or returns to the wallet stack) and comes back, the tool reverts to showing "Add to wallet" instead of "Added ✓". The "added" state is lost because it is stored in local React component state that resets on unmount.

**Bug 3**: When a user is in an emotion session, opens a recommended tool's preview, taps "Learn more" to view the rationale sheet, and then taps the "In crisis? Get support →" link, the rationale sheet closes but the Crisis Resources screen does not open. The navigation action is missing from the handler.

## Bug Analysis

---

### Bug 1: Scroll Position Lost After Preview

### Current Behavior (Defect)

1.1 WHEN the user previews a library tool during an emotion session and then closes the preview by pressing "Back to session" THEN the system displays the session view scrolled to the top (emotion picker) instead of the recommendations section

1.2 WHEN `handleClosePreview` sets `previewingCard` to null THEN the system remounts a fresh ScrollView at offset 0, losing the user's scroll position in the recommendations area

### Expected Behavior (Correct)

2.1 WHEN the user closes a library tool preview by pressing "Back to session" THEN the system SHALL scroll the session view to the recommendations section, restoring the user's position near where they were browsing

2.2 WHEN `handleClosePreview` sets `previewingCard` to null and the ScrollView remounts THEN the system SHALL programmatically scroll to the recommendations container Y offset after a short delay to allow remount

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user first receives recommendations (without previewing a tool) THEN the system SHALL CONTINUE TO auto-scroll to the recommendations section as it currently does

3.2 WHEN the user manually scrolls the session view without previewing a tool THEN the system SHALL CONTINUE TO maintain the user's scroll position normally

3.3 WHEN the user opens a wallet tool (not a library preview) THEN the system SHALL CONTINUE TO navigate away from the session as it currently does

3.4 WHEN the user adds a library tool to their wallet from the preview and then closes the preview THEN the system SHALL scroll to the recommendations section the same as closing without adding

---

### Bug 2: Added-to-Wallet State Lost on Session Remount

### Current Behavior (Defect)

4.1 WHEN a user adds a recommended library tool to their wallet during an emotion session (button shows "Added ✓") and then navigates away from the session (e.g., focuses another card or returns to the wallet stack) THEN the `SessionLauncherContent` component unmounts and the `addedToWalletIds` local state is destroyed

4.2 WHEN the user navigates back to the active session after having previously added a library tool THEN the system displays "Add to wallet" instead of "Added ✓" because a fresh empty `Set()` is created on remount

4.3 WHEN the user navigates back to the active session after having previously added a library tool THEN the `addedToWalletMapping` (library card ID → wallet card ID) is also lost, preventing correct navigation to the newly added wallet card

### Expected Behavior (Correct)

5.1 WHEN a user adds a recommended library tool to their wallet during an emotion session and then navigates away and back THEN the system SHALL display "Added ✓" for all tools that were added during the current session

5.2 WHEN the `SessionLauncherContent` component remounts during an active session THEN the system SHALL restore the set of library tool IDs that have been added to the wallet during this session from the Zustand session store

5.3 WHEN the `SessionLauncherContent` component remounts during an active session THEN the system SHALL restore the mapping from library card IDs to their corresponding wallet card IDs from the Zustand session store

### Unchanged Behavior (Regression Prevention)

6.1 WHEN the session ends via `endSession()` THEN the system SHALL CONTINUE TO clear all session state including the added-to-wallet tracking

6.2 WHEN the session is dismissed via `dismissWithoutSession()` THEN the system SHALL CONTINUE TO clear all session state including the added-to-wallet tracking

6.3 WHEN a library tool is already in the user's wallet (detected by existing duplicate detection logic) THEN the system SHALL CONTINUE TO hide the "Add to wallet" button entirely, regardless of the added-to-wallet session state

6.4 WHEN a tool is added to the wallet during the session THEN the system SHALL CONTINUE TO record the tool title in `toolsAddedToWallet` for the session summary

6.5 WHEN a positive quantity is added during the session THEN the system SHALL CONTINUE TO correctly calculate and display the count of tools added

---

## Bug 3: Crisis Support Link in Session Tool Preview Does Not Navigate

### Current Behavior (Defect)

7.1 WHEN a user is in an emotion session, opens a recommended tool's preview via `LibraryToolPreview`, taps "Learn more" to view the rationale sheet, and then taps the "In crisis? Get support →" link THEN the system closes the rationale sheet but does NOT navigate to the Crisis Resources screen

7.2 WHEN `onCrisisResourcesPress` is invoked inside `LibraryToolPreview`'s `RationaleSheet` THEN the handler only calls `setRationaleVisible(false)` without triggering any navigation action

### Expected Behavior (Correct)

8.1 WHEN a user taps the "In crisis? Get support →" link in the rationale sheet while previewing a tool during an emotion session THEN the system SHALL close the rationale sheet AND navigate to the Crisis Resources screen

8.2 WHEN `onCrisisResourcesPress` is invoked inside `LibraryToolPreview`'s `RationaleSheet` THEN the system SHALL dismiss the rationale sheet, close the tool preview, and navigate to the CrisisResources screen

### Unchanged Behavior (Regression Prevention)

9.1 WHEN the user taps the "In crisis? Get support →" link from the rationale sheet in the Library Browser (via `CardPreviewSheet`) THEN the system SHALL CONTINUE TO dismiss the preview and navigate to the Crisis Resources screen as it currently does

9.2 WHEN the user taps the "In crisis? Get support →" link from the rationale sheet on a focused wallet card (via `FocusedCardView`) THEN the system SHALL CONTINUE TO navigate to the Crisis Resources screen as it currently does

9.3 WHEN the user dismisses the rationale sheet without tapping the crisis link (via swipe, close button, or backdrop tap) THEN the system SHALL CONTINUE TO only dismiss the sheet without any navigation

9.4 WHEN the card is NOT distress-related THEN the system SHALL CONTINUE TO not show the "In crisis? Get support →" link in the rationale sheet
