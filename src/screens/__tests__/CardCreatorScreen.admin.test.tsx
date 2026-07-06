/**
 * Unit tests for triple-tap gesture and admin mode toggle on CardCreatorScreen.
 *
 * Validates: Requirements 1.1, 1.4, 1.5
 *
 * Tests the gesture timing logic (500ms window), toggle on/off behavior,
 * and admin mode reset on navigation blur.
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { useAdminStore } from '@/stores/adminStore';

// --- Fake timers for controlling Date.now() ---
jest.useFakeTimers();

// --- Navigation mock ---
type BlurListener = () => void;
let blurListeners: BlurListener[] = [];
const mockGoBack = jest.fn();
const mockSetOptions = jest.fn();
const mockAddListener = jest.fn((event: string, callback: BlurListener) => {
  if (event === 'blur') {
    blurListeners.push(callback);
  }
  return () => {
    blurListeners = blurListeners.filter((l) => l !== callback);
  };
});

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    setOptions: mockSetOptions,
    addListener: mockAddListener,
  }),
  useFocusEffect: jest.fn(),
}));

// --- Mock services and data dependencies ---
jest.mock('@/services/cardService', () => ({
  createCardService: () => ({
    getById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'test-id' }),
    update: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@/services/adminCardService', () => ({
  createLibraryCard: jest.fn().mockResolvedValue({ id: 'admin-lib-test' }),
}));

jest.mock('@/services/backgroundOverlayService', () => ({
  removeOverlay: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/emotionTagService', () => ({
  getTagsForCard: jest.fn().mockResolvedValue([]),
  setTagsForCard: jest.fn().mockResolvedValue(undefined),
  clearTagsForCard: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/analyticsEventLogger', () => ({
  logEvent: jest.fn(),
}));

jest.mock('@/data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    execAsync: jest.fn(),
    runAsync: jest.fn(),
  }),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-1234',
}));

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: jest.fn((selector) => {
    const state = { loadCards: jest.fn().mockResolvedValue(undefined) };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/components/creator/Step1Shell', () => {
  const { View } = require('react-native');
  return function MockStep1Shell() {
    return <View testID="step1-shell" />;
  };
});

jest.mock('@/components/creator/Step2Controls', () => {
  const { View } = require('react-native');
  return function MockStep2Controls() {
    return <View testID="step2-controls" />;
  };
});

jest.mock('@/components/creator/Step3Preview', () => {
  const { View } = require('react-native');
  return function MockStep3Preview() {
    return <View testID="step3-preview" />;
  };
});

// Import the component under test AFTER mocks are set up
import CardCreatorScreen from '@/screens/CardCreatorScreen';

// Helper: find the Pressable wrapping the header title by looking for onPress and nested text containing "Tool"
function findHeaderPressable(renderer: ReactTestRenderer) {
  const root = renderer.root;
  // Find all elements that have onPress prop
  const withOnPress = root.findAll(
    (node) =>
      node.props.onPress !== undefined &&
      typeof node.props.onPress === 'function'
  );

  // Among those, find the one whose children text includes "Tool"
  return withOnPress.find((node) => {
    try {
      const allChildren = root.findAll(() => true);
      // Check if this node has a Text child containing "Tool"
      const descendants = node.findAll((child) => {
        if (child.props && child.props.children) {
          const text = Array.isArray(child.props.children)
            ? child.props.children.join('')
            : String(child.props.children);
          return text.includes('Tool') && text.includes('Step');
        }
        return false;
      });
      return descendants.length > 0;
    } catch {
      return false;
    }
  });
}

// Helper to simulate a press on the header title
function pressHeaderTitle(renderer: ReactTestRenderer) {
  const pressable = findHeaderPressable(renderer);
  if (!pressable) throw new Error('Header title Pressable not found');
  act(() => {
    pressable.props.onPress();
  });
}

// Helper to trigger navigation blur event
function triggerBlur() {
  act(() => {
    blurListeners.forEach((listener) => listener());
  });
}

describe('CardCreatorScreen — Triple-tap gesture and admin mode', () => {
  let renderer: ReactTestRenderer;

  const defaultProps = {
    navigation: {
      goBack: mockGoBack,
      setOptions: mockSetOptions,
      addListener: mockAddListener,
    } as any,
    route: { params: undefined, key: 'test', name: 'CardCreator' as const },
  };

  beforeEach(() => {
    // Reset admin store
    useAdminStore.setState({ isAdminMode: false });
    blurListeners = [];
    jest.clearAllMocks();
    // Set a known start time
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
    }
  });

  describe('Requirement 1.1: Three taps within 500ms activates admin mode', () => {
    it('activates admin mode with three rapid taps', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      // Three taps at t=0, t=100, t=200 — all within 500ms
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);

      jest.setSystemTime(new Date('2024-01-01T00:00:00.100Z'));
      pressHeaderTitle(renderer);

      jest.setSystemTime(new Date('2024-01-01T00:00:00.200Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(true);
    });

    it('activates admin mode with three taps exactly at the 500ms boundary', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      // First tap at t=0, second at t=200, third at t=499 (within 500ms from first)
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);

      jest.setSystemTime(new Date('2024-01-01T00:00:00.200Z'));
      pressHeaderTitle(renderer);

      jest.setSystemTime(new Date('2024-01-01T00:00:00.499Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(true);
    });
  });

  describe('Timing edge cases: taps outside 500ms window do NOT activate', () => {
    it('does NOT activate when second tap is outside the 500ms window', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      // First tap at t=0
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);

      // Second tap at t=501 — outside window, resets counter
      jest.setSystemTime(new Date('2024-01-01T00:00:00.501Z'));
      pressHeaderTitle(renderer);

      // Third tap at t=600 — only 2nd tap in new window
      jest.setSystemTime(new Date('2024-01-01T00:00:00.600Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('does NOT activate when third tap exceeds 500ms from first', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      // First tap at t=0, second at t=300, third at t=501 (outside 500ms from first)
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);

      jest.setSystemTime(new Date('2024-01-01T00:00:00.300Z'));
      pressHeaderTitle(renderer);

      jest.setSystemTime(new Date('2024-01-01T00:00:00.501Z'));
      pressHeaderTitle(renderer);

      // The third tap at t=501 resets the counter (> 500ms from first tap at t=0),
      // so it becomes the new "first tap"
      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('two taps in window then one outside does NOT activate', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      // Two taps within window: t=0, t=100
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);

      jest.setSystemTime(new Date('2024-01-01T00:00:00.100Z'));
      pressHeaderTitle(renderer);

      // Third tap well outside: t=1000
      jest.setSystemTime(new Date('2024-01-01T00:00:01.000Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('single tap does not activate admin mode', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('two taps within window does not activate admin mode', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);

      jest.setSystemTime(new Date('2024-01-01T00:00:00.100Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });
  });

  describe('Requirement 1.5: Toggle on/off behavior', () => {
    it('deactivates admin mode with another triple-tap when already active', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      // First triple-tap: activate
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:00.100Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:00.200Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(true);

      // Second triple-tap: deactivate
      jest.setSystemTime(new Date('2024-01-01T00:00:01.000Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:01.100Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:01.200Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('six rapid taps activates once then deactivates (double triple-tap)', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      // Six rapid taps all within a tight timeframe
      // Taps 1-3 within first 500ms window → activate
      // After activation, counter resets to 0 — taps 4-6 form new triple-tap → deactivate
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:00.050Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:00.100Z'));
      pressHeaderTitle(renderer);

      // Admin is now active after first 3 taps
      expect(useAdminStore.getState().isAdminMode).toBe(true);

      // Next 3 taps (counter was reset after activation)
      jest.setSystemTime(new Date('2024-01-01T00:00:00.150Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:00.200Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:00.250Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });
  });

  describe('Requirement 1.4: Admin mode resets on navigation blur', () => {
    it('resets admin mode to false when navigation blur event fires', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      // Activate admin mode
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:00.100Z'));
      pressHeaderTitle(renderer);
      jest.setSystemTime(new Date('2024-01-01T00:00:00.200Z'));
      pressHeaderTitle(renderer);

      expect(useAdminStore.getState().isAdminMode).toBe(true);

      // Simulate navigation blur
      triggerBlur();

      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('blur is a no-op when admin mode is already inactive', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      expect(useAdminStore.getState().isAdminMode).toBe(false);

      // Simulate navigation blur
      triggerBlur();

      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('registers blur listener on mount', () => {
      act(() => {
        renderer = create(<CardCreatorScreen {...defaultProps} />);
      });

      expect(mockAddListener).toHaveBeenCalledWith('blur', expect.any(Function));
    });
  });
});
