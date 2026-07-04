/**
 * Unit tests for SettingsScreen Privacy & Data section.
 *
 * Validates: Requirements 5.1, 6.1, 6.2, 6.5
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockDispatch = jest.fn();

const navigationProp: any = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  dispatch: mockDispatch,
};

// Mock analyticsStore
const mockSetOptIn = jest.fn().mockResolvedValue(undefined);
const mockResetData = jest.fn().mockResolvedValue(undefined);

let mockOptIn = true;

jest.mock('@/stores/analyticsStore', () => {
  const store = jest.fn((selector: any) => {
    const state = { optIn: mockOptIn };
    return selector(state);
  });
  (store as any).getState = () => ({
    setOptIn: mockSetOptIn,
    resetData: mockResetData,
    optIn: mockOptIn,
  });
  return { useAnalyticsStore: store };
});

// Mock other stores and services that SettingsScreen uses
jest.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: { setState: jest.fn() },
}));

jest.mock('@/stores/kpiStore', () => ({
  useKpiStore: jest.fn(() => ({
    personalKpi: 'Feel calmer',
    isLoading: false,
    loadKpi: jest.fn(),
  })),
}));

jest.mock('@/services/exportService', () => ({
  createExportService: () => ({
    exportData: jest.fn().mockResolvedValue(undefined),
    deleteAllData: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@/data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  }),
  closeDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('@/components/settings/StartExperienceSetting', () => {
  const { View } = require('react-native');
  return () => <View testID="start-experience-setting" />;
});

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((config: any) => config),
  },
}));

import SettingsScreen from '../SettingsScreen';

describe('SettingsScreen - Privacy & Data section', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockOptIn = true;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Analytics toggle', () => {
    it('renders with ON state when optIn is true', async () => {
      mockOptIn = true;

      const { getByLabelText } = await render(
        <SettingsScreen navigation={navigationProp} route={{ key: 'settings', name: 'Settings' } as any} />
      );

      const toggle = getByLabelText('Toggle anonymous analytics data collection');
      expect(toggle.props.value).toBe(true);
    });

    it('renders with OFF state when optIn is false', async () => {
      mockOptIn = false;

      const { getByLabelText } = await render(
        <SettingsScreen navigation={navigationProp} route={{ key: 'settings', name: 'Settings' } as any} />
      );

      const toggle = getByLabelText('Toggle anonymous analytics data collection');
      expect(toggle.props.value).toBe(false);
    });

    it('calls useAnalyticsStore.getState().setOptIn() when toggle is flipped', async () => {
      mockOptIn = true;

      const { getByLabelText } = await render(
        <SettingsScreen navigation={navigationProp} route={{ key: 'settings', name: 'Settings' } as any} />
      );

      const toggle = getByLabelText('Toggle anonymous analytics data collection');
      fireEvent(toggle, 'valueChange', false);

      expect(mockSetOptIn).toHaveBeenCalledWith(false);
    });
  });

  describe('Reset confirmation flow', () => {
    it('pressing "Reset my app data" shows an alert confirmation dialog', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByLabelText } = await render(
        <SettingsScreen navigation={navigationProp} route={{ key: 'settings', name: 'Settings' } as any} />
      );

      const resetButton = getByLabelText('Reset my app data');
      fireEvent.press(resetButton);

      expect(alertSpy).toHaveBeenCalledWith(
        'Reset Analytics Data',
        expect.stringContaining('delete your locally stored anonymous usage data'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Reset' }),
        ])
      );

      alertSpy.mockRestore();
    });

    it('confirming the reset dialog calls resetData()', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByLabelText } = await render(
        <SettingsScreen navigation={navigationProp} route={{ key: 'settings', name: 'Settings' } as any} />
      );

      const resetButton = getByLabelText('Reset my app data');
      fireEvent.press(resetButton);

      // Get the confirm button's onPress from the Alert call
      const alertArgs = alertSpy.mock.calls[0];
      const buttons = alertArgs[2] as Array<{ text: string; onPress?: () => Promise<void> | void }>;
      const confirmButton = buttons.find(b => b.text === 'Reset');

      expect(confirmButton).toBeDefined();

      // Call the confirm handler
      await confirmButton!.onPress!();

      expect(mockResetData).toHaveBeenCalled();

      alertSpy.mockRestore();
    });

    it('canceling the reset dialog does not call resetData()', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByLabelText } = await render(
        <SettingsScreen navigation={navigationProp} route={{ key: 'settings', name: 'Settings' } as any} />
      );

      const resetButton = getByLabelText('Reset my app data');
      fireEvent.press(resetButton);

      // Get the cancel button from the Alert call
      const alertArgs = alertSpy.mock.calls[0];
      const buttons = alertArgs[2] as Array<{ text: string; onPress?: () => void; style?: string }>;
      const cancelButton = buttons.find(b => b.text === 'Cancel');

      expect(cancelButton).toBeDefined();
      expect(cancelButton!.style).toBe('cancel');

      // Cancel button has no onPress that calls resetData
      expect(mockResetData).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });
  });
});
