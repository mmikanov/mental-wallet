#!/usr/bin/env node
/*
 * capture-tip-gif.js — turn a CSS/HTML tip animation into an email-ready GIF + poster PNG.
 *
 * WHY: The website renders tip animations with CSS (full fidelity, loops). Email clients do
 * NOT run CSS keyframes/JS — but they DO autoplay animated GIFs in a plain <img>, and the
 * tip email already renders `heroImage` as an <img>. So the path to "motion in email" is:
 * render the same CSS animation in headless Chrome, record one loop as frames, and encode a
 * GIF. Outlook (desktop) shows only the GIF's first frame, so we also emit a poster PNG and
 * design the animation's frame 1 to stand alone.
 *
 * This is DEV-ONLY tooling (never shipped to users). Run it when you add/update a tip's
 * web animation to regenerate its email/feed asset.
 *
 * USAGE:
 *   node tools/capture-tip-gif.js \
 *     --in assets/tip-media/welcome-wallet.html \
 *     --out assets/tip-media/welcome-wallet \
 *     [--selector ".tip-anim"] [--width 360] [--fps 20] [--duration 6000] [--start 200]
 *
 * OUTPUTS (given --out <base>):
 *   <base>.gif    animated GIF (email heroImage / in-app feed)
 *   <base>.png    poster = first captured frame (static fallback + og image)
 *
 * REQUIREMENTS:
 *   - Node 18+
 *   - puppeteer            (headless Chrome; renders the CSS exactly like the browser)
 *   - ffmpeg on PATH       (preferred GIF encoder — best palette/size). If ffmpeg is not
 *                           found, the script still writes the PNG frames and the poster,
 *                           and prints the exact ffmpeg command to run manually.
 *
 * INSTALL (dev deps, in website/):
 *   npm i -D puppeteer
 *   # ffmpeg: `brew install ffmpeg` (macOS) or your platform's package manager.
 *
 * NOTES:
 *   - --duration should match ONE full loop of the animation (welcome = 6000ms).
 *   - --start skips the very first paint so we begin mid-motion cleanly (ms).
 *   - We force-enable motion by emulating "prefers-reduced-motion: no-preference" so the
 *     capture animates even if the host OS has reduce-motion on.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const inPath = args.in;
  const outBase = args.out;
  if (!inPath || !outBase) {
    console.error('Missing required --in <html> and --out <base>. See header for usage.');
    process.exit(1);
  }

  const selector = args.selector || '.tip-anim';
  const width = parseInt(args.width || '360', 10);
  const fps = parseInt(args.fps || '20', 10);
  const duration = parseInt(args.duration || '6000', 10); // one full loop
  const start = parseInt(args.start || '200', 10); // skip initial paint (ms)
  const scale = parseInt(args.scale || '2', 10); // deviceScaleFactor for crisp output

  // Puppeteer's bundled Chromium download is sometimes incomplete/corrupt (a tiny binary
  // that fails to spawn with "Unknown system error -88"). Prefer an explicit Chrome:
  //   --executable "/path/to/Chrome"  or  PUPPETEER_EXECUTABLE_PATH=...
  // Otherwise fall back to a system Google Chrome, then to Puppeteer's bundled one.
  const SYSTEM_CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ];
  function resolveExecutablePath() {
    if (args.executable) return args.executable;
    if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
    for (const c of SYSTEM_CHROME_CANDIDATES) {
      if (fs.existsSync(c)) return c;
    }
    return undefined; // let puppeteer use its bundled Chromium
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.error('puppeteer is not installed. Run:  npm i -D puppeteer');
    process.exit(1);
  }

  const absIn = path.resolve(process.cwd(), inPath);
  if (!fs.existsSync(absIn)) {
    console.error(`Input HTML not found: ${absIn}`);
    process.exit(1);
  }

  const absOutBase = path.resolve(process.cwd(), outBase);
  const outDir = path.dirname(absOutBase);
  fs.mkdirSync(outDir, { recursive: true });

  // Temp dir for frames
  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tip-frames-'));

  const frameCount = Math.round((duration / 1000) * fps);
  const frameInterval = 1000 / fps;

  console.log(`Capturing "${selector}" from ${inPath}`);
  console.log(`  ${frameCount} frames @ ${fps}fps over ${duration}ms (start +${start}ms)`);

  const executablePath = resolveExecutablePath();
  if (executablePath) {
    console.log(`  chrome: ${executablePath}`);
  }
  const browser = await puppeteer.launch({
    headless: 'new',
    ...(executablePath ? { executablePath } : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: width + 40, height: 400, deviceScaleFactor: scale });
    // Force motion on regardless of host OS reduce-motion setting.
    await page.emulateMediaFeatures([
      { name: 'prefers-reduced-motion', value: 'no-preference' },
    ]);

    await page.goto('file://' + absIn, { waitUntil: 'networkidle0' });
    const el = await page.$(selector);
    if (!el) {
      throw new Error(`Selector not found on page: ${selector}`);
    }

    // Let the initial delay pass so we start mid-loop cleanly.
    await new Promise((r) => setTimeout(r, start));

    const framePaths = [];
    for (let i = 0; i < frameCount; i++) {
      const framePath = path.join(framesDir, `frame-${String(i).padStart(4, '0')}.png`);
      await el.screenshot({ path: framePath });
      framePaths.push(framePath);
      await new Promise((r) => setTimeout(r, frameInterval));
    }

    // Poster = first frame (this is what Outlook/static clients show).
    fs.copyFileSync(framePaths[0], absOutBase + '.png');
    console.log(`  poster: ${outBase}.png`);

    // Encode GIF with ffmpeg (best quality via a generated palette).
    const gifPath = absOutBase + '.gif';
    const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
    if (hasFfmpeg) {
      const palette = path.join(framesDir, 'palette.png');
      const inputPattern = path.join(framesDir, 'frame-%04d.png');
      // 1) build an optimized palette, 2) encode looping GIF using it
      const p1 = spawnSync('ffmpeg', [
        '-y', '-framerate', String(fps), '-i', inputPattern,
        '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`,
        palette,
      ], { stdio: 'inherit' });
      if (p1.status !== 0) throw new Error('ffmpeg palettegen failed');

      const p2 = spawnSync('ffmpeg', [
        '-y', '-framerate', String(fps), '-i', inputPattern, '-i', palette,
        '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
        '-loop', '0',
        gifPath,
      ], { stdio: 'inherit' });
      if (p2.status !== 0) throw new Error('ffmpeg paletteuse failed');

      const sizeKb = Math.round(fs.statSync(gifPath).size / 1024);
      console.log(`  gif: ${outBase}.gif (${sizeKb} KB)`);
      if (sizeKb > 1024) {
        console.warn('  ⚠ GIF > 1MB. Consider lowering --fps, --width, or --duration for email.');
      }
    } else {
      // No ffmpeg: keep the frames and print the exact command to finish manually.
      const keepDir = absOutBase + '-frames';
      fs.rmSync(keepDir, { recursive: true, force: true });
      fs.cpSync(framesDir, keepDir, { recursive: true });
      console.warn('\nffmpeg not found on PATH. PNG frames written to:');
      console.warn(`  ${path.relative(process.cwd(), keepDir)}`);
      console.warn('\nInstall ffmpeg (macOS: brew install ffmpeg), then run:');
      console.warn(`  ffmpeg -framerate ${fps} -i "${keepDir}/frame-%04d.png" -vf "fps=${fps},scale=${width}:-1:flags=lanczos,palettegen" "${keepDir}/palette.png"`);
      console.warn(`  ffmpeg -framerate ${fps} -i "${keepDir}/frame-%04d.png" -i "${keepDir}/palette.png" -lavfi "fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse" -loop 0 "${gifPath}"`);
    }
  } finally {
    await browser.close();
    fs.rmSync(framesDir, { recursive: true, force: true });
  }

  console.log('\nDone. Use the .gif as the tip\'s heroImage for email; the .png is the static fallback/poster.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
