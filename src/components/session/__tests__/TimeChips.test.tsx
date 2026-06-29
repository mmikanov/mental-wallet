/**
 * TimeChips unit tests.
 *
 * Validates: Requirements 6.1, 6.4, 6.5, 6.6
 */

import React from 'react';
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import TimeChips from '../TimeChips';
import type { TimeType } from '@/types/index';

/** Find the top-level interactive chip nodes (TouchableOpacity wrappers) */
function findChips(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (node) =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel != null &&
      node.props.accessibilityState != null &&
      typeof node.props.onPress === 'function'
  ).filter((node, _index, arr) => {
    // Only keep the topmost node — exclude children of another matched node
    let parent = node.parent;
    while (parent) {
      if (arr.includes(parent)) return false;
      parent = parent.parent;
    }
    return true;
  });
}

describe('TimeChips', () => {
  const defaultProps = {
    selectedTime: null as TimeType | null,
    onSelectTime: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering (Req 6.1, 6.4)', () => {
    it('renders section label "How much time do you have?"', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<TimeChips {...defaultProps} />);
      });
      const root = tree!.root;
      const texts = root.findAllByType('Text' as any);
      const labelText = texts.find((t) =>
        t.children.includes('How much time do you have?')
      );
      expect(labelText).toBeDefined();
    });

    it('renders exactly 2 time chip options', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<TimeChips {...defaultProps} />);
      });
      const root = tree!.root;
      const buttons = findChips(root);
      expect(buttons).toHaveLength(2);
    });

    it('renders the correct chip labels', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<TimeChips {...defaultProps} />);
      });
      const root = tree!.root;
      const buttons = findChips(root);
      const labels = buttons.map((b) => b.props.accessibilityLabel);
      expect(labels).toEqual([
        'I have ~1–2 minutes',
        'I have ~5–10 minutes',
      ]);
    });
  });

  describe('single-select with deselect behavior (Req 6.5)', () => {
    it('calls onSelectTime with the time type when tapping an unselected chip', () => {
      const onSelectTime = jest.fn();
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <TimeChips selectedTime={null} onSelectTime={onSelectTime} />
        );
      });
      const root = tree!.root;
      const chips = findChips(root);
      const chip = chips.find(
        (n) => n.props.accessibilityLabel === 'I have ~1–2 minutes'
      )!;

      act(() => {
        chip.props.onPress();
      });

      expect(onSelectTime).toHaveBeenCalledWith('1_2_min');
      expect(onSelectTime).toHaveBeenCalledTimes(1);
    });

    it('calls onSelectTime(null) when tapping the already-selected chip (deselect)', () => {
      const onSelectTime = jest.fn();
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <TimeChips selectedTime="1_2_min" onSelectTime={onSelectTime} />
        );
      });
      const root = tree!.root;
      const chips = findChips(root);
      const chip = chips.find(
        (n) => n.props.accessibilityLabel === 'I have ~1–2 minutes'
      )!;

      act(() => {
        chip.props.onPress();
      });

      expect(onSelectTime).toHaveBeenCalledWith(null);
      expect(onSelectTime).toHaveBeenCalledTimes(1);
    });

    it('calls onSelectTime with the new type when switching selection', () => {
      const onSelectTime = jest.fn();
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <TimeChips selectedTime="1_2_min" onSelectTime={onSelectTime} />
        );
      });
      const root = tree!.root;
      const chips = findChips(root);
      const chip = chips.find(
        (n) => n.props.accessibilityLabel === 'I have ~5–10 minutes'
      )!;

      act(() => {
        chip.props.onPress();
      });

      expect(onSelectTime).toHaveBeenCalledWith('5_10_min');
      expect(onSelectTime).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('marks the selected chip with accessibilityState.selected = true', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <TimeChips selectedTime="5_10_min" onSelectTime={jest.fn()} />
        );
      });
      const root = tree!.root;
      const chips = findChips(root);
      const selectedChip = chips.find(
        (n) => n.props.accessibilityLabel === 'I have ~5–10 minutes'
      )!;
      const unselectedChip = chips.find(
        (n) => n.props.accessibilityLabel === 'I have ~1–2 minutes'
      )!;

      expect(selectedChip.props.accessibilityState).toEqual({ selected: true });
      expect(unselectedChip.props.accessibilityState).toEqual({ selected: false });
    });

    it('all chips have accessibilityRole="button"', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<TimeChips {...defaultProps} />);
      });
      const root = tree!.root;
      const buttons = findChips(root);
      expect(buttons).toHaveLength(2);
      buttons.forEach((button) => {
        expect(button.props.accessibilityRole).toBe('button');
      });
    });
  });

  describe('optional nature (Req 6.6)', () => {
    it('renders correctly with no selection (null)', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <TimeChips selectedTime={null} onSelectTime={jest.fn()} />
        );
      });
      const root = tree!.root;
      const buttons = findChips(root);
      buttons.forEach((button) => {
        expect(button.props.accessibilityState).toEqual({ selected: false });
      });
    });
  });
});
