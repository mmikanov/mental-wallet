# Design Document: KPI FAB Days-Since Badge

## Overview

This feature adds a red notification badge to the existing KPI FAB on the Wallet screen. The badge displays the number of calendar days since the user's last KPI check-in. It follows the standard iOS notification badge pattern — red circle, white bold number, positioned at the top-right corner of the parent element.

The implementation is decomposed into three layers:
1. **Pure computation** — a `computeDaysElapsed` function converting UTC timestamp → local date → calendar day difference
2. **State management** — extending `useKpiStore` with `lastCheckInDate` caching, foreground/midnight refresh triggers
3. **Presentation** — a `DaysSinceBadge` component with conditional rendering, sizing logic, and Reanimated spring animation

## Architecture

```
┌─────────────────────────────────────────────────┐
│  WalletScreen                                    │
│  ┌───────────────────────────────────────────┐  │
│  │  KpiFab                                    │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Animated.View (FAB container)       │  │  │
│  │  │    🌱 sprout emoji                   │  │  │
│  │  │    ┌────────────────┐                │  │  │
│  │  │    │ DaysSinceBadge │ (top-right)    │  │  │
│  │  │    └────────────────┘                │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  FocusedCardView (Daily Check-in)          │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  BadgeExplanationBanner              │  │  │
│  │  │  "It's been 3 days since your..."   │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  │  [card content, controls, etc.]            │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  SettingsScreen                                   │
│  [normal settings...]                             │
│  ┌───────────────────────────────────────────┐  │
│  │  AdminKpiBadgeTools (admin mode only)      │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  "Days ago" input + Create Record    │  │  │
│  │  │  Reset All KPI Records button        │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

State flow:
  kpiStore.lastCheckInDate ──► computeDaysElapsed(lastCheckInDate, now)
       │                                │
       │                                ▼
       │                        daysElapsed (number | null)
       │                                │
       │                        ┌───────┴───────┐
       │                        ▼               ▼
       │                DaysSinceBadge   BadgeExplanationBanner
       │                (visible ≥ 1)    (snapshot on card open)
       │
       ├── loadLastCheckIn() ── SQL query on mount
       ├── recordKpi() ── updates cache immediately
       ├── createFakeRecord(n) ── admin: inserts fake row, re-queries
       ├── resetAllRecords() ── admin: deletes all, nulls cache
       ├── AppState 'active' ── re-queries on foreground
       └── midnight timer ── re-computes at day boundary
```

## Components and Interfaces

### 1. `computeDaysElapsed` (Pure Function)

**Location:** `src/utils/kpiBadgeUtils.ts`

```typescript
/**
 * Computes the number of full calendar days between a UTC timestamp
 * and the current local date.
 *
 * Returns null if lastCheckInDate is null (no records).
 * Returns 0 if the last check-in was today (local time).
 * Returns positive integer for past days.
 */
export function computeDaysElapsed(
  lastCheckInDateUtc: string | null,
  now: Date = new Date()
): number | null {
  if (lastCheckInDateUtc === null) return null;

  // Convert UTC ISO string to local date (year, month, day only)
  const lastDate = new Date(lastCheckInDateUtc);
  const lastLocalDate = new Date(
    lastDate.getFullYear(),
    lastDate.getMonth(),
    lastDate.getDate()
  );

  // Current local date (strip time)
  const nowLocalDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  // Calendar day difference
  const diffMs = nowLocalDate.getTime() - lastLocalDate.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);

  return Math.max(0, diffDays);
}
```

### 2. `formatBadgeText` (Pure Function)

**Location:** `src/utils/kpiBadgeUtils.ts`

```typescript
/**
 * Formats the days-elapsed number for badge display.
 * Caps at "99+" for values > 99.
 */
export function formatBadgeText(daysElapsed: number): string {
  if (daysElapsed > 99) return '99+';
  return String(daysElapsed);
}
```

### 3. `getBadgeFontSize` (Pure Function)

**Location:** `src/utils/kpiBadgeUtils.ts`

```typescript
/**
 * Returns the font size for the badge number.
 * 12pt for single-digit, 10pt for multi-digit.
 */
export function getBadgeFontSize(daysElapsed: number): number {
  return daysElapsed < 10 ? 12 : 10;
}
```

### 4. `getBadgeWidth` (Pure Function)

**Location:** `src/utils/kpiBadgeUtils.ts`

```typescript
/**
 * Computes badge width. Minimum 20pt diameter.
 * For multi-digit: text width approximation + 8pt padding.
 * For "99+": fixed 28pt.
 */
export function getBadgeWidth(daysElapsed: number): number {
  if (daysElapsed < 10) return 20; // single digit — circle
  if (daysElapsed > 99) return 28; // "99+" — fixed capsule
  // 2 digits: ~14pt text + 8pt padding = 22pt minimum, floor to 22
  return 22;
}
```

