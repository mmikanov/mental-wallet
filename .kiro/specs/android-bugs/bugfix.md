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

