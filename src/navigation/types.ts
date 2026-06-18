/**
 * Navigation type definitions for the Mental Health Wallet app.
 * Defines the param lists for root stack and bottom tab navigators.
 */

export type RootStackParamList = {
  Disclaimer: undefined;
  MainTabs: undefined;
  LibraryBrowser: undefined;
  CardCreator: { cardId?: string } | undefined;
  Archive: undefined;
  Settings: undefined;
  CrisisResources: undefined;
  UsageHistory: { cardId: string };
  ReminderConfig: { cardId: string };
};

export type MainTabParamList = {
  Wallet: { focusCardId?: string } | undefined;
};
