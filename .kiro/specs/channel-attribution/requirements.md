# Requirements Document

## Introduction

To find the kind of person who sticks with the app, we need to know **where new users came
from** — which marketing channel led to each install — so we can compare how well different
audiences retain. We want this **without asking users a question**. A "where did you hear
about us?" prompt adds friction, gives the user nothing in return, and is often answered
inaccurately, which would pollute the very data we're trying to trust. Attribution here must
be **passive**: it happens invisibly, derived from the link a person used to reach the store.

This capability is a dependency of the ICP-discovery experiments described in
`docs/gtm-icp-discovery-plan.md`: those experiments are only readable if we can tell one
channel's results apart from another's.

Most channels send people to the **landing page first**, not straight to an app store,
because the page explains the app better than a raw store listing. So the common path is:
channel link → landing page → tap a store badge → install. For that path to be
attributable, the **landing page must carry the channel tag through to the store links** —
otherwise the tag is lost at the page and the install looks like it came from nowhere. This
spec therefore covers both the website download links and links shared outside the website.
People who arrive with no channel tag at all (typed the address, found it organically, a
share with no tag) are expected and counted as a separate organic group, not blamed on any
channel.

### Background

The next growth push is structured as experiments that drive different audiences (e.g.
self-improvers from one community, people in acute distress from another, therapist-referred
clients) through different channels. To learn which audience retains, each channel's installs
must be distinguishable on the analytics dashboard. The platforms differ in what they allow:
one mobile platform can pass along the originating link's tag at install time; the other
offers only coarser signals. We accept that difference and lean on running one channel at a
time in separate windows to keep results readable where the platform is less generous.

The app's analytics are deliberately anonymous and collect no personal data; this capability
must preserve that.

> The technical mechanism (how the originating link's tag is read on each platform, how it is
> recorded, and how the dashboard reads it) lives in `design.md`, not here.

### Glossary

- **Channel** — a place a person could have come from (for example, a specific online
  community, a social post, a therapist referral, or organic store search).
- **Attribution** — connecting a new install back to the channel that led to it, so results
  can be compared per channel. Here it is always passive (never a question to the user) and
  **directional, not exact** — it tells us roughly how a group behaves, not a precise
  per-person source.
- **Landing page** — the app's marketing website that most channel links point to, where a
  person reads about the app and taps a store badge to download.
- **Organic / untagged** — installs that arrive with no channel tag (for example, someone
  who typed the address or found the app through store search). These are counted as their
  own group, separate from any tagged channel.

## Requirements

### Requirement 1: Per-Channel Download Links

**User Story:** As the operator, I want each marketing channel to have its own download link, so installs can be traced back to the channel they came from.

#### Acceptance Criteria

1.1 THE operator SHALL be able to create a distinct, channel-tagged download link for each marketing channel used in an experiment.

1.2 EACH channel-tagged link SHALL lead to the normal app store listing, so the person's download experience is unchanged.

1.3 THE set of channel tags SHALL be documented so the operator can reuse consistent names across experiments.

### Requirement 2: Landing Page Carries the Channel Tag Through to the Store

**User Story:** As the operator, I want a channel link that lands on the website to still attribute the install, so the common "visit the site first, then download" path is not lost.

#### Acceptance Criteria

2.1 WHEN a person arrives at the landing page via a channel-tagged link THE landing page SHALL preserve the channel tag.

2.2 WHEN that person taps a store download badge on the landing page THE channel tag SHALL be carried through to the app store, so the resulting install is attributable to that channel.

2.3 THE tag-carrying behavior SHALL be invisible to the person and SHALL NOT change how the landing page looks or how downloading works.

2.4 A single channel-tagged link that points at the landing page SHALL be sufficient for the operator to run a channel; the operator SHALL NOT be required to hand out store-direct links to get attribution for the site-first path.

### Requirement 3: Installs With No Channel Tag Are a Separate Organic Group

**User Story:** As the operator, I want installs that arrive without any channel tag counted as their own organic group, so they are never miscredited to a channel.

#### Acceptance Criteria

3.1 WHEN an install arrives with no channel tag THE system SHALL count it as organic / untagged rather than attributing it to any channel.

3.2 THE organic / untagged group SHALL be distinguishable on the dashboard from the tagged channels.

3.3 A person who reaches the landing page without a channel tag SHALL fall into the organic / untagged group, and their download experience SHALL be unchanged.

### Requirement 4: Passive Attribution on Android

**User Story:** As the operator, I want the app to tell which channel link led to an Android install, invisibly to the user.

#### Acceptance Criteria

