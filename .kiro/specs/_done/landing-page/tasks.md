# Implementation Plan: Mental Wallet Landing Page

## Overview

Build and deploy a static marketing landing page for Mental Wallet at `mentalhealthwallet.productsforgood.co`. Plain HTML/CSS with minimal vanilla JS for FAQ accordion.

## Tasks

- [x] 1. Create `website/` directory structure and base HTML skeleton
  - Create `website/index.html` with proper HTML5 structure, meta tags, OG tags
  - Create `website/styles.css` with CSS reset and design tokens (colors, typography, spacing)
  - Create `website/script.js` placeholder
  - Copy app icon to `website/assets/icon.png`
  - _Requirements: 7, 8_

- [x] 2. Implement hero section
  - App icon (120px), app name, tagline ("Your coping tools, always in your pocket.")
  - Subtitle sentence
  - App Store and Google Play official badges (with placeholder links)
  - Responsive: badges stack on mobile, side-by-side on desktop
  - _Requirements: 1, 5, 6_

- [x] 3. Implement feature overview section
  - 4 feature cards in a responsive grid (2×2 desktop, 1-column mobile)
  - Each card: custom illustration (feature-*.png) + heading + 1-sentence description
  - Cards: Curated Tools, Build Your Own, Track What Works, Private by Default
  - _Requirements: 2, 5, 6_

- [x] 4. Implement FAQ accordion section
  - 6 FAQ items with question/answer pairs
  - Uses native `<details>` elements (progressive enhancement — content visible without JS)
  - Keyboard accessible (native browser behavior)
  - _Requirements: 3, 5, 7_

- [x] 5. Implement final CTA and footer
  - Repeated store badges with "Start building your toolkit today."
  - Footer: copyright, company name (Products for Good Inc), privacy/terms links, contact email
  - Contact: mentalhealthwallet@productsforgood.co
  - _Requirements: 4, 6_

- [x] 6. Implement responsive design and polish
  - Mobile-first CSS with breakpoints at 480px, 768px, and 1024px
  - Sticky nav bar with backdrop blur
  - Respect `prefers-reduced-motion`
  - _Requirements: 5, 6_

- [x] 7. Add privacy and terms pages
  - Created `website/privacy.html` and `website/terms.html` with consistent nav/footer styling
  - Legal pages link back to main landing page
  - _Requirements: 4_

- [x] 8. Create OG image and favicon
  - Generated `website/assets/og-image.jpg` (1200×630px — app icon centered on sage green background)
  - Using `icon.png` as favicon (PNG format)
  - _Requirements: 8_

- [x] 9. Lighthouse audit and final QA
  - Performance: 99, Accessibility: 100, Best Practices: 100, SEO: 100
  - Fixed color contrast issues (nav CTA button, footer links/copyright)
  - Page weight: 164KB total ✓
  - _Requirements: 5, 7, 8_

- [x] 10. Deploy to Cloudflare Pages
  - Uploaded `website/` contents via direct upload
  - Custom domain configured: `mentalhealthwallet.productsforgood.co`
  - DNS for `productsforgood.co` moved to Cloudflare (nameservers: `lady.ns.cloudflare.com`, `newt.ns.cloudflare.com`)
  - HTTPS active
  - Updated `src/config/appInfo.ts` with live privacy/terms URLs
  - _Requirements: 7_
