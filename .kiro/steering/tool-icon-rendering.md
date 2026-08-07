---
inclusion: fileMatch
fileMatchPattern: '**/renderCardIcon*,**/ThirdPartyIcon*,**/appLogoRegistry*,**/externalAppCards*,**/ToolPreviewCard*,**/LibraryToolPreview*,**/CardEdge*,**/CardPreviewSheet*,**/FocusedCardView*,**/ArchiveScreen*,**/CollapsedStack*'
---

# Tool Icon Rendering

## Architecture

All tool/card icons are rendered via `src/utils/renderCardIcon.tsx`. This is the single entry point for icon rendering across the entire app. Do NOT render icons directly with `<Text>{iconValue}</Text>` — that breaks for `third_party` icon types (renders raw URLs as text).

## How It Works

1. Caller passes `{ iconType, iconValue, size, fallbackEmoji?, sourceId? }` to `renderCardIcon()`
2. For `iconType: 'emoji'` → renders the emoji character as `<Text>`
3. For `iconType: 'third_party'` → checks `appLogoRegistry` for a bundled local asset (by `sourceId`), then passes to `ThirdPartyIcon` which downloads/caches the URL
4. Fallback: if image load fails, shows `fallbackEmoji`

## Critical Rules

1. **Always use `renderCardIcon()`** — never render `iconValue` directly as text
2. **Always pass `sourceId`** when available — this is the card ID or `sourceLibraryId` that the `appLogoRegistry` uses to resolve bundled app logos
3. **Never use `iconValue` as `fallbackEmoji`** for `third_party` icons — the iconValue is a URL, not displayable text. Use `'📋'` or a contextual emoji instead
4. **External app card IDs** start with `app-` (e.g., `app-headspace`) — these have bundled logos in `assets/app-logos/`

## All Surfaces That Render Icons

| Surface | File | sourceId source |
|---------|------|-----------------|
| Wallet stack (collapsed) | `CollapsedStack.tsx` | `card.sourceLibraryId \|\| card.id` |
| Wallet card edge | `CardEdge.tsx` | `card.sourceLibraryId \|\| card.id` |
| Focused card (header) | `FocusedCardView.tsx` | `card.sourceLibraryId \|\| card.id` |
| Focused card (compact) | `FocusedCardView.tsx` | `card.sourceLibraryId \|\| card.id` |
| Library browser list | `LibraryBrowserScreen.tsx` | `item.id` |
| Library card preview | `CardPreviewSheet.tsx` | `card.id` |
| Archive screen | `ArchiveScreen.tsx` | `item.sourceLibraryId \|\| item.id` |
| Card creator preview | `Step3Preview.tsx` | (none — new card, no registry entry) |
| Emotion session tool card | `ToolPreviewCard.tsx` | `cardId` prop |
| Emotion session tool preview | `LibraryToolPreview.tsx` | `card.id` |

## Adding New Icon Display Surfaces

When creating a new component that displays a card/tool icon:
1. Import `renderCardIcon` from `@/utils/renderCardIcon`
2. Call it with the card's `iconType`, `iconValue`, desired `size`, and `sourceId`
3. For `fallbackEmoji`: use `'📋'` if `iconType === 'third_party'`, otherwise use `iconValue`
4. Wrap in a `<View>` with appropriate dimensions — do NOT use `<Text>` directly

## Local Logo Bundle

External app logos are in `assets/app-logos/*.jpg`. The registry at `src/data/appLogoRegistry.ts` maps card IDs to `require()` assets. `renderCardIcon` resolves these via `Image.resolveAssetSource()` to get a local URI that works offline.
