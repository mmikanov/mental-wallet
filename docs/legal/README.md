# Legal Pages

The privacy policy and terms of service are hosted on the website and served at:

- **Privacy Policy**: https://mentalwallet.app/privacy
- **Terms of Service**: https://mentalwallet.app/terms

Source files live in `/website/privacy.html` and `/website/terms.html`.

The app opens these URLs via `expo-web-browser` (see `src/config/appInfo.ts` for the URL constants). There is no local copy in the app bundle — the website is the single source of truth.