### 5. `getAccessibilityLabel` (Pure Function)

**Location:** `src/utils/kpiBadgeUtils.ts`

```typescript
/**
 * Builds the FAB's accessibility label based on badge state.
 */
export function getAccessibilityLabel(daysElapsed: number | null): string {
  const base = 'Check in on how you\'re doing';
  if (daysElapsed === null || daysElapsed === 0) return base;
  const dayWord = daysElapsed === 1 ? 'day' : 'days';
  return `${base}, ${daysElapsed} ${dayWord} since last check-in`;
}
```

### 6. KPI Store Extension

**Location:** `src/stores/kpiStore.ts` (extend existing)

New state fields and actions:

```typescript
export interface KpiState {
  // ... existing fields ...
  lastCheckInDate: string | null; // UTC ISO 8601 or null
  lastCheckInLoaded: boolean;

  // New actions
  loadLastCheckIn: () => Promise<void>;
  refreshDaysElapsed: () => Promise<void>;
}
```

**`loadLastCheckIn` implementation:**

```typescript
async loadLastCheckIn() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ recorded_at: string }>(
    'SELECT recorded_at FROM kpi_records ORDER BY recorded_at DESC LIMIT 1'
  );
  set({ lastCheckInDate: row?.recorded_at ?? null, lastCheckInLoaded: true });
}
```

**`refreshDaysElapsed` implementation:**
Same as `loadLastCheckIn` — re-queries the DB and updates cache. Used by foreground resume and midnight timer.

**`recordKpi` modification:**
After the existing record insert, immediately update `lastCheckInDate` in the store with the new record's `recordedAt` timestamp (avoids an extra DB read):

```typescript
// Inside recordKpi, after successful insert:
set({ lastCheckInDate: recordedAt });
```

### 7. `DaysSinceBadge` Component

**Location:** `src/components/wallet/DaysSinceBadge.tsx`

```typescript
interface DaysSinceBadgeProps {
  daysElapsed: number | null;
}
```

**Rendering logic:**
- If `daysElapsed` is null or 0 → render nothing (badge hidden)
- If `daysElapsed` >= 1 → render red badge with formatted text

**Animation:**
- Uses Reanimated `useSharedValue` for badge scale (0 → 1)
- When `daysElapsed` transitions from 0/null to >= 1, triggers `withSpring(1, { damping: 12, stiffness: 180 })`
- When transitioning back to hidden, snaps scale to 0 (no exit animation needed — FAB hides the badge as a whole)
- Badge is a child of the FAB's `Animated.View`, so it inherits FAB show/hide animation automatically

**Layout:**
- `position: 'absolute'`, `top: -4`, `right: -4`
- `pointerEvents: 'none'` — does not intercept touches
- `accessibilityElementsHidden: true`, `importantForAccessibility: 'no'`

### 8. Midnight Rollover Timer

**Location:** Inside `KpiFab` component (or a custom hook `useMidnightRefresh`)

```typescript
function useMidnightRefresh(onMidnight: () => void) {
  useEffect(() => {
    const msUntilMidnight = getMsUntilMidnight();
    const timer = setTimeout(() => {
      onMidnight();
      // Re-schedule for next midnight (recursive via re-render)
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, [/* re-runs when lastCheckInDate changes to reschedule */]);
}

function getMsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  return midnight.getTime() - now.getTime();
}
```

### 9. Foreground Resume Handler

**Location:** Inside `KpiFab` component

```typescript
useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      refreshDaysElapsed();
    }
  });
  return () => subscription.remove();
}, []);
```

### 10. `formatExplanationMessage` (Pure Function)

**Location:** `src/utils/kpiBadgeUtils.ts`

```typescript
/**
 * Generates the badge explanation message shown at the top of the focused
 * Daily Check-in card. Returns null when no message should be displayed.
 *
 * Uses singular "day" for 1, plural "days" for 2+.
 * The daysElapsed value is a snapshot captured at the moment of card open.
 */
export function formatExplanationMessage(daysElapsed: number | null): string | null {
  if (daysElapsed === null || daysElapsed === 0) return null;
  const dayWord = daysElapsed === 1 ? 'day' : 'days';
  return `It's been ${daysElapsed} ${dayWord} since your last check-in`;
}
```

### 11. `BadgeExplanationBanner` Component

**Location:** `src/components/wallet/BadgeExplanationBanner.tsx`

```typescript
interface BadgeExplanationBannerProps {
  /** Snapshot of daysElapsed at the moment the card was opened */
  daysElapsedSnapshot: number | null;
  /** Whether the user has just completed a check-in (hides the banner) */
  checkInCompleted: boolean;
}
```

**Rendering logic:**
- If `daysElapsedSnapshot` is null or 0, or `checkInCompleted` is true → render nothing
- Otherwise, render a warm-toned text banner at the top of the card content area

**Visual design:**
- Soft background (e.g., `#FFF3E0` warm amber tint) with rounded corners
- Text: 14pt, `#5D4037` (warm brown), centered
- Padding: 12pt vertical, 16pt horizontal
- Margin bottom: 12pt (space before card controls)
- No icon — text-only to keep it calm and brief

