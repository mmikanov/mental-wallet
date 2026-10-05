-- Add a per-campaign spacing gap (in days). A campaign is eligible for a subscriber only if
-- that subscriber has received no email from us in the last `gap_days` days.
--
-- Default and minimum is 1: gap_days = 1 reproduces the previous "no two emails on the same
-- day" guard exactly. Larger values add deliberate spacing between emails in the drip
-- sequence. The worker also clamps gap_days to >= 1 on campaign create/update.

ALTER TABLE campaigns ADD COLUMN gap_days INTEGER NOT NULL DEFAULT 1;
