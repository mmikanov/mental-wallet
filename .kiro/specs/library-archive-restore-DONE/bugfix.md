# Bugfix Requirements Document

## Introduction

When a user archives a library card from their wallet, the Library Browser screen fails to recognize the card as archived. Instead, it shows "Add to wallet" — which creates a brand new card instance with no history. This leads to duplicate cards accumulating in the archive each time the cycle repeats (archive → re-add → archive). The fix must ensure the library correctly detects archived instances and offers a restore action instead of creating duplicates.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a library card has been archived AND the user views that card in the Library Browser THEN the system displays "Add to wallet" as if the card has never been added

1.2 WHEN a library card has been archived AND the user taps "Add to wallet" in the Library Browser THEN the system creates a brand new card instance with no usage history, no streak data, and a new ID

1.3 WHEN the user repeats the archive-and-add cycle for the same library card THEN the system accumulates multiple duplicate instances of that card in the archive

### Expected Behavior (Correct)

2.1 WHEN a library card has been archived AND the user views that card in the Library Browser THEN the system SHALL display "Restore from archive" instead of "Add to wallet"

2.2 WHEN a library card has been archived AND the user taps "Restore from archive" in the Library Browser THEN the system SHALL unarchive the existing card instance, preserving all usage history, streak data, and the original card ID

2.3 WHEN the user archives and restores the same library card multiple times THEN the system SHALL reuse the same card instance each time, never creating duplicates

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a library card has never been added to the wallet AND the user views that card in the Library Browser THEN the system SHALL CONTINUE TO display "Add to wallet" and create a new card instance when tapped

3.2 WHEN a library card is currently active (not archived) in the wallet AND the user views that card in the Library Browser THEN the system SHALL CONTINUE TO display "In wallet" with the button disabled

3.3 WHEN the user restores a card from the Archive screen directly THEN the system SHALL CONTINUE TO restore the card to the wallet with all history preserved

3.4 WHEN a non-library card (origin "my_tool" or "community") is archived THEN the Library Browser SHALL CONTINUE TO have no effect on those cards (they are not shown in the library)
