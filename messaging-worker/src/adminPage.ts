/**
 * Operator-only admin page for the drip (messaging-drip-admin-ui spec).
 *
 * A single self-contained HTML string (inline CSS + vanilla JS, no build step), served by the
 * messaging worker at GET /admin and gated by ADMIN_SECRET (substituted into __ADMIN_SECRET__
 * so the page's fetch() calls authenticate). It is a presentation layer over the existing
 * /drip/* endpoints — it adds NO sending logic of its own.
 *
 * The pure display helpers (countdown formatting, sim-grid building) are duplicated here in
 * plain JS for the browser; their logic is unit-tested in src/adminHelpers.ts.
 *
 * Mirrors the analytics worker's dashboard.ts pattern. NOTE: because the JS lives inside a
 * `\`...\`` template literal, any ${...} meant for the browser at runtime is escaped as \${...}.
 */

export const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Drip Admin — Mental Health Wallet</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --ink:#1a1a1a; --muted:#6c757d; --line:#e5e7eb;
          --green:#2e7d32; --greenbg:#e8f5e9; --amber:#b26a00; --amberbg:#fff3e0;
          --red:#c62828; --redbg:#ffebee; --blue:#1565c0; --bluebg:#e3f2fd; }
  * { box-sizing:border-box; }
  body { font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif; color:var(--ink);
         background:var(--bg); margin:0; padding:24px; line-height:1.45; }
  h1 { font-size:1.25rem; margin:0 0 4px; }
  h2 { font-size:1rem; margin:0 0 12px; }
  .sub { color:var(--muted); font-size:0.85rem; margin:0 0 20px; }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:10px;
           padding:16px 18px; margin-bottom:18px; }
  .row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .spacer { flex:1; }
  button { font:inherit; border:1px solid var(--line); background:#fff; color:var(--ink);
           padding:6px 12px; border-radius:7px; cursor:pointer; }
  button:hover { background:#f0f1f3; }
  button.primary { background:var(--blue); color:#fff; border-color:var(--blue); }
  button.danger { background:#fff; color:var(--red); border-color:var(--red); }
  button.danger:hover { background:var(--redbg); }
  button:disabled { opacity:0.5; cursor:not-allowed; }
  .badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:0.8rem; font-weight:600; }
  .badge.ok { background:var(--greenbg); color:var(--green); }
  .badge.paused { background:var(--amberbg); color:var(--amber); }
  .badge.running { background:var(--bluebg); color:var(--blue); }
  table { border-collapse:collapse; width:100%; font-size:0.88rem; margin-top:8px; }
  th,td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); white-space:nowrap; }
  th { color:var(--muted); font-weight:600; }
  .empty { color:var(--muted); padding:14px; text-align:center; border:1px dashed var(--line); border-radius:8px; }
  input,select { font:inherit; padding:5px 8px; border:1px solid var(--line); border-radius:6px; }
  input[type=number] { width:70px; }
  .err { background:var(--redbg); color:var(--red); border:1px solid var(--red); border-radius:7px;
         padding:8px 12px; margin:8px 0; font-size:0.85rem; display:none; white-space:pre-wrap; }
  .hint { color:var(--amber); font-size:0.82rem; }
  .mut { color:var(--muted); font-size:0.82rem; }
  .grid-cell-next { background:var(--greenbg); color:var(--green); }
  .grid-cell-waiting { background:var(--amberbg); color:var(--amber); }
  .grid-cell-finished { color:var(--muted); }
  .mode-dry { color:var(--green); font-weight:600; }
  .mode-prod { color:var(--red); font-weight:600; }
  .scroll { overflow-x:auto; }
