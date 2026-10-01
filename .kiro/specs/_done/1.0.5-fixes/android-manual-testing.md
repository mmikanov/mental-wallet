# 1.0.5 — Android on-device testing guide (Bug 1)

Manual steps to test the Android deep-link fixes on a **physical Android phone connected to
your computer**. These cover the parts of Bug 1 that can only be verified on a real device —
they are not automatable in CI. The related spec tasks are noted next to each part.

## Why a physical, Play-signed build
Android **App Links** (the `https://…` links) only verify against the **Play app-signing key**,
so they must be tested on a build installed **from a Play track** (internal/closed/production)
on a **real device**. The emulator and a locally side-loaded APK will NOT verify App Links.
The `mentalwallet://` custom scheme works without any of that and is the reliable local
fallback.

## Before you start
1. Enable **Developer options → USB debugging** on the phone, connect it over USB.
2. Confirm the computer sees it:
   ```
   adb devices
   ```
   You should see your device listed as `device` (not `unauthorized`). Accept the debugging
   prompt on the phone if asked.
3. Install the 1.0.5 build **from a Play track** on the device (for Part 1a). For Part 1b a
   dev build is fine.

---

## Part 1a — Android App Links verification (spec tasks 1.1 → 1.6)

Goal: tapping `https://mentalhealthwallet.productsforgood.co/app/checkin` opens the app
directly (no browser chooser).

### Step 1 — Check the current verification state (task 1.1)
```
adb shell pm get-app-links com.mentalwallet.app
```
Find the line for `mentalhealthwallet.productsforgood.co`. You want **`verified`**.
If it shows `none`, `legacy_failure`, or `1024` (unverified) → that's the bug.

### Step 2 — Confirm the assetlinks file is live and correct (task 1.1)
```
curl -sSL -i https://mentalhealthwallet.productsforgood.co/.well-known/assetlinks.json
```
Check all three:
- HTTP **200** with **no redirect** (no 301/302 in the header block).
- `Content-Type: application/json`.
- The JSON body has a `sha256_cert_fingerprints` array. Per repo notes it should list **two**
  fingerprints: the Play **app-signing key** and the **EAS upload/release keystore**.

### Step 3 — Get Play's app-signing fingerprint (task 1.1)
Play Console → your app → **Test and release → App integrity → App signing** (a.k.a. "Protect
app signing key → Manage Play app signing"). Copy the **SHA-256 certificate fingerprint** under
*App signing key certificate*.

### Step 4 — Compare (task 1.3 — write down the answer)
The SHA-256 from Step 3 **must appear** in the `assetlinks.json` array from Step 2. The usual
culprit is that the file lists only the **upload/EAS** key, not Play's **app-signing** key.
Record: *is the domain `verified`, and is Play's app-signing fingerprint in the file?*

### Step 5 — If the fingerprint is missing (task 1.4) — ASK KIRO
This part is not device-bound. Paste Kiro the Play app-signing SHA-256 and it will:
- add it to the live `assetlinks.json` (keep the existing one — an array with both is correct),
  redeploy the worker, and
- update the repo copy at `website/.well-known/assetlinks.json` to match, confirming
  `website/_headers` still pins `Content-Type: application/json`.

### Step 6 — Re-verify on device (task 1.5)
After the file is fixed, reinstall from the track, or force re-verification:
```
adb shell pm verify-app-links --re-verify com.mentalwallet.app
adb shell pm get-app-links com.mentalwallet.app        # expect: verified
```
Then tap a link to `https://mentalhealthwallet.productsforgood.co/app/checkin` (from a note/
message on the phone) → it should open the app on the **check-in card, with no browser**.

Confirm the custom-scheme fallback still works:
```
adb shell am start -a android.intent.action.VIEW -d "mentalwallet://checkin" com.mentalwallet.app
```

### Step 7 — Checkpoint (task 1.6)
1a is done when the domain is `verified` on the physical Play-signed build and the `…/app/checkin`
link opens the app directly. Note: this can't be confirmed in CI or via emulator side-load.

---

## Part 1b — Reminder tap opens the RIGHT tool (spec tasks 1.2, 1.7, 1.9)

Per the debugging steering ("instrument before hypothesizing"), we capture a log BEFORE
attempting a behavioral fix. The mapping helper (`reminderNotificationDataToUrl` in
`src/navigation/linking.ts`) is already extracted and unit-tested; the remaining question is
purely on-device: does the notification-response handler fire, and does `data.cardId` arrive?

### Step 8 — Add temporary diagnostics (task 1.2) — ASK KIRO
Ask Kiro to add two `if (__DEV__) console.log('[dl] …')` points in
`src/navigation/linking.ts`:
- in `getInitialURL`, right after `getLastNotificationResponseAsync()` — log whether a response
  exists and what `data` contains;
- in `subscribe`, inside the response listener — log the received `data` and whether
  `data.cardId` is present.
(These are temporary and will be removed in Step 11.)

### Step 9 — Run it and capture Logcat (task 1.2)
With the dev build running on the device:
```
adb logcat -c
adb logcat | grep "\[dl\]"
```
In the app, set a per-card reminder ~1 minute out, then test BOTH:
- **Cold:** fully kill the app, wait for the notification, tap it.
- **Warm:** background the app (don't kill), wait for the notification, tap it.

### Step 10 — Answer the smallest question, then fix (task 1.7) — ASK KIRO
Paste Kiro the `[dl]` Logcat output. The single question it must answer: *does the handler fire,
and does `data.cardId` arrive?* Based on what the log actually shows (not a guess), Kiro will
implement the specific fix (e.g. notification `data` survival / channel setup, or
response-listener registration timing).

### Step 11 — Verify + clean up (task 1.9, 1.10)
Re-tap a reminder **cold** and **warm** → it opens that specific tool. Then ask Kiro to remove
all temporary `[dl]` logs (grep the tag) before anything is committed.

---

## Quick reference — deep-link routes
Both `mentalwallet://<path>` (custom scheme, always works) and
`https://mentalhealthwallet.productsforgood.co/app/<path>` (App Link, needs Part 1a verified):
- `wallet?focusCardId=<id>` — focus + expand a specific card (this is what a reminder tap maps to)
- `checkin` — the daily KPI check-in card
- `how-i-feel` — the "Start from how I feel" session card
- `learn-more-tour` — the top stack card
- `add-tool?filter=apps` — Library browser

## What was already verified in code (no device needed)
- The reminder `data → mentalwallet://wallet?focusCardId=<id>` mapping is unit-tested (18 cases,
  `src/navigation/__tests__/linking.reminderMapping.test.ts`).
- Route parsing (`getStateFromPath`) is covered by `src/navigation/__tests__/linking.test.ts`.
So Part 1b is specifically about the **on-device delivery** layer those unit tests can't reach.
