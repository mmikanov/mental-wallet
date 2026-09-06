/*
 * build-content.js — generates the tips website content from content/tips/*.md.
 *
 * Outputs (all static, committed, served by wrangler deploy):
 *   website/tips/<slug>.html   one article page per tip
 *   website/tips/index.html    searchable/filterable index page
 *   website/content/index.json machine-readable index (web index + future in-app feed)
 *
 * No network, no database. Run: npm run build:content
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const TIPS_DIR = path.join(ROOT, 'content', 'tips');
const OUT_TIPS_DIR = path.join(__dirname, 'tips');
const OUT_CONTENT_DIR = path.join(__dirname, 'content');

// INTERIM app CTA: article pages render a single "app-cta" button whose href is
// rewritten to the correct store by /app-cta.js based on the visitor's platform. The
// store URLs live in app-cta.js. When real deep links ship (see
// .kiro/specs/app-deep-linking), the article CTA reverts to a single real deep link and
// the store becomes the not-installed fallback.

// --- helpers ---

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/*
 * Minimal frontmatter parser for the flat tip schema (plus nested cta.label/url),
 * matching the approach used by messaging-worker/scripts/send-tip.ts. Not general YAML.
 */
function parseTip(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no frontmatter block found`);
  const [, fm, body] = m;

  const fields = {};
  const cta = {};
  const topics = [];
  let inCta = false;

  for (const line of fm.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    if (/^cta:\s*$/.test(line)) { inCta = true; continue; }
    if (inCta && /^\s+\w+:/.test(line)) {
      const cm = line.match(/^\s+(\w+):\s*(.*)$/);
      if (cm) { cta[cm[1]] = stripQuotes(cm[2]); continue; }
    }
    inCta = false;
    const fmatch = line.match(/^(\w+):\s*(.*)$/);
    if (!fmatch) continue;
    const key = fmatch[1];
    const val = fmatch[2];
    if (key === 'topics') {
      // topics: ["a", "b"]
      const arr = val.match(/\[(.*)\]/);
      if (arr) {
        arr[1].split(',').forEach((t) => {
          const cleaned = stripQuotes(t.trim());
          if (cleaned) topics.push(cleaned);
        });
      }
    } else {
      fields[key] = stripQuotes(val);
    }
  }

  const tip = {
    slug: fields.slug || '',
    title: fields.title || '',
    summary: fields.summary || '',
    type: fields.type || 'feature',
    topics,
    heroImage: fields.heroImage || '',
    cta: cta.label && cta.url ? { label: cta.label, url: cta.url } : null,
    publishedAt: fields.publishedAt || '',
    version: fields.version || '1',
    body: body.trim(),
  };

  // Validate required fields (Requirement 1.4)
  const missing = ['title', 'summary', 'slug'].filter((k) => !tip[k]);
  if (missing.length > 0) {
    throw new Error(`${file}: missing required frontmatter: ${missing.join(', ')}`);
  }
  return tip;
}

function stripQuotes(s) {
  const t = String(s).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

const TYPE_LABELS = {
  feature: 'Feature',
  problem_solving: 'Problem solving',
  come_back: 'Reminder',
};

// --- shared HTML fragments (match the hand-written pages) ---

function pageHead(title, description, canonicalPath) {
  const url = 'https://mentalhealthwallet.productsforgood.co' + canonicalPath;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — Mental Health Wallet</title>
  <meta name="description" content="${escapeAttr(description)}">
  <link rel="canonical" href="${escapeAttr(url)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${escapeAttr(url)}">
  <meta property="og:image" content="https://mentalhealthwallet.productsforgood.co/assets/og-image.jpg">
  <link rel="icon" type="image/png" href="/assets/icon.png">
  <link rel="stylesheet" href="/styles.css">
</head>`;
}

const NAV = `  <a href="#main" class="skip-link">Skip to main content</a>
  <nav class="nav" aria-label="Main navigation">
    <div class="nav-inner container">
      <a href="/" class="nav-brand" aria-label="Mental Health Wallet home">
        <img src="/assets/icon.png" alt="" width="32" height="32" class="nav-icon">
        <span class="nav-name">Mental Health Wallet</span>
      </a>
      <a href="/tips" class="nav-cta">All tips</a>
    </div>
  </nav>`;

