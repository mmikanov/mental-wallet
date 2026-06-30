/**
 * Helper functions for Library Browser button-state determination and sort logic.
 *
 * Extracted from LibraryBrowserScreen to make the logic unit-testable
 * without rendering React components.
 *
 * THREE-STATE LOGIC:
 * 1. If an archived instance exists (by sourceLibraryId or title fallback) → "Restore from archive"
 * 2. If an active instance exists in wallet → "In wallet" (disabled)
 * 3. Otherwise → "Add to wallet"
 */

import type { CuratedCardDefinition } from '@/data/curatedLibrary';

export type SortMode = 'category' | 'newest';

/**
 * Sorts curated library cards by "newest first" (reverse array order).
 *
 * Since curated cards don't have a `createdAt` timestamp, we treat their
 * position in the CURATED_LIBRARY array as chronological order — later entries
 * are considered "newer". Reversing the array gives newest-to-oldest.
 */
export function sortNewestFirst(cards: CuratedCardDefinition[]): CuratedCardDefinition[] {
  return [...cards].reverse();
}

export interface ButtonState {
  label: string;
  disabled: boolean;
  action: 'add' | 'restore' | 'none';
  archivedInstanceId?: string;
}

/**
 * Determines the button state for a library card in the Library Browser.
 *
 * @param libraryCardId - The ID of the curated library card definition
 * @param libraryCardTitle - The title of the curated library card (used for matching)
 * @param activeCards - Array of active (non-archived) wallet cards
 * @param archivedLibraryCards - Map of sourceLibraryId (or title) → archived card ID
 * @returns Button state with label, disabled flag, action type, and optional archivedInstanceId
 */
export function getLibraryCardButtonState(
  libraryCardId: string,
  libraryCardTitle: string,
  activeCards: Array<{ title: string; originBadge: string; sourceLibraryId?: string | null }>,
  archivedLibraryCards: Map<string, string>
): ButtonState {
  // 1. Check if an archived instance exists (by sourceLibraryId first, then title fallback)
  if (archivedLibraryCards.has(libraryCardId)) {
    return {
      label: 'Restore from archive',
      disabled: false,
      action: 'restore',
      archivedInstanceId: archivedLibraryCards.get(libraryCardId),
    };
  }

  // Title fallback for pre-migration cards without source_library_id
  if (archivedLibraryCards.has(libraryCardTitle)) {
    return {
      label: 'Restore from archive',
      disabled: false,
      action: 'restore',
      archivedInstanceId: archivedLibraryCards.get(libraryCardTitle),
    };
  }

  // 2. Check if an active card matches by sourceLibraryId or by title + originBadge
  const isAlreadyInWallet = activeCards.some(
    (c) =>
      (c.sourceLibraryId != null && c.sourceLibraryId === libraryCardId) ||
      (c.title === libraryCardTitle && c.originBadge === 'library')
  );

  if (isAlreadyInWallet) {
    return { label: 'In wallet', disabled: true, action: 'none' };
  }

  // 3. Card has never been added
  return { label: 'Add to wallet', disabled: false, action: 'add' };
}
