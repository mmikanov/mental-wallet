# Requirements Document

## Introduction

Wellness Wallet needs a public-facing marketing landing page to drive app store downloads, provide legal document hosting (privacy policy, terms of service), and establish credibility for app store reviewers. The site will be hosted at `mentalhealthwallet.productsforgood.co` as a static HTML/CSS page with no build dependencies.

## Glossary

- **Landing Page**: The single-page marketing website for Mental Wallet.
- **Store Badge**: Official App Store / Google Play download button images linked to the app listing.
- **FAQ**: Frequently Asked Questions section addressing common user concerns.
- **CTA**: Call to action — the primary download buttons.

## Requirements

### Requirement 1: Hero Section

**User Story:** As a visitor, I want to immediately understand what the app is and how to download it, so I can decide if it's for me within seconds.

#### Acceptance Criteria

1. THE Landing Page SHALL display the app icon (assets/icon.png), app name ("Mental Wallet"), and a tagline in a prominent hero section.

**Tagline options (choose one):**
- **"Your coping tools, always in your pocket."** ← selected
- "A personal toolkit for better days."
- "Collect tools that help. Build habits that last."
- "Your wellness, organized."

*Note: A/B test alternatives post-launch.*

2. THE Hero Section SHALL include App Store and Google Play download badge buttons.
3. THE download badges SHALL link to the respective store listings (placeholder URLs until published).
4. THE Hero Section SHALL be the first visible content on page load without scrolling (above the fold on desktop and mobile).

### Requirement 2: Feature Overview Section

**User Story:** As a visitor, I want to understand what the app does and why I should use it, so I can decide whether to download.

#### Acceptance Criteria

1. THE Landing Page SHALL include a "What it does" section with 3-5 concise feature bullets or cards.
2. EACH feature bullet SHALL include an icon/emoji and a short description (max 2 sentences).
3. THE feature descriptions SHALL communicate the core value props: personalized coping toolkit, card-based UI, habit tracking, curated library, and privacy-first local storage.

### Requirement 3: FAQ Section

**User Story:** As a visitor, I want answers to common questions about the app, so I can feel confident before downloading.

#### Acceptance Criteria

1. THE Landing Page SHALL include an FAQ section with at least 5 questions and answers.
2. THE FAQ SHALL address: what the app is, whether it replaces therapy, data privacy, cost, and platform availability.
3. EACH FAQ item SHALL be expandable/collapsible (accordion pattern) to save vertical space.
4. THE FAQ SHALL include a disclaimer that the app is not a replacement for professional mental health care.

### Requirement 4: Footer with Legal Links

**User Story:** As an app store reviewer or privacy-conscious user, I want to access the privacy policy and terms of service, so I can verify the app's data practices.

#### Acceptance Criteria

1. THE Landing Page SHALL include a footer with links to the Privacy Policy and Terms of Service.
2. THE Privacy Policy and Terms of Service SHALL be accessible at dedicated URLs under the same subdomain (e.g., `/privacy` and `/terms`).
3. THE footer SHALL display the company name ("Products for Good Inc") and copyright year.
4. THE footer SHALL include a contact email for support inquiries.

### Requirement 5: Responsive Design

**User Story:** As a visitor on any device, I want the page to look good and function properly, so I can learn about the app regardless of my screen size.

#### Acceptance Criteria

1. THE Landing Page SHALL be fully responsive, rendering correctly on mobile (320px+), tablet (768px+), and desktop (1024px+) viewports.
2. THE download badges SHALL stack vertically on mobile and display side-by-side on desktop.
3. ALL text SHALL be readable without horizontal scrolling on any viewport.
4. THE page SHALL score 90+ on Google Lighthouse for Performance, Accessibility, Best Practices, and SEO.

### Requirement 6: Visual Design

**User Story:** As a visitor, I want the website to feel cohesive with the app's brand, so I trust it's the official page.

#### Acceptance Criteria

1. THE Landing Page SHALL use a color palette derived from the app icon: sage green (`#788d75`) as primary, cream/off-white (`#f5f2eb`) as background, and dark text for readability.
2. THE page SHALL use clean, modern typography (system font stack or a single web font).
3. THE overall design SHALL feel calming and approachable, consistent with a wellness brand.
4. THE page SHALL NOT include animations or effects that could trigger motion sensitivity (respect `prefers-reduced-motion`).

### Requirement 7: Technical Constraints

**User Story:** As the developer, I want a simple static site with no build step, so it's easy to deploy and maintain.

#### Acceptance Criteria

1. THE Landing Page SHALL be implemented as plain HTML and CSS only — no JavaScript frameworks, no build tools required.
2. JavaScript SHALL only be used for the FAQ accordion interaction (progressive enhancement — FAQ content remains visible without JS).
3. THE entire site SHALL be deployable by uploading static files to any web host (GitHub Pages, Netlify, Cloudflare Pages, etc.).
4. ALL assets (images, fonts) SHALL be self-contained or loaded from CDNs — no server-side processing required.
5. THE site files SHALL live in a `website/` directory at the project root.

### Requirement 8: SEO and Metadata

**User Story:** As the app owner, I want the landing page to rank well in search results for wellness app queries, so potential users can discover it organically.

#### Acceptance Criteria

1. THE Landing Page SHALL include proper meta tags: title, description, Open Graph (og:title, og:description, og:image), and Twitter Card tags.
2. THE page title SHALL be "Mental Wallet — Your Personal Wellness Toolkit".
3. THE meta description SHALL be under 160 characters and include keywords: wellness, coping tools, mental health, habit.
4. THE page SHALL include a canonical URL meta tag.
