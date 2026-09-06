/**
 * Seed the messaging store from the warm-launch opt-ins.
 *
 * Reads the LOCAL, gitignored docs/warm-launch-messages.md, extracts each
 * interviewee's first name + email (from the section headers) and their
 * mailing-list opt-in status (from the tracking table), and subscribes every
 * OPTED-IN person to BOTH scopes via the worker's /subscribe endpoint with
 * source='warm_launch'.
 *
 * This runs LOCALLY and never commits PII into the repo. It talks to the
 * worker over HTTP, reusing the validated upsert logic (no direct D1 writes).
 *
 * Usage:
 *   MESSAGING_BASE_URL=https://mental-wallet-messaging.<subdomain>.workers.dev \
 *   WARM_LAUNCH_FILE=../docs/warm-launch-messages.md \
 *   npm run seed:warm-launch
 *
 * For a local dev worker, set MESSAGING_BASE_URL=http://localhost:8787.
 * Add DRY_RUN=1 to print what would be sent without calling the endpoint.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Interviewee {
  id: number; // the tN number
  firstName: string;
  email: string;
}

const DEFAULT_FILE = resolve(__dirname, '../../docs/warm-launch-messages.md');
const filePath = resolve(process.cwd(), process.env.WARM_LAUNCH_FILE || DEFAULT_FILE);
const baseUrl = process.env.MESSAGING_BASE_URL;
const dryRun = process.env.DRY_RUN === '1';

if (!baseUrl && !dryRun) {
  console.error('Set MESSAGING_BASE_URL (or DRY_RUN=1 to preview).');
  process.exit(1);
}

const md = readFileSync(filePath, 'utf8');

// --- Parse section headers: "## 1. Gus Gray — ... — email: gus@..." ---
// First name = first whitespace-delimited token of the display name.
const headerRe = /^##\s+(\d+)\.\s+(.+?)\s+—.*?email:\s*([^\s]+@[^\s]+)/gim;
const byId = new Map<number, Interviewee>();
let m: RegExpExecArray | null;
while ((m = headerRe.exec(md)) !== null) {
  const id = parseInt(m[1], 10);
  const displayName = m[2].trim();
  const firstName = displayName.split(/\s+/)[0];
  const email = m[3].trim().toLowerCase();
  byId.set(id, { id, firstName, email });
}

// --- Parse the tracking table for opt-in status ---
// Rows look like: | 1 | [Gus Gray](#t1) | ... | ✅ opted in |
// The mailing-list column is the LAST cell. Opted in = contains ✅.
const optedIn = new Set<number>();
for (const line of md.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) continue;
  const cells = trimmed.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
  if (cells.length < 2) continue;
  const idNum = parseInt(cells[0], 10);
  if (Number.isNaN(idNum)) continue; // skip header/separator rows
  const mailingCell = cells[cells.length - 1];
  if (mailingCell.includes('✅')) optedIn.add(idNum);
}

// --- Build the seed list: opted-in people we also have an email for ---
const toSeed: Interviewee[] = [];
for (const id of optedIn) {
  const person = byId.get(id);
  if (person) toSeed.push(person);
}

if (toSeed.length === 0) {
  console.log('No opted-in interviewees found. Nothing to seed.');
  process.exit(0);
}

console.log(`Found ${toSeed.length} opted-in subscriber(s) to seed (both scopes):`);
for (const p of toSeed) console.log(`  - ${p.firstName} <${p.email}>`);

if (dryRun) {
  console.log('\nDRY_RUN=1 — no requests sent.');
  process.exit(0);
}

async function main() {
  let ok = 0;
  let failed = 0;
  for (const p of toSeed) {
    const res = await fetch(`${baseUrl!.replace(/\/$/, '')}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: p.email,
        first_name: p.firstName,
        reminders: true,
        tips: true,
        source: 'warm_launch',
      }),
    });
    if (res.ok) {
      ok++;
    } else {
      failed++;
      console.error(`  ✗ ${p.email}: ${res.status} ${await res.text()}`);
    }
  }
  console.log(`\nDone. Subscribed: ${ok}, failed: ${failed}.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