</style>
</head>
<body>
  <h1>Drip Admin</h1>
  <p class="sub">Operator-only control + testing for the daily email drip. Private page (secret-gated); not visible to subscribers.</p>

  <!-- STATUS -->
  <div class="panel" id="status-panel">
    <h2>Status</h2>
    <div class="row">
      <span id="state-badge" class="badge">loading…</span>
      <span id="run-badge"></span>
      <span class="mut" id="next-run"></span>
      <span class="spacer"></span>
      <button id="btn-pause">Pause</button>
      <button id="btn-resume">Resume</button>
      <button id="btn-refresh">Refresh</button>
    </div>
    <div class="err" id="status-err"></div>
  </div>

  <!-- SEQUENCE -->
  <div class="panel" id="sequence-panel">
    <h2>Sequence <span class="mut" id="seq-count"></span></h2>
    <div id="run-hint" class="hint" style="display:none;">A run is in progress — you may want to hold off editing until it finishes.</div>
    <div id="seq-body"></div>
    <div class="err" id="seq-err"></div>
    <div class="row" style="margin-top:12px;">
      <select id="add-campaign"><option value="">Add a campaign to the sequence…</option></select>
      <button id="btn-add-step">Add step</button>
    </div>
  </div>

  <!-- PREVIEW -->
  <div class="panel" id="preview-panel">
    <h2>Preview next run</h2>
    <div class="row">
      <button id="btn-preview">Preview next run (dry-run)</button>
      <span class="mut">Shows what the next daily run would send. <strong>No emails are sent.</strong></span>
    </div>
    <div id="preview-body"></div>
    <div class="err" id="preview-err"></div>
  </div>

  <!-- TESTING -->
  <div class="panel" id="testing-panel">
    <h2>Testing (time-travel)</h2>
    <div class="row">
      <button id="btn-test-create" class="primary">Create test users</button>
      <span class="mut">Fresh cohort with signup ages derived from the current sequence. <strong>Replaces</strong> any existing test users.</span>
    </div>
    <div class="row" style="margin-top:8px;">
      <button id="btn-test-reset">Reset test users</button>
      <span class="mut"><strong>Keeps</strong> the same test users; clears their send history so you can re-run.</span>
    </div>
    <div id="test-cohort" class="mut" style="margin-top:8px;"></div>
    <hr style="border:none;border-top:1px solid var(--line);margin:14px 0;" />
    <div class="row">
      <label>Start <input type="date" id="sim-start" /></label>
      <label>Days <input type="number" id="sim-days" value="14" min="1" max="400" /></label>
      <label>Mode
        <select id="sim-mode">
          <option value="dry-run">dry-run (no emails)</option>
          <option value="production">send-to-test (real emails, test users only)</option>
        </select>
      </label>
      <button id="btn-simulate" class="primary">Run simulation</button>
    </div>
    <div class="mut" id="sim-mode-note"></div>
    <div class="scroll"><div id="sim-body"></div></div>
    <div class="err" id="sim-err"></div>
  </div>