**Placement in FocusedCardView:**
- Rendered as the first child inside the card's scrollable content area, above the description/controls
- Only rendered when the card is the Daily Check-in card (identified by `card.sourceLibraryId` matching the KPI card ID)

### 12. KPI FAB → Focused Card: Snapshot Flow

When the user taps the KPI_FAB:
1. The current `daysElapsed` value is read from the store (already computed)
2. This value is passed as a **snapshot** prop (`daysElapsedSnapshot`) to the `FocusedCardView` / `BadgeExplanationBanner`
3. The snapshot is captured once at open time and does not update if time passes while the card is open
4. After check-in completion, the banner hides via the `checkInCompleted` flag (set by the existing `recordKpi` flow)

**Integration point in WalletScreen.tsx:**
```typescript
// When KPI FAB is pressed, capture the snapshot
const [kpiDaysSnapshot, setKpiDaysSnapshot] = useState<number | null>(null);

const handleKpiFabPress = useCallback(() => {
  const current = computeDaysElapsed(kpiStore.lastCheckInDate);
  setKpiDaysSnapshot(current);
  // ... existing logic to focus the KPI card
}, [kpiStore.lastCheckInDate]);
```

### 13. `validateDaysAgoInput` (Pure Function)

**Location:** `src/utils/kpiBadgeUtils.ts`

```typescript
/**
 * Validates admin input for "create fake record" action.
 * Returns an error message string if invalid, or null if valid.
 *
 * Valid: positive integer (1 or greater).
 * Invalid: 0, negative, non-numeric, empty string, decimals.
 */
export function validateDaysAgoInput(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return 'Please enter a number of days';
  const num = Number(trimmed);
  if (isNaN(num)) return 'Please enter a valid number';
  if (!Number.isInteger(num)) return 'Please enter a whole number';
  if (num <= 0) return 'Must be at least 1 day';
  return null; // valid
}
```

### 14. `computeFakeRecordTimestamp` (Pure Function)

**Location:** `src/utils/kpiBadgeUtils.ts`

```typescript
/**
 * Computes the recorded_at ISO timestamp for a fake KPI record,
 * set to the specified number of days before the reference date.
 */
export function computeFakeRecordTimestamp(
  daysAgo: number,
  now: Date = new Date()
): string {
  const target = new Date(now);
  target.setDate(target.getDate() - daysAgo);
  return target.toISOString();
}
```

### 15. `AdminKpiBadgeTools` Component

**Location:** `src/components/settings/AdminKpiBadgeTools.tsx`

```typescript
interface AdminKpiBadgeToolsProps {
  /** Provided by parent — only rendered when admin mode is active */
}
```

**UI layout:**
- Section header: "🧪 KPI Badge Testing" (or similar)
- **Create Fake Record** subsection:
  - Text input: "Days ago" (numeric keyboard)
  - "Create Record" button
  - Inline validation error text (red, below input)
- **Reset** subsection:
  - "Reset All KPI Records" button (destructive style — red text)
  - Confirmation alert before executing (standard Alert.alert with Cancel/Reset)
- Wrapped in a `View` with a border/divider separating it from normal settings

**Behavior:**
- Only rendered when `useAdminStore().isAdminMode === true`
- On "Create Record" press:
  1. Validate input via `validateDaysAgoInput`
  2. If invalid → show inline error, do not proceed
  3. If valid → call `kpiService.createFakeRecord(daysAgo)` → update store
- On "Reset All" press:
  1. Show confirmation alert
  2. If confirmed → call `kpiService.resetAllRecords()` → clear store

### 16. KPI Store Extension for Admin Tools

**Location:** `src/stores/kpiStore.ts` (extend existing)

New actions added to `KpiState`:

