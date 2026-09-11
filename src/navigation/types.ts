/**
 * Navigation type definitions for the Mental Wallet app.
 * Defines the param lists for root stack and bottom tab navigators.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Wallet:
    | {
        focusCardId?: string;
        highlightSessionCard?: boolean;
        /** Deep link /app/how-i-feel — focus+expand the "Start from how I feel" session card */
        openHowIFeel?: boolean;
        /** Deep link /app/checkin — focus+expand the seedling KPI daily check-in card */
        openKpiCheckin?: boolean;
        /** Deep link /app/learn-more-tour — focus+expand the top (non-session) stack card */
        openTopCard?: boolean;
      }
    | undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ModeChoice: undefined;
  LibraryBrowser: { initialFilter?: string } | undefined;
  CardCreator: { cardId?: string; adminEditCardId?: string; adminEditSource?: 'admin' | 'static' } | undefined;
  Archive: undefined;
  Settings: undefined;
  Tips: undefined;
  CrisisResources: undefined;
  UsageHistory: { cardId: string };
  ReminderConfig: { cardId: string };
  KpiChange: undefined;
  Licenses: undefined;
  DevEventViewer: undefined;
  WalletInsights: undefined;
  ToolInsights: { cardId: string };
  InsightsHelp: undefined;
  About: undefined;
  PrivacyExplanation: undefined;
};
