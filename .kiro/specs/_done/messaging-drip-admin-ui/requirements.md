# Requirements Document

## Introduction

The messaging drip automation (see `.kiro/specs/messaging-drip-automation/`) is operated
entirely through admin API calls today. That makes it hard to run and, especially, hard to
**test** — reading a multi-step sequence, previewing what tomorrow would send, or stepping a
test subscriber through the whole sequence is awkward from the command line. This spec adds a
simple **operator admin screen** that puts those actions behind buttons and readable tables.

The screen is for the **operator only** (the person running the app's messaging), reached
through a private, secret-protected page — the same way the analytics dashboard is private.
It is not shown to end users or email subscribers.

### Background

The analytics side already has a private, secret-gated admin dashboard the operator opens in a
browser. The messaging side has no such screen — it is all command-line. This spec gives the
drip the same kind of operator screen so the sequence can be seen and exercised visually,
which matters most for **testing** (previewing runs, time-travel simulation, resetting test
subscribers) where eyeballing a table beats parsing command output.

This UI is a **frontend over the messaging worker's existing operator capabilities**. Its
initial focus is the drip (so it depends on `messaging-drip-automation` being built), but it is
intended to be **extensible into a general messaging-worker admin console** later — e.g.
running a standalone campaign, a one-off tip send, or managing subscribers without a drip
sequence. It drives the worker's existing send/consent rules rather than inventing its own send
path. It can be built after the drip, when convenient.

### Glossary

- **Operator admin screen** — a private, secret-protected page the operator opens in a browser
  to view and run the drip; not visible to end users or subscribers.
- **Sequence** — the ordered list of campaigns subscribers move through (defined by the drip
  automation spec).
- **Simulation / time-travel** — running the drip against a chosen or stepped-forward date so
  the operator can see what would be sent on each day, without waiting real days (defined by
  the drip automation spec).

> How the screen is built and served (its hosting, how it authenticates, and which operator
> actions it calls) lives in `design.md`, not here. It reuses the drip automation's existing
> operator actions rather than adding new sending logic.

## Requirements

### Requirement 1: Private Operator Access

**User Story:** As the operator, I want the admin screen to be private and protected, so only I can view or run the drip and no end user can reach it.

#### Acceptance Criteria

1.1 THE admin screen SHALL require the operator's admin secret to open; without it, access SHALL be denied.

1.2 THE admin screen SHALL NOT be reachable or visible to end users or email subscribers.

1.3 THE screen SHALL drive the messaging worker's existing operator capabilities rather than inventing its own sending mechanism; it is a front end over the worker, not a separate send path. (It may surface those capabilities through new, more convenient controls — this is about not bypassing the worker's send/consent rules, not about limiting which features the screen covers.)

1.4 THE screen's initial focus SHALL be the drip, but it MAY be extended over time to cover other messaging-worker features (for example, running a standalone campaign, a one-off tip send, or managing subscribers) without a drip sequence; this requirement SHALL NOT restrict the screen to drip-only.

### Requirement 2: View the Sequence

**User Story:** As the operator, I want to see the whole sequence at a glance, so I can confirm the order, campaigns, and spacing are what I intend.

#### Acceptance Criteria

2.1 THE screen SHALL display the sequence as an ordered list, showing each step's position, the campaign (and its tip), the scope (tips or reminders), and the spacing gap in days.

2.2 THE screen SHALL indicate which steps are enabled vs. removed/disabled.

2.3 THE screen SHALL show, for the overall list, enough context to understand the flow at a glance (for example, how many steps and their order).

2.4 EACH step SHALL show a short identifying tag for its campaign alongside the name, so the operator can tell apart campaigns that have similar or identical names.

### Requirement 3: Edit the Sequence

**User Story:** As the operator, I want to change the sequence from the screen, so I can tune the flow without hand-crafting API calls.

#### Acceptance Criteria

3.1 THE screen SHALL let the operator reorder steps.

3.2 THE screen SHALL let the operator add a campaign to the sequence and remove (or disable) one.

3.3 THE screen SHALL let the operator change a step's spacing gap, respecting the minimum of 1 day.

3.4 EACH change (reorder, add, remove/disable, gap change) SHALL take effect immediately (auto-save, no separate "Save" step), and the screen SHALL show the updated sequence without a manual refresh.

3.5 THE screen SHALL let the operator build the sequence from scratch — starting from an empty sequence and adding its first step and subsequent steps — not only edit a pre-existing one.

3.6 WHEN the sequence is empty THE screen SHALL show a clear empty state that invites adding the first step, rather than appearing broken.

3.7 BECAUSE a campaign can appear in the sequence at most once, the control for adding a campaign SHALL only offer campaigns that are not already in the sequence. WHEN a campaign is added it SHALL disappear from that list, and WHEN a campaign is removed from the sequence it SHALL reappear there, so the operator is never offered a duplicate that would be rejected.

### Requirement 4: Preview the Next Run

**User Story:** As the operator, I want to preview what the next daily run would send, so I can confirm it before it goes out.

