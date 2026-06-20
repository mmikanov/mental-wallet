# Requirements Document

## Introduction

The wallet-level analytics dashboard gives users a bird's-eye view of their practice habits across all tools. It surfaces aggregate usage data, mood trends, and tool effectiveness rankings.

**Dependency:** Requires the `mood-logging` spec to be implemented first.

## Requirements

### Requirement 1: Wallet-Level Analytics Dashboard

**User Story:** As a user, I want a dashboard summarizing my overall tool usage, so that I can see my practice habits and identify areas for improvement.

#### Acceptance Criteria

1. THE App SHALL provide a Wallet-level analytics dashboard accessible from the Wallet Kebab_Menu showing: total tools in Wallet, total completions for the selected time period, most-used tools (top 3), and tools not used in the last 14 days.
2. THE App SHALL allow switching between time period views (7d default, 30d, year, all time).
3. THE App SHALL display mood analytics (trend chart, tool effectiveness ranking, mood correlation data) as a section within the dashboard.
4. IF zero completions exist for the selected period, THEN THE App SHALL display an empty state encouraging tool use.
5. THE App SHALL display the mental health disclaimer at the top of the analytics view.
