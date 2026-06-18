/**
 * Unit tests for accessibility utilities.
 *
 * Validates: Requirements 17.3
 */

import { AccessibilityInfo } from 'react-native';
import { announce, announceCardTransition, A11Y_LABELS, MIN_TAP_TARGET } from '../accessibility';

jest.mock('react-native', () => ({
  AccessibilityInfo: {
    announceForAccessibility: jest.fn(),
    isScreenReaderEnabled: jest.fn(),
  },
  Platform: { OS: 'ios' },
}));

describe('announce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls AccessibilityInfo.announceForAccessibility with message', () => {
    announce('Card expanded');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Card expanded');
  });

  it('does not call announceForAccessibility with empty string', () => {
    announce('');
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });
});

describe('announceCardTransition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('announces focused with card title', () => {
    announceCardTransition('focused', 'Deep Breathing');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Deep Breathing focused');
  });

  it('announces focused without card title', () => {
    announceCardTransition('focused');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Card focused');
  });

  it('announces expanded state', () => {
    announceCardTransition('expanded');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Card expanded, showing controls');
  });

  it('announces collapsed state', () => {
    announceCardTransition('collapsed');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Card collapsed');
  });

  it('announces completed state', () => {
    announceCardTransition('completed');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Completed successfully');
  });

  it('announces archived state', () => {
    announceCardTransition('archived');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Card archived');
  });

  it('announces restored state', () => {
    announceCardTransition('restored');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Card restored to wallet');
  });
});

describe('A11Y_LABELS', () => {
  it('contains required wallet labels', () => {
    expect(A11Y_LABELS.WALLET_HEADER).toBe('My Wallet');
    expect(A11Y_LABELS.ADD_TOOL).toBe('Add tool to wallet');
  });

  it('contains required card interaction labels', () => {
    expect(A11Y_LABELS.CARD_EXPAND).toBe('Expand card to see full content');
    expect(A11Y_LABELS.CARD_COLLAPSE).toBe('Collapse card');
  });
});

describe('MIN_TAP_TARGET', () => {
  it('meets WCAG 2.1 AA minimum of 44x44 points', () => {
    expect(MIN_TAP_TARGET.width).toBeGreaterThanOrEqual(44);
    expect(MIN_TAP_TARGET.height).toBeGreaterThanOrEqual(44);
  });
});
