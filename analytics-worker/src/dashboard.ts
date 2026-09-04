/**
 * Dashboard HTML — exported as a string constant for the Worker to serve.
 * Fetches KPIs from the /kpis endpoint (server-side computed) and renders them.
 * Clickable cards open detail panels with drill-down data from /details/* endpoints.
 */

export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Dashboard — Mental Health Wallet</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='2' y='6' width='28' height='22' rx='4' fill='%2316213e'/><rect x='8' y='18' width='4' height='6' rx='1' fill='%234caf50'/><rect x='14' y='14' width='4' height='10' rx='1' fill='%232196f3'/><rect x='20' y='10' width='4' height='14' rx='1' fill='%23ff9800'/></svg>" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f7fa;
      color: #1a1a2e;
      padding: 24px;
      line-height: 1.5;
    }
    h1 { font-size: 1.75rem; margin-bottom: 4px; color: #16213e; }
    .subtitle { color: #6c757d; font-size: 0.9rem; margin-bottom: 24px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .card h3 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6c757d;
      margin-bottom: 8px;
    }
    .card .value { font-size: 2rem; font-weight: 700; color: #16213e; }
    .card .detail { font-size: 0.85rem; color: #6c757d; margin-top: 4px; }
    .section-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 12px; color: #16213e; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      margin-bottom: 32px;
    }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
    th {
      background: #f8f9fa;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6c757d;
    }
    td { font-size: 0.95rem; }
    .status-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      margin-bottom: 24px;
      padding: 8px 12px;
      background: #e8f5e9;
      border-radius: 8px;
      font-size: 0.8rem;
      color: #2e7d32;
    }
    .status-bar .dot {
      width: 8px; height: 8px;
      background: #4caf50;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .actions { margin-top: 16px; }
    .actions button {
      background: #e53935; color: #fff; border: none;
      padding: 8px 16px; border-radius: 6px; cursor: pointer;
      font-size: 0.85rem; font-weight: 500;
    }
    .actions button:hover { background: #c62828; }
    .empty-state { text-align: center; padding: 48px 24px; color: #6c757d; }
    .empty-state p { margin-top: 8px; }
    .outcome-bar {
      display: flex; gap: 4px; height: 24px; border-radius: 6px; overflow: hidden; margin-top: 8px;
    }
    .outcome-bar div { display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: #fff; font-weight: 600; }
    .outcome-calmer { background: #4caf50; }
    .outcome-clearer { background: #2196f3; }
    .outcome-hopeful { background: #ff9800; }
    .outcome-same { background: #9e9e9e; }
    .outcome-worse { background: #e53935; }
    .legend { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; font-size: 0.75rem; color: #6c757d; }
    .legend span::before { content: ''; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
    .legend .l-calmer::before { background: #4caf50; }
    .legend .l-clearer::before { background: #2196f3; }
    .legend .l-hopeful::before { background: #ff9800; }
    .legend .l-same::before { background: #9e9e9e; }
    .legend .l-worse::before { background: #e53935; }
    .detail-panel {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      margin-bottom: 24px;
      max-height: 400px;
      overflow-y: auto;
    }
    .detail-panel h3 {
      font-size: 1rem;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .detail-panel .close-btn {
      background: #eee;
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .detail-panel .close-btn:hover { background: #ddd; }
    .detail-panel table { width: 100%; border-collapse: collapse; font-size: 0.85rem; box-shadow: none; margin-bottom: 0; }
    .detail-panel th, .detail-panel td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #f0f0f0; }
    .detail-panel th { color: #6c757d; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; }
    .loading-detail { text-align: center; padding: 20px; color: #6c757d; font-size: 0.9rem; }
    .phase-filter {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      padding: 12px 16px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      flex-wrap: wrap;
    }
    .phase-filter label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6c757d;
    }
    .phase-filter .phase-btn {
      padding: 6px 14px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: #f8f9fa;
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 500;
      color: #444;
      transition: all 0.15s;
    }
    .phase-filter .phase-btn:hover { background: #e8f0fe; border-color: #4285f4; }
    .phase-filter .phase-btn.active { background: #4285f4; color: #fff; border-color: #4285f4; }
    .phase-filter .phase-btn.disabled { opacity: 0.4; cursor: not-allowed; }
    .phase-filter .phase-dates { font-size: 0.75rem; color: #999; margin-left: 8px; }
    .phase-filter .phase-range {
      flex-basis: 100%;
      font-size: 0.85rem;
      font-weight: 600;
      color: #1a73e8;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <h1>Analytics Dashboard</h1>
  <p class="subtitle">Mental Health Wallet — Production</p>

  <div class="status-bar">
    <span class="dot"></span>
    <span>Auto-refreshing every 30 seconds</span>
    <span id="last-updated" style="margin-left: auto;"></span>
  </div>

  <div class="phase-filter" id="phase-filter">
    <label>Phase:</label>
    <button class="phase-btn active" data-phase="all" onclick="setPhase('all')">All Time</button>
    <button class="phase-btn disabled" data-phase="pre-release" onclick="setPhase('pre-release')">Pre-Release (before release)</button>
    <button class="phase-btn disabled" data-phase="post-release" onclick="setPhase('post-release')">Post-Release (release to now)</button>
    <button class="phase-btn disabled" data-phase="warm" onclick="setPhase('warm')">Warm Launch (release to warm end)</button>
    <button class="phase-btn disabled" data-phase="cold" onclick="setPhase('cold')">Cold Acquisition (after cold start)</button>
    <div class="phase-range" id="phase-range"></div>
    <span class="phase-dates" id="phase-dates"></span>
  </div>

  <div id="dashboard-content">
    <div class="empty-state"><p>Loading...</p></div>
  </div>

  <div class="actions">
    <button onclick="clearEvents()">Clear All Events</button>
  </div>

  <script>
    const SECRET = '__DASHBOARD_SECRET__';
    let milestones = { release: null, warmEnd: null, coldStart: null };
    let currentPhase = 'all';

    async function fetchMilestones() {
      try {
        const res = await fetch('/milestones?secret=' + encodeURIComponent(SECRET));
        if (!res.ok) return;
        milestones = await res.json();
        updatePhaseButtons();
      } catch (e) {
        console.error('Failed to fetch milestones:', e);
      }
    }

    function updatePhaseButtons() {
      const btns = document.querySelectorAll('.phase-btn[data-phase]');
      btns.forEach(function(btn) {
        var phase = btn.getAttribute('data-phase');
        if (phase === 'all') { btn.classList.remove('disabled'); return; }
        if (phase === 'pre-release' && milestones.release) btn.classList.remove('disabled');
        if (phase === 'post-release' && milestones.release) btn.classList.remove('disabled');
        if (phase === 'warm' && milestones.release) btn.classList.remove('disabled');
        if (phase === 'cold' && milestones.coldStart) btn.classList.remove('disabled');
      });
      updatePhaseDates();
    }

    function updatePhaseDates() {
      var el = document.getElementById('phase-dates');
      if (!el) return;
      var parts = [];
      if (milestones.release) parts.push('Release: ' + fmtDate(milestones.release));
      if (milestones.warmEnd) parts.push('Warm ends: ' + fmtDate(milestones.warmEnd));
      if (milestones.coldStart) parts.push('Cold starts: ' + fmtDate(milestones.coldStart));
      var datesText = parts.length > 0 ? parts.join(' | ') : 'No milestone dates set (configure in wrangler.toml)';
      var excludedText = '';
      if (milestones.excludedUserIds && milestones.excludedUserIds.length > 0) {
        excludedText = '<br><span style="color:#e53935;">Excluded from KPIs:</span> ' + milestones.excludedUserIds.join(', ');
      }
      el.innerHTML = datesText + excludedText;
      updatePhaseRange();
    }

    function setPhase(phase) {
      var btn = document.querySelector('.phase-btn[data-phase="' + phase + '"]');
      if (btn && btn.classList.contains('disabled')) return;
      currentPhase = phase;
      document.querySelectorAll('.phase-btn').forEach(function(b) { b.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      updatePhaseRange();
      refresh();
    }

    // Returns the actual {from, to} timestamps for the current phase (null = unbounded).
    // Single source of truth for both the query params and the range shown on the bar.
    function getActiveRange() {
      var from = null, to = null;
      if (currentPhase === 'pre-release' && milestones.release) {
        to = milestones.release;
      } else if (currentPhase === 'post-release') {
        if (milestones.release) from = milestones.release;
      } else if (currentPhase === 'warm') {
        if (milestones.release) from = milestones.release;
        if (milestones.warmEnd) to = milestones.warmEnd;
        else if (milestones.coldStart) to = milestones.coldStart;
      } else if (currentPhase === 'cold') {
        if (milestones.coldStart) from = milestones.coldStart;
      }
      return { from: from, to: to };
    }

    function getPhaseParams() {
      var r = getActiveRange();
      var params = '';
      if (r.from) params += '&from=' + encodeURIComponent(r.from);
      if (r.to) params += '&to=' + encodeURIComponent(r.to);
      return params;
    }

    // Length of the currently selected phase window in days.
    // A missing "to" means the window runs up to now (open-ended phases like
    // Post-Release and Cold Acquisition), so we measure to the current time,
    // NOT infinity. A missing "from" (only All Time) is genuinely unbounded
    // into the past and is treated as long enough.
    function phaseWindowDays() {
      if (currentPhase === 'all') return Infinity;
      var r = getActiveRange();
      if (!r.from) return Infinity;
      var toMs = r.to ? new Date(r.to).getTime() : Date.now();
      var ms = toMs - new Date(r.from).getTime();
      if (!isFinite(ms)) return Infinity;
      if (ms < 0) return 0; // degenerate/empty window -> treat as too short (n/a)
      return ms / (24 * 60 * 60 * 1000);
    }

    // Renders a retention percentage, or "n/a" when the selected window is
    // shorter than the bucket horizon (a DN number over a few hours is
    // meaningless because days_since_install is per-event, not per-window).
    function retentionValue(pctValue, horizonDays) {
      if (phaseWindowDays() < horizonDays) {
        return '<span style="color:#999;">n/a</span>';
      }
      return pct(pctValue);
    }

    function updatePhaseRange() {
      var el = document.getElementById('phase-range');
      if (!el) return;
      if (currentPhase === 'all') {
        el.textContent = 'Showing: all events (no date filter)';
        return;
      }
      var r = getActiveRange();
      var fromText = r.from ? fmtDate(r.from) : 'the beginning';
      var toText = r.to ? fmtDate(r.to) : 'now';
      el.textContent = 'Showing: ' + fromText + ' \u2192 ' + toText;
    }

    async function fetchKPIs() {
      try {
        const res = await fetch('/kpis?secret=' + encodeURIComponent(SECRET) + getPhaseParams());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {
        console.error('Failed to fetch KPIs:', e);
        return null;
      }
    }

    async function fetchDetail(type) {
      try {
        const res = await fetch('/details/' + type + '?secret=' + encodeURIComponent(SECRET) + getPhaseParams());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {
        console.error('Failed to fetch detail:', e);
        return null;
      }
    }

    function pct(n) { return n.toFixed(1) + '%'; }
    function num(n) { return n.toLocaleString(); }
    function shortId(id) { return id ? id.slice(0, 8) + '...' : '-'; }
    function fmtDate(ts) { return ts ? new Date(ts).toLocaleString() : '-'; }

    function renderOutcomeBar(outcomes, total) {
      if (total === 0) return '<div class="detail">No outcome responses yet</div>';
      const bar = ['calmer', 'clearer', 'hopeful', 'same', 'worse'].map(key => {
        const width = (outcomes[key] / total) * 100;
        if (width < 1) return '';
        return '<div class="outcome-' + key + '" style="width:' + width + '%">' + (width > 8 ? outcomes[key] : '') + '</div>';
      }).join('');
      return '<div class="outcome-bar">' + bar + '</div>' +
        '<div class="legend">' +
        '<span class="l-calmer">Calmer</span>' +
        '<span class="l-clearer">Clearer</span>' +
        '<span class="l-hopeful">Hopeful</span>' +
        '<span class="l-same">Same</span>' +
        '<span class="l-worse">Worse</span>' +
        '</div>';
    }

    let activeDetail = null;

    function render(kpis) {
      if (!kpis || kpis.totalEvents === 0) {
        document.getElementById('dashboard-content').innerHTML =
          '<div class="empty-state"><h2>No events received yet</h2><p>Deploy the app and start using it to see data here.</p></div>';
        return;
      }

      const totalModes = kpis.walletFirst + kpis.emotionFirst;
      const walletPct = totalModes > 0 ? (kpis.walletFirst / totalModes) * 100 : 0;
      const emotionPct = totalModes > 0 ? (kpis.emotionFirst / totalModes) * 100 : 0;

      document.getElementById('dashboard-content').innerHTML = \`
        <div class="grid">
          <div class="card" onclick="showDetail('users')">
            <h3>Active Unique Users</h3>
            <div class="value">\${num(kpis.uniqueUsers)}</div>
            <div class="detail">Any activity in this phase. Click for list. Not additive across phases.</div>
          </div>
          <div class="card">
            <h3>New Unique Users</h3>
            <div class="value">\${num(kpis.newUsers)}</div>
            <div class="detail">First joined in this phase (acquisition cohort). Additive across phases.</div>
          </div>
          <div class="card" onclick="window.open('/events?secret=' + encodeURIComponent(SECRET), '_blank')">
            <h3>Total Events</h3>
            <div class="value">\${num(kpis.totalEvents)}</div>
            <div class="detail">Click to view raw events</div>
          </div>
          <div class="card" onclick="showDetail('onboarding')">
            <h3>Onboarding Completion</h3>
            <div class="value">\${pct(kpis.onboardingRate)}</div>
            <div class="detail">Click for step breakdown</div>
          </div>
          <div class="card" onclick="showDetail('modes')">
            <h3>Mode Split</h3>
            <div class="value">\${pct(walletPct)} / \${pct(emotionPct)}</div>
            <div class="detail">Wallet-first vs Emotion-first (\${totalModes} selections)</div>
          </div>
          <div class="card" onclick="showDetail('tools')">
            <h3>Tool Completion Rate</h3>
            <div class="value">\${pct(kpis.toolCompletionRate)}</div>
            <div class="detail">\${num(kpis.toolCompleted)} completed / \${num(kpis.toolOpened)} opened</div>
          </div>
          <div class="card" onclick="showDetail('outcomes')">
            <h3>Outcome Positivity</h3>
            <div class="value">\${pct(kpis.outcomePositivity)}</div>
            \${renderOutcomeBar(kpis.outcomes, kpis.totalOutcomes)}
          </div>
          <div class="card" onclick="showDetail('platforms')">
            <h3>Platform Split</h3>
            <div class="value">\${num(kpis.iosUsers)} / \${num(kpis.androidUsers)}</div>
            <div class="detail">iOS / Android users — Click for details</div>
          </div>
        </div>

        <div class="section-title">Launch Success Metrics</div>
        <div class="grid">
          <div class="card" style="border-left: 4px solid \${kpis.launch.activationRate >= 70 ? '#4caf50' : kpis.launch.activationRate >= 50 ? '#ff9800' : '#e53935'}">
            <h3>Activation Rate</h3>
            <div class="value">\${pct(kpis.launch.activationRate)}</div>
            <div class="detail">\${kpis.launch.activatedUsers} of \${kpis.launch.totalUsers} users completed a tool within 48h</div>
            <div class="detail" style="margin-top:4px;font-size:0.75rem;color:\${kpis.launch.activationRate >= 70 ? '#4caf50' : '#6c757d'}">Target: 70%+</div>
          </div>
          <div class="card" style="border-left: 4px solid \${kpis.launch.weeklyEngagement >= 3 ? '#4caf50' : kpis.launch.weeklyEngagement >= 2 ? '#ff9800' : '#e53935'}">
            <h3>Weekly Engagement</h3>
            <div class="value">\${kpis.launch.weeklyEngagement.toFixed(1)}</div>
            <div class="detail">Avg card completions/user/week (last 14 days, \${kpis.launch.activeUsers14d} active users)</div>
            <div class="detail" style="margin-top:4px;font-size:0.75rem;color:\${kpis.launch.weeklyEngagement >= 3 ? '#4caf50' : '#6c757d'}">Target: 3+/week</div>
          </div>
          <div class="card" style="border-left: 4px solid \${phaseWindowDays() < 7 ? '#ddd' : kpis.launch.retentionD7Pct >= 40 ? '#4caf50' : kpis.launch.retentionD7Pct >= 25 ? '#ff9800' : '#e53935'}">
            <h3>D7 Retention</h3>
            <div class="value">\${retentionValue(kpis.launch.retentionD7Pct, 7)}</div>
            <div class="detail">Users returning within 7 days of install</div>
            <div class="detail" style="margin-top:4px;font-size:0.75rem;color:\${phaseWindowDays() < 7 ? '#999' : kpis.launch.retentionD7Pct >= 40 ? '#4caf50' : '#6c757d'}">\${phaseWindowDays() < 7 ? 'Window shorter than 7 days' : 'Target: 40%+'}</div>
          </div>
          <div class="card" style="border-left: 4px solid \${phaseWindowDays() < 30 ? '#ddd' : kpis.launch.retentionD30Pct >= 25 ? '#4caf50' : kpis.launch.retentionD30Pct >= 15 ? '#ff9800' : '#e53935'}">
            <h3>D30 Retention</h3>
            <div class="value">\${retentionValue(kpis.launch.retentionD30Pct, 30)}</div>
            <div class="detail">Users returning within 30 days of install</div>
            <div class="detail" style="margin-top:4px;font-size:0.75rem;color:\${phaseWindowDays() < 30 ? '#999' : kpis.launch.retentionD30Pct >= 25 ? '#4caf50' : '#6c757d'}">\${phaseWindowDays() < 30 ? 'Window shorter than 30 days' : 'Target: 25%+'}</div>
          </div>
          <div class="card">
            <h3>Share Taps</h3>
            <div class="value">\${num(kpis.launch.shareTaps)}</div>
            <div class="detail">Times users opened the share sheet</div>
          </div>
          <div class="card">
            <h3>Wallet Growth</h3>
            <div class="value">\${num(kpis.launch.usersWhoAddedTools)}</div>
            <div class="detail">Returning users who added new cards</div>
          </div>
        </div>

        <div id="detail-panel"></div>

        <div class="section-title">Retention (unique users by days since install)</div>
        <div class="detail" style="margin-bottom:8px;color:#6c757d;font-size:0.8rem;">
          These buckets count app opens by each event's <em>days since install</em>, within the selected phase window.
          They are not a tracked install cohort: the D7/D30 users can be different people from the D0 users.
          When a phase window is shorter than the bucket horizon, D7/D30 percentages show "n/a" because a returning user who installed earlier would otherwise inflate them.
        </div>
        <table>
          <thead>
            <tr><th>Bucket</th><th>Description</th><th>Unique Users</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>D0</strong></td><td>Install day</td><td>\${kpis.retention.D0}</td></tr>
            <tr><td><strong>D1</strong></td><td>Day 1 after install</td><td>\${kpis.retention.D1}</td></tr>
            <tr><td><strong>D7</strong></td><td>Within first 7 days</td><td>\${kpis.retention.D7}</td></tr>
            <tr><td><strong>D30</strong></td><td>Within first 30 days</td><td>\${kpis.retention.D30}</td></tr>
          </tbody>
        </table>
      \`;

      // Re-open detail panel if one was active
      if (activeDetail) {
        showDetail(activeDetail);
      }
    }

    async function showDetail(type) {
      activeDetail = type;
      const panel = document.getElementById('detail-panel');
      if (!panel) return;

      panel.innerHTML = '<div class="loading-detail">Loading...</div>';

      const data = await fetchDetail(type);
      if (!data) {
        panel.innerHTML = '<div class="detail-panel"><h3>Error loading data <button class="close-btn" onclick="closeDetail()">Close</button></h3></div>';
        return;
      }

      let html = '';

      if (type === 'users') {
        const users = Array.isArray(data) ? data : [];
        html = '<div class="detail-panel">' +
          '<h3>Unique Users (' + users.length + ') <button class="close-btn" onclick="closeDetail()">Close</button></h3>' +
          '<table><thead><tr><th>User ID</th><th>Platform</th><th>OS Version</th><th>Country</th><th>Events</th><th>First Seen</th><th>Last Seen</th></tr></thead><tbody>' +
          users.map(function(u) {
            return '<tr><td>' + shortId(u.anonymous_user_id) + '</td><td>' + (u.platform || '-') + '</td><td>' + (u.os_version || '-') + '</td><td>' + (u.country || '-') + '</td><td>' + u.event_count + '</td><td>' + fmtDate(u.first_seen) + '</td><td>' + fmtDate(u.last_seen) + '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      }

      if (type === 'onboarding') {
        html = '<div class="detail-panel">' +
          '<h3>Onboarding Details <button class="close-btn" onclick="closeDetail()">Close</button></h3>' +
          '<p style="margin-bottom:12px;">Users opened app: ' + data.usersOpened + ' | Completed onboarding: ' + data.usersCompleted + '</p>' +
          '<table><thead><tr><th>Step Name</th><th>Views</th></tr></thead><tbody>' +
          (data.steps || []).map(function(s) {
            return '<tr><td>' + (s.step_name || 'unknown') + '</td><td>' + s.views + '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      }

      if (type === 'modes') {
        const modes = Array.isArray(data) ? data : [];
        html = '<div class="detail-panel">' +
          '<h3>Mode Selections (' + modes.length + ') <button class="close-btn" onclick="closeDetail()">Close</button></h3>' +
          '<table><thead><tr><th>User ID</th><th>Mode</th><th>Timestamp</th></tr></thead><tbody>' +
          modes.map(function(m) {
            return '<tr><td>' + shortId(m.anonymous_user_id) + '</td><td>' + (m.mode || '-') + '</td><td>' + fmtDate(m.timestamp) + '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      }

      if (type === 'tools') {
        const tools = Array.isArray(data) ? data : [];
        html = '<div class="detail-panel">' +
          '<h3>Tool Completions by Card <button class="close-btn" onclick="closeDetail()">Close</button></h3>' +
          '<table><thead><tr><th>Card ID</th><th>Category</th><th>Completions</th><th>Avg Duration</th></tr></thead><tbody>' +
          tools.map(function(t) {
            var avgSec = t.avg_duration_ms ? Math.round(t.avg_duration_ms / 1000) + 's' : '-';
            return '<tr><td>' + (t.card_id ? t.card_id.slice(0, 20) : '-') + '</td><td>' + (t.card_category || '-') + '</td><td>' + t.completions + '</td><td>' + avgSec + '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      }

      if (type === 'outcomes') {
        const outcomes = Array.isArray(data) ? data : [];
        var total = outcomes.reduce(function(sum, o) { return sum + o.count; }, 0);
        html = '<div class="detail-panel">' +
          '<h3>Outcome Responses (' + total + ') <button class="close-btn" onclick="closeDetail()">Close</button></h3>' +
          '<table><thead><tr><th>Response</th><th>Count</th><th>Percentage</th></tr></thead><tbody>' +
          outcomes.map(function(o) {
            return '<tr><td>' + (o.response || '-') + '</td><td>' + o.count + '</td><td>' + (total > 0 ? (o.count / total * 100).toFixed(1) + '%' : '-') + '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      }

      if (type === 'platforms') {
        var platforms = (data && data.platforms) ? data.platforms : [];
        var osVersions = (data && data.osVersions) ? data.osVersions : [];
        var appVersions = (data && data.appVersions) ? data.appVersions : [];
        html = '<div class="detail-panel">' +
          '<h3>Platform & Version Breakdown <button class="close-btn" onclick="closeDetail()">Close</button></h3>' +
          '<p style="margin-bottom:12px;font-weight:600;">Platforms</p>' +
          '<table><thead><tr><th>Platform</th><th>Unique Users</th><th>Total Events</th></tr></thead><tbody>' +
          platforms.map(function(p) {
            return '<tr><td>' + (p.platform || 'unknown') + '</td><td>' + p.users + '</td><td>' + p.events + '</td></tr>';
          }).join('') +
          '</tbody></table>' +
          '<p style="margin:16px 0 12px;font-weight:600;">OS Versions</p>' +
          '<table><thead><tr><th>Platform</th><th>OS Version</th><th>Unique Users</th></tr></thead><tbody>' +
          osVersions.map(function(o) {
            return '<tr><td>' + (o.platform || '-') + '</td><td>' + (o.os_version || '-') + '</td><td>' + o.users + '</td></tr>';
          }).join('') +
          '</tbody></table>' +
          '<p style="margin:16px 0 12px;font-weight:600;">App Versions</p>' +
          '<table><thead><tr><th>App Version</th><th>Unique Users</th><th>Total Events</th></tr></thead><tbody>' +
          appVersions.map(function(v) {
            return '<tr><td>' + (v.app_version || '-') + '</td><td>' + v.users + '</td><td>' + v.events + '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      }

      panel.innerHTML = html;
    }

    function closeDetail() {
      activeDetail = null;
      var panel = document.getElementById('detail-panel');
      if (panel) panel.innerHTML = '';
    }

    async function refresh() {
      const kpis = await fetchKPIs();
      render(kpis);
      document.getElementById('last-updated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
    }

    async function clearEvents() {
      if (!confirm('Clear ALL analytics events? This cannot be undone.')) return;
      try {
        await fetch('/events?secret=' + encodeURIComponent(SECRET), { method: 'DELETE' });
        closeDetail();
        await refresh();
      } catch (e) {
        alert('Failed to clear events: ' + e.message);
      }
    }

    refresh();
    fetchMilestones();
    setInterval(refresh, 30000);
  </script>
</body>
</html>`;
