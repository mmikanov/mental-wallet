/**
 * Unit tests for ThirdPartyIcon component.
 *
 * Validates: Requirements 4.1, 4.5, 4.6
 */

import React from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react-native';
import ThirdPartyIcon from '../ThirdPartyIcon';

describe('ThirdPartyIcon', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Requirement 4.1: Image renders with valid HTTPS URI ---
  describe('image rendering', () => {
    it('renders Image component with valid HTTPS URI', async () => {
      await render(
        <ThirdPartyIcon
          uri="https://example.com/logo.png"
          fallbackEmoji="🎯"
          size={32}
        />
      );

      const image = screen.getByLabelText('Third-party brand icon');
      expect(image).toBeTruthy();
      expect(image.props.source).toEqual({ uri: 'https://example.com/logo.png' });
      expect(image.props.resizeMode).toBe('contain');
    });

    it('renders image at the specified size', async () => {
      await render(
        <ThirdPartyIcon
          uri="https://example.com/logo.png"
          fallbackEmoji="🎯"
          size={48}
        />
      );

      const image = screen.getByLabelText('Third-party brand icon');
      expect(image.props.style).toEqual(
        expect.objectContaining({ width: 48, height: 48 })
      );
    });
  });

  // --- Requirement 4.5: Emoji fallback on image load error ---
  describe('fallback on error', () => {
    it('shows emoji fallback when image fails to load', async () => {
      await render(
        <ThirdPartyIcon
          uri="https://example.com/broken.png"
          fallbackEmoji="🎯"
          size={32}
        />
      );

      const image = screen.getByLabelText('Third-party brand icon');
      await act(async () => {
        fireEvent(image, 'error');
      });

      expect(screen.getByText('🎯')).toBeTruthy();
      expect(screen.queryByLabelText('Third-party brand icon')).toBeNull();
    });
  });

  // --- Requirement 4.5: Emoji fallback on 10s timeout ---
  describe('fallback on timeout', () => {
    it('shows emoji fallback after default 10s timeout', async () => {
      await render(
        <ThirdPartyIcon
          uri="https://example.com/slow.png"
          fallbackEmoji="⏰"
          size={32}
        />
      );

      // Image should be visible initially
      expect(screen.getByLabelText('Third-party brand icon')).toBeTruthy();

      // Advance past default timeout
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      // Should now show fallback emoji
      expect(screen.getByText('⏰')).toBeTruthy();
      expect(screen.queryByLabelText('Third-party brand icon')).toBeNull();
    });

    it('shows emoji fallback after custom timeout', async () => {
      await render(
        <ThirdPartyIcon
          uri="https://example.com/slow.png"
          fallbackEmoji="⏰"
          size={32}
          timeoutMs={5000}
        />
      );

      // Not yet timed out at 4999ms
      await act(async () => {
        jest.advanceTimersByTime(4999);
      });
      expect(screen.getByLabelText('Third-party brand icon')).toBeTruthy();

      // Timeout at 5000ms
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.getByText('⏰')).toBeTruthy();
    });

    it('does not show fallback if image loads before timeout', async () => {
      await render(
        <ThirdPartyIcon
          uri="https://example.com/logo.png"
          fallbackEmoji="⏰"
          size={32}
          timeoutMs={5000}
        />
      );

      // Simulate successful load
      const image = screen.getByLabelText('Third-party brand icon');
      await act(async () => {
        fireEvent(image, 'load');
      });

      // Advance past timeout
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      // Should still show image, not fallback
      expect(screen.getByLabelText('Third-party brand icon')).toBeTruthy();
      expect(screen.queryByText('⏰')).toBeNull();
    });
  });

  // --- Requirement 4.6: Background image fallback to color on failure ---
  describe('fallback emoji rendering', () => {
    it('renders fallback emoji with correct accessibility label', async () => {
      await render(
        <ThirdPartyIcon
          uri="https://example.com/broken.png"
          fallbackEmoji="🏢"
          size={32}
        />
      );

      const image = screen.getByLabelText('Third-party brand icon');
      await act(async () => {
        fireEvent(image, 'error');
      });

      const emoji = screen.getByLabelText('Card icon');
      expect(emoji).toBeTruthy();
      expect(screen.getByText('🏢')).toBeTruthy();
    });

    it('renders the correct fallback emoji provided via props', async () => {
      await render(
        <ThirdPartyIcon
          uri="https://example.com/broken.png"
          fallbackEmoji="🎵"
          size={32}
        />
      );

      const image = screen.getByLabelText('Third-party brand icon');
      await act(async () => {
        fireEvent(image, 'error');
      });

      expect(screen.getByText('🎵')).toBeTruthy();
    });
  });
});
