/**
 * Country code -> English display name, used by the Worker's users sort so a capped list is
 * ordered by the NAME the dashboard shows. The browser has an equivalent copy inside
 * USERS_SORT_JS (usersTableClient.ts); users-sort.test.ts checks the two agree.
 *
 * null / empty -> em dash; Cloudflare special codes XX (unknown) and T1 (Tor) get friendly
 * labels; if Intl.DisplayNames throws or just echoes the code, the raw (upper-cased) code wins.
 */
const SPECIAL: Record<string, string> = { XX: 'Unknown', T1: 'Tor network' };
let fmt: Intl.DisplayNames | null = null;

export function countryName(code: string | null | undefined): string {
  if (code === null || code === undefined) return '\u2014';
  const c = String(code).trim().toUpperCase();
  if (c === '') return '\u2014';
  if (SPECIAL[c]) return SPECIAL[c];
  try {
    if (!fmt) fmt = new Intl.DisplayNames(['en'], { type: 'region' });
    const n = fmt.of(c);
    return n && n !== c ? n : c;
  } catch {
    return c;
  }
}
