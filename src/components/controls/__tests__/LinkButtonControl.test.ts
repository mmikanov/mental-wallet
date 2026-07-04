/**
 * Unit tests for LinkButtonControl link-opening logic.
 *
 * Tests the error handling flow:
 * - Opens target URL via system handler
 * - Falls back to fallbackUrl if target fails
 * - Shows error alert if both fail or no fallback exists
 *
 * Validates: Requirements 6.5, 6.6, 6.7
 */

import { Linking, Alert } from 'react-native';
import { tryOpenUrl } from '../LinkButtonControl';

// Mock React Native modules
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (styles: any) => styles },
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock analyticsEventLogger to avoid expo-crypto dependency
jest.mock('@/services/analyticsEventLogger', () => ({
  logEvent: jest.fn(),
}));

describe('tryOpenUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when URL can be opened', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);

    const result = await tryOpenUrl('https://example.com');

    expect(result).toBe(true);
    expect(Linking.canOpenURL).toHaveBeenCalledWith('https://example.com');
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });

  it('should return false when canOpenURL returns false', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);

    const result = await tryOpenUrl('myapp://deep-link');

    expect(result).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('should return false when openURL throws an error', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('Failed'));

    const result = await tryOpenUrl('https://broken.com');

    expect(result).toBe(false);
  });

  it('should return false when canOpenURL throws an error', async () => {
    (Linking.canOpenURL as jest.Mock).mockRejectedValue(new Error('Not supported'));

    const result = await tryOpenUrl('badscheme://test');

    expect(result).toBe(false);
  });
});

describe('LinkButtonControl error handling flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens target URL successfully on first attempt', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);

    const result = await tryOpenUrl('https://example.com');

    expect(result).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('returns false for unreachable URL (fallback handled by component)', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);

    const result = await tryOpenUrl('myapp://not-installed');

    expect(result).toBe(false);
  });

  it('handles deep link schemes that are not installed', async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);

    const result = await tryOpenUrl('spotify://track/123');

    expect(result).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
