# Bugfix Requirements Document

## Introduction

This document collects visual and behavioral bugs found during Android emulator testing. Issues are recorded as discovered, then fixed as a batch.

## Bug Analysis

---

### Bug 1: Tooltip Highlight Misaligned on Frontmost Card

### Current Behavior (Defect)

1.1 WHEN the micro-tutorial tooltip displays on the wallet screen on Android THEN the spotlight highlight does not align with the frontmost card — it appears offset from the card it should highlight

1.2 WHEN `measureInWindow` is used to calculate the frontmost card position on Android THEN the returned Y coordinate includes the status bar height, but the TooltipOverlay is positioned relative to the SafeAreaView (which excludes the status bar), causing a vertical offset

### Expected Behavior (Correct)

2.1 WHEN the micro-tutorial tooltip displays on the wallet screen on Android THEN the spotlight highlight SHALL align precisely with the frontmost card, matching iOS behavior

2.2 WHEN the frontmost card position is calculated THEN the system SHALL measure relative to the SafeAreaView container (not the window) to ensure consistent positioning across platforms

### Status

**Fixed** — Implemented relative measurement (measureInWindow on both container and target, then subtract). Committed in `5f3f346`.

---

### Bug 2: Tooltip Arrow Renders as Diamond on Android

### Current Behavior (Defect)

3.1 WHEN the tooltip bubble displays on Android THEN the arrow (pointing up toward the highlighted card) renders as a full diamond shape instead of a triangle

3.2 WHEN a rotated square (`transform: rotate(45deg)`) is used as the arrow on Android THEN the parent's `overflow: hidden` or clipping does not hide the bottom half of the square, unlike iOS where it is properly clipped to look like a triangle

### Expected Behavior (Correct)

4.1 WHEN the tooltip bubble displays on Android THEN the arrow SHALL appear as a triangle (matching iOS behavior), not a diamond

### Status

**Fixed** — arrowClip approach with overflow:hidden + rotated inner square renders correctly as a triangle on Android (New Architecture).

---

### Bug 3: Cannot Scroll Expanded Card Content on Android (Swipe-to-Dismiss Intercepts)

### Current Behavior (Defect)

5.1 WHEN a card is expanded and the user attempts to scroll down through the card's controls on Android THEN the swipe-to-dismiss gesture fires instead, closing/collapsing the card

5.2 WHEN the user drags vertically within the expanded card's ScrollView on Android THEN the pan gesture handler intercepts the touch before the ScrollView can consume it, making it impossible to reach controls below the fold

### Expected Behavior (Correct)

6.1 WHEN a card is expanded and the user scrolls vertically within the card content area on Android THEN the ScrollView SHALL consume the scroll gesture, allowing the user to see all controls

6.2 WHEN the ScrollView is at the top (scroll offset 0) and the user drags downward THEN the swipe-to-dismiss gesture MAY activate (matching iOS behavior where dismiss only fires when scroll is at top)

### Status

**Fixed** — Uses `GHScrollView` (from react-native-gesture-handler) with `nestedScrollEnabled={true}` on Android when expanded. This allows proper scroll coordination between the gesture detector and the scroll view.

---

### Bug 4: Library Card Preview Sheet Lacks Backdrop on Android

### Current Behavior (Defect)

7.1 WHEN the user taps "Preview" on a card in the Library Browser on Android THEN the card preview sheet appears but the library list behind it is fully visible, creating a messy overlapping layout

7.2 WHEN the CardPreviewSheet is presented on Android THEN there is no opaque backdrop or dimming layer behind it, so the background content shows through and text/controls overlap

### Expected Behavior (Correct)

8.1 WHEN the user taps "Preview" on a card in the Library Browser on Android THEN the preview sheet SHALL appear with a dimmed/opaque backdrop that hides the content behind it (matching iOS behavior)

### Status

**Fixed** — `CardPreviewSheet` conditionally applies `androidOverlay` style (semi-transparent backdrop with `rgba(0,0,0,0.5)`) on Android via `Platform.OS === 'android'` check.

---

### Bug 5: Collapsed Stack Cards Lack Depth Effect on Android

### Current Behavior (Defect)

9.1 WHEN a card is focused and the remaining cards are shown as collapsed strips at the bottom on Android THEN all collapsed card strips appear at the same width, creating a flat appearance

9.2 ON iOS the collapsed cards show a perspective/depth effect where each card is slightly narrower than the one above, creating a stacked appearance