```typescript
export interface KpiState {
  // ... existing fields ...
  lastCheckInDate: string | null;
  lastCheckInLoaded: boolean;

  // Existing actions
  loadLastCheckIn: () => Promise<void>;
  refreshDaysElapsed: () => Promise<void>;

  // New admin actions
  createFakeRecord: (daysAgo: number) => Promise<void>;
  resetAllRecords: () => Promise<void>;
}
```

**`createFakeRecord` implementation:**
```typescript
async createFakeRecord(daysAgo: number) {
  const db = await getDatabase();
  const recordedAt = computeFakeRecordTimestamp(daysAgo);
  const id = generateId(); // using expo-crypto UUID
  await db.runAsync(
    'INSERT INTO kpi_records (id, value, note, kpi_label, recorded_at) VALUES (?, ?, ?, ?, ?)',
    [id, 0, 'Fake admin record', 'admin-test', recordedAt]
  );
  // Update cache — the fake record may or may not be the most recent
  // Re-query to get the actual latest
  await get().loadLastCheckIn();
}
```

**`resetAllRecords` implementation:**
```typescript
async resetAllRecords() {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM kpi_records');
  set({ lastCheckInDate: null, lastCheckInLoaded: true });
}
```

### 17. SettingsScreen Integration

**Location:** `src/screens/SettingsScreen.tsx`

The `AdminKpiBadgeTools` component is conditionally rendered inside the existing SettingsScreen:

```typescript
import { useAdminStore } from '@/stores/adminStore';
import AdminKpiBadgeTools from '@/components/settings/AdminKpiBadgeTools';

function SettingsScreen({ navigation }: Props) {
  const { isAdminMode } = useAdminStore();

  return (
    // ... existing settings content ...
    {isAdminMode && <AdminKpiBadgeTools />}
    // ... rest of settings ...
  );
}
```

The admin section is placed at the bottom of the Settings scroll area, after all normal user-facing settings, and is completely absent from the component tree when `isAdminMode` is false.

## Data Models

No schema changes required. The feature reads from the existing `kpi_records` table:

```sql
-- Existing table (already indexed)
CREATE TABLE kpi_records (
  id TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  note TEXT,
  kpi_label TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

-- Existing index (already present)
CREATE INDEX idx_kpi_records_recorded_at ON kpi_records(recorded_at);
```

**Query used by `loadLastCheckIn`:**
```sql
SELECT recorded_at FROM kpi_records ORDER BY recorded_at DESC LIMIT 1
```

This query uses the existing descending index on `recorded_at` for O(1) lookup.

## Interfaces

### KPI Badge Utilities (`src/utils/kpiBadgeUtils.ts`)

```typescript
export function computeDaysElapsed(lastCheckInDateUtc: string | null, now?: Date): number | null;
export function formatBadgeText(daysElapsed: number): string;
export function getBadgeFontSize(daysElapsed: number): number;
export function getBadgeWidth(daysElapsed: number): number;
export function getAccessibilityLabel(daysElapsed: number | null): string;
export function formatExplanationMessage(daysElapsed: number | null): string | null;
export function validateDaysAgoInput(input: string): string | null;
export function computeFakeRecordTimestamp(daysAgo: number, now?: Date): string;
```

### Extended KPI Store

```typescript
// Added to existing KpiState interface
lastCheckInDate: string | null;
lastCheckInLoaded: boolean;
loadLastCheckIn: () => Promise<void>;
refreshDaysElapsed: () => Promise<void>;
createFakeRecord: (daysAgo: number) => Promise<void>;
resetAllRecords: () => Promise<void>;
```

### DaysSinceBadge Props

```typescript
interface DaysSinceBadgeProps {
  daysElapsed: number | null;
}
```

### BadgeExplanationBanner Props

```typescript
interface BadgeExplanationBannerProps {
  daysElapsedSnapshot: number | null;
  checkInCompleted: boolean;
}
```

### AdminKpiBadgeTools Props

```typescript
interface AdminKpiBadgeToolsProps {
  // No required props — reads admin state from useAdminStore
}
```

## Testing Strategy

### Unit Tests (Example-Based)
- Badge hidden when `lastCheckInDate` is null (Req 1.3)
- Store updates `lastCheckInDate` immediately after `recordKpi` (Req 1.4, 5.3)
- Midnight timer reschedules correctly (Req 2.2)
- AppState 'active' triggers refresh (Req 2.3)
- Badge component renders correct styles — red fill, white text (Req 3.1)
- Badge positioned at top-right with correct offsets (Req 3.3)
- Badge inherits FAB animation as child element (Req 4.1, 4.2)
- Badge has independent scale-up spring on appear (Req 4.3)
- Badge has `pointerEvents: 'none'` (Req 4.4)
- SQL query uses `ORDER BY recorded_at DESC LIMIT 1` (Req 5.1)
- Badge excluded from accessibility focus order (Req 6.3)
- Explanation banner hidden after check-in completion (Req 7.4)
- Admin tools section visible only in admin mode (Req 8.1, 8.6)
- Store `lastCheckInDate` updated after fake record creation (Req 8.3)
- Reset clears all records and nulls store (Req 8.4)

