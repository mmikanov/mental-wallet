# Marketing Website (Cloudflare Pages)

The marketing landing page is hosted on Cloudflare Pages at:
**https://mentalhealthwallet.productsforgood.co/**

---

## Deploy Updates

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. Click on the project
3. Click **"New deployment"**
4. Drag and drop the contents of the `website/` folder (not the folder itself — the files inside it)
5. Click Deploy

The custom domain will automatically serve the new files once deployment completes (~30 seconds).

---

## Files

```
website/
├── index.html          # Main landing page
├── privacy.html        # Privacy policy
├── terms.html          # Terms of service
├── styles.css          # All styles
├── script.js           # FAQ accordion
├── CNAME               # Custom domain config
└── assets/
    ├── icon.png        # App icon (240px, optimized for web)
    ├── og-image.jpg    # Social share image (1200×630)
    ├── app-store-badge.svg
    ├── google-play-badge.svg
    └── feature-*.png   # Feature section illustrations
```

---

## DNS Setup

- Domain registrar: DreamHost
- DNS managed by: Cloudflare (nameservers: `lady.ns.cloudflare.com`, `newt.ns.cloudflare.com`)
- Subdomain `mentalhealthwallet` points to the Cloudflare Pages project via CNAME