### Expected Behavior (Correct)

10.1 WHEN cards are shown in the collapsed stack at the bottom on Android THEN they SHALL display the same depth/perspective effect as iOS (each card slightly scaled down or narrower for depth)

### Status

**Fixed** — Added progressive `marginHorizontal` to edge cards (`(edgeCards.length - index) * 4`), making deeper cards narrower for a stacked depth effect.

---

<!-- Add additional bugs below as they are discovered during Android testing -->

### Bug 6: Step 2 Bottom Buttons Disappear During Control Edit and Reposition Incorrectly After

### Current Behavior (Defect)

11.1 WHEN a control is expanded for editing in Step 2 on Android THEN the "Add block" and "Next" buttons at the bottom of the screen disappear entirely, leaving the user with no visible navigation actions

11.2 WHEN the control editing is completed (collapsed) on Android THEN the "Add block" and "Next" buttons reappear but are positioned higher than expected, with wasted empty space below them (not pinned to the bottom of the screen as they were before editing)

### Expected Behavior (Correct)

12.1 WHEN a control is expanded for editing in Step 2 on Android THEN the "Add block" and "Next" buttons SHALL remain visible at the bottom of the screen (the content area should scroll to accommodate the expanded editor, not hide the buttons)

12.2 WHEN the control editing is completed (collapsed) on Android THEN the "Add block" and "Next" buttons SHALL return to their original position pinned to the bottom of the screen with no extra empty space below them

### Unchanged Behavior (Regression Prevention)

13.1 ON iOS, the buttons SHALL CONTINUE TO remain visible and correctly positioned during and after control editing

13.2 The buttons SHALL CONTINUE TO appear correctly at the bottom on initial load (before any control is edited) on both platforms

### Status

**Fixed** — Disabled `KeyboardAvoidingView` `behavior` on Android (set to `undefined`) since the component already manually hides the bottom bar via `isKeyboardVisible` state. The `behavior='height'` on Android was not properly restoring the view height after keyboard dismiss, causing the buttons to float in the middle. iOS retains `behavior='padding'` which works correctly with the dual strategy.

---

### Bug 7: Content Hidden Behind Android 3-Button Navigation Bar

### Current Behavior (Defect)

14.1 WHEN the wallet, library browser, or insights screen renders on a physical Android device with the 3-button navigation bar THEN the bottom of the content is covered by the nav bar

14.2 The screens used `SafeAreaView edges={['top']}`, applying safe-area inset only at the top and leaving content under the bottom system nav bar

### Expected Behavior (Correct)

15.1 WHEN these screens render on any Android navigation mode THEN content SHALL be inset above the navigation bar

### Status

**Fixed** — Changed `edges={['top']}` to `edges={['top', 'bottom']}` on WalletScreen, WalletInsightsScreen, and LibraryBrowserScreen. Only showed on physical devices / 3-button nav (emulator gesture nav has a smaller inset).

---

### Bug 8: "Rate Mental Health Wallet" Setting Does Nothing on Android

### Current Behavior (Defect)

16.1 WHEN the user taps "Rate Mental Health Wallet" in Settings on Android THEN nothing happens — no dialog, no store page

16.2 `requestAppReview()` calls `StoreReview.requestReview()` when `isAvailableAsync()` is true. On Android the Play In-App Review API silently no-ops (debug/sideloaded build, already-reviewed, or quota-throttled), and the store-URL fallback is never reached because `requestReview()` does not throw

### Expected Behavior (Correct)

17.1 WHEN the user taps "Rate" on Android THEN the app SHALL open the Play Store listing page as a reliable, visible action (rather than depending on the in-app review dialog that frequently suppresses itself)

17.2 WHEN on iOS THEN the native in-app review prompt SHALL CONTINUE TO be used (it is reliable there)

### Status

**Fixed** — `requestAppReview()` now opens the Play Store URL directly on Android; iOS keeps the native `StoreReview.requestReview()` with a store-URL fallback.

---

### Bug 9: Guided Check-in Options Don't Scroll on Android

### Current Behavior (Defect)

18.1 WHEN the user goes through the guided "figure out how I feel" check-in flow on Android THEN the list of options in each question cannot be scrolled, so options below the fold (e.g. "Very high energy") are unreachable

18.2 `CheckinQuestionScreen` uses a plain `react-native` ScrollView; the flow renders inside the gesture-handler-backed expanded session launcher card, and on Android the native gesture parent claims the touch, blocking the plain ScrollView