### Property Tests (fast-check)
- `computeDaysElapsed` returns correct calendar day difference for random UTC timestamps and reference dates
- `formatBadgeText` caps at "99+" for values > 99, returns string number otherwise
- `getBadgeFontSize` returns 12 for 1–9, 10 for 10+
- `getBadgeWidth` always returns >= 20
- `getAccessibilityLabel` includes count only when daysElapsed >= 1
- `formatExplanationMessage` returns correct message with singular/plural and includes the numeric count for all daysElapsed >= 1, returns null for 0 and null
- `validateDaysAgoInput` rejects all invalid inputs (0, negative, non-numeric, empty, decimals) and accepts all positive integers
- `computeFakeRecordTimestamp` produces a timestamp exactly N calendar days before the reference date for any positive integer N

## Error Handling

| Scenario | Behavior |
|----------|----------|
| DB query fails on `loadLastCheckIn` | Set `lastCheckInDate` to null → badge hidden (safe default) |
| `recorded_at` contains invalid ISO string | `new Date(invalid)` → NaN → `computeDaysElapsed` returns null → badge hidden |
| Device clock set to past (negative diff) | `Math.max(0, diffDays)` ensures non-negative result |
| Store not yet loaded (`lastCheckInLoaded` is false) | Badge hidden until first load completes |
| Admin enters invalid days-ago value | Inline validation error displayed, no DB write attempted |
| Admin reset fails (DB error) | Error caught, store not cleared, user notified via Alert |
| `createFakeRecord` DB write fails | Error caught, store remains unchanged, user notified via Alert |
| Card opened with stale daysElapsed (clock drift) | Snapshot is taken at open time — acceptable since it reflects the badge the user saw |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Calendar day computation is correct

*For any* valid UTC ISO 8601 timestamp `lastCheckIn` and any reference date `now`, `computeDaysElapsed(lastCheckIn, now)` SHALL equal the number of calendar days between the local date of `lastCheckIn` and the local date of `now`, and SHALL never be negative.

**Validates: Requirements 2.1**

### Property 2: Badge visibility matches days elapsed

*For any* `lastCheckInDate` and `now` pair, the badge SHALL be visible if and only if `computeDaysElapsed(lastCheckInDate, now)` returns a value >= 1. When `computeDaysElapsed` returns null or 0, the badge SHALL be hidden.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 3: Badge text formatting and capping

*For any* positive integer `daysElapsed`, `formatBadgeText(daysElapsed)` SHALL return `String(daysElapsed)` when daysElapsed is in [1, 99], and SHALL return `"99+"` when daysElapsed > 99. Additionally, `getBadgeFontSize` SHALL return 12 for single-digit values and 10 for multi-digit values.

**Validates: Requirements 3.4, 3.5**

### Property 4: Badge minimum sizing

*For any* positive integer `daysElapsed`, `getBadgeWidth(daysElapsed)` SHALL return a value >= 20 (the minimum badge diameter).

**Validates: Requirements 3.2**

### Property 5: Accessibility label correctness

*For any* `daysElapsed` value, `getAccessibilityLabel(daysElapsed)` SHALL include the days count string when daysElapsed >= 1, and SHALL equal the base label without days information when daysElapsed is null or 0.

**Validates: Requirements 6.1, 6.2**

### Property 6: Explanation message formatting and visibility

*For any* `daysElapsed` value >= 1, `formatExplanationMessage(daysElapsed)` SHALL return a non-null string containing the numeric count and the correct singular ("day") or plural ("days") form. For daysElapsed = 0 or null, it SHALL return null.

**Validates: Requirements 7.1, 7.2, 7.3, 7.5**

### Property 7: Admin days-ago input validation

*For any* string that represents a non-positive number (0 or negative), a non-numeric value, an empty/whitespace string, or a decimal, `validateDaysAgoInput` SHALL return a non-null error message. For any string representing a positive integer (1 or greater), it SHALL return null.

**Validates: Requirements 8.5**

### Property 8: Fake record timestamp computation

*For any* positive integer `daysAgo` and reference date `now`, `computeFakeRecordTimestamp(daysAgo, now)` SHALL produce a UTC ISO timestamp such that the calendar day difference between the resulting timestamp and `now` equals exactly `daysAgo`.

**Validates: Requirements 8.2**
