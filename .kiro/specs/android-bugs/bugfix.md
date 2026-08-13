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

**Pending**

---

### Bug 3: Cannot Scroll Expanded Card Content on Android (Swipe-to-Dismiss Intercepts)

### Current Behavior (Defect)

5.1 WHEN a card is expanded and the user attempts to scroll down through the card's controls on Android THEN the swipe-to-dismiss gesture fires instead, closing/collapsing the card

5.2 WHEN the user drags vertically within the expanded card's ScrollView on Android THEN the pan gesture handler intercepts the touch before the ScrollView can consume it, making it impossible to reach controls below the fold

### Expected Behavior (Correct)

6.1 WHEN a card is expanded and the user scrolls vertically within the card content area on Android THEN the ScrollView SHALL consume the scroll gesture, allowing the user to see all controls

6.2 WHEN the ScrollView is at the top (scroll offset 0) and the user drags downward THEN the swipe-to-dismiss gesture MAY activate (matching iOS behavior where dismiss only fires when scroll is at top)

### Status

**Pending**

---

### Bug 4: Library Card Preview Sheet Lacks Backdrop on Android

### Current Behavior (Defect)

7.1 WHEN the user taps "Preview" on a card in the Library Browser on Android THEN the card preview sheet appears but the library list behind it is fully visible, creating a messy overlapping layout

7.2 WHEN the CardPreviewSheet is presented on Android THEN there is no opaque backdrop or dimming layer behind it, so the background content shows through and text/controls overlap

### Expected Behavior (Correct)

8.1 WHEN the user taps "Preview" on a card in the Library Browser on Android THEN the preview sheet SHALL appear with a dimmed/opaque backdrop that hides the content behind it (matching iOS behavior)

### Status

**Pending**

---

### Bug 5: Collapsed Stack Cards Lack Depth Effect on Android

### Current Behavior (Defect)

9.1 WHEN a card is focused and the remaining cards are shown as collapsed strips at the bottom on Android THEN all collapsed card strips appear at the same width, creating a flat appearance

9.2 ON iOS the collapsed cards show a perspective/depth effect where each card is slightly narrower than the one above, creating a stacked appearance

### Expected Behavior (Correct)

10.1 WHEN cards are shown in the collapsed stack at the bottom on Android THEN they SHALL display the same depth/perspective effect as iOS (each card slightly scaled down or narrower for depth)

### Status

**Pending**

---

<!-- Add additional bugs below as they are discovered during Android testing -->

