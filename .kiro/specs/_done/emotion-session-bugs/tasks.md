# Tasks

## Task 1: Write bug condition exploration test for scroll restoration

- [x] Write property-based test in `src/components/session/__tests__/SessionLauncherContent.scrollRestore.test.tsx` that renders SessionLauncherContent with non-null recommendations and previewingCard set to a library card, simulates closing the preview, and asserts scrollTo is called with recommendations container Y offset. Use fast-check to generate arbitrary CuratedCardDefinition objects. Run test on UNFIXED code — test MUST FAIL (confirms bug exists). Document counterexamples.
- _Requirements: 1.1, 1.2, 2.1, 2.2_

## Task 2: Write preservation property tests for auto-scroll behavior

- [x] Write tests in `src/components/session/__tests__/SessionLauncherContent.scrollPreservation.test.tsx` following observation-first methodology. Write property-based test: for all valid RecommendationResult objects (via fast-check), initial recommendations fetch triggers auto-scroll to recoContainerY. Write test: opening a wallet tool navigates away without affecting scroll. Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve).
- _Requirements: 3.1, 3.2, 3.3_

## Task 3: Fix scroll position restoration after preview close

- [x] 3.1: Implement fix in SessionLauncherContent — Add wasPreviewingRef, set it true in handleClosePreview, add useEffect that scrolls to recoContainerY.current after 150ms delay when preview closes
- [x] 3.2: Re-run exploration test from task 1 — must now PASS (confirms fix works)
- [x] 3.3: Re-run preservation tests from task 2 — must still PASS (no regressions)
- _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

## Task 4: Checkpoint — Bug 1 complete

- [x] Run full test suite (npm test) and confirm all tests pass. Confirm scroll restoration works after preview close. Confirm initial auto-scroll still works for fresh recommendations.
- _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3_

## Task 5: Write bug condition exploration test for added-to-wallet persistence

- [x] Write property-based test in `src/components/session/__tests__/SessionLauncherContent.walletState.test.tsx` that renders SessionLauncherContent with active session, triggers handleAddToWallet with generated library card ID, unmounts component, remounts component, and asserts "Added ✓" is displayed and addedToWalletMapping contains the mapping. Use fast-check for IDs. Run test on UNFIXED code — test MUST FAIL (confirms bug exists). Document counterexamples.
- _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

## Task 6: Write preservation property tests for session cleanup

- [x] Write tests in `src/stores/__tests__/sessionStore.walletPreservation.test.ts` following observation-first methodology. Write property-based test: for all sequences of recordToolAddedToWallet calls followed by endSession(), store resets to INITIAL_STATE. Same for dismissWithoutSession(). Write test: toolsAddedToWallet titles array records correctly. Verify tests PASS on UNFIXED code.
- _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

## Task 7: Fix added-to-wallet state persistence in Zustand store

- [x] 7.1: Add addedToWalletIds (string[]) and addedToWalletMapping (Record<string,string>) to sessionStore state and INITIAL_STATE. Add recordToolAddedToWallet action. Verify cleared by endSession/dismissWithoutSession.
- [x] 7.2: In SessionLauncherContent, remove local useState for addedToWalletIds and addedToWalletMapping. Add store selectors, derive Set/Map via useMemo. Update handleAddToWallet to call store action.
- [x] 7.3: Re-run exploration test from task 5 — must now PASS (confirms fix works)
- [x] 7.4: Re-run preservation tests from task 6 — must still PASS (no regressions)
- _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5_

## Task 8: Checkpoint — Bug 2 complete

- [x] Run full test suite (npm test) and confirm all tests pass. Confirm "Added ✓" persists across unmount/remount cycles. Confirm session end/dismiss clears added-to-wallet state.
- _Requirements: 4.1, 5.1, 5.2, 5.3, 6.1, 6.2_

## Task 9: Write bug condition exploration test for crisis link navigation

- [x] Write property-based test in `src/components/session/__tests__/LibraryToolPreview.crisisNav.test.tsx` that renders LibraryToolPreview with distress-related card and onCrisisResourcesPress callback, opens rationale sheet, simulates pressing "In crisis? Get support →", and asserts callback was invoked. Use fast-check for distress card generation. Run test on UNFIXED code — test MUST FAIL (confirms bug exists). Document counterexamples.
- _Requirements: 7.1, 7.2, 8.1, 8.2_

## Task 10: Write preservation property tests for crisis link on other surfaces

- [x] Write tests in `src/components/session/__tests__/crisisLink.preservation.test.tsx` following observation-first methodology. Test CardPreviewSheet crisis link triggers onCrisisResourcesPress. Test FocusedCardView crisis link navigates. Test dismissing rationale sheet without crisis tap only closes sheet. Property-based test: for all non-distress cards, crisis link is NOT rendered. Verify tests PASS on UNFIXED code.
- _Requirements: 9.1, 9.2, 9.3, 9.4_

## Task 11: Fix crisis link navigation from session tool preview

- [x] 11.1: Add onCrisisResourcesPress prop to LibraryToolPreview. Update RationaleSheet handler to dismiss then invoke callback.
- [x] 11.2: Add onCrisisResourcesPress to SessionLauncherContentProps. Create handleCrisisResourcesPress that closes preview and calls prop. Pass to LibraryToolPreview.
- [x] 11.3: In WalletScreen, pass onCrisisResourcesPress={() => navigation.navigate('CrisisResources')} to SessionLauncherContent.
- [x] 11.4: Re-run exploration test from task 9 — must now PASS (confirms fix works)
- [x] 11.5: Re-run preservation tests from task 10 — must still PASS (no regressions)
- _Requirements: 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 9.3, 9.4_

## Task 12: Checkpoint — Bug 3 complete

- [x] Run full test suite (npm test) and confirm all tests pass. Confirm crisis link from session preview navigates to CrisisResources. Confirm crisis link from Library Browser and Focused Card still works. Confirm rationale dismiss without crisis tap does not navigate.
- _Requirements: 7.1, 8.1, 8.2, 9.1, 9.2, 9.3_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5", "6"] },
    { "id": 4, "tasks": ["7"] },
    { "id": 5, "tasks": ["8"] },
    { "id": 6, "tasks": ["9", "10"] },
    { "id": 7, "tasks": ["11"] },
    { "id": 8, "tasks": ["12"] }
  ]
}
```

## Notes

- Tech stack: React Native, Expo SDK 54, TypeScript, Zustand 5, React Navigation 7, Jest with jest-expo, fast-check 3 for PBT
- Path alias: `@/*` maps to `src/*`
- All three bugs are in the session component tree (`src/components/session/`) and session store (`src/stores/sessionStore.ts`)
- Bugs are fixed sequentially — complete one full cycle before starting the next
- Property-based tests use fast-check 3 and run via Jest (`npm test`)
- Exploration tests are expected to FAIL on unfixed code (confirming the bug exists) then PASS after the fix
- Preservation tests are expected to PASS on both unfixed and fixed code (confirming no regressions)
