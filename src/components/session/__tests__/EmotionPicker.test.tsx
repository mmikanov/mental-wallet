/**
 * EmotionPicker unit tests.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 5.5, 8.9
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

  it('renders all 12 emotion chips', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<EmotionPicker {...defaultProps} />);
    });
    const root = tree!.root;
    const buttons = root.findAllByType(TouchableOpacity);
    // No onStartCheckin provided, so no "not sure" button — just 12 chips
    expect(buttons).toHaveLength(12);
  });

  it('renders expected emotion labels for all 12 emotions', () => {
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
      'Sad',
      'Angry',
      'Numb',
      'Lonely',
      'Ashamed',
      'Guilty',
      'Hopeless',
      'Calm',
      'Curious',
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
      (node) => node.props.accessibilityLabel === 'Sad'
    )[0];
    const stressedChip = root.findAll(
      (node) => node.props.accessibilityLabel === 'Stressed'
    )[0];

    expect(sadChip.props.accessibilityState).toEqual({ selected: true });
    expect(stressedChip.props.accessibilityState).toEqual({ selected: false });
  });

  it('renders "I\'m not sure how I feel" button when onStartCheckin is provided', () => {
    const onStartCheckin = jest.fn();
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <EmotionPicker {...defaultProps} onStartCheckin={onStartCheckin} />
      );
    });
    const root = tree!.root;
    const buttons = root.findAllByType(TouchableOpacity);
    // 12 chips + 1 "not sure" button
    expect(buttons).toHaveLength(13);

    const notSureButton = root.findAll(
      (node) =>
        node.props.accessibilityLabel ===
        "I'm not sure how I feel. Start guided check-in."
    )[0];
    expect(notSureButton).toBeDefined();
  });

  it('calls onStartCheckin when "I\'m not sure how I feel" button is tapped', () => {
    const onStartCheckin = jest.fn();
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <EmotionPicker {...defaultProps} onStartCheckin={onStartCheckin} />
      );
    });
    const root = tree!.root;
    const notSureButton = root.findAll(
      (node) =>
        node.props.accessibilityLabel ===
        "I'm not sure how I feel. Start guided check-in."
    )[0];

    act(() => {
      notSureButton.props.onPress();
    });

    expect(onStartCheckin).toHaveBeenCalledTimes(1);
  });

  it('does not render "I\'m not sure how I feel" button when onStartCheckin is not provided', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<EmotionPicker {...defaultProps} />);
    });
    const root = tree!.root;
    const notSureButton = root.findAll(
      (node) =>
        node.props.accessibilityLabel ===
        "I'm not sure how I feel. Start guided check-in."
    );
    expect(notSureButton).toHaveLength(0);
  });

  it('highlights preSelectedEmotion when no selectedEmotion is set', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <EmotionPicker {...defaultProps} preSelectedEmotion="lonely" />
      );
    });
    const root = tree!.root;
    const lonelyChip = root.findAll(
      (node) => node.props.accessibilityLabel === 'Lonely'
    )[0];
    expect(lonelyChip.props.accessibilityState).toEqual({ selected: true });
  });

  it('displays softLabel text when provided', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <EmotionPicker
          {...defaultProps}
          softLabel="It sounds like you might be feeling lonely right now"
        />
      );
    });
    const root = tree!.root;
    const texts = root.findAllByType('Text' as any);
    const softLabelText = texts.find((t) =>
      t.children.includes(
        'It sounds like you might be feeling lonely right now'
      )
    );
    expect(softLabelText).toBeDefined();
  });

  it('all chips have accessibilityRole="button"', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(<EmotionPicker {...defaultProps} />);
    });
    const root = tree!.root;
    const buttons = root.findAllByType(TouchableOpacity);
    for (const button of buttons) {
      expect(button.props.accessibilityRole).toBe('button');
    }
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
