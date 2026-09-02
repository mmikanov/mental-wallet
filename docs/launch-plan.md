# Launch Plan — Mental Health Wallet

## Goal

Validate that Mental Health Wallet delivers real value to users. Success = people download, use it, and come back regularly.

---

## Success Criteria

| Metric | Target | How We Measure |
|--------|--------|----------------|
| **Activation Rate** | 70%+ of downloaders complete at least 1 card interaction within 48h | `tool_completed` event within 48h of first `app_opened` |
| **Weekly Engagement** | 3+ card completions/week per active user in first 2 weeks | `tool_completed` count per user per week |
| **D7 Retention** | 40%+ | Users with `app_opened` on day 7+ vs day 0 |
| **D30 Retention** | 25%+ | Users with `app_opened` on day 30+ vs day 0 |
| **Organic Sharing** | Any signal (even 1-2 users sharing unprompted is positive) | `share_tapped` event + survey responses |
| **Wallet Growth** | Users add cards beyond onboarding defaults | `tool_added` events after first session |

### How to Read Results

- Warm cohort retains well + cold cohort doesn't activate → messaging/positioning problem, not product problem
- Both cohorts retain → value validated, invest in growth
- Neither retains above 20% D7 → core value hypothesis needs rethinking

---

## Phases

### Phase 1: Warm Launch (Week 1–2)

Launch to the 25 interviewees who expressed interest. These people already understand the concept and helped shape the product.

**Why first:** Creates a controlled window where all analytics data = warm cohort. No need for user IDs to distinguish groups — the time window is the separator.

#### Checklist

- [x] App live on App Store (approved Aug 17, 2026) and on Google Play (live, v1.0.3).
- [x] Analytics dashboard updated with launch KPIs (activation, engagement, retention)
- [x] `share_tapped` event added to track organic sharing
- [x] Phase milestone filtering added to dashboard
- [x] Personalized message templates drafted (docs/outreach-templates.md)
- [x] Feedback mechanism ready (in-app "Send Feedback" button already exists)
- [ ] Short follow-up survey prepared (send at Day 7)
- [x] Deploy analytics worker to production
- [ ] Set MILESTONE_RELEASE date in wrangler.toml once Google Play approves, then redeploy
- [ ] Send personalized launch messages to all 25 interviewees
- [ ] Monitor dashboard daily for first 7 days
- [ ] Send Day-7 follow-up survey
- [ ] Compile warm cohort results at Day 14

#### Personalization Strategy

Use interview notes to tailor each message:
- Reference specific suggestions they made that were implemented
- Note their phone type (iOS/Android) and include the correct store link
- Keep it personal and brief — they're collaborators, not leads

### Phase 2: Cold Acquisition (Week 3+)

Start only after warm cohort data gives initial signal. Anyone activating after this point = cold cohort.

#### Channels (ranked by fit)

| Channel | Why It Fits | Action |
|---------|-------------|--------|
| **App Store Optimization (ASO)** | Passive discovery, compounds over time | Optimize keywords, screenshots, description |
| **LinkedIn** | Already your active platform, professional wellness audience | Share authentic posts about building the app, link to download |
| **Reddit** | r/mentalhealth, r/selfimprovement, r/anxiety — high-intent, anonymous | Authentic value-first posts (not promotional) |
| **Therapist outreach** | High-trust referral, target audience overlap | Email 5–10 local therapists with a brief intro |

#### Channels Parked for Later

| Channel | Why Later |
|---------|-----------|
| Product Hunt | Need upvote base first — revisit when 50+ active users |
| Instagram/TikTok | Not active on these platforms |
| Paid ads | Only after organic signal validates product-market fit |

#### Checklist

- [ ] ASO review: verify keywords, screenshots reflect actual experience
- [ ] Draft 2–3 LinkedIn posts (authentic, story-driven)
- [ ] Draft 2–3 Reddit posts (value-first, no self-promotion tone)
- [ ] Identify and email 5–10 therapists
- [ ] Begin posting (1 per channel per week)
- [ ] Monitor cold cohort activation and retention starting Week 3

### Phase 3: Measure & Decide (Week 4–6)

#### Checklist

- [ ] Compare warm vs cold cohort retention (date-based separation)
- [ ] Review qualitative feedback from surveys
- [ ] Identify top-used cards and unused cards
- [ ] Decide: double down on growth, iterate on product, or pivot positioning
- [ ] Document learnings

---

## Analytics Events Required for Launch KPIs

Already tracked:
- `app_opened` (with `days_since_install` property) → retention
- `onboarding_completed` → activation funnel
- `tool_opened` / `tool_completed` → engagement
- `tool_added` → wallet growth
- `share_tapped` → organic sharing signal

---

## Cohort Separation Strategy

Since we don't collect user IDs or referral source, we use **time-based cohort separation**:

- **Warm cohort:** All users who first appear during Week 1–2 (before any public posting)
- **Cold cohort:** All users who first appear from Week 3 onward

This only works if we don't do any public promotion during the warm window. The warm launch messages go out privately (LinkedIn DMs, email, text).

---

## Feedback Collection

### In-app (already built)
- "Send Feedback" button in Settings → opens email to mentalhealthwallet@productsforgood.co

### Day-7 Follow-up Survey (send to warm cohort)

Questions:
1. How many times did you open the app this week? (rough estimate is fine)
2. Which card(s) did you use most?
3. Did anything feel confusing or frustrating?
4. Would you recommend this to a friend? Why or why not?
5. Anything else you want to share?

Format: Google Form or simple reply-to-email (whichever feels lower friction)

---

## Timeline Summary

| Week | Activity |
|------|----------|
| Pre-launch | Finalize app submission, update analytics, prep messages |
| Week 1 | Send warm launch messages, monitor daily |
| Week 2 | Continue monitoring, send Day-7 survey |
| Week 3 | Begin cold acquisition (LinkedIn, Reddit, ASO) |
| Week 4–6 | Measure both cohorts, gather qualitative feedback |
| Week 6 | Decision point: grow, iterate, or pivot |
