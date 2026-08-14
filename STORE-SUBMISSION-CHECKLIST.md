# App Store Submission Checklist

## iOS (App Store)

- [x] Create app in App Store Connect (My Apps → + → New App, Bundle ID: `com.mentalwallet.app`)
- [x] Host privacy policy at a public URL
- [x] Host terms of service at a public URL
- [x] Take screenshots — iPhone 6.5" (1284×2778px)
- [x] Write app description
- [x] Write promotional text
- [x] Write subtitle
- [x] Choose keywords
- [x] Complete age rating questionnaire (4+)
- [x] Set category: Health & Fitness
- [x] Set price: Free
- [x] Set Support URL and Copyright
- [x] Run production build: `eas build --platform ios --profile production`
- [x] Submit to App Store: `eas submit --platform ios`
- [x] Submit for review in App Store Connect
- [x] **Respond to Guideline 2.1 rejection** — provide required information in App Review Notes:
  - [x] Screen recording on physical device (launch → onboarding → wallet → use tool → emotion session)
  - [x] List tested devices and OS versions
  - [x] App description, target audience, problem it solves
  - [x] Setup instructions (no login required)
  - [x] External services list (Cloudflare Worker for analytics only)
  - [x] Regional differences (none — consistent across all regions)
  - [x] Regulated industry documentation (N/A — personal self-help tool, not medical)
- [x] After app is created in App Store Connect, update `APP_STORE_URL` in `src/config/appInfo.ts` with real Apple ID (Apple ID: 6800036822)

## Android (Google Play)

- [ ] Sign up for Google Play Developer account ($25 one-time)
- [x] Fix adaptive icon reference in app.json (add `foregroundImage`)
- [ ] Configure Android signing credentials: `eas credentials --platform android`
- [ ] Create app in Google Play Console
- [x] Host privacy policy at a public URL (same as iOS)
- [ ] Take screenshots — phone (at least 2, recommended 4-8)
- [ ] Take screenshots — tablet (optional but recommended)
- [x] Create feature graphic (1024×500px)
- [x] Write short description (80 chars max)
- [x] Write full description (4000 chars max)
- [ ] Complete content rating questionnaire
- [ ] Complete data safety form (declare: anonymous analytics, local health data, notification tokens)
- [ ] Declare target audience (18+, not directed at children)
- [ ] Set category: Health & Fitness
- [ ] Set price: Free
- [ ] Run production build: `eas build --platform android --profile production`
- [ ] Submit to Google Play: `eas submit --platform android`

## App Icon

- [x] Design and export the following icon files:

| File | Size | Format | Purpose | Status |
|------|------|--------|---------|--------|
| `assets/icon.png` | 1024×1024px | PNG (no alpha/transparency) | iOS App Store icon & Expo default | ✅ Done |
| `assets/adaptive-icon.png` | 1024×1024px | PNG (with transparency OK) | Android adaptive icon foreground layer (content should be within the inner 66% safe zone — ~672×672px centered) | ✅ Done |
| `assets/splash-icon.png` | 1024×1024px | PNG (transparency OK) | Splash screen logo | ✅ Done |
| iOS App Store icon | 1024×1024px | PNG, no alpha, no rounded corners | Uploaded to App Store Connect (Apple applies the mask) | ✅ Same as icon.png |

**Guidelines:**
- iOS icon must have **no transparency** and **no rounded corners** — Apple applies the corner mask automatically.
- Android adaptive icon foreground: keep important content within the center 66% (the "safe zone"). The OS crops the outer edges into circles, squircles, etc. depending on the device.
- The `backgroundColor` in `app.json` (`#788d75`) is used as the Android adaptive icon background layer and the splash screen background.
- Both stores require 1024×1024px as the submission icon.

## Marketing Website

- [x] Build landing page (hero, features, FAQ, CTA, footer)
- [x] Deploy to Cloudflare Pages
- [x] Configure custom domain: `mentalhealthwallet.productsforgood.co`
- [x] Set up Cloudflare DNS for `productsforgood.co`
- [x] HTTPS active
- [x] Privacy policy live at: https://mentalhealthwallet.productsforgood.co/privacy.html
- [x] Terms of service live at: https://mentalhealthwallet.productsforgood.co/terms.html
- [x] Contact email configured: `mentalhealthwallet@productsforgood.co`

## Shared / Pre-Submission

- [x] Host privacy policy HTML at a public URL
- [x] Host terms of service HTML at a public URL
- [x] Prepare store listing copy (description, keywords, promotional text)
- [x] Create marketing screenshots for both platforms
- [x] Create feature graphic for Google Play (1024×500px)
- [x] Verify app icon is 1024×1024px (required by both stores)
- [x] Finalize app display name — "Mental Health Wallet" (full brand), "Mental Wallet" (home screen)

## Notes

- ~~Privacy policy and terms need public hosting.~~ Done — hosted at `mentalhealthwallet.productsforgood.co`.
- ~~`assets/adaptive-icon.png` exists but isn't referenced in `app.json` — quick fix.~~ Fixed — `foregroundImage` added to app.json.
- EAS handles iOS code signing automatically (certificates + provisioning profiles) — no manual Xcode setup needed. Apple Developer account: ✅ already have one.
- Apple review typically takes 24-48 hours. Google Play initial review can take up to 7 days.
- ~~Health & mental health apps get extra scrutiny — make sure the disclaimer screen is visible early in the flow.~~ Done — disclaimer shows on first launch before wallet access.
- ~~App name was "Mental Health Wallet"~~ — Brand is **Mental Health Wallet™** for all external/user-facing surfaces. Home screen display name is "Mental Wallet" (short). Code internals (bundle IDs, slugs, paths) remain `mental-wallet`.
- ~~Splash screen background was white~~ — Updated to `#788d75` (sage green matching the icon).
- ~~Website needed to be built and hosted~~ — Live at https://mentalhealthwallet.productsforgood.co/
- **Trademark:** Use "Mental Health Wallet™" (common law ™) in the App Store subtitle, store listing description, and website hero/footer. No filing required — just consistent use. Consider CIPO (Canada) or USPTO registration later if the brand gains traction.
- **DNS:** Nameservers for `productsforgood.co` moved from DreamHost to Cloudflare (`lady.ns.cloudflare.com`, `newt.ns.cloudflare.com`). DreamHost remains the registrar.
- **iPad:** Disabled (`supportsTablet: false` + `TARGETED_DEVICE_FAMILY = "1"`) — the wallet UI doesn't scale well to tablet. iPhone-only for now.
- **App Privacy:** Declared in App Store Connect — anonymous analytics only, no data linked to identity, no tracking.
- **Governing Law:** Terms of Service specify Ontario, Canada.
- **Developer Account:** Individual (Moshe Mikanovsky). Can transfer to Organization (Products for Good Inc) later via D-U-N-S enrollment.
