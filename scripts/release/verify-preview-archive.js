const tar = require('tar');

function normalizeArchivePath(value) {
  const path = String(value || '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (!path || path === '.') return '';
  return path;
}

/** @param {Array<{path: string, type: string, mode: number}>} entries @param {Map<string, number> | null} [expectedModes=null] */
function validateArchiveEntries(entries, expectedModes = null) {
  const errors = [];
  const seen = new Set();
  const byPath = new Map();

  for (const entry of entries) {
    const path = normalizeArchivePath(entry.path);
    if (!path) continue;
    if (path.startsWith('/') || /^[a-z]:\//i.test(path) || path.split('/').includes('..')) {
      errors.push(`ARCHIVE_PATH_TRAVERSAL:${entry.path}`);
      continue;
    }
    if (seen.has(path)) errors.push(`ARCHIVE_DUPLICATE_PATH:${path}`);
    seen.add(path);
    byPath.set(path, entry);
    if ((Number(entry.mode) & 0o002) !== 0) errors.push(`ARCHIVE_WORLD_WRITABLE_ENTRY:${path}`);
    if (expectedModes && expectedModes.has(path) && (Number(entry.mode) & 0o777) !== expectedModes.get(path)) {
      errors.push(`ARCHIVE_MODE_NOT_PRESERVED:${path}`);
    }
  }

  const required = [
    ['server.js', 'File'],
    ['.next/BUILD_ID', 'File'],
    ['.next/static', 'Directory'],
    ['public', 'Directory'],
    ['release-manifest.json', 'File'],
  ];
  for (const [path, expectedType] of required) {
    const entry = byPath.get(path);
    if (!entry) errors.push(`ARCHIVE_REQUIRED_PATH_MISSING:${path}`);
    else if (entry.type !== expectedType) errors.push(`ARCHIVE_REQUIRED_PATH_TYPE_INVALID:${path}`);
  }
  return errors;
}

async function inspectArchive(file) {
  const entries = [];
  await tar.t({
    file,
    strict: true,
    onentry(entry) {
      entries.push({ path: entry.path, type: entry.type, mode: entry.mode });
    },
  });
  return entries;
}

async function inspectSourceModes(root) {
  const fs = require('node:fs/promises');
  const pathModule = require('node:path');
  const modes = new Map();
  async function visit(directory) {
    for (const name of await fs.readdir(directory)) {
      const absolute = pathModule.join(directory, name);
      const relative = pathModule.relative(root, absolute).split(pathModule.sep).join('/');
      const stat = await fs.lstat(absolute);
      modes.set(relative, stat.mode & 0o777);
      if (stat.isDirectory()) await visit(absolute);
    }
  }
  await visit(root);
  return modes;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('ARCHIVE_PATH_REQUIRED');
  const sourceRoot = process.argv[3];
  if (!sourceRoot) throw new Error('ARCHIVE_SOURCE_ROOT_REQUIRED');
  const entries = await inspectArchive(file);
  const sourceModes = await inspectSourceModes(sourceRoot);
  const errors = validateArchiveEntries(entries, sourceModes);
  const archivePaths = new Set(entries.map((entry) => normalizeArchivePath(entry.path)).filter(Boolean));
  for (const path of sourceModes.keys()) {
    if (!archivePaths.has(path)) errors.push(`ARCHIVE_SOURCE_PATH_MISSING:${path}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`ARCHIVE_ENTRIES=${entries.length}`);
  console.log('ARCHIVE_LAYOUT_AND_MODES=PASS');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`PREVIEW_ARCHIVE_INVALID:${error instanceof Error ? error.message : 'unknown'}`);
    process.exitCode = 1;
  });
}

module.exports = { normalizeArchivePath, validateArchiveEntries, inspectArchive, inspectSourceModes };
