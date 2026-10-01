/**
 * Tests for the CardKebabMenu "Update from library" entry point (Task 5.6).
 *
 * Library Card Sync (Phase 1), Req 4.1: the kebab menu is an OPTIONAL secondary
 * entry point to the update flow. The "Update from library" item is shown IFF the
 * caller wired `onUpdateFromLibrary` AND the card is genuinely outdated versus the
 * current curated definition (`evaluateOutdated(card).isOutdated`).
 *
 * Determinism: `evaluateOutdated` looks the curated def up in the module-level
 * `CURATED_LIBRARY` by `sourceLibraryId`. We mock `@/data/curatedLibrary` with a
 * mutable fixture behind a getter (same seam as `librarySyncService.test.ts`) so we
 * control the outdated/up-to-date decision precisely, independent of the real
 * curated contents. `jest.requireActual` preserves the real interfaces/exports.
 *
 * Validates: Requirements 4.1
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { Card } from '@/types/index';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';

// Mutable fixture returned as CURATED_LIBRARY; each test rewrites its contents.
const curatedFixture: CuratedCardDefinition[] = [];

jest.mock('@/data/curatedLibrary', () => {
  const actual = jest.requireActual('@/data/curatedLibrary');
  return {
    ...actual,
    get CURATED_LIBRARY() {
      return curatedFixture;
    },
  };
});

// eslint-disable-next-line import/first
import CardKebabMenu from '../CardKebabMenu';

const SOURCE_ID = 'lib-box-breathing';

function setCurated(def: Partial<CuratedCardDefinition> & { id: string }): void {
  curatedFixture.length = 0;
  curatedFixture.push({
    title: 'Box Breathing',
    description: 'A calming four-count breathing exercise.',
    iconType: 'emoji',
    iconValue: '🫁',
    backgroundType: 'color',
    backgroundValue: '#EDE7F6',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: true,
    controls: [],
    ...def,
  } as CuratedCardDefinition);
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    title: 'Box Breathing',
    description: 'A calming four-count breathing exercise.',
    iconType: 'emoji',
    iconValue: '🫁',
    backgroundType: 'color',
    backgroundValue: '#EDE7F6',
    categoryId: 'grounding-calming',
    originBadge: 'library',
    stackPosition: 0,
    totalUses: 5,
    currentStreak: 2,
    lastUsedAt: '2024-01-15T10:00:00.000Z',
    isArchived: false,
    archivedAt: null,
    previousStackPosition: null,
    allowBackgroundCustomization: false,
    sourceLibraryId: SOURCE_ID,
    sourceLibraryVersion: 1,
    controls: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

const noop = () => undefined;

function renderMenu(props: Partial<React.ComponentProps<typeof CardKebabMenu>>) {
  return render(
    <CardKebabMenu
      visible
      card={props.card ?? makeCard()}
      onClose={props.onClose ?? noop}
      onEdit={noop}
      onDuplicate={noop}
      onViewUsageHistory={noop}
      onSetReminder={noop}
      onArchive={noop}
      onUpdateFromLibrary={props.onUpdateFromLibrary}
    />
  );
}

describe('CardKebabMenu — "Update from library" entry point (Req 4.1)', () => {
  beforeEach(() => {
    curatedFixture.length = 0;
  });

  it('shows the item when onUpdateFromLibrary is provided AND the card is outdated', async () => {
    // Curated version (2) ahead of the copy version (1) → outdated.
    setCurated({ id: SOURCE_ID, version: 2 });
    const onUpdateFromLibrary = jest.fn();

    await renderMenu({
      card: makeCard({ sourceLibraryVersion: 1 }),
      onUpdateFromLibrary,
    });

    expect(screen.queryByLabelText('Update from library')).not.toBeNull();
  });

  it('runs onClose then onUpdateFromLibrary(card.id) when the item is tapped', async () => {
    setCurated({ id: SOURCE_ID, version: 2 });
    const onUpdateFromLibrary = jest.fn();
    const onClose = jest.fn();

    await renderMenu({
      card: makeCard({ id: 'card-42', sourceLibraryVersion: 1 }),
      onUpdateFromLibrary,
      onClose,
    });

    fireEvent.press(screen.getByLabelText('Update from library'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onUpdateFromLibrary).toHaveBeenCalledWith('card-42');
  });

  it('does NOT show the item when onUpdateFromLibrary is absent (even if outdated)', async () => {
    setCurated({ id: SOURCE_ID, version: 2 });

    await renderMenu({
      card: makeCard({ sourceLibraryVersion: 1 }),
      onUpdateFromLibrary: undefined,
    });

    expect(screen.queryByLabelText('Update from library')).toBeNull();
  });

  it('does NOT show the item when the card is not outdated (prop provided, versions equal)', async () => {
    // Copy already at the curated version → not outdated.
    setCurated({ id: SOURCE_ID, version: 2 });
    const onUpdateFromLibrary = jest.fn();

    await renderMenu({
      card: makeCard({ sourceLibraryVersion: 2 }),
      onUpdateFromLibrary,
    });

    expect(screen.queryByLabelText('Update from library')).toBeNull();
  });

  it('does NOT show the item when the curated definition is unversioned', async () => {
    // No version on the curated def → never outdated (Req 1.4b).
    setCurated({ id: SOURCE_ID, version: undefined });
    const onUpdateFromLibrary = jest.fn();

    await renderMenu({
      card: makeCard({ sourceLibraryVersion: null }),
      onUpdateFromLibrary,
    });

    expect(screen.queryByLabelText('Update from library')).toBeNull();
  });
});
