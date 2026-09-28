# Bug 1 — Android deep links: investigation findings

Record of the on-device investigation so it isn't lost. Covers what was tested,
what was proven, and the open question. TL;DR: **1b (reminder taps) works; 1a
(web-link auto-verification) is NOT a config defect we can fix in this repo — the
config is provably correct — and nothing in 1.0.5 changes 1a behavior vs 1.0.4.**

## Environment used
- One physical Android phone, connected via adb.
- Build under test: 1.0.5 internal-track build (versionCode 10, versionName 1.0.5),
  installed **from the Play Store** (`installerPackageName=com.android.vending`).
- Note: this device had a messy install history during testing (debug sideload →
  uninstall → Play internal-track update, repeated). That churn is a known cause of
  the Android Domain Verification Agent getting stuck, independent of config.

## Bug 1b — reminder taps → open the right tool: VERIFIED (works)
- Added temporary `[dl]` diagnostics to `src/navigation/linking.ts` (since removed)
  and a `__DEV__`-only "Fire test reminder" button (still present; see tech-debt).
- Logs confirmed: the notification handler fires, `data.cardId` arrives intact, and
  the mapping resolves to `mentalwallet://wallet?focusCardId=<id>`.
- User confirmed the app opens on the correct tool, warm and cold.
- Conclusion: **no code bug in 1b.** The `reminderNotificationDataToUrl` extraction
  (task 1.7 refactor) + regression test (task 1.8) are the whole of it. The device
  path uses the `mentalwallet://` custom scheme, which does not depend on web-domain
  verification, so it is the reliable path.

## Bug 1a — HTTPS web links (…/app/checkin) → open the app: NOT a config defect
The requirements hypothesized a fingerprint/signature mismatch on the Play-published
build (Req 1.2). Investigation DISPROVED that hypothesis. Every input to Android's
App Links verifier was checked and is correct:

| Check | Result |
| --- | --- |
| Installed build is the real Play build | ✅ versionCode 10, `com.android.vending` |
| App signing key (Play Console, Classical) | `C4:72:E2:FF:ED:5A:93:23:F3:35:98:3C:B9:31:30:3C:36:BE:A9:87:9E:EB:51:6D:1E:A4:6B:55:A1:F5:A0:A5` |
| That key is in `assetlinks.json` | ✅ present |
| Upload key in `assetlinks.json` | ✅ `16:85:BA:DC:…` matches Play Console upload cert |
| `assetlinks.json` served correctly | ✅ HTTP 200, `application/json`, no redirect |
| **Google Digital Asset Links API returns the statements** | ✅ both statements, correct package + fingerprint (authoritative) |
| Manifest `autoVerify="true"` + host + `/app` path | ✅ correct |
| Web fallback page `/app/checkin` resolves | ✅ HTTP 200 |

Despite all of the above, on this device a clean install shows:
`adb shell pm get-app-links com.mentalwallet.app` →
`mentalhealthwallet.productsforgood.co: 1024` (unverified), and tapping the link
opens the browser. When link handling is **manually** enabled in Android settings
("Open supported links" → the domain), the link **does** open the app on the right
tool — proving the entire routing chain is correct; only Android's *automatic*
verification is not completing.

### The `2A:8C:E4:B0:…` red herring
`adb shell pm get-app-links` prints a `Signatures: [2A:8C:E4:…]` line. This is the
**Domain Verification Agent's** identity (the system verifier component), NOT the
app's signing cert. The app's real signing key is `C4:72:E2:FF:…` (matches Play +
the file). Do not chase `2A:8C:…`.

### What was tried and did NOT help
- Forced re-verification (`pm verify-app-links --re-verify`, `set-app-links … 0 all`) — still 1024.
- Fresh uninstall + reboot + Play reinstall — still 1024.
- Cache-header change: `website/_headers` now serves the association files with
  `Cache-Control: public, max-age=3600` instead of Cloudflare Workers-Assets'
  default `max-age=0, must-revalidate`. Deployed and confirmed at the edge — did NOT
  change the 1024 result. (Kept anyway: it is correct practice and low-risk.)

### Most likely real explanation (community-supported, not yet proven)
Android App Links auto-verification is documented to behave unreliably on
**internal-test-track and sideloaded installs**, and on devices whose verifier state
was polluted by install churn — independent of correct config. Multiple developer
reports describe exactly this: "configured correctly, works once enabled, but
disabled/unverified by default when installed via the Play Internal Test Track or
sideloaded." A clean **production-track** install often verifies once Google's
verifier catches up post-release.

## Does anything in 1.0.5 change 1a?
**No.** The `AndroidManifest.xml` App Links intent-filter and the `assetlinks.json`
fingerprints are unchanged from the 1.0.4 production build. The only
verification-adjacent change (the `_headers` cache policy) demonstrably did not
affect the result. Shipping 1.0.5 will not, by itself, change what 1.0.4 users
experience with web links.

## Decision (chosen by the operator)
Stop the on-device 1a chase. The config is correct and 1.0.5 doesn't affect 1a.
Ship 1.0.5 for the real fixes (Bug 2 practice-time tracking, Bug 3 label dedupe).
For 1a: after 1.0.5 is live on the **production** track, re-check
`adb shell pm get-app-links com.mentalwallet.app` on a phone that installed it from
production — that is the real users' environment and the decisive test we could not
run on a single internal-track device. If it shows `verified` there, 1a was
internal-track/timing noise; if it still fails on a clean production install with
the config confirmed correct, escalate as an Android/Play verification issue (not a
repo-fixable code/config bug).

## Custom-scheme fallback (works regardless)
`mentalwallet://checkin`, `mentalwallet://how-i-feel`, `mentalwallet://wallet?focusCardId=<id>`,
etc. do not depend on web-domain verification and open the app reliably. Reminder
taps use this path.
