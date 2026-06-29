/**
 * EmotionPicker unit tests.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 12.1
 */

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import EmotionPicker from '../EmotionPicker';
import type { EmotionType } from '@/types/index';

describe('EmotionPicker', () => {
  const defaultProps = {
    selectedEmotion: null as EmotionType | null,
    onSelectEmotion: jest.fn(),
    onDeselectEmotion: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the prompt text "How are you feeling right now?"', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<EmotionPicker {...defaultProps} />);
    });
    const root = tree!.root;
    const texts = root.findAllByType('Text' as any);
    const promptText = texts.find(
      (t) => t.children.includes('How are you feeling right now?')
    );
    expect(promptText).toBeDefined();
  });

  it('renders all 6 emotion chips', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<EmotionPicker {...defaultProps} />);
    });
    const root = tree!.root;
    const buttons = root.findAllByType(TouchableOpacity);
    expect(buttons).toHaveLength(6);
  });

  it('renders expected emotion labels', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<EmotionPicker {...defaultProps} />);
    });
    const root = tree!.root;
    const buttons = root.findAllByType(TouchableOpacity);
    const labels = buttons.map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual([
      'Stressed',
      'Overwhelmed',
      'Anxious',
      'Sad/low',
      'Angry',
      'Numb',
    ]);
  });

  it('calls onSelectEmotion when tapping an unselected chip', () => {
    const onSelectEmotion = jest.fn();
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <EmotionPicker {...defaultProps} onSelectEmotion={onSelectEmotion} />
      );
    });
    const root = tree!.root;
    const stressedChip = root.findAll(
      (node) => node.props.accessibilityLabel === 'Stressed'
    )[0];

    act(() => {
      stressedChip.props.onPress();
    });

    expect(onSelectEmotion).toHaveBeenCalledWith('stressed');
    expect(onSelectEmotion).toHaveBeenCalledTimes(1);
  });

  it('calls onDeselectEmotion when tapping the already-selected chip', () => {
    const onDeselectEmotion = jest.fn();
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <EmotionPicker
          {...defaultProps}
          selectedEmotion="anxious"
          onDeselectEmotion={onDeselectEmotion}
        />
      );
    });
    const root = tree!.root;
    const anxiousChip = root.findAll(
      (node) => node.props.accessibilityLabel === 'Anxious'
    )[0];

    act(() => {
      anxiousChip.props.onPress();
    });

    expect(onDeselectEmotion).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectEmotion (not onDeselectEmotion) when tapping a different chip while one is selected', () => {
    const onSelectEmotion = jest.fn();
    const onDeselectEmotion = jest.fn();
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <EmotionPicker
          {...defaultProps}
          selectedEmotion="stressed"
          onSelectEmotion={onSelectEmotion}
          onDeselectEmotion={onDeselectEmotion}
        />
      );
    });
    const root = tree!.root;
    const angryChip = root.findAll(
      (node) => node.props.accessibilityLabel === 'Angry'
    )[0];

    act(() => {
      angryChip.props.onPress();
    });

    expect(onSelectEmotion).toHaveBeenCalledWith('angry');
    expect(onDeselectEmotion).not.toHaveBeenCalled();
  });

  it('marks the selected chip with accessibilityState.selected = true', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <EmotionPicker {...defaultProps} selectedEmotion="sad" />
      );
    });
    const root = tree!.root;
    const sadChip = root.findAll(
      (node) => node.props.accessibilityLabel === 'Sad/low'
    )[0];
    const stressedChip = root.findAll(
      (node) => node.props.accessibilityLabel === 'Stressed'
    )[0];

    expect(sadChip.props.accessibilityState).toEqual({ selected: true });
    expect(stressedChip.props.accessibilityState).toEqual({ selected: false });
  });

  it('does not contain clinical language (mood, affect, diagnose, disorder)', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<EmotionPicker {...defaultProps} />);
    });
    const json = JSON.stringify(tree!.toJSON());
    const clinicalTerms = ['mood', 'affect', 'diagnose', 'disorder'];
    for (const term of clinicalTerms) {
      expect(json.toLowerCase()).not.toContain(term);
    }
  });
});