const FOOTER = `  <footer class="footer">
    <div class="container footer-content">
      <p class="footer-brand">Mental Health Wallet&#8482;</p>
      <nav class="footer-links" aria-label="Footer navigation">
        <a href="/privacy.html">Privacy Policy</a>
        <a href="/terms.html">Terms of Service</a>
        <a href="mailto:mentalhealthwallet@productsforgood.co">Contact</a>
      </nav>
      <p class="footer-copyright">&copy; 2026 Products for Good Inc. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;

// --- article page ---

function renderArticle(tip) {
  const bodyHtml = marked.parse(tip.body);
  const hero = tip.heroImage
    ? `<img src="${escapeAttr(tip.heroImage)}" alt="" class="article-hero">`
    : '';
  // INTERIM CTA: one intent-labeled button. Its href defaults to the site's download
  // section (both stores) and is rewritten by app-cta.js to the correct store based on
  // the visitor's platform (iOS -> App Store, Android -> Play, desktop/unknown -> both).
  // The label states the action ("open"), and installed users see "Open" on the store.
  // Reverts to a single real deep-link CTA once app-deep-linking ships (see spec).
  const ctaLabel = tip.cta ? escapeHtml(tip.cta.label) : 'Open Mental Health Wallet';
  const cta = `<div class="article-cta">
          <a href="/#hero" class="btn-primary app-cta">${ctaLabel}</a>
        </div>`;

  return `${pageHead(tip.title, tip.summary, '/tips/' + tip.slug)}
<body>
${NAV}
  <main id="main" class="article-page">
    <div class="container">
      <p class="article-back"><a href="/tips">&larr; All tips</a></p>
      <article class="article-body">
        <h1>${escapeHtml(tip.title)}</h1>
        ${hero}
        ${bodyHtml}
        ${cta}
      </article>
    </div>
  </main>
${FOOTER.replace('</body>', '  <script src="/app-cta.js"></script>\n</body>')}
`;
}

// --- index page ---

function renderIndexPage(tips) {
  // Baseline (no-JS) list, enhanced by an inline script that reads index.json.
  const items = tips.map((t) => `
        <li class="tip-item" data-type="${escapeAttr(t.type)}" data-topics="${escapeAttr(t.topics.join(' '))}" data-title="${escapeAttr(t.title.toLowerCase())}" data-summary="${escapeAttr(t.summary.toLowerCase())}" data-date="${escapeAttr(t.publishedAt)}">
          <a class="tip-item-link" href="/tips/${escapeAttr(t.slug)}">
            <h3>${escapeHtml(t.title)}</h3>
            <p class="tip-item-summary">${escapeHtml(t.summary)}</p>
            <p class="tip-item-meta"><span class="tip-badge">${escapeHtml(TYPE_LABELS[t.type] || t.type)}</span>${t.topics.map((tp) => `<span class="tip-topic">${escapeHtml(tp)}</span>`).join('')}</p>
          </a>
        </li>`).join('');

  const allTopics = Array.from(new Set(tips.flatMap((t) => t.topics))).sort();
  const topicOptions = ['<option value="">All topics</option>']
    .concat(allTopics.map((tp) => `<option value="${escapeAttr(tp)}">${escapeHtml(tp)}</option>`))
    .join('');

  return `${pageHead('Tips', 'Practical tips to get the most out of Mental Health Wallet.', '/tips')}
<body>
${NAV}
  <main id="main" class="tips-index">
    <div class="container">
      <h1>Tips</h1>
      <p class="lead">Short, practical ideas to help you get the most out of the app.</p>

      <div class="tips-controls">
        <div class="form-field">
          <label for="tip-search">Search</label>
          <input type="text" id="tip-search" placeholder="Search tips...">
        </div>
        <div class="form-field">
          <label for="tip-type">Type</label>
          <select id="tip-type">
            <option value="">All types</option>
            <option value="feature">Feature</option>
            <option value="problem_solving">Problem solving</option>
            <option value="come_back">Reminder</option>
          </select>
        </div>
        <div class="form-field">
          <label for="tip-topic">Topic</label>
          <select id="tip-topic">${topicOptions}</select>
        </div>
        <div class="form-field">
          <label for="tip-sort">Sort</label>
          <select id="tip-sort">
            <option value="newest">Newest</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </div>
      </div>

      <ul class="tips-list" id="tips-list">${items}
      </ul>
      <p class="tips-empty" id="tips-empty" hidden>No tips match your filters.</p>
    </div>
  </main>
