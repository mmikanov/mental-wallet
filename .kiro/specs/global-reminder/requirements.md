# Requirements Document

## Introduction

The global reminder extends the existing per-card reminder system with a wallet-level "Daily wellness check-in" notification. It suggests a specific card based on least-recent usage to encourage variety in practice.

## Requirements

### Requirement 1: Global Reminder

**User Story:** As a user, I want a daily wellness check-in reminder that suggests a tool, so that I remember to practice even without setting individual card reminders.

#### Acceptance Criteria

1. WHEN a user sets a global reminder from the Wallet Kebab_Menu, THE App SHALL configure a "Daily wellness check-in" notification at the selected time.
2. THE notification SHALL suggest the least-used card in the past 14 days (or a random card if equally used).
3. Tapping the notification SHALL open the suggested card in Focused_Card view.