<script>
  var SECRET = '__ADMIN_SECRET__';

  // --- pure helpers (logic mirrored from src/adminHelpers.ts, unit-tested there) ---
  function formatCountdown(iso, now) {
    now = now || new Date();
    if (!iso) return 'unknown';
    var t = Date.parse(iso);
    if (isNaN(t)) return 'unknown';
    var ms = t - now.getTime();
    if (ms <= 0) return 'due now';
    var mins = Math.floor(ms / 60000);
    var days = Math.floor(mins / (60*24));
    var hours = Math.floor((mins % (60*24)) / 60);
    var m = mins % 60;
    if (days > 0) return 'in ' + days + 'd ' + hours + 'h';
    if (hours > 0) return 'in ' + hours + 'h ' + m + 'm';
    return 'in ' + m + 'm';
  }
  function testerLabel(email) {
    var m = email.match(/\\+(\\d+)d@/);
    return m ? m[1] + 'd' : email.split('@')[0];
  }
  function testerAge(email) {
    var m = email.match(/\\+(\\d+)d@/);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
  }
  function buildSimGrid(perDay) {
    var emails = {};
    perDay.forEach(function(d){ d.plan.forEach(function(p){ emails[p.email] = true; }); });
    var list = Object.keys(emails).sort(function(a,b){ return testerAge(a) - testerAge(b); });
    var testers = list.map(testerLabel);
    var emailByLabel = {}; list.forEach(function(e){ emailByLabel[testerLabel(e)] = e; });
    var rows = perDay.map(function(d){
      var byEmail = {}; d.plan.forEach(function(p){ byEmail[p.email] = p; });
      var cells = {};
      testers.forEach(function(t){
        var e = emailByLabel[t]; var entry = e ? byEmail[e] : null;
        cells[t] = entry ? { status: entry.status, tip_slug: entry.tip_slug, sent: entry.sent } : { status: 'finished' };
      });
      return { day: d.day, cells: cells };
    });
    return { testers: testers, rows: rows };
  }
  function cellText(cell) {
    if (cell.status === 'next') return cell.tip_slug ? cell.tip_slug : 'next';
    return cell.status;
  }

  // --- fetch helper: adds the secret, parses JSON, surfaces errors ---
  function qs(params) {
    var s = 'secret=' + encodeURIComponent(SECRET);
    return s;
  }
  async function api(path, opts) {
    opts = opts || {};
    var sep = path.indexOf('?') >= 0 ? '&' : '?';
    var url = path + sep + qs();
    var res = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    var text = await res.text();
    var data; try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
    if (!res.ok) {
      var msg = (data && (data.error || data.detail)) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }
  function showErr(id, e) {
    var el = document.getElementById(id);
    el.textContent = String(e && e.message ? e.message : e);
    el.style.display = 'block';
  }
  function clearErr(id) { var el = document.getElementById(id); el.style.display = 'none'; el.textContent = ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // --- STATUS ---
  var lastRunning = false;
  async function refreshStatus() {
    clearErr('status-err');
    try {
      var s = await api('/drip/status');
      var badge = document.getElementById('state-badge');
      badge.className = 'badge ' + (s.paused ? 'paused' : 'ok');
      badge.textContent = s.paused ? 'PAUSED' : 'Running (scheduled)';
      var rb = document.getElementById('run-badge');
      rb.innerHTML = s.running ? '<span class="badge running">RUNNING NOW</span>' : '';
      document.getElementById('next-run').textContent = 'Next run: ' + formatCountdown(s.nextRunAt) +
        (s.lastRunAt ? '  ·  last run ' + new Date(s.lastRunAt).toLocaleString() : '  ·  never run yet');
      document.getElementById('run-hint').style.display = s.running ? 'block' : 'none';
      lastRunning = !!s.running;
    } catch (e) { showErr('status-err', e); }
  }
  document.getElementById('btn-pause').onclick = async function(){ try { await api('/drip/pause', {method:'POST'}); await refreshStatus(); } catch(e){ showErr('status-err', e); } };
  document.getElementById('btn-resume').onclick = async function(){ try { await api('/drip/resume', {method:'POST'}); await refreshStatus(); } catch(e){ showErr('status-err', e); } };
  document.getElementById('btn-refresh').onclick = refreshStatus;

  // --- CAMPAIGNS (for the add-to-sequence picker) ---
  async function loadCampaignOptions() {
    try {
      var data = await api('/campaigns');
      var sel = document.getElementById('add-campaign');
      // Keep the placeholder, replace the rest.
      sel.length = 1;
      (data.campaigns || []).forEach(function(c){
        var o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.name + '  (' + c.tip_slug + ', ' + c.scope + ', gap ' + c.gap_days + ')';
        sel.appendChild(o);
      });
    } catch (e) { /* non-fatal; picker just stays empty */ }
  }

  // --- SEQUENCE ---
  async function refreshSequence() {
    clearErr('seq-err');
    try {
      var data = await api('/drip/sequence');
      document.getElementById('seq-count').textContent = '(' + data.count + ' step' + (data.count === 1 ? '' : 's') + ')';
      var body = document.getElementById('seq-body');
      if (!data.steps.length) {
        body.innerHTML = '<div class="empty">The sequence is empty. Add the first step below to build it.</div>';
        return;
      }
      var rows = data.steps.map(function(s, i){
        var last = i === data.steps.length - 1;
        return '<tr>' +
          '<td>' + s.position + '</td>' +
          '<td>' + esc(s.campaign_name) + '<div class="mut">' + esc(s.tip_slug) + '</div></td>' +
          '<td>' + esc(s.scope) + '</td>' +
          '<td><input type="number" min="1" value="' + s.gap_days + '" data-gap-campaign="' + s.campaign_id + '" style="width:60px" /></td>' +
          '<td>' + (s.enabled ? 'enabled' : '<span class="mut">disabled</span>') + '</td>' +
          '<td class="row">' +
            '<button data-up="' + s.id + '" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
            '<button data-down="' + s.id + '" ' + (last ? 'disabled' : '') + '>↓</button>' +
            '<button data-toggle="' + s.id + '" data-enabled="' + (s.enabled ? '1' : '0') + '">' + (s.enabled ? 'Disable' : 'Enable') + '</button>' +
            '<button class="danger" data-del="' + s.id + '" data-pos="' + s.position + '">Remove</button>' +
          '</td>' +
        '</tr>';
      }).join('');
      body.innerHTML = '<table><thead><tr><th>#</th><th>Campaign</th><th>Scope</th><th>Gap (days)</th><th>State</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
      wireSequenceActions(data.steps);
    } catch (e) { showErr('seq-err', e); }
  }
  function wireSequenceActions(steps) {
    var body = document.getElementById('seq-body');
    // Reorder up/down: compute target position and PATCH.
    body.querySelectorAll('[data-up]').forEach(function(b){
      b.onclick = async function(){ await moveStep(b.getAttribute('data-up'), -1, steps); };
    });
    body.querySelectorAll('[data-down]').forEach(function(b){
      b.onclick = async function(){ await moveStep(b.getAttribute('data-down'), +1, steps); };
    });
    body.querySelectorAll('[data-toggle]').forEach(function(b){
      b.onclick = async function(){
        try { await api('/drip/sequence/steps/' + b.getAttribute('data-toggle'), {method:'PATCH', body:{ enabled: b.getAttribute('data-enabled') !== '1' }}); await refreshSequence(); }
        catch(e){ showErr('seq-err', e); await refreshSequence(); }
      };
    });
    body.querySelectorAll('[data-del]').forEach(function(b){
      b.onclick = async function(){
        if (!confirm('Remove this step from the sequence? (The campaign itself and its send history are kept.)')) return;
        try { await api('/drip/sequence/steps/' + b.getAttribute('data-del'), {method:'DELETE'}); await refreshSequence(); }
        catch(e){ showErr('seq-err', e); await refreshSequence(); }
      };
    });
    // Gap edit (auto-save on change): PATCH the campaign's gap_days.
    body.querySelectorAll('[data-gap-campaign]').forEach(function(inp){
      inp.onchange = async function(){
        var v = Math.max(1, Math.floor(Number(inp.value) || 1));
        inp.value = v;
        try { await api('/campaigns/' + inp.getAttribute('data-gap-campaign'), {method:'PATCH', body:{ gap_days: v }}); await refreshSequence(); }
        catch(e){ showErr('seq-err', e); await refreshSequence(); }
      };
    });
  }
  async function moveStep(stepId, delta, steps) {
    var idx = steps.findIndex(function(s){ return s.id === stepId; });
    if (idx < 0) return;
    var target = steps[idx].position + delta;
    try { await api('/drip/sequence/steps/' + stepId, {method:'PATCH', body:{ position: target }}); await refreshSequence(); }
    catch(e){ showErr('seq-err', e); await refreshSequence(); }
  }
  document.getElementById('btn-add-step').onclick = async function(){
    var sel = document.getElementById('add-campaign');
    var id = sel.value;
    if (!id) { showErr('seq-err', 'Pick a campaign to add.'); return; }
    clearErr('seq-err');
    try { await api('/drip/sequence/steps', {method:'POST', body:{ campaign_id: id }}); sel.value=''; await refreshSequence(); }
    catch(e){ showErr('seq-err', e); await refreshSequence(); }
  };

  // --- PREVIEW ---
  document.getElementById('btn-preview').onclick = async function(){
    clearErr('preview-err');
    var body = document.getElementById('preview-body');
    body.innerHTML = '<div class="mut">Running dry-run…</div>';
    try {
      var data = await api('/drip/preview', {method:'POST', body:{}});
      var c = data.counts || {};
      var list = (data.plan || []).map(function(p){
        return '<tr><td>' + esc(p.email) + '</td><td>' + esc(p.status) + '</td><td>' + esc(p.tip_slug || '') + '</td></tr>';
      }).join('');
      body.innerHTML = '<p class="mut">Dry run — no emails sent. Next: ' + (c.next||0) + ' · waiting: ' + (c.waiting||0) + ' · finished: ' + (c.finished||0) +
        (data.planTruncated ? ' (list truncated)' : '') + '</p>' +
        (list ? '<table><thead><tr><th>Subscriber</th><th>Status</th><th>Next campaign</th></tr></thead><tbody>' + list + '</tbody></table>' : '<div class="empty">No subscribers.</div>');
    } catch (e) { body.innerHTML=''; showErr('preview-err', e); }
  };

  // --- TESTING: cohort ---
  function renderCohort(testers) {
    var el = document.getElementById('test-cohort');
    if (!testers || !testers.length) { el.textContent = 'No test users yet.'; return; }
    el.innerHTML = 'Test cohort: ' + testers.map(function(t){ return 'joined ' + t.ageDays + 'd ago'; }).join(' · ') + ' (test-only; never real subscribers)';
  }
  document.getElementById('btn-test-create').onclick = async function(){
    clearErr('sim-err');
    if (!confirm('Create a fresh test cohort? This REPLACES any existing test users and clears their history. (Test users only — never real subscribers.)')) return;
    try { var d = await api('/drip/test/create', {method:'POST'}); renderCohort(d.testers); }
    catch(e){ showErr('sim-err', e); }
  };
  document.getElementById('btn-test-reset').onclick = async function(){
    clearErr('sim-err');
    try { var d = await api('/drip/test/reset', {method:'POST'}); document.getElementById('test-cohort').textContent = 'Reset ' + d.kept + ' test user(s): send history cleared, ages kept.'; }
    catch(e){ showErr('sim-err', e); }
  };

  // --- TESTING: simulate ---
  function renderModeNote() {
    var mode = document.getElementById('sim-mode').value;
    var el = document.getElementById('sim-mode-note');
    if (mode === 'production') el.innerHTML = 'Active mode: <span class="mode-prod">send-to-test</span> — this DELIVERS real emails (to test users only).';
    else el.innerHTML = 'Active mode: <span class="mode-dry">dry-run</span> — no emails sent; advances test state virtually so you see the full progression.';
  }
  document.getElementById('sim-mode').onchange = renderModeNote;
  document.getElementById('btn-simulate').onclick = async function(){
    clearErr('sim-err');
    var mode = document.getElementById('sim-mode').value;
    var days = Math.max(1, Math.min(400, Math.floor(Number(document.getElementById('sim-days').value) || 14)));
    var startDate = document.getElementById('sim-start').value || undefined;
    if (mode === 'production') {
      if (!confirm('Run in send-to-test mode? This DELIVERS real emails to the test cohort (never real subscribers). Continue?')) return;
    }
    var body = document.getElementById('sim-body');
    body.innerHTML = '<div class="mut">Simulating…</div>';
    try {
      var data = await api('/drip/simulate', {method:'POST', body:{ startDate: startDate, days: days, mode: mode }});
      var grid = buildSimGrid(data.perDay || []);
      if (!grid.testers.length) { body.innerHTML = '<div class="empty">No test users. Create a test cohort first.</div>'; return; }
      var head = '<tr><th>Day</th>' + grid.testers.map(function(t){ return '<th>' + esc(t) + '</th>'; }).join('') + '</tr>';
      var rows = grid.rows.map(function(r){
        return '<tr><td>' + esc(r.day) + '</td>' + grid.testers.map(function(t){
          var cell = r.cells[t];
          return '<td class="grid-cell-' + cell.status + '">' + esc(cellText(cell)) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      body.innerHTML = '<p class="mut">' + esc(data.mode) + ' · ' + data.days + ' day(s) from ' + esc(data.startDate) + ' · ' + data.testerCount + ' test user(s)' +
        (data.mode === 'dry-run' ? '. Virtual advancement — run "Reset test users" to clear.' : '') + '</p>' +
        '<table><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>';
    } catch (e) { body.innerHTML=''; showErr('sim-err', e); }
  };

  // --- init ---
  (function(){
    document.getElementById('sim-start').value = new Date().toISOString().slice(0,10);
    renderModeNote();
    refreshStatus();
    loadCampaignOptions();
    refreshSequence();
    setInterval(refreshStatus, 20000); // keep next-run / running indicator fresh
  })();
</script>
</body>
</html>`;
