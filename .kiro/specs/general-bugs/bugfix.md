# Bugfix Requirements Document

## Introduction

This document collects cross-platform visual and behavioral bugs found during testing. Issues are recorded as discovered, then fixed as a batch.

## Bug Analysis

---

### Bug 1: Card Content Bleeds Above Next Card Edge in Stacked View

### Current Behavior (Defect)

1.1 WHEN a card in the stacked wallet view has content taller than the peek height (e.g., Headspace card with third_party icon + reminder bell indicator) THEN the card's description text or extra elements are visible above the edge of the card stacked below it

1.2 WHEN the Headspace card (or any card with a reminder indicator and third_party icon type) is in the stack THEN its content overflows the 60px peek area, causing visual bleed into the card above

### Expected Behavior (Correct)

2.1 WHEN cards are displayed in the stacked wallet view THEN each card's content SHALL be clipped to its peek area (top ~60px), with no content bleeding above or below the card edge boundaries

2.2 WHEN a card has extra elements (reminder indicator, description text) THEN the card edge component SHALL clip overflow so only the title row (icon + title + category dot) is visible in the stacked state

### Status

**Pending**

---

<!-- Add additional cross-platform bugs below as they are discovered -->
