/**
 * Manual Jest mock for expo-file-system (the new `Paths`/`Directory`/`File` API).
 *
 * The real module touches native filesystem APIs that don't exist under jest-expo:
 * `Paths.cache` is undefined, so `new Directory(Paths.cache, ...)` throws. That crash
 * happened at MODULE LOAD in ThirdPartyIcon, taking down every suite whose import graph
 * reached it. ThirdPartyIcon now constructs the cache dir lazily, but this mock also lets
 * component tests import/exercise the module cleanly.
 *
 * Stubs mirror only the surface ThirdPartyIcon uses: Paths.cache, Directory
 * (exists/create), File (exists/uri + static downloadFileAsync). Kept intentionally
 * minimal — extend if other code starts using more of the API in tests.
 */

const Paths = {
  cache: 'file:///mock-cache/',
  document: 'file:///mock-documents/',
};

class Directory {
  constructor(parent, name) {
    const base = typeof parent === 'string' ? parent : (parent && parent.uri) || 'file:///mock/';
    this.uri = name ? `${base}${name}/` : base;
    // Default to "already exists" so tests don't attempt creation unless they opt in.
    this.exists = true;
  }
  create() {
    this.exists = true;
  }
}

class File {
  constructor(parent, name) {
    const base = typeof parent === 'string' ? parent : (parent && parent.uri) || 'file:///mock/';
    this.uri = name ? `${base}${name}` : base;
    // Default to "not cached" so the resolve path exercises the download branch.
    this.exists = false;
  }
  static async downloadFileAsync(_uri, targetFile) {
    // Simulate a successful download: the target now exists.
    if (targetFile) targetFile.exists = true;
    return targetFile;
  }
}

module.exports = { Paths, Directory, File };
