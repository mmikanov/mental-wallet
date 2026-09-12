# Deep Links

The app handles deep links so notification taps and tip CTAs land on a specific screen.
Source of truth: `src/navigation/linking.ts` (route config + `getStateFromPath`). This page is
a convenience reference — if the two ever disagree, `linking.ts` wins.

## Transports

Every route below works under BOTH:

- **Custom scheme:** `mentalwallet://<path>` — always works once the app is installed (used by
  reminder notification taps). Registered in `app.json`, iOS `Info.plist`, Android
  `AndroidManifest.xml`.
- **Universal / App Link:** `https://mentalhealthwallet.productsforgood.co/app/<path>` — opens
  the app when installed, falls back to the web page when not. Requires the association files
  at `/.well-known/` (already deployed) AND an app build carrying the iOS associated-domains
  entitlement + Android autoVerify filter. iOS Universal Links are unreliable on the Simulator;
  verify on a real device.

## Routes

| Path | Lands on | Notes |
|------|----------|-------|
| `wallet` | Wallet | Plain wallet. |
| `wallet?focusCardId=<id>` | Wallet, that card focused + expanded | Also the reminder-tap target. Degrades to the plain wallet if the card is missing/archived. `<id>` is the card's per-install id. |
| `how-i-feel` | "Start from how I feel" session card, focused + expanded | The emotion session (session-launcher card). |
| `checkin` | Seedling KPI daily check-in card, focused + expanded | The 🌱 daily check-in card. |
| `learn-more-tour` | Top stack card, focused + expanded | Skips the session-launcher so a real tool's "Learn more" link is visible. Degrades to the plain wallet if no qualifying card. |
| `add-tool` | Library browser | |
| `add-tool?filter=apps` | Library browser, Apps filter pre-selected | For discovering third-party apps. |
| `archive` | Archive screen | |
| `settings` | Settings screen | |

## Examples

```
mentalwallet://how-i-feel
mentalwallet://wallet?focusCardId=abc123
mentalwallet://add-tool?filter=apps
https://mentalhealthwallet.productsforgood.co/app/checkin
https://mentalhealthwallet.productsforgood.co/app/learn-more-tour
```

## Tip CTA mapping (which tip points where)

Used by the CTA-upgrade work (`.kiro/specs/1.0.4-email-optin-and-cta-upgrade`):

| Tip | Destination |
|-----|-------------|
| `welcome`, `come-back-reset`, `reorder-tools`, `archive-restore-tools`, `outcome-capture` | `/app/wallet` |
| `emotion-based-session`, `feeling-anxious` | `/app/how-i-feel` |
| `personal-kpi-check-in` | `/app/checkin` |
| `discover-third-party-apps` | `/app/add-tool?filter=apps` |
| `add-your-own-app`, `add-your-own-tool` | `/app/add-tool` |
| `learn-more-evidence` | `/app/learn-more-tour` |

## Testing

Ready-to-run `xcrun simctl` / `adb` commands are in the deep-linking spec:
`.kiro/specs/1.0.4-deep-linking/tasks.md` → "Manual testing" section. Key gotchas: build a real
native binary (Expo Go / dev-client won't own the `mentalwallet://` scheme), and iOS Universal
Links need a real device.
