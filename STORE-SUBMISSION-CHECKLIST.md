# App Store Submission Checklist

## iOS (App Store)

- [ ] Create app in App Store Connect (My Apps → + → New App, Bundle ID: `com.mentalwallet.app`)
- [ ] Host privacy policy at a public URL
- [ ] Host terms of service at a public URL
- [ ] Take screenshots — iPhone 6.7" (Pro Max)
- [ ] Take screenshots — iPhone 5.5" (iPhone 8 Plus)
- [ ] Write app description
- [ ] Write promotional text
- [ ] Write subtitle
- [ ] Choose keywords
- [ ] Complete age rating questionnaire (likely 4+)
- [ ] Set category: Health & Fitness → Mental Health
- [ ] Set price: Free
- [ ] Run production build: `eas build --platform ios --profile production`
- [ ] Submit to App Store: `eas submit --platform ios`
- [ ] Submit for review in App Store Connect

## Android (Google Play)

- [ ] Sign up for Google Play Developer account ($25 one-time)
- [x] Fix adaptive icon reference in app.json (add `foregroundImage`)
- [ ] Configure Android signing credentials: `eas credentials --platform android`
- [ ] Create app in Google Play Console
- [ ] Host privacy policy at a public URL (same as iOS)
- [ ] Take screenshots — phone (at least 2, recommended 4-8)
- [ ] Take screenshots — tablet (optional but recommended)
- [ ] Create feature graphic (1024×500px)
- [ ] Write short description (80 chars max)
- [ ] Write full description (4000 chars max)
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

## Shared / Pre-Submission

- [ ] Host privacy policy HTML at a public URL (e.g., GitHub Pages, your domain)
- [ ] Host terms of service HTML at a public URL
- [ ] Prepare store listing copy (description, keywords, promotional text)
- [ ] Create marketing screenshots for both platforms
- [ ] Create feature graphic for Google Play (1024×500px)
- [x] Verify app icon is 1024×1024px (required by both stores)

## Notes

- Privacy policy and terms already exist at `docs/legal/privacy.html` and `docs/legal/terms.html` — they just need public hosting.
- ~~`assets/adaptive-icon.png` exists but isn't referenced in `app.json` — quick fix.~~ Fixed — `foregroundImage` added to app.json.
- EAS handles iOS code signing automatically (certificates + provisioning profiles) — no manual Xcode setup needed. Apple Developer account: ✅ already have one.
- Apple review typically takes 24-48 hours. Google Play initial review can take up to 7 days.
- ~~Health & mental health apps get extra scrutiny — make sure the disclaimer screen is visible early in the flow.~~ Done — disclaimer shows on first launch before wallet access.
- ~~App name was "Mental Health Wallet"~~ — Renamed to **Mental Wallet** across all files, bundle IDs, legal docs, and native project.
- ~~Splash screen background was white~~ — Updated to `#788d75` (sage green matching the icon).
- **Trademark:** Use "Mental Wallet™" (common law ™) in the App Store subtitle, store listing description, and website hero/footer. No filing required — just consistent use. Consider USPTO registration later if the brand gains traction.
