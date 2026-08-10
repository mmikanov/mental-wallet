# Implementation Plan: Mental Wallet Landing Page

## Overview

Build and deploy a static marketing landing page for Mental Wallet at `mentalwallet.productsforgood.co`. Plain HTML/CSS with minimal vanilla JS for FAQ accordion.

## Tasks

- [ ] 1. Create `website/` directory structure and base HTML skeleton
  - Create `website/index.html` with proper HTML5 structure, meta tags, OG tags
  - Create `website/styles.css` with CSS reset and design tokens (colors, typography, spacing)
  - Create `website/script.js` placeholder
  - Copy app icon to `website/assets/icon.png`
  - _Requirements: 7, 8_

- [ ] 2. Implement hero section
  - App icon (120px), app name, tagline ("Your coping tools, always in your pocket.")
  - Subtitle sentence
  - App Store and Google Play badge placeholders (with links)
  - Responsive: badges stack on mobile, side-by-side on desktop
  - _Requirements: 1, 5, 6_

- [ ] 3. Implement feature overview section
  - 4 feature cards in a responsive grid (2×2 desktop, 1-column mobile)
  - Each card: emoji + heading + 1-sentence description
  - Cards: Curated Tools, Build Your Own, Track What Works, Private by Default
  - _Requirements: 2, 5, 6_

- [ ] 4. Implement FAQ accordion section
  - 6 FAQ items with question/answer pairs
  - Click-to-expand accordion with CSS transitions
  - Progressive enhancement: all answers visible without JS, JS adds collapse behavior
  - Keyboard accessible (Enter/Space to toggle)
  - _Requirements: 3, 5, 7_

- [ ] 5. Implement final CTA and footer
  - Repeated store badges with "Start building your toolkit today."
  - Footer: copyright, company name, privacy/terms links, contact email
  - _Requirements: 4, 6_

- [ ] 6. Implement responsive design and polish
  - Mobile-first CSS with breakpoints at 768px and 1024px
  - Sticky nav bar with scroll behavior
  - Respect `prefers-reduced-motion`
  - Test at 320px, 768px, 1024px, 1440px viewports
  - Verify color contrast meets WCAG AA
  - _Requirements: 5, 6_

- [ ] 7. Add privacy and terms pages
  - Copy `docs/legal/privacy.html` → `website/privacy.html` (with consistent nav/footer styling)
  - Copy `docs/legal/terms.html` → `website/terms.html` (with consistent nav/footer styling)
  - Ensure legal pages link back to main landing page
  - _Requirements: 4_

- [ ] 8. Create OG image and favicon
  - Generate `website/assets/og-image.png` (1200×630px — app icon centered on sage green background)
  - Generate `website/favicon.ico` from app icon
  - Verify social share preview renders correctly
  - _Requirements: 8_

- [ ] 9. Lighthouse audit and final QA
  - Run Lighthouse on the local page
  - Verify scores 90+ for Performance, Accessibility, Best Practices, SEO
  - Fix any issues found
  - Test in Safari, Chrome, Firefox
  - Verify page weight < 500KB total
  - _Requirements: 5, 7, 8_

- [ ] 10. Deploy to GitHub Pages
  - Create GitHub repo or configure existing repo for Pages
  - Push `website/` contents
  - Add CNAME file for `mentalwallet.productsforgood.co`
  - Configure DreamHost DNS: CNAME record `mentalwallet` → GitHub Pages URL
  - Verify HTTPS is working
  - Update `src/config/appInfo.ts` with final live URLs
  - _Requirements: 7_
