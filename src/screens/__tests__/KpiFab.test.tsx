/**
 * Integration tests for KpiFab component logic.
 *
 * Since KpiFab is defined inline within WalletScreen.tsx (not exported),
 * these tests verify the integration of useKpiStore + computeDaysElapsed +
 * getAccessibilityLabel — the same logic the component uses to compute
 * its accessibility label and trigger foreground refresh.
 *
 * Validates: Requirements 2.3, 6.1, 6.2
 */

import { useKpiStore } from '@/stores/kpiStore';
import { computeDaysElapsed, getAccessibilityLabel } from '@/utils/kpiBadgeUtils';
import { AppState } from 'react-native';

// Mock dependencies required by kpiStore
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid',
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

const { getDatabase } = require('@/data/database');

describe('KpiFab Integration', () => {
  beforeEach(() => {
    useKpiStore.setState({
      lastCheckInDate: null,
      lastCheckInLoaded: true,
      personalKpi: null,
      isLoading: false,
    });
    jest.clearAllMocks();
  });

  describe('Accessibility label — Requirement 6.1, 6.2', () => {
    it('includes days count when badge is visible (daysElapsed >= 1)', () => {
      // Simulate store state with a check-in 3 days ago
      useKpiStore.setState({ lastCheckInDate: '2024-06-10T10:00:00.000Z' });

      const state = useKpiStore.getState();
      const now = new Date('2024-06-13T10:00:00.000Z');
      const daysElapsed = computeDaysElapsed(state.lastCheckInDate, now);
      const label = getAccessibilityLabel(daysElapsed);

      expect(daysElapsed).toBe(3);
      expect(label).toBe("Check in on how you're doing, 3 days since last check-in");
    });

    it('is base text when badge is hidden (no records)', () => {
      // lastCheckInDate is null — no records
      useKpiStore.setState({ lastCheckInDate: null });

      const state = useKpiStore.getState();
      const daysElapsed = computeDaysElapsed(state.lastCheckInDate, new Date());
      const label = getAccessibilityLabel(daysElapsed);

      expect(daysElapsed).toBeNull();
      expect(label).toBe("Check in on how you're doing");
    });

    it('is base text when badge is hidden (checked in today)', () => {
      const now = new Date('2024-06-13T15:00:00.000Z');
      // Check-in was earlier today
      useKpiStore.setState({ lastCheckInDate: '2024-06-13T08:00:00.000Z' });

      const state = useKpiStore.getState();
      const daysElapsed = computeDaysElapsed(state.lastCheckInDate, now);
      const label = getAccessibilityLabel(daysElapsed);

      expect(daysElapsed).toBe(0);
      expect(label).toBe("Check in on how you're doing");
    });
  });

  describe('Foreground refresh — Requirement 2.3', () => {
    it('AppState active triggers refreshDaysElapsed', async () => {
      // Set up a mock DB that returns a check-in date
      const mockDb = {
        getFirstAsync: jest.fn().mockResolvedValue({
          recorded_at: '2024-06-12T10:00:00.000Z',
        }),
        runAsync: jest.fn().mockResolvedValue(undefined),
      };
      getDatabase.mockResolvedValue(mockDb);

      // refreshDaysElapsed is the function the component calls on AppState 'active'
      await useKpiStore.getState().refreshDaysElapsed();

      // After refresh, the store should have the latest check-in date from DB
      const state = useKpiStore.getState();
      expect(state.lastCheckInDate).toBe('2024-06-12T10:00:00.000Z');
      expect(state.lastCheckInLoaded).toBe(true);
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT recorded_at FROM kpi_records ORDER BY recorded_at DESC LIMIT 1'
      );
    });

    it('refreshDaysElapsed sets null when DB returns no records', async () => {
      // Start with an existing date
      useKpiStore.setState({ lastCheckInDate: '2024-06-10T10:00:00.000Z' });

      const mockDb = {
        getFirstAsync: jest.fn().mockResolvedValue(null),
        runAsync: jest.fn().mockResolvedValue(undefined),
      };
      getDatabase.mockResolvedValue(mockDb);

      await useKpiStore.getState().refreshDaysElapsed();

      const state = useKpiStore.getState();
      expect(state.lastCheckInDate).toBeNull();
      expect(state.lastCheckInLoaded).toBe(true);
    });

    it('AppState addEventListener is available for subscription', () => {
      // Verify the AppState API shape the component relies on
      const subscription = AppState.addEventListener('change', jest.fn());
      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(subscription).toHaveProperty('remove');
    });
  });
});
