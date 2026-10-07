# Requirements Document

# Requirements Document — Attribution Dashboard Enhancements

## Introduction

This spec covers enhancements to the **operator analytics dashboard** that make the
**install-source attribution** (where users installed from) genuinely readable and useful. It
is scoped to the attribution view: comparing channels, trusting the per-channel retention
number, and being honest about thin data and platform caveats. It is **not** the in-app
analytics screen that end users see (that is the separate `analytics-dashboard` spec), and it
is **not** the channel-attribution data pipeline itself (that is the `channel-attribution`
spec) — this spec only improves how the resulting install-source data is **presented** to the
operator.

Passive channel attribution now records which marketing channel each install came from, and
cohort-based retention gives a trustworthy stickiness measure. The data to answer the core
go-to-market question exists — but the dashboard that presents it hasn't caught up. The
operator still has to eyeball separate sections to answer the one question the attribution
work was built for: **which install source produces users who actually stick?** This spec
makes the dashboard answer that question clearly, honestly, and at a glance.

### Background

Install-source attribution and cohort retention are built on the data side
(`.kiro/specs/channel-attribution/`, `.kiro/specs/retention-cohorts/`), and the dashboard
already shows a first-pass per-channel breakdown. But the presentation has gaps that blunt its
usefulness for deciding which audience to pursue: small channels can read as if solid, the
legacy retention figure and the trustworthy cohort figure can both appear without a clear
"use this one" signal, and comparing channels side by side (the whole point of attribution) is
harder than it should be. This spec is about **reading the install-source data well** — it
adds no new data collection and changes nothing about how the app, workers, or privacy model
behave.

### Glossary

- **Operator dashboard** — the private, secret-gated analytics web page the operator opens in
  a browser (served by the analytics worker). Not the end-user in-app analytics.
- **KPI** — a headline number on the dashboard (for example, installs, activation rate,
  retention).
- **Cohort retention** — the trustworthy install-day retention measure introduced by the
  retention-cohorts work (the one the operator should rely on), as opposed to the earlier
  bucket-based figure.
- **Channel** — where an install came from (a tagged marketing channel, or the
  organic/untagged group), as introduced by the channel-attribution work.
- **Small sample** — a channel or cohort with too few people to read a percentage reliably.

> The technical approach (which endpoints feed which card, how the page is structured, how
> filters compose) belongs in `design.md`, not here. This document stays in product language
> per the `workflow` steering rule.

## Requirements

### Requirement 1: One Clear Retention Number

**User Story:** As the operator, I want the dashboard to show a single, trustworthy retention number, so I stop second-guessing which figure to believe.

#### Acceptance Criteria

1.1 THE dashboard SHALL present cohort-based retention as the primary retention measure everywhere retention appears.

1.2 WHERE the earlier bucket-based retention figure is still shown at all, THE dashboard SHALL clearly label it as legacy/deprecated, or remove it, so the operator is never left comparing two retention numbers without knowing which to trust.

1.3 EACH retention figure SHALL show the size of the group it was computed from, so the operator can see how solid it is.

### Requirement 2: Compare Channels Side by Side

**User Story:** As the operator, I want to compare channels against each other in one view, so I can see which audience activates and retains best and decide which ICP to pursue.

#### Acceptance Criteria

2.1 THE dashboard SHALL present the channels (and the organic/untagged group) together in one place, so their key metrics can be compared without hunting across sections.

2.2 THE comparison SHALL include, per channel, at least: new installs, activation, wallet growth, and cohort retention.

2.3 THE organic/untagged group SHALL always appear in the comparison as its own clearly labeled entry, distinct from the tagged channels.

2.4 THE operator SHALL be able to read the comparison for a chosen time window and user group (new vs. active), consistent with the dashboard's existing filters, so a comparison can be scoped to one experiment window.

### Requirement 3: Honest About Small Samples

**User Story:** As the operator, I want the dashboard to make thin data obvious, so I don't make a decision off a fragile percentage.

#### Acceptance Criteria

3.1 WHERE a channel or cohort is too small to read a rate reliably THE dashboard SHALL show the raw count and visibly mark the rate as not-yet-meaningful (rather than presenting a fragile percentage as if it were solid).

