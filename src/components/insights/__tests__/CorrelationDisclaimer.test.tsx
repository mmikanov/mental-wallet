/**
 * Unit tests for CorrelationDisclaimer component.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CorrelationDisclaimer } from '../CorrelationDisclaimer';

describe('CorrelationDisclaimer', () => {
  it('always renders the base disclaimer text about associations not causation', async () => {
    await render(<CorrelationDisclaimer />);
    expect(
      screen.getByText(
        /These patterns reflect associations in your data — they don't prove that any tool caused a change in how you feel\./
      )
    ).toBeTruthy();
  });

  it('does not render negative correlation note when showNegativeCorrelationNote is false', async () => {
    await render(<CorrelationDisclaimer showNegativeCorrelationNote={false} />);
    expect(
      screen.queryByText(/Reaching for tools on tough days/)
    ).toBeNull();
  });

  it('does not render negative correlation note when prop is omitted (defaults to false)', async () => {
    await render(<CorrelationDisclaimer />);
    expect(
      screen.queryByText(/Reaching for tools on tough days/)
    ).toBeNull();
  });

  it('renders the negative correlation note when showNegativeCorrelationNote is true', async () => {
    await render(<CorrelationDisclaimer showNegativeCorrelationNote={true} />);
    expect(
      screen.getByText(
        /Reaching for tools on tough days is a sign of good self-care\./
      )
    ).toBeTruthy();
  });

  it('includes "you tend to use it when you need it most" framing for negative correlations', async () => {
    await render(<CorrelationDisclaimer showNegativeCorrelationNote={true} />);
    expect(
      screen.getByText(/you tend to use it when you need it most/)
    ).toBeTruthy();
  });

  it('does not render crisis resources link when showNegativeCorrelationNote is true', async () => {
    await render(<CorrelationDisclaimer showNegativeCorrelationNote={true} />);
    expect(
      screen.queryByText(/Need support\? Crisis resources/)
    ).toBeNull();
  });

  it('has accessibilityRole="text" on the container', async () => {
    const result = await render(<CorrelationDisclaimer />);
    const tree = result.toJSON();
    expect(tree?.props?.accessibilityRole).toBe('text');
  });
});