4.1 WHEN a person installs on Android via a channel-tagged link THE system SHALL associate that install with the originating channel, with no visible step for the user.

4.2 THE channel association SHALL be available to the analytics dashboard so Android installs can be grouped and compared by channel.

### Requirement 5: Coarser Attribution on iPhone (Accepted Tradeoff)

**User Story:** As the operator, I accept coarser attribution on iPhone, where the platform gives less install information, so I still get a usable channel read.

#### Acceptance Criteria

5.1 THE system SHALL support channel tags carried on the iPhone store link together with the store's own source analytics as the attribution signal on that platform.

5.2 WHERE per-install channel detail is not available on iPhone THE operator SHALL be able to distinguish channels by running one channel at a time in separate time windows.

5.3 THE plan SHALL clearly state that iPhone attribution is coarser than Android, so the operator reads it with that caveat.

### Requirement 6: Channel Breakdown on the Analytics Dashboard

**User Story:** As the operator, I want the analytics dashboard to break results down by the channel installs came from, so I can compare how each audience activates and sticks and decide which ICP to pursue.

#### Acceptance Criteria

6.1 THE dashboard SHALL present a per-channel breakdown that shows, for each channel (and the organic / untagged group), at least: the number of new installs, activation, wallet growth, and retention.

6.2 THE per-channel retention SHALL use the trustworthy cohort-based retention measure (the one introduced by the retention-cohorts work), not the earlier bucket-based figure.

6.3 THE operator SHALL be able to filter the existing dashboard metrics by a single channel, so every metric can be scoped to one channel's installs.

6.4 THE channel filter SHALL work together with the existing date/phase and user filters, so the operator can combine them (for example, a single channel within a single experiment window).

6.5 THE organic / untagged group SHALL appear in the breakdown as its own entry, clearly separated from the tagged channels.

6.6 WHERE a channel has too few installs to read a metric meaningfully THE dashboard SHALL make the small sample evident (for example, by showing the count alongside the percentage) rather than presenting a fragile percentage as if it were solid.

### Requirement 7: No User-Facing Question or Friction

**User Story:** As a user, I should never be asked where I came from, and my setup experience should not change because of attribution.

#### Acceptance Criteria

7.1 THE attribution capability SHALL NOT add any question, prompt, or visible step for the user.

7.2 THE onboarding and first-run experience SHALL remain unchanged by attribution.

### Requirement 8: Privacy Preserved

**User Story:** As the product owner, I want attribution to respect the app's privacy stance, so we collect no personal data and keep analytics anonymous.

#### Acceptance Criteria

8.1 THE attribution capability SHALL NOT collect personal data about the user.

8.2 THE existing anonymous analytics SHALL remain anonymous; attribution SHALL add only a channel label, not personal identity.

### Requirement 9: Known Limits Stated Plainly

**User Story:** As the operator, I want the known limits of attribution spelled out, so I don't over-read the numbers.

#### Acceptance Criteria

9.1 THE documentation SHALL state, in plain words, that a reinstall can look like a new person, so attribution is directional rather than exact.

9.2 THE documentation SHALL state that attribution is a group-level signal for comparing channels, not a precise per-user source of truth.

### Requirement 10: Success Verification

**User Story:** As the operator, I want to confirm attribution works before relying on it for experiments.

#### Acceptance Criteria

10.1 A test download made via a channel-tagged link SHALL be correctly attributed to that channel on the dashboard.

10.2 A test download made by visiting the landing page through a channel-tagged link and then tapping a store badge SHALL be correctly attributed to that channel.

10.3 THE per-channel breakdown SHALL correctly separate test installs from different channels, and SHALL place untagged test installs in the organic / untagged group.

10.4 WHEN separate channels are run in separate time windows THEIR results SHALL remain distinguishable on the dashboard.

## Out of Scope

- Paid-advertising attribution SDKs or ad-network measurement integrations.
- Any user-facing question or self-reported source.
- Cross-device identity (linking the same person across multiple devices).

## Notes

- The technical mechanism (platform install-referrer handling, store campaign tokens, the
  analytics event detail, and the dashboard channel breakdown and filter) belongs in
  `design.md`. This document stays in product language per the `workflow` steering rule.
- The per-channel retention in Requirement 6 depends on the trustworthy cohort retention
  from `.kiro/specs/retention-cohorts/`; that work is a prerequisite for a meaningful
  per-channel retention read.
- Attribution is one of three measurement-foundation pieces in
  `docs/gtm-icp-discovery-plan.md` (alongside the retention metric fix and the automated
  email drip). The retention fix is tracked separately in `.kiro/specs/retention-cohorts/`.
