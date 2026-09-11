/**
 * Unit tests for EmailOptInPrompt (1.0.4-email-optin Track A).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import EmailOptInPrompt from '../EmailOptInPrompt';

jest.mock('react-native-reanimated', () => {
  const mockReact = require('react');
  const View = mockReact.forwardRef((props: any, _ref: any) =>
    mockReact.createElement('View', props, props.children)
  );
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withTiming: (v: any, _cfg?: any, cb?: (f: boolean) => void) => {
      if (cb) cb(true);
      return v;
    },
    Easing: { inOut: () => () => 0, ease: () => 0 },
    runOnJS: (fn: any) => fn,
  };
});

describe('EmailOptInPrompt', () => {
  it('renders the plain-framing copy when visible', async () => {
    await render(
      <EmailOptInPrompt visible onSubscribe={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(screen.getByText(/occasional tips and optional reminders/i)).toBeTruthy();
  });

  it('calls onSubscribe when Subscribe is tapped', async () => {
    const onSubscribe = jest.fn();
    await render(
      <EmailOptInPrompt visible onSubscribe={onSubscribe} onDismiss={jest.fn()} />
    );
    fireEvent.press(screen.getByLabelText('Subscribe to email updates'));
    expect(onSubscribe).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the close (Not now) button is tapped', async () => {
    const onDismiss = jest.fn();
    await render(
      <EmailOptInPrompt visible onSubscribe={jest.fn()} onDismiss={onDismiss} />
    );
    fireEvent.press(screen.getByLabelText('Not now'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when not visible', async () => {
    const result = await render(
      <EmailOptInPrompt visible={false} onSubscribe={jest.fn()} onDismiss={jest.fn()} />
    );
    expect(result.toJSON()).toBeNull();
  });
});
