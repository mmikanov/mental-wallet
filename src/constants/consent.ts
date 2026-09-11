/**
 * Consent constants — single source of truth for the onboarding disclaimer acknowledgment.
 *
 * The app is anonymous and stores no per-user consent record. The protective value comes
 * from being able to reproduce EXACTLY what a user was asked to agree to in a given app
 * version: keep the copy + version here, in the codebase, so git history + release tags are
 * the audit trail.
 *
 * Bump CONSENT_VERSION whenever CONSENT_LABEL changes materially.
 *
 * NOTE: wording is product intent and should be reviewed by a qualified attorney before
 * launch. This constant defines what is shown; it is not legal advice.
 *
 * Spec: .kiro/specs/1.0.4-onboarding-consent
 */

/** Date-based identifier for the current consent copy. Bump on any material copy change. */
export const CONSENT_VERSION = '2026-09-11';

/**
 * The exact acknowledgment text shown next to the consent checkbox on the onboarding
 * Welcome screen. Ticking it acknowledges the disclaimer AND agreement to the Terms of
 * Service (plus acknowledgment of the Privacy Policy), which are linked separately.
 */
export const CONSENT_LABEL =
  'I understand this app is a personal wellness tool — not medical, therapeutic, or ' +
  'professional advice — and that using it creates no provider relationship. It is not a ' +
  'replacement for professional mental health care or a crisis service. If I am in crisis, ' +
  'I will contact a crisis helpline or emergency services. I agree to the Terms of Service ' +
  'and acknowledge the Privacy Policy.';
