/**
 * Unit tests for TierProgressCard component.
 * Validates: Requirements 3.5, 5.10, 6.9
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { TierProgressCard } from '../TierProgressCard';
import type { TierProgress } from '@/services/tierEvaluator';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

describe('TierProgressCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('below_nascent tier', () => {
    const tierProgress: TierProgress = {
      currentTier: 'below_nascent',
      checkInCount: 1,
      toolUseCount: 1,
      distinctToolCount: 1,
      nextTier: 'nascent',
      checkInsNeeded: 2,
      toolUsesNeeded: 2,
      distinctToolsNeeded: 0,
    };

    it('shows progress bars for dimensions where data is needed', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.getByText('1/3 check-ins')).toBeTruthy();
      expect(screen.getByText('1/3 tool uses')).toBeTruthy();
    });

    it('hides progress bars for dimensions already met', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      // distinctToolsNeeded is 0, so "different tools" should not appear
      expect(screen.queryByText(/different tools/)).toBeNull();
    });

    it('shows remaining items text', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.getByText('Check in 2 more days')).toBeTruthy();
      expect(screen.getByText('Use tools 2 more times')).toBeTruthy();
    });

    it('shows unlock description for next tier', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(
        screen.getByText('Start seeing your patterns and engagement trends')
      ).toBeTruthy();
    });

    it('shows "Keep practicing" CTA', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.getByText('Keep practicing →')).toBeTruthy();
    });

    it('navigates to MainTabs when CTA is tapped', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      fireEvent.press(screen.getByText('Keep practicing →'));
      expect(mockNavigate).toHaveBeenCalledWith('MainTabs');
    });

    it('calls onNavigateToWallet if provided instead of navigation', async () => {
      const onNavigateToWallet = jest.fn();
      await render(
        <TierProgressCard
          tierProgress={tierProgress}
          onNavigateToWallet={onNavigateToWallet}
        />
      );

      fireEvent.press(screen.getByText('Keep practicing →'));
      expect(onNavigateToWallet).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('nascent tier', () => {
    const tierProgress: TierProgress = {
      currentTier: 'nascent',
      checkInCount: 4,
      toolUseCount: 3,
      distinctToolCount: 1,
      nextTier: 'preliminary',
      checkInsNeeded: 3,
      toolUsesNeeded: 2,
      distinctToolsNeeded: 1,
    };

    it('shows unlock text for preliminary tier', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(
        screen.getByText(
          'Unlock early patterns and your first Best Tools ranking'
        )
      ).toBeTruthy();
    });

    it('shows progress bars for all needed dimensions', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.getByText('4/7 check-ins')).toBeTruthy();
      expect(screen.getByText('3/5 tool uses')).toBeTruthy();
      expect(screen.getByText('1/2 different tools')).toBeTruthy();
    });

    it('shows remaining items text for all dimensions', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.getByText('Check in 3 more days')).toBeTruthy();
      expect(screen.getByText('Use tools 2 more times')).toBeTruthy();
      expect(screen.getByText('Try 1 more different tool')).toBeTruthy();
    });

    it('shows "Keep practicing" CTA', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.getByText('Keep practicing →')).toBeTruthy();
    });
  });

  describe('preliminary tier', () => {
    const tierProgress: TierProgress = {
      currentTier: 'preliminary',
      checkInCount: 10,
      toolUseCount: 7,
      distinctToolCount: 3,
      nextTier: 'confident',
      checkInsNeeded: 4,
      toolUsesNeeded: 3,
      distinctToolsNeeded: 0,
    };

    it('shows unlock text for confident tier', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(
        screen.getByText(
          'Unlock full insights, the dual-axis chart, and confident tool rankings'
        )
      ).toBeTruthy();
    });

    it('shows "Almost there" CTA', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.getByText('Almost there — keep going →')).toBeTruthy();
    });

    it('hides progress bars for dimensions already met (distinctTools)', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.queryByText(/different tools/)).toBeNull();
    });

    it('shows progress bars for needed dimensions', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.getByText('10/14 check-ins')).toBeTruthy();
      expect(screen.getByText('7/10 tool uses')).toBeTruthy();
    });
  });

  describe('confident tier', () => {
    const tierProgress: TierProgress = {
      currentTier: 'confident',
      checkInCount: 20,
      toolUseCount: 15,
      distinctToolCount: 4,
      nextTier: null,
      checkInsNeeded: 0,
      toolUsesNeeded: 0,
      distinctToolsNeeded: 0,
    };

    it('shows "unlocked everything" message', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(
        screen.getByText("You've unlocked everything! Full insights are available.")
      ).toBeTruthy();
    });

    it('does not show any CTA button', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.queryByText(/→/)).toBeNull();
    });

    it('does not show progress bars', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.queryByText(/check-ins/)).toBeNull();
      expect(screen.queryByText(/tool uses/)).toBeNull();
    });
  });

  describe('singular/plural text', () => {
    it('uses singular "day" when 1 check-in is needed', async () => {
      const tierProgress: TierProgress = {
        currentTier: 'below_nascent',
        checkInCount: 2,
        toolUseCount: 3,
        distinctToolCount: 1,
        nextTier: 'nascent',
        checkInsNeeded: 1,
        toolUsesNeeded: 0,
        distinctToolsNeeded: 0,
      };

      await render(<TierProgressCard tierProgress={tierProgress} />);
      expect(screen.getByText('Check in 1 more day')).toBeTruthy();
    });

    it('uses singular "time" when 1 tool use is needed', async () => {
      const tierProgress: TierProgress = {
        currentTier: 'below_nascent',
        checkInCount: 3,
        toolUseCount: 2,
        distinctToolCount: 1,
        nextTier: 'nascent',
        checkInsNeeded: 0,
        toolUsesNeeded: 1,
        distinctToolsNeeded: 0,
      };

      await render(<TierProgressCard tierProgress={tierProgress} />);
      expect(screen.getByText('Use tools 1 more time')).toBeTruthy();
    });

    it('uses singular "tool" when 1 distinct tool is needed', async () => {
      const tierProgress: TierProgress = {
        currentTier: 'nascent',
        checkInCount: 7,
        toolUseCount: 5,
        distinctToolCount: 1,
        nextTier: 'preliminary',
        checkInsNeeded: 0,
        toolUsesNeeded: 0,
        distinctToolsNeeded: 1,
      };

      await render(<TierProgressCard tierProgress={tierProgress} />);
      expect(screen.getByText('Try 1 more different tool')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    const tierProgress: TierProgress = {
      currentTier: 'nascent',
      checkInCount: 4,
      toolUseCount: 3,
      distinctToolCount: 1,
      nextTier: 'preliminary',
      checkInsNeeded: 3,
      toolUsesNeeded: 2,
      distinctToolsNeeded: 1,
    };

    it('has accessible labels on progress rows', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(screen.getByLabelText('check-ins: 4 of 7')).toBeTruthy();
      expect(screen.getByLabelText('tool uses: 3 of 5')).toBeTruthy();
      expect(screen.getByLabelText('different tools: 1 of 2')).toBeTruthy();
    });

    it('CTA has accessible label describing its action', async () => {
      await render(<TierProgressCard tierProgress={tierProgress} />);

      expect(
        screen.getByLabelText('Keep practicing. Navigate to your wallet.')
      ).toBeTruthy();
    });
  });
});