${FOOTER.replace('</body>', `  <script>
    (function () {
      const list = document.getElementById('tips-list');
      const empty = document.getElementById('tips-empty');
      const search = document.getElementById('tip-search');
      const typeSel = document.getElementById('tip-type');
      const topicSel = document.getElementById('tip-topic');
      const sortSel = document.getElementById('tip-sort');
      const items = Array.prototype.slice.call(list.querySelectorAll('.tip-item'));

      function apply() {
        const q = search.value.trim().toLowerCase();
        const type = typeSel.value;
        const topic = topicSel.value;
        let visible = 0;
        items.forEach(function (li) {
          const matchesQ = !q || li.dataset.title.indexOf(q) >= 0 || li.dataset.summary.indexOf(q) >= 0 || li.dataset.topics.toLowerCase().indexOf(q) >= 0;
          const matchesType = !type || li.dataset.type === type;
          const matchesTopic = !topic || (' ' + li.dataset.topics + ' ').indexOf(' ' + topic + ' ') >= 0;
          const show = matchesQ && matchesType && matchesTopic;
          li.hidden = !show;
          if (show) visible++;
        });
        empty.hidden = visible !== 0;
        // sort
        const sorted = items.slice().sort(function (a, b) {
          if (sortSel.value === 'title') return a.dataset.title.localeCompare(b.dataset.title);
          return (b.dataset.date || '').localeCompare(a.dataset.date || '');
        });
        sorted.forEach(function (li) { list.appendChild(li); });
      }

      [search, typeSel, topicSel, sortSel].forEach(function (el) {
        el.addEventListener('input', apply);
        el.addEventListener('change', apply);
      });
      apply();
    })();
  </script>
</body>`)}
`;
}

// --- main build ---

function build() {
  if (!fs.existsSync(TIPS_DIR)) {
    console.error(`Tips directory not found: ${TIPS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TIPS_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
  if (files.length === 0) {
    console.error('No tip markdown files found.');
    process.exit(1);
  }

  const tips = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(TIPS_DIR, file), 'utf8');
    const tip = parseTip(raw, file);
    tips.push(tip);
  }

  // Deterministic sort: publishedAt desc, then title
  tips.sort((a, b) => {
    if (b.publishedAt !== a.publishedAt) return b.publishedAt.localeCompare(a.publishedAt);
    return a.title.localeCompare(b.title);
  });

  // Fresh output dir for article pages (avoid orphans from removed tips)
  fs.rmSync(OUT_TIPS_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_TIPS_DIR, { recursive: true });
  fs.mkdirSync(OUT_CONTENT_DIR, { recursive: true });

  // Article pages
  for (const tip of tips) {
    fs.writeFileSync(path.join(OUT_TIPS_DIR, `${tip.slug}.html`), renderArticle(tip));
  }

  // index.json
  const index = tips.map((t) => ({
    slug: t.slug,
    title: t.title,
    summary: t.summary,
    type: t.type,
    topics: t.topics,
    heroImage: t.heroImage,
    cta: t.cta,
    url: `/tips/${t.slug}`,
    publishedAt: t.publishedAt,
  }));
  fs.writeFileSync(path.join(OUT_CONTENT_DIR, 'index.json'), JSON.stringify(index, null, 2));

  // Index page
  fs.writeFileSync(path.join(OUT_TIPS_DIR, 'index.html'), renderIndexPage(tips));

  console.log(`Built ${tips.length} tip page(s):`);
  tips.forEach((t) => console.log(`  /tips/${t.slug}`));
  console.log(`  /tips (index)`);
  console.log(`  /content/index.json`);
}

build();
