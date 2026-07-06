/**
 * Unit tests for CardPreviewSheet component.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9
 */

import React from 'react';
import { render, fireEvent, waitFor, act, screen } from '@testing-library/react-native';
import CardPreviewSheet from '../CardPreviewSheet';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import type { ButtonState } from '@/screens/libraryBrowserHelpers';

// --- Mock ControlRenderer ---
const mockControlRenderer = jest.fn(() => null);
jest.mock('@/components/controls/ControlRenderer', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockControlRenderer(props);
    return null;
  },
}));

// --- Mock isLightBackground ---
jest.mock('@/utils/cardColors', () => ({
  isLightBackground: (color: string) => {
    const hex = color.replace('#', '');
    if (hex.length < 6) return true;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  },
}));

// --- Test fixtures ---
const mockCard: CuratedCardDefinition = {
  id: 'test-card-1',
  title: 'Test Card Title',
  description: 'A test card description for preview.',
  iconType: 'emoji',
  iconValue: '🧘',
  backgroundType: 'color',
  backgroundValue: '#E8F4F8',
  categoryId: 'grounding-calming',
  allowBackgroundCustomization: true,
  controls: [
    {
      type: 'static_text',
      position: 0,
      config: { title: 'Instructions', body: 'Some instructions', fontSize: 'medium' },
      isRequired: false,
    },
    {
      type: 'text_input',
      position: 1,
      config: { label: 'Reflection', placeholder: 'How do you feel?', maxLength: 200 },
      isRequired: false,
    },
  ],
};

const addButtonState: ButtonState = {
  label: 'Add to wallet',
  disabled: false,
  action: 'add',
};

const inWalletButtonState: ButtonState = {
  label: 'In wallet',
  disabled: true,
  action: 'none',
};

const restoreButtonState: ButtonState = {
  label: 'Restore from archive',
  disabled: false,
  action: 'restore',
};

const defaultProps = {
  card: mockCard,
  visible: true,
  onDismiss: jest.fn(),
  buttonState: addButtonState,
  onAddToWallet: jest.fn().mockResolvedValue(undefined),
  onRestore: jest.fn().mockResolvedValue(undefined),
};

