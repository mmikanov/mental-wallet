# Requirements Document

## Introduction

Today, sending the tips and reminders emails is a manual chore: the operator runs each
campaign by hand. We want the campaigns to go out **automatically every day**, in a **fixed
order**, so every subscriber moves through the same sequence of campaigns — the first
campaign first, then the next, and so on — regardless of when they signed up. Someone who
subscribes today and someone who subscribed months ago receive the same campaigns in the same
order with the same spacing; only their personal starting point differs.

The automation does **not** send a separate per-person email flow. It sends **campaigns in
order**. Each campaign already knows which tip to send and figures out its own eligible
audience; the automation's job is to run the right campaign at the right time and make sure
each subscriber advances through the campaigns in sequence, one at a time.

### Background

This is the "automation later" step anticipated in `docs/message-release-plan.md`, which lays
out the editorial order of the tips but sends them by hand today. The existing campaign system
(in the messaging system) already handles the hard parts of a single send: it enforces
consent, sends each person their own email, avoids sending a subscriber more than one email in
a day (deferring extras to a later run), and tracks who a campaign has already reached. This
spec adds the **daily scheduling** and the **fixed campaign order** on top of that, plus two
changes to how campaigns decide who is eligible (see Requirements 4 and 5).

Two deliberate changes to today's behavior are part of this work:

1. **A tip may intentionally be repeated.** Sometimes a subscriber misses or ignores a tip,
   so the operator may want to send the same tip again later — as long as other campaigns come
   between the two sends. Today the system treats "already received this tip" as permanent and
   would block the repeat. We are changing uniqueness so it is tracked **per campaign**, not
   per tip: each campaign is its own distinct send with its own reason, and the tip it carries
   is just what it delivers. The same tip can therefore appear in more than one campaign in the
   sequence.

2. **A campaign has a gap since the subscriber's last email, and that gap carries through the
   sequence.** Every campaign carries a gap of N days: "only people who haven't received any
   email from us in the last N days are eligible." The gap is a parameter the operator can set
   (or the drip sequence can supply), with a minimum and default of 1 day — so by default a
   subscriber is never emailed twice on the same day, and the operator can widen the gap to as
   many days as they want between particular emails. Anyone too recent is simply not sent this
   campaign on this run and waits. Crucially, because a subscriber must move through the
   sequence in order, a subscriber who hasn't yet received the current campaign is **not**
   eligible for the next one — so a deferral naturally holds up everything after it for that
   person until they catch up.

### Glossary

- **Campaign** — a single defined send: which tip to deliver, to which scope, with its own
  reason and its own record of who it has reached. The unit the sequence is built from.
- **Sequence (drip)** — the fixed, ordered list of campaigns subscribers move through over
  time (campaign 1, then campaign 2, and so on).
- **Sequence position** — how far a given subscriber has advanced through the sequence (which
  campaigns they have received, and therefore which campaign is next for them).
- **Spacing / gap (N days)** — a campaign's rule that a subscriber is only eligible if they
  have received no email from us in the last N days. It is a parameter (operator-set or
  supplied by the sequence) with a minimum and default of 1 day; a gap of 1 means "not the
  same day as another email."
- **Scope (tips vs reminders)** — the two kinds of email a person can opt into independently:
  **tips** (educational / feature content and the newsletter) and **reminders** (gentle
  "come back" nudges). A person may be opted into either, both, or neither.

> The technical mechanism (the daily scheduled trigger, how a subscriber's sequence position
> is tracked, how campaign-level uniqueness and the carry-over gap are enforced, and how
> emails are actually sent) lives in `design.md`, not here. It reuses and extends the existing
> campaign machinery rather than reinventing it.

## Requirements

### Requirement 1: Fixed, Ordered Campaign Sequence

**User Story:** As a subscriber, I want to receive the campaigns in a consistent order starting with the welcome message, so my experience is the same as everyone else's regardless of when I joined.

#### Acceptance Criteria

1.1 THE system SHALL deliver the campaigns in a single fixed order for all subscribers.

1.2 THE welcome message SHALL be the first campaign a subscriber receives.

1.3 TWO subscribers who join on different dates SHALL receive the same campaigns in the same order.

1.4 A subscriber SHALL advance through the sequence one campaign at a time, so they never receive a later campaign before an earlier one they have not yet received.

### Requirement 2: Automatic Daily Sending

**User Story:** As the operator, I want the daily send to happen automatically, so I don't have to run campaigns by hand.

#### Acceptance Criteria

2.1 THE system SHALL run the sequence automatically on a daily basis without operator action.

