/**
 * Navigation type definitions for the Mental Health Wallet app.
 * Defines the param lists for root stack and bottom tab navigators.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Wallet: { focusCardId?: string; highlightSessionCard?: boolean } | undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ModeChoice: undefined;
  LibraryBrowser: undefined;
  CardCreator: { cardId?: string; adminEditCardId?: string; adminEditSource?: 'admin' | 'static' } | undefined;
  Archive: undefined;
  Settings: undefined;
  CrisisResources: undefined;
  UsageHistory: { cardId: string };
  ReminderConfig: { cardId: string };
  KpiChange: undefined;
  PrivacyPolicy: undefined;
  DevEventViewer: undefined;
};