#### Acceptance Criteria

4.1 THE screen SHALL show a preview of the next run that lists, per subscriber (or a readable summary), the campaign they would receive next — or that they are waiting or finished — without sending anything.

4.2 THE preview SHALL make clear it is a dry run and that no emails were sent.

### Requirement 5: Pause and Resume

**User Story:** As the operator, I want to pause and resume the automation from the screen, so I can stop sends quickly if something looks wrong.

#### Acceptance Criteria

5.1 THE screen SHALL show whether the automation is currently paused or running.

5.2 THE screen SHALL let the operator pause and resume the automation.

5.3 WHEN paused THE screen SHALL make the paused state visually obvious.

### Requirement 6: Drip Schedule Status (Avoid Editing During a Run)

**User Story:** As the operator, I want the screen to show when the drip runs next and whether it is running right now, so I can choose not to edit the sequence while a run is in progress.

#### Acceptance Criteria

6.1 THE screen SHALL show when the drip is next scheduled to run (for example, a countdown or the next run time).

6.2 WHEN a daily run is in progress THE screen SHALL indicate that the drip is running right now.

6.3 THE screen SHALL present this clearly enough that the operator can decide to hold off on edits while a run is in progress. (Editing is not blocked — a mid-run edit is accepted; this is awareness, not a lock. The drip does not pause itself for edits, and a run in progress is not interrupted.)

6.4 THE running/next-run indicator SHALL stay reasonably current while the screen is open (it SHALL update over time without the operator refreshing).

6.5 WHEN the automation is paused THE screen SHALL make clear that no sends will go out while paused, and SHALL NOT present the next scheduled time as if a run were coming; it MAY still show, for reference, when the next run would occur once resumed.

6.6 THE next-run and last-run times SHALL be shown in US Eastern time (adjusting for daylight saving), labeled so the operator knows the time zone, in addition to any relative countdown.

6.7 WHEN the sequence is empty THE screen SHALL make clear that resuming would not send anything until at least one campaign is added, so the operator is not misled into thinking a resume alone will start sends.

### Requirement 7: Test the Sequence Visually (Time-Travel)

**User Story:** As the operator, I want to run the full sequence and a few-days slice from the screen and see the result laid out, so testing is easy and visual rather than command-line.

#### Acceptance Criteria

7.1 THE screen SHALL let the operator run a simulation from a chosen start date, stepping forward a chosen number of days, and SHALL display which campaign each test subscriber would receive on each simulated day.

7.2 THE screen SHALL let the operator run a full-sequence simulation (step until the sequence completes) and a few-days simulation, and present the per-day result readably.

7.3 THE screen SHALL offer a no-send simulation (shows what would be sent) and a send-to-test mode that delivers only to designated test subscribers, and SHALL make clear which mode is active.

