# Requirements Document

## Introduction

User submissions allow users to share their custom tools with the community. Cards are submitted to a moderation queue, reviewed by curators, and published with a "Community" badge if approved.

## Glossary

- **Moderation_Queue**: The review pipeline where user-submitted cards await curator approval.
- **Community_Card**: A tool submitted by a user and approved through moderation.

## Requirements

### Requirement 1: User Submissions and Moderation

**User Story:** As a user, I want to submit my custom tools to the community library, so that others can benefit from techniques that work for me.

#### Acceptance Criteria

1. WHEN a user selects "Submit to library" from the Kebab_Menu on a "My tool" card, THE App SHALL pre-fill a submission form with the card's title, description, and category, requiring: title (max 60 chars), description (max 200 chars), category, "When to use" (max 300 chars), and tool type.
2. THE App SHALL display submission guidelines and require acknowledgment before submission.
3. THE App SHALL ask the user whether to publish anonymously or with attribution.
4. THE submission form SHALL include an "Allow background customization" toggle (defaulting to off) that lets the submitter specify whether users can personalize the card's background without duplicating it.
5. WHEN submitted, THE App SHALL place the card into the Moderation_Queue and show "Pending Review" status.
6. WHEN approved, the card becomes visible with "Community" badge and the `allowBackgroundCustomization` setting chosen by the submitter; user is notified.
7. WHEN rejected, the user receives rejection reason and can revise and resubmit.
