/**
 * Unit tests for RationaleEntryPoint component.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RationaleEntryPoint } from '../RationaleEntryPoint';

describe('RationaleEntryPoint', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  describe('visibility — renders null when inANutshell is absent', () => {
    it('renders null when inANutshell is undefined', async () => {
      const { toJSON } = await render(
        <Text>
          Description text
          <RationaleEntryPoint inANutshell={undefined} onPress={mockOnPress} />
        </Text>
      );
      // Should not contain "Learn more"
      expect(JSON.stringify(toJSON())).not.toContain('Learn more');
    });

    it('renders null when inANutshell is empty string', async () => {
      const { toJSON } = await render(
        <Text>
          Description text
          <RationaleEntryPoint inANutshell="" onPress={mockOnPress} />
        </Text>
      );
      expect(JSON.stringify(toJSON())).not.toContain('Learn more');
    });

    it('renders null when inANutshell is whitespace only', async () => {
      const { toJSON } = await render(
        <Text>
          Description text
          <RationaleEntryPoint inANutshell={'   \t\n  '} onPress={mockOnPress} />
        </Text>
      );
      expect(JSON.stringify(toJSON())).not.toContain('Learn more');
    });
  });

  describe('visibility — renders entry point when inANutshell has content', () => {
    it('renders "Learn more" when inANutshell has non-whitespace content', async () => {
      await render(
        <Text>
          Description text
          <RationaleEntryPoint inANutshell="Some rationale text" onPress={mockOnPress} />
        </Text>
      );
      expect(screen.getByText(/Learn more/)).toBeTruthy();
    });

    it('renders when inANutshell has content with surrounding whitespace', async () => {
      await render(
        <Text>
          Description text
          <RationaleEntryPoint inANutshell="  content  " onPress={mockOnPress} />
        </Text>
      );
      expect(screen.getByText(/Learn more/)).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('has accessibilityRole of link', async () => {
      await render(
        <Text>
          Description
          <RationaleEntryPoint inANutshell="Some text" onPress={mockOnPress} />
        </Text>
      );
      expect(screen.getByRole('link')).toBeTruthy();
    });

    it('has accessible label about learning more', async () => {
      await render(
        <Text>
          Description
          <RationaleEntryPoint inANutshell="Some text" onPress={mockOnPress} />
        </Text>
      );
      expect(screen.getByLabelText('Learn more about why this might help')).toBeTruthy();
    });
  });

  describe('interaction', () => {
    it('calls onPress when tapped', async () => {
      await render(
        <Text>
          Description
          <RationaleEntryPoint inANutshell="Some text" onPress={mockOnPress} />
        </Text>
      );
      fireEvent.press(screen.getByRole('link'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });
  });
});
