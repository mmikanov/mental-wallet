/**
 * Unit tests for ToolsToReconsider component.
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ToolsToReconsider } from '../ToolsToReconsider';
import type { ToolCorrelationResult } from '@/services/correlationEngine';

function makeToolResult(overrides: Partial<ToolCorrelationResult> = {}): ToolCorrelationResult {
  return {
    cardId: 'card-1',
    cardTitle: 'Affirmations',
    scoreDelta: -0.1,
    correlationDirection: 'neutral',
    sampleSizeToolDays: 10,
    sampleSizeOtherDays: 20,
    avgDurationSec: 120,
    outcomeEffectivenessScore: 0.2,
    effectivenessPattern: 'not_helping',
    ...overrides,
  };
}

describe('ToolsToReconsider', () => {
  it('renders null when tools array is empty (section hidden)', async () => {
    const result = await render(
      <ToolsToReconsider tools={[]} onArchive={jest.fn()} onKeep={jest.fn()} />
    );
    expect(result.toJSON()).toBeNull();
  });

  it('renders section title, tooltip, and accessible tool entries with labels', async () => {
    const { getByText, getByTestId } = await render(
      <ToolsToReconsider
        tools={[makeToolResult({ cardId: 'card-1', cardTitle: 'Affirmations' })]}
        onArchive={jest.fn()}
        onKeep={jest.fn()}
      />
    );

    // Section title
    expect(getByText('Tools to reconsider')).toBeTruthy();

    // Tooltip trigger (ⓘ) should be present
    expect(getByTestId('insight-tooltip-trigger')).toBeTruthy();

    // Tool entry with accessibility label
    const entry = getByTestId('reconsider-tool-card-1');
    expect(entry.props.accessibilityLabel).toContain('Affirmations');
    expect(entry.props.accessibilityLabel).toContain('Archive or Keep');

    // Archive button has accessible label
    const archiveBtn = getByTestId('reconsider-archive-card-1');
    expect(archiveBtn.props.accessibilityLabel).toBe('Archive Affirmations');

    // Keep button has accessible label
    const keepBtn = getByTestId('reconsider-keep-card-1');
    expect(keepBtn.props.accessibilityLabel).toBe('Keep Affirmations');
  });

  it('renders tool name and plain-language observation for each tool', async () => {
    const tools = [
      makeToolResult({ cardId: 'card-1', cardTitle: 'Affirmations' }),
      makeToolResult({ cardId: 'card-2', cardTitle: 'Gratitude Journal' }),
    ];
    const { getByText } = await render(
      <ToolsToReconsider tools={tools} onArchive={jest.fn()} onKeep={jest.fn()} />
    );

    expect(getByText('Affirmations')).toBeTruthy();
    expect(
      getByText("When you use Affirmations, you usually don't feel much different afterward")
    ).toBeTruthy();

    expect(getByText('Gratitude Journal')).toBeTruthy();
    expect(
      getByText("When you use Gratitude Journal, you usually don't feel much different afterward")
    ).toBeTruthy();
  });

  it('renders up to 3 tool entries with Archive and Keep buttons', async () => {
    const tools = [
      makeToolResult({ cardId: 'card-1', cardTitle: 'Tool A' }),
      makeToolResult({ cardId: 'card-2', cardTitle: 'Tool B' }),
      makeToolResult({ cardId: 'card-3', cardTitle: 'Tool C' }),
    ];
    const { getByTestId } = await render(
      <ToolsToReconsider tools={tools} onArchive={jest.fn()} onKeep={jest.fn()} />
    );

    expect(getByTestId('reconsider-tool-card-1')).toBeTruthy();
    expect(getByTestId('reconsider-tool-card-2')).toBeTruthy();
    expect(getByTestId('reconsider-tool-card-3')).toBeTruthy();
    expect(getByTestId('reconsider-archive-card-1')).toBeTruthy();
    expect(getByTestId('reconsider-keep-card-1')).toBeTruthy();
    expect(getByTestId('reconsider-archive-card-2')).toBeTruthy();
    expect(getByTestId('reconsider-keep-card-2')).toBeTruthy();
    expect(getByTestId('reconsider-archive-card-3')).toBeTruthy();
    expect(getByTestId('reconsider-keep-card-3')).toBeTruthy();
  });

  it('calls onArchive with the correct cardId when Archive is pressed', async () => {
    const mockArchive = jest.fn();
    const { getByTestId } = await render(
      <ToolsToReconsider
        tools={[makeToolResult({ cardId: 'card-1', cardTitle: 'Affirmations' })]}
        onArchive={mockArchive}
        onKeep={jest.fn()}
      />
    );

    fireEvent.press(getByTestId('reconsider-archive-card-1'));
    expect(mockArchive).toHaveBeenCalledWith('card-1');
    expect(mockArchive).toHaveBeenCalledTimes(1);
  });

  it('calls onKeep with the correct cardId when Keep is pressed', async () => {
    const mockKeep = jest.fn();
    const { getByTestId } = await render(
      <ToolsToReconsider
        tools={[makeToolResult({ cardId: 'card-1', cardTitle: 'Affirmations' })]}
        onArchive={jest.fn()}
        onKeep={mockKeep}
      />
    );

    fireEvent.press(getByTestId('reconsider-keep-card-1'));
    expect(mockKeep).toHaveBeenCalledWith('card-1');
    expect(mockKeep).toHaveBeenCalledTimes(1);
  });

  it('does not crash when onArchive and onKeep are undefined', async () => {
    const { getByTestId } = await render(
      <ToolsToReconsider
        tools={[makeToolResult({ cardId: 'card-1', cardTitle: 'Affirmations' })]}
      />
    );

    // Pressing buttons should not throw
    fireEvent.press(getByTestId('reconsider-archive-card-1'));
    fireEvent.press(getByTestId('reconsider-keep-card-1'));
  });
});