7.4 THE screen SHALL let the operator CREATE a batch of test subscribers in one action, with signup ages derived from the current sequence (so the testers land at the sequence's meaningful points and exercise it properly). Creating a set SHALL REPLACE any previous test subscribers entirely — removing the prior test subscribers and all their drip send history — so the operator always gets a clean cohort. This SHALL affect only test subscribers, never real ones, and the screen SHALL make that clear.

7.5 THE screen SHALL let the operator RESET the existing test subscribers — clearing their drip send history so a full-sequence test can be re-run from the start, while keeping the same test subscribers and their signup ages — and SHALL make clear this affects only test subscribers, never real ones.

7.6 THE screen SHALL present the two test-data actions (create a fresh set vs. reset the existing set) distinctly, so the operator understands that "create" makes a new set and "reset" re-tests the current one.

7.7 THE simulation results shown SHALL reflect the same order, uniqueness, spacing, and carry-over behavior as a real run (the screen is a view over the drip's own simulation, not a separate calculation; Req 1.3).

### Requirement 8: Safety and Clarity

**User Story:** As the operator, I want the screen to make dangerous vs. safe actions obvious, so I don't accidentally send real emails while testing.

#### Acceptance Criteria

8.1 THE screen SHALL clearly separate actions that send real email to real subscribers from safe actions (dry-run preview, no-send simulation, test-only sends).

8.2 WHEN an action would send real email to real subscribers THE screen SHALL require an explicit confirmation step.

8.3 THE screen SHALL surface errors from any action in a readable way, rather than failing silently.

### Requirement 9: Success Verification

**User Story:** As the operator, I want to confirm the screen does what it says before relying on it.

#### Acceptance Criteria

9.1 THE sequence shown on the screen SHALL match the actual sequence the drip would run.

9.2 A preview or simulation shown on the screen SHALL match what the drip's own preview/simulation produces for the same inputs.

9.3 A real-send action from the screen SHALL be gated by the confirmation step before anything is sent.

### Requirement 10: Create and Edit Campaigns from the Screen

**User Story:** As the operator, I want to create a new campaign and edit an existing one directly from the screen, so I can build and tune the content the sequence uses without hand-crafting commands.

#### Background

A step in the sequence points at a campaign — the thing that defines which tip goes out, to which audience. Originally the operator could only arrange existing campaigns into a sequence; creating or correcting a campaign had to happen elsewhere. In practice the operator needs to do both from one place: spin up a new campaign to add, and fix a campaign's name, its tip, or its audience when they got it wrong.

A subtlety matters here: once a campaign has actually gone out to recipients, its **content** (the tip it delivered and the audience it was sent to) is a historical fact and must not be rewritten — changing it would misrepresent what people received. But a campaign's **name** is only an internal label the operator uses to recognize it on this screen; it was never shown to recipients. So renaming a campaign after it has sent is harmless and should be allowed, even though its content stays locked.

#### Acceptance Criteria

10.1 THE screen SHALL let the operator create a new campaign by giving it a name, choosing its tip from a list of tips that actually have content, and choosing its audience (tips or reminders); the new campaign SHALL then be available to add to the sequence.

10.2 THE screen SHALL let the operator edit a campaign referenced by a sequence step — changing its name, its tip (chosen from the same list of tips that have content), and its audience — and the step SHALL continue to reference that same campaign after the edit.

10.3 WHEN a campaign has already sent (or is in the middle of sending) THE screen SHALL still allow its name to be changed, because the name is only an internal label, but SHALL prevent changing its tip or audience, and SHALL explain to the operator why those are locked.

10.4 WHEN the operator tries to give a campaign a name already used by another campaign THE screen SHALL surface that as a clear error rather than silently failing or creating a duplicate-named campaign.

10.5 AFTER a campaign is created or edited THE screen SHALL reflect the change everywhere it appears without a manual refresh — including the sequence list and the list of campaigns available to add — so a renamed campaign never shows a stale name.

10.6 Editing a campaign SHALL NOT change the sequence's membership or order; it only changes the campaign's own content/label.

### Requirement 11: See a Subscriber's History

**User Story:** As the operator, I want to look up one subscriber and see their timeline — when they signed up, consent changes, and which emails they were sent — so I can understand or troubleshoot an individual's experience.

#### Acceptance Criteria

11.1 THE screen SHALL let the operator look up a single subscriber and view a timeline for them.

11.2 THE timeline SHALL combine the subscriber's subscription events (such as signup, scope/consent changes, and unsubscribe) and the emails they were sent, ordered by date, so sends can be read in the context of consent changes.

11.3 THE timeline SHALL be read-only (it is for understanding, not editing the subscriber).

## Out of Scope

- Any change to how the messaging worker actually sends, orders, dedupes, consents, or spaces
  email — the screen drives the worker's existing behavior, it does not change it.
- End-user or subscriber-facing UI (this is operator-only).
- Editing tip **content** (the tip's markdown body) — tips are authored as markdown elsewhere.
  Choosing *which* tip a campaign delivers is in scope (Req 10), but writing the tip's text is not.
- A general analytics/reporting dashboard for email performance (opens/clicks) — a possible
  separate future spec, not this one.
- Managing **multiple, separate sequences** from the screen — the drip has exactly one global
  sequence (see the drip automation spec), so the screen builds and edits that single sequence
  (including creating it from scratch, Req 3.5). Multi-sequence management is a future direction
  that depends on the drip supporting multiple sequences first.
- A one-click **pre-populate / seed the recommended sequence** action — the sequence is only a
  few steps, so the operator builds it one at a time via the screen (Req 3.5); a batch seed
  action is not worth building now (consistent with the drip spec's out-of-scope decision).
- Note: covering non-drip messaging-worker features (standalone campaigns, one-off sends,
  subscriber management) is NOT out of scope as a future direction — it is explicitly allowed
  (Req 1.4) — but it is not required for the first version, which focuses on the drip.
- Note: creating/editing campaigns (Req 10) and viewing a subscriber's history (Req 11) were
  added to the first version during implementation. They are a natural first realization of the
  Req 1.4 extensibility — the operator needed to build and correct campaigns and inspect an
  individual subscriber from the same screen rather than dropping to commands.

## Notes

- **Depends on** `.kiro/specs/messaging-drip-automation/` for its initial (drip) scope. This UI
  calls that spec's operator actions (view/edit sequence, preview, pause/resume, simulate,
  reset test subscribers); it adds no new sending behavior (Req 1.3, 6.5).
- **Extensible by design (Req 1.4):** the first version focuses on the drip, but the screen is
  intended to be able to grow into a general messaging-worker admin console (standalone
  campaigns, one-off tip sends, subscriber management) if and when that is useful. The design
  should not architect the screen in a way that walls it off to drip-only.
- The technical approach (where the page is hosted and served, how it authenticates, and which
  operator actions it calls) belongs in `design.md`. A natural fit is the same pattern the
  analytics dashboard already uses — a private, secret-gated page served by the messaging
  worker — but that is a design decision, recorded there.
- **Deferrable:** this can be built after the drip automation ships. The drip is fully operable
  without it (via API); this screen exists to make operating and especially **testing** the
  drip easier.
