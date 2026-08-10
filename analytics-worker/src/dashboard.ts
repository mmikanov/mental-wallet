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
  <title>Analytics Dashboard — Mental Wallet</title>
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
  </style>
</head>
<body>
  <h1>Analytics Dashboard</h1>
  <p class="subtitle">Mental Wallet — Production</p>

  <div class="status-bar">
    <span class="dot"></span>
    <span>Auto-refreshing every 30 seconds</span>
    <span id="last-updated" style="margin-left: auto;"></span>
  </div>

  <div id="dashboard-content">
    <div class="empty-state"><p>Loading...</p></div>
  </div>

  <div class="actions">
    <button onclick="clearEvents()">Clear All Events</button>
  </div>

  <script>
    const SECRET = '__DASHBOARD_SECRET__';

    async function fetchKPIs() {
      try {
        const res = await fetch('/kpis?secret=' + encodeURIComponent(SECRET));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {
        console.error('Failed to fetch KPIs:', e);
        return null;
      }
    }

    async function fetchDetail(type) {
      try {
        const res = await fetch('/details/' + type + '?secret=' + encodeURIComponent(SECRET));
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
            <h3>Unique Users</h3>
            <div class="value">\${num(kpis.uniqueUsers)}</div>
            <div class="detail">Click to view user list</div>
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

        <div id="detail-panel"></div>

        <div class="section-title">Retention (unique users by days since install)</div>
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
          '<table><thead><tr><th>User ID</th><th>Events</th><th>First Seen</th><th>Last Seen</th></tr></thead><tbody>' +
          users.map(function(u) {
            return '<tr><td>' + shortId(u.anonymous_user_id) + '</td><td>' + u.event_count + '</td><td>' + fmtDate(u.first_seen) + '</td><td>' + fmtDate(u.last_seen) + '</td></tr>';
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
    setInterval(refresh, 30000);
  </script>
</body>
</html>`;
