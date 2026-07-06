/**
 * Unit tests for ReminderIndicator component and its integration with CardEdge.
 *
 * Validates: Requirements 3.1, 3.2, 3.4, 3.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ReminderIndicator from '../ReminderIndicator';
import CardEdge from '../CardEdge';
import type { Card } from '@/types/index';

// --- Mock renderCardIcon to avoid pulling in ThirdPartyIcon/Image deps ---
jest.mock('@/utils/renderCardIcon', () => ({
  renderCardIcon: ({ iconValue }: { iconValue: string }) => {
    const { Text } = require('react-native');
    return <Text>{iconValue || '📋'}</Text>;
  },
}));

// --- Test fixtures ---
const mockCard: Card = {
  id: 'card-1',
  title: 'Grounding Exercise',
  description: 'A simple grounding technique.',
  iconType: 'emoji',
  iconValue: '🌿',
  backgroundType: 'color',
  backgroundValue: '#E8F4F8',
  categoryId: 'grounding',
  originBadge: 'library',
  stackPosition: 0,
  totalUses: 5,
  currentStreak: 2,
  lastUsedAt: '2024-01-01T10:00:00Z',
  isArchived: false,
  archivedAt: null,
  previousStackPosition: null,
  allowBackgroundCustomization: true,
  controls: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const darkCard: Card = {
  ...mockCard,
  id: 'card-dark',
  backgroundValue: '#1A1A2E',
};

describe('ReminderIndicator', () => {
  describe('rendering', () => {
    it('renders the bell emoji', async () => {
      await render(<ReminderIndicator isLight={true} />);
      expect(screen.getByText('🔔')).toBeTruthy();
    });

    it('has accessibilityLabel "Reminder set"', async () => {
      await render(<ReminderIndicator isLight={true} />);
      expect(screen.getByLabelText('Reminder set')).toBeTruthy();
    });

    it('has accessibilityRole "image"', async () => {
      await render(<ReminderIndicator isLight={true} />);
      const indicator = screen.getByLabelText('Reminder set');
      expect(indicator.props.accessibilityRole).toBe('image');
    });
  });

  describe('non-interactive', () => {
    it('does not have an onPress handler', async () => {
      await render(<ReminderIndicator isLight={true} />);
      const indicator = screen.getByLabelText('Reminder set');
      // The component renders a View, not a Touchable — no onPress prop
      expect(indicator.props.onPress).toBeUndefined();
    });

    it('does not respond to accessibilityRole "button"', async () => {
      await render(<ReminderIndicator isLight={false} />);
      const indicator = screen.getByLabelText('Reminder set');
      expect(indicator.props.accessibilityRole).not.toBe('button');
    });
  });

  describe('color adaptation', () => {
    it('uses dark color on light backgrounds (isLight=true)', async () => {
      await render(<ReminderIndicator isLight={true} />);
      const bellText = screen.getByText('🔔');
      const style = Array.isArray(bellText.props.style)
        ? Object.assign({}, ...bellText.props.style)
        : bellText.props.style;
      expect(style.color).toBe('#1C1C1E');
    });

    it('uses light color on dark backgrounds (isLight=false)', async () => {
      await render(<ReminderIndicator isLight={false} />);
      const bellText = screen.getByText('🔔');
      const style = Array.isArray(bellText.props.style)
        ? Object.assign({}, ...bellText.props.style)
        : bellText.props.style;
      expect(style.color).toBe('#FFFFFF');
    });
  });
});

describe('CardEdge + ReminderIndicator integration', () => {
  const defaultProps = {
    card: mockCard,
    categoryColor: '#4A90D9',
    onPress: jest.fn(),
    onLongPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('indicator visibility', () => {
    it('shows ReminderIndicator when hasReminder=true', async () => {
      await render(<CardEdge {...defaultProps} hasReminder={true} />);
      expect(screen.getByLabelText('Reminder set')).toBeTruthy();
    });

    it('does not show ReminderIndicator when hasReminder=false', async () => {
      await render(<CardEdge {...defaultProps} hasReminder={false} />);
      expect(screen.queryByLabelText('Reminder set')).toBeNull();
    });

    it('does not show ReminderIndicator when hasReminder is not provided (defaults to false)', async () => {
      await render(<CardEdge {...defaultProps} />);
      expect(screen.queryByLabelText('Reminder set')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('indicator has accessibilityLabel "Reminder set" within CardEdge', async () => {
      await render(<CardEdge {...defaultProps} hasReminder={true} />);
      const indicator = screen.getByLabelText('Reminder set');
      expect(indicator).toBeTruthy();
      expect(indicator.props.accessibilityRole).toBe('image');
    });
  });

  describe('non-interactive within CardEdge', () => {
    it('indicator does not have its own onPress handler inside CardEdge', async () => {
      await render(<CardEdge {...defaultProps} hasReminder={true} />);
      const indicator = screen.getByLabelText('Reminder set');
      expect(indicator.props.onPress).toBeUndefined();
    });
  });

  describe('color adaptation within CardEdge', () => {
    it('uses dark indicator color on light card background', async () => {
      await render(<CardEdge {...defaultProps} card={mockCard} hasReminder={true} />);
      const bellText = screen.getByText('🔔');
      const style = Array.isArray(bellText.props.style)
        ? Object.assign({}, ...bellText.props.style)
        : bellText.props.style;
      expect(style.color).toBe('#1C1C1E');
    });

    it('uses light indicator color on dark card background', async () => {
      await render(<CardEdge {...defaultProps} card={darkCard} hasReminder={true} />);
      const bellText = screen.getByText('🔔');
      const style = Array.isArray(bellText.props.style)
        ? Object.assign({}, ...bellText.props.style)
        : bellText.props.style;
      expect(style.color).toBe('#FFFFFF');
    });
  });
});
