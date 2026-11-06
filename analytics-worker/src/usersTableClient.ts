/**
 * Browser-side sort for the Users drill-down table, shipped to the dashboard as a plain-JS
 * string (interpolated into DASHBOARD_HTML) so the EXACT code that runs in the browser is also
 * what the unit tests evaluate (see users-sort.test.ts, which runs it through new Function and
 * checks parity with the server comparators in usersQuery.ts).
 *
 * Constraints: no backticks, no dollar-brace sequences, no backslashes (it lives inside a
 * template literal). Missing values (null / '' ) sort last in BOTH directions. Versions compare
 * numerically per dotted segment (1.0.10 > 1.0.9); timestamps compare as instants; Events
 * compares numerically; everything else is a case-insensitive string compare.
 */
export const USERS_SORT_JS = `
    // Default direction when a column header is first clicked: counts, dates and versions start
    // newest/highest first; text columns start A-Z.
    var USERS_DESC_FIRST = { event_count: 1, first_seen: 1, last_seen: 1, first_version: 1, latest_version: 1 };
    function usersDefaultDir(key) { return USERS_DESC_FIRST[key] ? 'desc' : 'asc'; }

    function cmpVersionStr(a, b) {
      var pa = String(a).split('.').map(function(x) { return parseInt(x, 10) || 0; });
      var pb = String(b).split('.').map(function(x) { return parseInt(x, 10) || 0; });
      var n = Math.max(pa.length, pb.length);
      for (var i = 0; i < n; i++) {
        var d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d;
      }
      return 0;
    }
    function cmpText(a, b) { return String(a == null ? '' : a).toLowerCase().localeCompare(String(b == null ? '' : b).toLowerCase()); }

    function usersValue(key, r) { return key === 'user' ? r.anonymous_user_id : r[key]; }
    function usersCompare(key, a, b) {
      if (key === 'event_count') return Number(a.event_count) - Number(b.event_count);
      if (key === 'first_seen' || key === 'last_seen') return new Date(a[key]).getTime() - new Date(b[key]).getTime();
      if (key === 'first_version') return cmpVersionStr(a.first_version, b.first_version) || cmpText(a.first_platform, b.first_platform);
      if (key === 'latest_version') return cmpVersionStr(a.latest_version, b.latest_version) || cmpText(a.platform, b.platform);
      return cmpText(usersValue(key, a), usersValue(key, b));
    }
    // Stable sort, returns a new array.
    function sortUsersRows(rows, key, dir) {
      var sign = dir === 'asc' ? 1 : -1;
      return rows.map(function(r, i) { return { r: r, i: i }; }).sort(function(x, y) {
        var vx = usersValue(key, x.r), vy = usersValue(key, y.r);
        var mx = vx === null || vx === undefined || vx === '';
        var my = vy === null || vy === undefined || vy === '';
        if (mx || my) return mx && my ? x.i - y.i : (mx ? 1 : -1);
        return (sign * usersCompare(key, x.r, y.r)) || (x.i - y.i);
      }).map(function(x) { return x.r; });
    }
`;