2.2 EACH day THE system SHALL, for each subscriber, consider only the next campaign that subscriber is due for.

2.3 IF a subscriber is not due for any campaign on a given day THE system SHALL send them nothing that day.

2.4 WHEN a subscriber has received every campaign in the sequence THE system SHALL send them nothing further until the operator adds a new campaign to the sequence.

### Requirement 3: Preview and Pause (Operator Control)

**User Story:** As the operator, I want to preview what the automated run would do and be able to pause it, so I stay in control and avoid surprises.

#### Acceptance Criteria

3.1 THE operator SHALL be able to preview what the automated run would do before it goes out, without any email being sent (a safe dry run).

3.2 THE preview SHALL show which campaign each subscriber would receive next (or that they are waiting / finished), so the operator can confirm the order and eligibility look right.

3.3 THE operator SHALL be able to pause the automation at any time, after which no further automatic sends occur until it is resumed.

### Requirement 4: Uniqueness Is Per Campaign (a Tip May Repeat)

**User Story:** As the operator, I want uniqueness tracked per campaign rather than per tip, so I can intentionally repeat an older tip later in the sequence for people who missed it.

#### Acceptance Criteria

4.1 NO subscriber SHALL receive the same campaign more than once.

4.2 THE same tip MAY be delivered by more than one campaign in the sequence, so a tip can intentionally recur, provided other campaigns fall between the two sends.

4.3 WHEN a tip is repeated by a later campaign THE fact that the subscriber received that tip from an earlier campaign SHALL NOT prevent the later campaign from sending it.

4.4 THE change to per-campaign uniqueness SHALL apply to the existing campaign system, so that running a campaign is governed by whether the subscriber already received that campaign, not whether they ever received its tip.

### Requirement 5: Spacing Gap That Carries Through the Sequence

**User Story:** As the operator, I want to require a minimum gap since a subscriber's last email for certain campaigns, and have that gap respected across the whole sequence, so spacing choices aren't undone by the next campaign.

#### Acceptance Criteria

5.1 A campaign SHALL have a gap of N days, meaning a subscriber is eligible only if they have received no email from us in the last N days.

5.2 THE gap value SHALL be a parameter that can be set either by the operator (per campaign) or supplied by the drip sequence, so the operator can choose any number of days they want.

5.3 THE gap SHALL have a minimum and default of 1 day, so a campaign can never be configured to send to a subscriber on the same day as another email; a gap of 1 day enforces the existing no-same-day behavior.

5.4 WHEN a subscriber is too recent to meet a campaign's gap THE campaign SHALL NOT send to them on that run, and they SHALL remain due for that same campaign on a later run once the gap is met.

5.5 A subscriber who has not yet received the current campaign SHALL NOT be eligible for any later campaign in the sequence (the deferral carries over, holding up everything downstream for that subscriber until they catch up).

### Requirement 6: Consent Respected (Existing Behavior Relied Upon)

**User Story:** As a subscriber, I want these emails to respect my opt-in choices, so I only get what I agreed to and unsubscribing stops them.

#### Acceptance Criteria

6.1 THE automation SHALL rely on the existing campaign consent enforcement so that only people opted into a campaign's scope receive it.

6.2 WHEN a person unsubscribes THE sequence SHALL stop for them.

6.3 THE tips and reminders scopes SHALL be respected independently, so a subscriber only receives campaigns for the scopes they opted into.

### Requirement 7: Operator Can Change the Sequence Without Engineering

**User Story:** As the operator, I want to change which campaigns are in the sequence, their order, and their spacing without an engineering change, so I can tune the nurture flow myself.

#### Acceptance Criteria

7.1 THE operator SHALL be able to change the order of campaigns in the sequence without an engineering change.

7.2 THE operator SHALL be able to add or remove a campaign from the sequence without an engineering change.

7.3 THE operator SHALL be able to change a campaign's spacing gap without an engineering change.

7.4 THE operator SHALL be able to create the sequence from scratch — starting from an empty sequence and adding steps one at a time — without an engineering change.

7.5 WHEN the sequence is empty THE daily run SHALL simply send nothing, rather than erroring.

### Requirement 8: Editing the Sequence Mid-Flight (Live, Received-Based)

**User Story:** As the operator, when I change the sequence while subscribers are partway through it, I want the simplest predictable behavior: the updated sequence just takes effect, and each subscriber gets whatever campaign they are next eligible for under the new arrangement.

#### Acceptance Criteria