3.2 EVERY percentage on the dashboard SHALL be accompanied by the count it was computed from.

3.3 THE threshold for "too small" SHALL be applied consistently across the dashboard, so the same standard of confidence is used everywhere.

### Requirement 4: State the Known Limits Plainly

**User Story:** As the operator, I want the dashboard to spell out the caveats of what it shows, so I read the numbers with the right amount of trust.

#### Acceptance Criteria

4.1 THE dashboard SHALL state plainly that iPhone channel attribution is coarser — iPhone link installs appear in the organic/untagged group, and real iPhone channel performance is read from the app store's own analytics plus running one channel per time window.

4.2 THE dashboard SHALL state plainly that attribution is directional, not exact (for example, a reinstall can look like a new person), so channel comparisons are read as group-level signals.

4.3 THESE caveats SHALL appear next to the data they qualify (for example, the attribution caveat with the channel comparison), not buried in a separate help page.

### Requirement 5: Reads at a Glance

**User Story:** As the operator, I want the most decision-relevant information to be readable quickly, so I can check the app's health and the current experiment without studying the page.

#### Acceptance Criteria

5.1 THE dashboard SHALL surface the headline health of the app (installs, activation, retention) prominently, above the more detailed breakdowns.

5.2 THE channel comparison SHALL be reachable without excessive scrolling or digging, since it is the primary decision surface during the ICP-discovery experiments.

5.3 THE dashboard SHALL remain usable on a normal laptop browser without horizontal scrolling for the headline view.

### Requirement 6: Filters Compose Predictably

**User Story:** As the operator, I want the dashboard's filters to work together, so I can scope every number to one experiment window, one user group, and one channel.

#### Acceptance Criteria

6.1 THE existing time-window and user-group (new vs. active) filters SHALL continue to scope every metric on the page.

6.2 THE channel filter SHALL compose with the time-window and user-group filters, so the operator can view, for example, a single channel within a single experiment window.

6.3 WHEN filters are changed THE dashboard SHALL update all affected metrics consistently, so no card is left showing a stale or differently-scoped number.

### Requirement 7: No Change to Data, Privacy, or Collection

**User Story:** As the product owner, I want these dashboard improvements to be presentation-only, so the app's privacy stance and data model are untouched.

#### Acceptance Criteria

7.1 THESE changes SHALL be presentation/reading improvements only; they SHALL NOT add any new data collection or change what is stored.

7.2 THE analytics SHALL remain anonymous; nothing in these changes SHALL introduce personal data.

7.3 THE operator dashboard SHALL remain private and secret-protected, reachable only by the operator.

### Requirement 8: Success Verification

**User Story:** As the operator, I want to confirm the improved dashboard reads correctly before relying on it for experiment decisions.

#### Acceptance Criteria

8.1 THE numbers shown SHALL match what the underlying analytics produce for the same filters (the dashboard is a presentation layer, not a separate calculation).

8.2 A channel comparison scoped to a time window SHALL show each channel's metrics for that window, with small channels marked as such.

8.3 THE single-retention-number and the small-sample marking SHALL be verifiable against known test data.

## Out of Scope

- The in-app, end-user analytics screen (that is the separate `analytics-dashboard` spec);
  this spec is only the operator's private web dashboard.
- Any new data collection, event, or stored field — this is a reading/presentation change.
- The device-side channel attribution itself (that is the `channel-attribution` spec; this
  spec only improves how the resulting data is presented).
- Email-performance reporting (opens/clicks) — a possible separate future dashboard, not this.
- Changing the privacy model or making the dashboard public.

## Notes

- **Builds on** `.kiro/specs/retention-cohorts/` (the trustworthy retention measure) and
  `.kiro/specs/channel-attribution/` (the channel data and the first version of the breakdown).
  Those shipped the data and a first-pass breakdown; this spec is about presenting them well.
- **Presentation-only:** every requirement here is about how the operator reads existing data.
  No worker ingestion, schema, app, or privacy change is implied.
- The technical approach (dashboard structure, which endpoints feed each card, how the filters
  are serialized and composed) belongs in `design.md`.
- This supports the ICP-discovery experiments in `docs/gtm-icp-discovery-plan.md`: those
  experiments are only readable if the operator can compare channels and trust the retention
  number at a glance.
