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

<!-- Add additional bugs below as they are discovered during Android testing -->

