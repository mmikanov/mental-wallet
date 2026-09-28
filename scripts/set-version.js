#!/usr/bin/env node
/**
 * set-version.js — single-command marketing-version bump for the bare workflow.
 *
 * This project commits the native ios/ and android/ folders, so the marketing
 * version lives in 4 places that must stay identical (Apple rejects a duplicate
 * CFBundleShortVersionString, and mismatches cause confusing store states).
 * This script writes all of them (plus package.json) from one argument.
 *
 * Build numbers (iOS buildNumber / CURRENT_PROJECT_VERSION, Android versionCode)
 * are intentionally NOT touched — EAS autoIncrement manages those.
 *
 * Usage:
 *   node scripts/set-version.js 1.0.5
 *   npm run set-version -- 1.0.5
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/set-version.js <version>  (e.g. 1.0.5)');
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version "${version}". Expected semver like 1.0.5 (major.minor.patch).`);
  process.exit(1);
}

/** Read a file, apply a replacer, write it back only if changed. Returns a status string. */
function edit(relPath, label, replacer) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ ${label}: file not found at ${relPath}`);
    process.exitCode = 1;
    return;
  }
  const before = fs.readFileSync(filePath, 'utf8');
  const after = replacer(before);
  if (after == null) {
    console.error(`  ✗ ${label}: could not find version to replace in ${relPath}`);
    process.exitCode = 1;
    return;
  }
  if (after === before) {
    console.log(`  = ${label}: already ${version}`);
    return;
  }
  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`  ✓ ${label}: set to ${version}`);
}

console.log(`Setting marketing version to ${version} across all files...`);

// 1. app.json  ->  expo.version
edit('app.json', 'app.json (expo.version)', (src) => {
  const re = /("version"\s*:\s*")(\d+\.\d+\.\d+)(")/;
  return re.test(src) ? src.replace(re, `$1${version}$3`) : null;
});

// 2. ios/MentalWallet/Info.plist  ->  CFBundleShortVersionString
edit('ios/MentalWallet/Info.plist', 'Info.plist (CFBundleShortVersionString)', (src) => {
  const re = /(<key>CFBundleShortVersionString<\/key>\s*<string>)(\d+\.\d+\.\d+)(<\/string>)/;
  return re.test(src) ? src.replace(re, `$1${version}$3`) : null;
});

// 3. ios/MentalWallet.xcodeproj/project.pbxproj  ->  MARKETING_VERSION (Debug + Release)
edit('ios/MentalWallet.xcodeproj/project.pbxproj', 'project.pbxproj (MARKETING_VERSION x2)', (src) => {
  const re = /(MARKETING_VERSION = )(\d+\.\d+\.\d+)(;)/g;
  return re.test(src) ? src.replace(re, `$1${version}$3`) : null;
});

// 4. android/app/build.gradle  ->  versionName
edit('android/app/build.gradle', 'build.gradle (versionName)', (src) => {
  const re = /(versionName\s+")(\d+\.\d+\.\d+)(")/;
  return re.test(src) ? src.replace(re, `$1${version}$3`) : null;
});

// 5. package.json  ->  version (kept in sync for tidiness; not used by the build)
edit('package.json', 'package.json (version)', (src) => {
  const re = /("version"\s*:\s*")(\d+\.\d+\.\d+)(")/;
  return re.test(src) ? src.replace(re, `$1${version}$3`) : null;
});

if (process.exitCode) {
  console.error('\nOne or more files failed. Fix the above and re-run.');
} else {
  console.log(`\nDone. All version fields set to ${version}. Build numbers were left untouched (EAS autoIncrement handles those).`);
}