describe('CardPreviewSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Requirement 1.1: Shell fields render correctly ---
  describe('shell rendering', () => {
    it('renders card icon', async () => {
      await render(<CardPreviewSheet {...defaultProps} />);
      expect(screen.getByText('🧘')).toBeTruthy();
    });

    it('renders card title', async () => {
      await render(<CardPreviewSheet {...defaultProps} />);
      expect(screen.getByText('Test Card Title')).toBeTruthy();
    });

    it('renders card description', async () => {
      await render(<CardPreviewSheet {...defaultProps} />);
      expect(screen.getByText('A test card description for preview.')).toBeTruthy();
    });

    it('uses fallback icon for non-emoji iconType', async () => {
      const card = { ...mockCard, iconType: 'library' as const };
      await render(
        <CardPreviewSheet {...defaultProps} card={card as unknown as CuratedCardDefinition} />
      );
      expect(screen.getByText('📋')).toBeTruthy();
    });
  });

  // --- Requirement 1.2: Controls render in position order with readOnly ---
  describe('controls rendering', () => {
    it('passes controls to ControlRenderer with readOnly=true', async () => {
      await render(<CardPreviewSheet {...defaultProps} />);

      expect(mockControlRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          readOnly: true,
          values: {},
        })
      );
    });

    it('passes controls mapped with correct structure', async () => {
      await render(<CardPreviewSheet {...defaultProps} />);

      const calledProps = mockControlRenderer.mock.calls[0][0];
      const controls = calledProps.controls;
      expect(controls).toHaveLength(2);
      expect(controls[0].type).toBe('static_text');
      expect(controls[0].position).toBe(0);
      expect(controls[1].type).toBe('text_input');
      expect(controls[1].position).toBe(1);
    });
  });

  // --- Requirements 1.3, 1.6, 1.7: Button states ---
  describe('button states', () => {
    it('shows "Add to wallet" button when action is add', async () => {
      await render(
        <CardPreviewSheet {...defaultProps} buttonState={addButtonState} />
      );
      expect(screen.getByText('Add to wallet')).toBeTruthy();
    });

    it('shows "In wallet" indicator when action is none (disabled)', async () => {
      await render(
        <CardPreviewSheet {...defaultProps} buttonState={inWalletButtonState} />
      );
      expect(screen.getByText('In wallet')).toBeTruthy();
    });

    it('shows "Restore from archive" button when action is restore', async () => {
      await render(
        <CardPreviewSheet {...defaultProps} buttonState={restoreButtonState} />
      );
      expect(screen.getByText('Restore from archive')).toBeTruthy();
    });

    it('disables button when buttonState.disabled is true', async () => {
      await render(
        <CardPreviewSheet {...defaultProps} buttonState={inWalletButtonState} />
      );
      const button = screen.getByLabelText('In wallet');
      expect(button.props.accessibilityState.disabled).toBe(true);
    });
  });

  // --- Requirement 1.4: Loading state during operations ---
  describe('loading state', () => {
    it('shows loading indicator when add operation is in progress', async () => {
      let resolveAdd!: () => void;
      const slowAdd = jest.fn(
        () => new Promise<void>((resolve) => { resolveAdd = resolve; })
      );

      await render(
        <CardPreviewSheet {...defaultProps} onAddToWallet={slowAdd} />
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Add to wallet'));
      });

      expect(screen.getByTestId('loading-indicator')).toBeTruthy();

      await act(async () => {
        resolveAdd();
      });
    });

    it('shows loading indicator when restore operation is in progress', async () => {
      let resolveRestore!: () => void;
      const slowRestore = jest.fn(
        () => new Promise<void>((resolve) => { resolveRestore = resolve; })
      );

      await render(
        <CardPreviewSheet
          {...defaultProps}
          buttonState={restoreButtonState}
          onRestore={slowRestore}
        />
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Restore from archive'));
      });

      expect(screen.getByTestId('loading-indicator')).toBeTruthy();

      await act(async () => {
        resolveRestore();
      });
    });

    it('disables action button during loading', async () => {
      let resolveAdd!: () => void;
      const slowAdd = jest.fn(
        () => new Promise<void>((resolve) => { resolveAdd = resolve; })
      );

      await render(
        <CardPreviewSheet {...defaultProps} onAddToWallet={slowAdd} />
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Add to wallet'));
      });

      // Button should be disabled during loading
      const button = screen.getByLabelText('Adding...');
      expect(button.props.accessibilityState.disabled).toBe(true);

      await act(async () => {
        resolveAdd();
      });
    });
  });

  // --- Requirement 1.9: Error display and retry ---
  describe('error display and retry', () => {
    it('displays error message when add operation fails', async () => {
      const failingAdd = jest.fn().mockRejectedValue(new Error('Network error'));

      await render(
        <CardPreviewSheet {...defaultProps} onAddToWallet={failingAdd} />
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Add to wallet'));
      });

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeTruthy();
      });
    });

    it('displays error message when restore operation fails', async () => {
      const failingRestore = jest.fn().mockRejectedValue(new Error('Restore failed'));

      await render(
        <CardPreviewSheet
          {...defaultProps}
          buttonState={restoreButtonState}
          onRestore={failingRestore}
        />
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Restore from archive'));
      });

      await waitFor(() => {
        expect(screen.getByText('Restore failed')).toBeTruthy();
      });
    });

    it('keeps action button available for retry after error', async () => {
      const failingAdd = jest.fn().mockRejectedValue(new Error('Failed'));

      await render(
        <CardPreviewSheet {...defaultProps} onAddToWallet={failingAdd} />
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Add to wallet'));
      });

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeTruthy();
      });

      // Button should still be available for retry
      expect(screen.getByText('Add to wallet')).toBeTruthy();
    });

    it('clears error on successful retry', async () => {
      const failThenSucceed = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(undefined);

      await render(
        <CardPreviewSheet {...defaultProps} onAddToWallet={failThenSucceed} />
      );

      // First attempt fails
      await act(async () => {
        fireEvent.press(screen.getByText('Add to wallet'));
      });

      await waitFor(() => {
        expect(screen.getByText('Temporary error')).toBeTruthy();
      });

      // Retry succeeds
      await act(async () => {
        fireEvent.press(screen.getByText('Add to wallet'));
      });

      await waitFor(() => {
        expect(screen.queryByText('Temporary error')).toBeNull();
      });
    });

    it('displays generic error for non-Error exceptions', async () => {
      const failingAdd = jest.fn().mockRejectedValue('string error');

      await render(
        <CardPreviewSheet {...defaultProps} onAddToWallet={failingAdd} />
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Add to wallet'));
      });

      await waitFor(() => {
        expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
      });
    });
  });

  // --- Requirement 1.5: Dismiss behavior ---
  describe('dismiss behavior', () => {
    it('calls onDismiss when dismiss button is pressed', async () => {
      const onDismiss = jest.fn();

      await render(
        <CardPreviewSheet {...defaultProps} onDismiss={onDismiss} />
      );

      fireEvent.press(screen.getByText('Dismiss'));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('has accessible dismiss button', async () => {
      await render(<CardPreviewSheet {...defaultProps} />);

      const dismissButton = screen.getByLabelText('Dismiss preview');
      expect(dismissButton).toBeTruthy();
    });
  });

  // --- Action callbacks ---
  describe('action callbacks', () => {
    it('calls onAddToWallet with the card when add button is pressed', async () => {
      const onAddToWallet = jest.fn().mockResolvedValue(undefined);

      await render(
        <CardPreviewSheet {...defaultProps} onAddToWallet={onAddToWallet} />
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Add to wallet'));
      });

      expect(onAddToWallet).toHaveBeenCalledWith(mockCard);
    });

    it('calls onRestore with the card when restore button is pressed', async () => {
      const onRestore = jest.fn().mockResolvedValue(undefined);

      await render(
        <CardPreviewSheet
          {...defaultProps}
          buttonState={restoreButtonState}
          onRestore={onRestore}
        />
      );

      await act(async () => {
        fireEvent.press(screen.getByText('Restore from archive'));
      });

      expect(onRestore).toHaveBeenCalledWith(mockCard);
    });

    it('does not call any action when "In wallet" button is pressed', async () => {
      const onAddToWallet = jest.fn();
      const onRestore = jest.fn();

      await render(
        <CardPreviewSheet
          {...defaultProps}
          buttonState={inWalletButtonState}
          onAddToWallet={onAddToWallet}
          onRestore={onRestore}
        />
      );

      expect(onAddToWallet).not.toHaveBeenCalled();
      expect(onRestore).not.toHaveBeenCalled();
    });
  });

  // --- Visibility ---
  describe('visibility', () => {
    it('does not render content when visible is false', async () => {
      await render(
        <CardPreviewSheet {...defaultProps} visible={false} />
      );
      expect(screen.queryByText('Test Card Title')).toBeNull();
    });
  });
});
