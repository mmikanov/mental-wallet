/**
 * Regression: deep-link nav state must take precedence over the emotion-mode
 * "highlight session card" initial params on cold start.
 *
 * Bug: on iOS cold start, launching `mentalwallet://checkin` opened only the
 * wallet (not the check-in card). Root cause: when Start_Mode resolved to
 * 'emotion', RootNavigator set `initialParams = { screen: 'Wallet', params:
 * { highlightSessionCard: true } }` on the MainTabs screen. React Navigation
 * had already applied the deep-link state (openKpiCheckin), but these
 * initialParams clobbered it — so the deep-link param never reached
 * WalletScreen. Confirmed on device: getStateFromPath produced `checkin`, but
 * WalletScreen received `{ highlightSessionCard: true }`.
 *
 * Fix: when a launch URL is present, skip the emotion-highlight params.
 */

import { resolveInitialMainTabsParams } from '../resolveInitialMainTabsParams';

describe('resolveInitialMainTabsParams — deep-link precedence', () => {
  it('emotion mode with NO launch URL → highlights the session card (Req 2.2)', () => {
    expect(resolveInitialMainTabsParams('emotion', null)).toEqual({
      screen: 'Wallet',
      params: { highlightSessionCard: true },
    });
  });

  it('emotion mode WITH a scheme deep link → no highlight params (deep link wins)', () => {
    expect(
      resolveInitialMainTabsParams('emotion', 'mentalwallet://checkin'),
    ).toBeUndefined();
  });

  it('emotion mode WITH an https deep link → no highlight params (deep link wins)', () => {
    expect(
      resolveInitialMainTabsParams('emotion', 'https://mentalwallet.app/app/checkin'),
    ).toBeUndefined();
  });

  it('wallet mode with NO launch URL → no highlight params', () => {
    expect(resolveInitialMainTabsParams('wallet', null)).toBeUndefined();
  });

  it('wallet mode WITH a deep link → no highlight params', () => {
    expect(
      resolveInitialMainTabsParams('wallet', 'mentalwallet://how-i-feel'),
    ).toBeUndefined();
  });

  it('treats an empty-string launch URL like no URL (highlights in emotion mode)', () => {
    // Linking.getInitialURL resolves to null when there is no URL; empty string
    // is not expected in practice, but guard the truthiness contract explicitly.
    expect(resolveInitialMainTabsParams('emotion', '')).toEqual({
      screen: 'Wallet',
      params: { highlightSessionCard: true },
    });
  });
});