### Expected Behavior (Correct)

19.1 WHEN the user scrolls the options list in a check-in question on Android THEN the list SHALL scroll and reveal all options

### Unchanged Behavior (Regression Prevention)

20.1 ON iOS, the options list SHALL CONTINUE TO scroll as before

### Status

**Fixed** — `CheckinQuestionScreen` now uses react-native-gesture-handler's ScrollView on Android (with nestedScrollEnabled), matching the SessionLauncherContent pattern.

---

### Bug 10: Library Tool Preview Doesn't Scroll in Emotion Session on Android

### Current Behavior (Defect)

21.1 WHEN the user previews a suggested tool inside an emotion session on Android THEN the tool content (e.g. "How To" steps) cannot be scrolled and is cut off; only the fixed "Add to my wallet" footer stays visible

21.2 `LibraryToolPreview` uses a plain `react-native` ScrollView, blocked by the Android gesture parent — same mechanism as Bug 9

### Expected Behavior (Correct)

22.1 WHEN the user scrolls the tool preview on Android THEN the full tool content SHALL be scrollable

### Unchanged Behavior (Regression Prevention)

23.1 ON iOS, the tool preview SHALL CONTINUE TO scroll as before

### Status

**Fixed** — `LibraryToolPreview` now uses react-native-gesture-handler's ScrollView on Android (with nestedScrollEnabled).

---

### Bug 11: Outcome Options Overflow the Frame on Narrow Physical Devices

### Current Behavior (Defect)

24.1 WHEN the "How do you feel after this?" prompt renders on a narrow physical Android phone THEN the 5 options (Calmer/Clearer/Hopeful/Same/Worse) overflow the right edge and the last option is clipped

24.2 Each option button has a fixed `minWidth: 56` in a non-wrapping, non-scrolling `flexDirection: 'row'`, so the ~296px minimum content width overflows narrower devices. It looks fine on wider emulators

### Expected Behavior (Correct)

25.1 WHEN the outcome prompt renders on any device width THEN all 5 options SHALL fit within the frame without clipping

### Unchanged Behavior (Regression Prevention)

26.1 The options SHALL CONTINUE TO meet the 44pt minimum touch target height

26.2 The options SHALL CONTINUE TO show emoji + label and register selection

### Status

**Fixed** — Outcome buttons now use `flex: 1` (removed fixed `minWidth: 56`), so the 5 options share available width and fit on narrow devices. Kept `minHeight: 44`; labels use `numberOfLines={1}`.

---

### Bug 12: Focused Card Expand Arrow Missing / Unreachable + Wasted Vertical Space

### Current Behavior (Defect)

27.1 WHEN a card is focused on Android and its content is short THEN the expand arrow (▼) is not visible and cannot be scrolled to, so the user has no way to expand the card

27.2 There is excessive vertical space between the origin badge/tag and the stats bar, and the stats white bar appears taller than it should

27.3 Two root causes: (a) `flexGrow: 1` on the scroll content container stretches short content to fill the viewport, distributing empty space and pushing the arrow to/below the card bottom; (b) the non-expanded state used a plain `react-native` ScrollView nested under the swipe-to-dismiss `GestureDetector`, which does not scroll on Android — so when the arrow is pushed below the fold it is unreachable

### Expected Behavior (Correct)

28.1 WHEN a card is focused with short content THEN the expand arrow SHALL sit directly beneath the content with no wasted vertical space

28.2 WHEN a card is focused with tall content on Android THEN the content SHALL scroll so the expand arrow is reachable

28.3 The stats bar SHALL render at its natural height (no stretching)

### Unchanged Behavior (Regression Prevention)

29.1 ON iOS, the focused card layout and expand arrow SHALL CONTINUE TO work as before

29.2 The expanded state (both the normal expanded content and the session-launcher custom content) SHALL CONTINUE TO scroll tall content correctly

29.3 Swipe-to-dismiss SHALL CONTINUE TO work on the focused card

### Status

**Fixed** — In `FocusedCardView`, the non-expanded branch now uses `GHScrollView` on Android (coordinates scroll with the pan GestureDetector) and a new `cardShellInnerContentCollapsed` content style WITHOUT `flexGrow` so short content stays compact and the arrow sits directly under it. The expanded paths keep `flexGrow` (they legitimately need to fill/scroll). StatsRow needed no change — the "taller bar" was purely the flexGrow stretching.

---

