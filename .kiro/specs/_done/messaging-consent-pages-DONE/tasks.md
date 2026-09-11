# Tasks

## Task 1: Add GET /preferences (read current scopes) to the worker

- [x] Branch `/preferences` by method: `GET` → new `handleGetPreferences`, `POST` →
      existing handler (unchanged)
- [x] `handleGetPreferences`: token from query; 400 if missing; 404 uniform if unknown;
      else return `{ ok: true, scopes: { tips, reminders }, first_name }`
- [x] Verify (local): typecheck; valid token returns current scopes; unknown → 404; missing
      → 400; POST /preferences and other endpoints unchanged
- _Requirements: 4.1, 4.2, 4.3, 4.4_

## Task 2: Shared messaging.js

- [x] Create `website/messaging.js` with the worker base URL and fetch helpers
      (subscribe, getPreferences, savePreferences, unsubscribe) + a client email validator
- [x] Verify: helpers call the correct endpoints/methods and parse responses
- _Requirements: 1.3, 2.3, 3.2, 4.1_

## Task 3: subscribe.html

- [x] Build the subscribe page (email, optional first name, tips/reminders checkboxes),
      reusing nav/footer/`styles.css` and accessibility conventions
- [x] Client-side email validation with inline error; POST to `/subscribe`; success/error
      states; scope explanations; Privacy Policy link; note distinguishing this opt-in from
      the app's anonymous analytics
- [x] Verify (local/live worker): valid submit creates a subscriber; invalid email blocked
      client-side
- _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2_

## Task 4: preferences.html

- [x] Build the preferences page: read `token` from URL; on load GET current scopes and
      pre-check boxes; Save posts to `/preferences`; invalid/missing token → friendly
      message + re-subscribe link; include unsubscribe-all affordance
- [x] Verify (local/live worker): pre-fill matches DB; save updates scopes; bad token
      handled
- _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

## Task 5: unsubscribe.html

- [x] Build the unsubscribe page: read `token`; disable all scopes via the worker; uniform
      confirmation (idempotent); links to re-subscribe / manage preferences
- [x] Verify (local/live worker): scopes zeroed; repeat is idempotent; unknown token shows
      same confirmation
- _Requirements: 3.1, 3.2, 3.3, 3.4_

## Task 6: Deploy and document

- [x] Deploy the worker (GET /preferences) and the website (new pages) — your step
- [x] Update `docs/deployment/marketing-website.md` with the new files + worker wiring
- [x] Operator end-to-end: from a real email, click Manage preferences and Unsubscribe and
      confirm both land on the branded pages and work — your step (after deploy)
- _Requirements: 5.3, 5.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3", "4", "5"] },
    { "id": 2, "tasks": ["6"] }
  ]
}
```