8.1 THE sequence SHALL be evaluated fresh on each run against its current order, membership, and gaps; there SHALL be no per-subscriber frozen copy of an earlier version of the sequence.

8.2 FOR each subscriber on each run THE next campaign SHALL be the earliest campaign in the current order that the subscriber has not yet received and is eligible for.

8.3 WHEN the operator reorders the sequence THE subscriber SHALL simply receive their next eligible campaign under the new order, even if that campaign was moved to an earlier position; no campaign the subscriber already received SHALL be sent again (per Requirement 4).

8.4 WHEN the operator inserts a campaign earlier than a subscriber's current position THE subscriber SHALL receive it when it becomes their next eligible unreceived campaign, even if they had otherwise moved past that point (a late insertion may re-engage a subscriber who had finished).

8.5 WHEN the operator removes a campaign from the sequence THE subscribers who had not yet received it SHALL simply move on to their next eligible campaign; the removed campaign SHALL be unlinked from the sequence while the campaign itself and its send history remain intact.

8.6 WHEN the operator changes a campaign's gap THE new gap SHALL take effect on the next run for all subscribers not yet past that campaign; a gap change SHALL be forward-only and SHALL NOT un-send anything already sent.

8.7 THIS behavior is the intentionally simplest option (evaluate live, send what each subscriber is eligible for) and MAY be replaced later by a more elaborate behavior (for example, freezing a subscriber's path or only-forward insertions) if a need arises; this requirement is the recorded source of truth until then.

### Requirement 9: Scope of the Automatic Sequence (Product Decision)

**User Story:** As the operator, I want the automatic daily sequence to cover the educational tips now, and I accept deferring the behavior-based "come back" reminder, so we ship the readable part first.

#### Acceptance Criteria

9.1 THE automatic daily sequence SHALL cover the educational tips.

9.2 THE "come back, we miss you" reminder that should fire after a person goes quiet SHALL be deferred, because it needs a signal about the person's last app use that is not available today.

9.3 THE deferral SHALL be recorded as a parked follow-up, not a silent omission.

### Requirement 10: Testing the Sequence

**User Story:** As the operator, I want to test a full sequence end-to-end and test just the next few days of a sequence, without waiting real calendar days, so I can confirm the order, spacing, and eligibility are right before and after going live.

#### Acceptance Criteria

10.1 THE operator SHALL be able to run the sequence against a controllable "today," so a test does not depend on real calendar time passing.

10.2 THE operator SHALL be able to step the simulated date forward one day at a time, seeing which campaign each test subscriber would receive on each simulated day.

10.3 BY stepping forward until the sequence completes THE operator SHALL be able to test a full sequence end-to-end (every campaign, in order, with uniqueness and gaps honored); BY stepping forward only a few days THE operator SHALL be able to test just the next few days of a sequence.

10.4 THE operator SHALL be able to run these tests as a pure simulation that sends no emails (showing what would be sent on each simulated day).

10.5 THE operator SHALL be able to run these tests as real sends directed only to a designated test subscriber or test address, so the actual emails can be seen to arrive and render.

10.6 THE tests SHALL operate on isolated test subscribers, so running a test SHALL NOT touch or advance the sequence position of real subscribers.

10.7 THE operator SHALL be able to create test subscribers whose signup is set as a relative age ("joined N days ago"), so testers can sit at different points in the flow (for example, one brand new, one a week in, one well past the end).

10.8 THE operator SHALL be able to create a BATCH of test subscribers in one action, where the batch's relative signup ages are derived from the CURRENT sequence (its steps and spacing), so the generated testers land at the sequence's meaningful points and exercise it properly.

10.9 THE operator SHALL have two distinct test-data actions: (a) RESET an existing set of test subscribers — clearing their drip send history so their position returns to the start, while keeping the subscribers and their signup ages — so the same set can be re-tested; and (b) CREATE a fresh set of test subscribers with newly derived signup ages, which SHALL REPLACE the previous set of test subscribers entirely — removing the prior test subscribers and all of their drip send history — so creating a set always yields a clean cohort with no leftovers from a previous set. Both actions SHALL affect only test subscribers, never real ones.

10.10 THE simulation results SHALL reflect the same order, per-campaign uniqueness, gap, and carry-over rules as a real run (Requirements 1, 4, 5, 8), so a passing test is meaningful.

### Requirement 11: Success Verification

**User Story:** As the operator, I want to confirm the automation does the right thing before and after turning it on.

#### Acceptance Criteria

11.1 A preview SHALL show each subscriber's correct next campaign (or waiting / finished state) in the right order.

11.2 AFTER the automation is turned on EACH subscriber SHALL receive the next campaign they are due, in order, never receiving the same campaign twice and never jumping ahead past a campaign they have not received.

11.3 A subscriber deferred by a campaign's gap SHALL be shown as still due for that campaign (not advanced past it) until the gap is met.

### Requirement 12: Daily Operator Summary Email

**User Story:** As the operator, I want an email after each daily run summarizing who received which campaign that day — and especially who just reached the end of the sequence — so I can keep an eye on the drip without opening the admin screen.

#### Background

The automation runs on its own each day. Without a report, the operator has no passive visibility into what went out — they would have to open the screen and check. A short summary email after each run gives that visibility by default, and a specific callout for anyone who just received the final campaign tells the operator which subscribers have now completed the whole flow (useful for knowing when to add more content or follow up).

#### Acceptance Criteria

12.1 AFTER a daily run completes THE system SHALL send the operator a summary of that run.

12.2 THE summary SHALL list who received an email that day and which campaign/tip each of them received, grouped so the operator can see per campaign who got it, and SHALL include run totals (how many were sent, how many failed, how many are waiting, how many have finished, and how many subscribers were considered).

12.3 WHEN any subscriber received the LAST campaign in the sequence on that run THE summary SHALL call those subscribers out distinctly, noting they have now reached the end of the drip; WHEN no one did, the summary SHALL say so.

12.4 WHEN a send failed during the run THE summary SHALL list the affected recipients and the campaign involved, so problems are visible rather than silent.

12.5 WHEN a run sends nothing (everyone waiting, finished, or not yet signed up) THE system SHALL still send a brief summary confirming the run happened and that nothing went out, so the operator knows the automation is alive.

12.6 WHEN the drip is paused (so no run occurs) THE system SHALL NOT send a summary.

12.7 THE summary SHALL go only to the operator, never to subscribers, and SHALL be sent to a configurable operator address; IF no operator address is configured THE summary SHALL simply be skipped without affecting the run.

12.8 THE summary SHALL be best-effort: a failure to build or send it SHALL NEVER disrupt or re-trigger the daily run itself.

12.9 Dates/times shown in the summary SHALL be presented in US Eastern time, consistent with how the operator screen shows run times.

## Out of Scope

- **Multiple, separate sequences.** There is exactly ONE global sequence that all subscribers
  move through. Supporting several named/parallel sequences (for example, a different drip per
  audience or scope, with subscribers assigned to one) is a deliberate future direction, not
  this spec. (The operator can create and rebuild the single sequence from scratch — Req 7.4 —
  but there is only one at a time.)
- **Pre-populating / seeding the sequence with a batch mechanism.** The sequence is only a few
  campaigns, so the operator builds it one step at a time (Req 7.4); a special one-step
  "seed the recommended sequence" action or script is not worth building now.
- Behavior-triggered reminders (the quiet-for-a-while "come back" nudge) — parked until a
  last-activity signal exists.
- Creating new tip content (the sequence uses the tips that already exist).
- Changing the consent / subscribe flow.
- Remote push notifications.

## Notes

- **Dependency on a change to the existing campaign system.** Requirement 4 (per-campaign
  uniqueness instead of per-tip) and Requirement 5 (the gap and its carry-over) are changes to
  how campaigns decide eligibility today. The design must cover updating the existing campaign
  machinery, not only building a new scheduler on top of it.
- **What is reused vs. generalized:** the per-recipient send path and consent enforcement are
  existing campaign behaviors the automation relies on unchanged (Requirement 6). The existing
  same-day guard is **generalized** into the N-day gap (Requirement 5): a gap with a minimum
  and default of 1 day reproduces today's "no two emails in one day" behavior, and larger
  values add deliberate spacing.
- **Verification honesty:** the sequence logic (order, uniqueness, gaps, carry-over, and the
  day-by-day cadence) can be fully tested ahead of time via the controllable-"today"
  simulation and the step-forward tests in Requirement 10 — including a full end-to-end run
  and a few-days run — against isolated test subscribers. The one thing that can only be
  observed live is that the automated daily trigger actually **fires each day** in production;
  the success check therefore includes watching one real daily run after turning it on.
- The technical mechanism (daily scheduled trigger, per-subscriber sequence-position tracking,
  per-campaign uniqueness, the carry-over gap, and the send) belongs in `design.md`.
- This is one of three measurement-foundation pieces in `docs/gtm-icp-discovery-plan.md`; a
  consistent automatic nurture sequence keeps the onboarding emails from being a confound
  between ICP experiments.
