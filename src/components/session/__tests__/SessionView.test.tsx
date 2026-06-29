/**
 * SessionView unit tests.
 *
 * Validates: Requirements 7.4, 7.5, 7.6, 11.1
 * Also covers: "Show me tools" button enabled/disabled states (Req 5.2, 5.3, 5.4)
 */

import React from 'react';
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import SessionView, { SessionViewProps } from '../SessionView';
import type { RecommendationResult } from '@/services/recommendationService';

function makeToolRecommendation(
  overrides: Partial<{ cardId: string; title: string; description: string; iconValue: string; source: 'wallet' | 'library'; contextRelevanceScore: number }> = {}
) {
  return {
    cardId: overrides.cardId ?? 'card-1',
    title: overrides.title ?? 'Test Tool',
    description: overrides.description ?? 'A test description',
    iconValue: overrides.iconValue ?? '🧘',
    source: overrides.source ?? 'wallet',
    contextRelevanceScore: overrides.contextRelevanceScore ?? 1,
  };
}

function defaultProps(overrides: Partial<SessionViewProps> = {}): SessionViewProps {
  return {
    selectedEmotion: null,
    selectedContexts: [],
    selectedTime: null,
    recommendations: null,
    onSelectEmotion: jest.fn(),
    onDeselectEmotion: jest.fn(),
    onToggleContext: jest.fn(),
    onSelectTime: jest.fn(),
    onFetchRecommendations: jest.fn(),
    onOpenTool: jest.fn(),
    onEndSession: jest.fn(),
    ...overrides,
  };
}

/** Find a node by accessibilityLabel */
function findByA11yLabel(root: ReactTestInstance, label: string): ReactTestInstance | undefined {
  return root.findAll((node) => node.props.accessibilityLabel === label)[0];
}

/** Find all Text nodes containing a specific string */
function findTextContaining(root: ReactTestInstance, text: string): ReactTestInstance[] {
  return root.findAll(
    (node) =>
      node.type === 'Text' &&
      (node.children?.includes(text) ||
        (typeof node.children?.[0] === 'string' && node.children[0].includes(text)))
  );
}

describe('SessionView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('"From your wallet" section (Req 7.4)', () => {
    it('renders "From your wallet" header when walletTools is non-empty', () => {
      const recommendations: RecommendationResult = {
        walletTools: [makeToolRecommendation({ source: 'wallet', cardId: 'w-1', title: 'Breathing' })],
        libraryTools: [],
        isFallback: false,
      };

      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: 'stressed', recommendations })} />
        );
      });

      const root = tree!.root;
      const headers = findTextContaining(root, 'From your wallet');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('omits "From your wallet" section when walletTools is empty', () => {
      const recommendations: RecommendationResult = {
        walletTools: [],
        libraryTools: [makeToolRecommendation({ source: 'library', cardId: 'l-1' })],
        isFallback: false,
      };

      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: 'stressed', recommendations })} />
        );
      });

      const root = tree!.root;
      const headers = findTextContaining(root, 'From your wallet');
      expect(headers).toHaveLength(0);
    });
  });

  describe('"Suggested tools to try" section (Req 7.5)', () => {
    it('renders "Suggested tools to try" header when libraryTools is non-empty', () => {
      const recommendations: RecommendationResult = {
        walletTools: [],
        libraryTools: [makeToolRecommendation({ source: 'library', cardId: 'l-1', title: 'Grounding' })],
        isFallback: false,
      };

      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: 'anxious', recommendations })} />
        );
      });

      const root = tree!.root;
      const headers = findTextContaining(root, 'Suggested tools to try');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('omits "Suggested tools to try" section when libraryTools is empty', () => {
      const recommendations: RecommendationResult = {
        walletTools: [makeToolRecommendation({ source: 'wallet', cardId: 'w-1' })],
        libraryTools: [],
        isFallback: false,
      };

      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: 'stressed', recommendations })} />
        );
      });

      const root = tree!.root;
      const headers = findTextContaining(root, 'Suggested tools to try');
      expect(headers).toHaveLength(0);
    });
  });

  describe('fallback message (Req 7.6)', () => {
    it('renders fallback message when isFallback is true', () => {
      const recommendations: RecommendationResult = {
        walletTools: [],
        libraryTools: [makeToolRecommendation({ source: 'library', cardId: 'f-1' })],
        isFallback: true,
      };

      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: 'numb', recommendations })} />
        );
      });

      const root = tree!.root;
      const fallbackTexts = findTextContaining(root, "We don't have a specific match right now");
      expect(fallbackTexts.length).toBeGreaterThan(0);
    });

    it('does not render fallback message when isFallback is false', () => {
      const recommendations: RecommendationResult = {
        walletTools: [makeToolRecommendation({ source: 'wallet', cardId: 'w-1' })],
        libraryTools: [],
        isFallback: false,
      };

      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: 'stressed', recommendations })} />
        );
      });

      const root = tree!.root;
      const fallbackTexts = findTextContaining(root, "We don't have a specific match right now");
      expect(fallbackTexts).toHaveLength(0);
    });
  });

  describe('"Show me tools" button states (Req 5.2, 5.3, 5.4)', () => {
    it('is disabled when selectedEmotion is null', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: null })} />
        );
      });

      const root = tree!.root;
      const showMeButton = findByA11yLabel(root, 'Show me tools');
      expect(showMeButton).toBeDefined();
      expect(showMeButton!.props.accessibilityState).toEqual({ disabled: true });
    });

    it('is enabled when selectedEmotion is non-null', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: 'anxious' })} />
        );
      });

      const root = tree!.root;
      const showMeButton = findByA11yLabel(root, 'Show me tools');
      expect(showMeButton).toBeDefined();
      expect(showMeButton!.props.accessibilityState).toEqual({ disabled: false });
    });
  });

  describe('"End session" button (Req 11.1)', () => {
    it('is always present regardless of selection state', () => {
      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: null, recommendations: null })} />
        );
      });

      const root = tree!.root;
      const endButton = findByA11yLabel(root, 'End session');
      expect(endButton).toBeDefined();
    });

    it('is present when recommendations are shown', () => {
      const recommendations: RecommendationResult = {
        walletTools: [makeToolRecommendation({ source: 'wallet', cardId: 'w-1' })],
        libraryTools: [makeToolRecommendation({ source: 'library', cardId: 'l-1' })],
        isFallback: false,
      };

      let tree: ReactTestRenderer;
      act(() => {
        tree = create(
          <SessionView {...defaultProps({ selectedEmotion: 'stressed', recommendations })} />
        );
      });

      const root = tree!.root;
      const endButton = findByA11yLabel(root, 'End session');
      expect(endButton).toBeDefined();
    });
  });
});
