# Design Document

## Overview

A single-page static marketing site for Mental Wallet, hosted at `mentalhealthwallet.productsforgood.co`. Built with plain HTML/CSS plus minimal vanilla JS for the FAQ accordion. No build tools, no frameworks — just files you can upload anywhere.

## File Structure

```
website/
├── index.html          # Main landing page
├── privacy.html        # Privacy policy (with shared nav/footer)
├── terms.html          # Terms of service (with shared nav/footer)
├── styles.css          # All styles
├── script.js           # FAQ accordion enhancement
├── CNAME               # Custom domain for Cloudflare Pages
├── assets/
│   ├── icon.png        # App icon (240px, optimized for web)
│   ├── og-image.jpg    # Open Graph share image (1200×630px)
│   ├── app-store-badge.svg    # Official Apple App Store download badge
│   ├── google-play-badge.svg  # Official Google Play download badge
│   └── feature-*.png   # Custom illustrations for feature cards
```

## Page Sections (top to bottom)

### 1. Navigation Bar (sticky)
- App icon (small, 32px) + "Mental Wallet" text
- Single CTA button: "Download" (scrolls to hero store badges or links directly)
- Minimal, transparent on scroll-top, gains background on scroll

### 2. Hero Section
- Large app icon (120px)
- App name: "Mental Wallet"
- Tagline: **"Your coping tools, always in your pocket."**
  - Alt taglines considered:
    - "A personal toolkit for better days."
    - "Collect tools that help. Build habits that last."
    - "Your wellness, organized."
- Subtitle (1 sentence): "A card-based toolkit to build coping habits, track your mood, and find what works for you."
- Two store badges side by side (stacked on mobile)
- Background: subtle sage green gradient or soft pattern

### 3. Feature Bullets
- 3-4 cards/tiles in a grid (2×2 on desktop, single column on mobile)
- Each card: emoji/icon + heading + 1-sentence description

| Icon | Heading | Description |
|------|---------|-------------|
| 🃏 | Curated Tools | Browse 20+ evidence-informed coping cards — grounding, reframing, breathwork, and more. |
| ✨ | Build Your Own | Create custom cards with sliders, text inputs, and choice buttons. Make tools that fit how you think. |
| 📊 | Track What Works | See usage streaks, mood trends, and which tools help most — all private, all on your device. |
| 🔒 | Private by Default | Your data stays on your phone. No accounts, no cloud sync, no data collection. |

### 4. FAQ Section
- Accordion pattern (click question → answer expands)
- Styled with border-bottom separators

| Question | Answer |
|----------|--------|
| What is Mental Wallet? | A mobile app that puts your coping tools in one place. Think of it as a wallet for the techniques that help you feel better — breathing exercises, mood trackers, gratitude prompts, and more. |
| Does it replace therapy? | No. Mental Wallet is a personal toolkit, not a therapeutic intervention. It's designed to complement professional support, not replace it. If you're in crisis, please contact the 988 Suicide & Crisis Lifeline or your local emergency services. |
| Is my data private? | Yes. Everything stays on your device. We don't have accounts, don't sync to the cloud, and don't sell data. You own your information. |
| Is it free? | Yes, Mental Wallet is currently free to download and use while in beta. Pricing may change in the future, but early users will always be appreciated. |
| What platforms is it available on? | iOS and Android. |
| Who makes this? | Mental Wallet is made by [Products for Good Inc](https://productsforgood.co), a company focused on building tools that create more good in the world. |

### 5. Final CTA
- Repeated store badges
- Short line: "Start building your toolkit today."

### 6. Footer
- "© 2026 Products for Good Inc"
- "Mental Wallet™" (common law trademark)
- Links: Privacy Policy · Terms of Service · Contact (mailto)
- Subtle, minimal styling

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#788d75` | Nav bar, buttons, accents |
| Primary dark | `#5a6b57` | Hover states, footer background |
| Background | `#f5f2eb` | Page background |
| Card background | `#ffffff` | Feature cards, FAQ items |
| Text | `#2d2d2d` | Body text |
| Text muted | `#6b6b6b` | Subtitle, footer text |
| Accent | `#b8c5a8` | Light green for borders, highlights |

## Typography

System font stack (no external font loading for performance):
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
```

- Hero heading: 48px (mobile: 32px), font-weight 700
- Section headings: 28px (mobile: 24px), font-weight 600
- Body text: 18px (mobile: 16px), font-weight 400, line-height 1.6

## Responsive Breakpoints

- Mobile: < 768px (single column, stacked badges, hamburger-less — nav stays simple)
- Tablet: 768px – 1023px (2-column feature grid)
- Desktop: 1024px+ (max-width container 1100px, centered)

## Performance Targets

- Total page weight < 500KB (including images)
- No render-blocking resources
- Lighthouse scores: 90+ across all categories
- First Contentful Paint < 1.5s

## Deployment

Hosted on **Cloudflare Pages** (direct upload).

1. Go to Cloudflare Dashboard → Workers & Pages → project → New deployment
2. Upload contents of `website/` folder
3. Custom domain `mentalhealthwallet.productsforgood.co` configured via CNAME
4. DNS managed by Cloudflare (nameservers: `lady.ns.cloudflare.com`, `newt.ns.cloudflare.com`)
5. HTTPS auto-provisioned by Cloudflare

## Contact Email

All contact/support/privacy emails use: `mentalhealthwallet@productsforgood.co`

## Store Badge Links (placeholder)

```html
<!-- Replace with actual URLs once published -->
<a href="https://apps.apple.com/app/mental-wallet/id000000000">App Store</a>
<a href="https://play.google.com/store/apps/details?id=com.mentalwallet.app">Google Play</a>
```

## Open Graph / Social Sharing

When shared on social media, the page should show:
- **Title:** Mental Wallet — Your Personal Wellness Toolkit
- **Description:** A card-based toolkit to build coping habits, track your mood, and find what works for you.
- **Image:** The app icon on the sage green background (1200×630px)

## Accessibility

- All images have alt text
- FAQ accordion is keyboard-navigable (Enter/Space to toggle)
- Sufficient color contrast (WCAG AA minimum)
- Skip-to-content link for keyboard users
- `prefers-reduced-motion` respected (no animations if set)
