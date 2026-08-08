/**
 * generate-licenses.js
 *
 * Reads production dependencies from package.json, extracts license info
 * from node_modules, and outputs src/data/licenses.json.
 *
 * Usage: node scripts/generate-licenses.js
 */

const fs = require('fs');
const path = require('path');

// ─── Configurable exclusion list ─────────────────────────────────────────────
// Packages listed here are in "dependencies" but don't ship in the production
// binary (e.g., dev tooling that Expo bundles separately).
const EXCLUDED_PACKAGES = ['expo-dev-client', '@expo/ngrok'];

// ─── Paths ───────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const NODE_MODULES = path.join(ROOT, 'node_modules');
const OUTPUT_PATH = path.join(ROOT, 'src', 'data', 'licenses.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Try to read a LICENSE file from a package directory.
 * Checks common filename variants.
 */
function readLicenseFile(pkgDir) {
  const variants = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt'];
  for (const filename of variants) {
    const filePath = path.join(pkgDir, filename);
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      // File doesn't exist, try next variant
    }
  }
  return '';
}

/**
 * Extract copyright line from license text, or fall back to the author field.
 */
function extractCopyright(licenseText, author) {
  if (licenseText) {
    // Look for common copyright patterns
    const lines = licenseText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^copyright/i.test(trimmed) || /^\(c\)/i.test(trimmed) || /^©/.test(trimmed)) {
        return trimmed;
      }
    }
  }

  // Fall back to author field
  if (!author) return '';
  if (typeof author === 'string') return author;
  if (typeof author === 'object' && author.name) {
    return author.email ? `${author.name} <${author.email}>` : author.name;
  }
  return '';
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const dependencies = Object.keys(packageJson.dependencies || {});

  const packages = [];

  for (const dep of dependencies) {
    if (EXCLUDED_PACKAGES.includes(dep)) {
      continue;
    }

    // Handle scoped packages (e.g., @react-navigation/native)
    const pkgDir = path.join(NODE_MODULES, ...dep.split('/'));
    const pkgJsonPath = path.join(pkgDir, 'package.json');

    try {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      const licenseText = readLicenseFile(pkgDir);
      const copyright = extractCopyright(licenseText, pkgJson.author);

      packages.push({
        name: dep,
        version: pkgJson.version || '',
        license: pkgJson.license || 'UNKNOWN',
        copyright,
        licenseText,
      });
    } catch {
      // Package not found in node_modules — skip gracefully
      console.warn(`Warning: Could not read package info for "${dep}", skipping.`);
    }
  }

  // Sort alphabetically by name
  packages.sort((a, b) => a.name.localeCompare(b.name));

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  const output = JSON.stringify({ packages }, null, 2);
  fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');

  console.log(`Generated licenses for ${packages.length} packages → src/data/licenses.json`);
}

main();
