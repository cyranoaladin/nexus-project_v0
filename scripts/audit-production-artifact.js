const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] ?? '.next/standalone');
const allowedTopLevel = new Set([
  '.next',
  'Nexus_Reussite_Accueil.html',
  'data',
  'docs',
  'lib',
  'node_modules',
  'package.json',
  'programmes',
  'public',
  'server.js',
  'src',
]);
const forbiddenPath = /(^|\/)(e2e|__tests__|playwright-report|test-results|\.worktrees|storage)(\/|$)|(^|\/)\.env(?:\.|$)|\.(pem|key|p12|patch|log)$/i;
const forbiddenPackage = /(^|\/)node_modules\/(?:@emnapi\/runtime|@img\/sharp-wasm32)(\/|$)/;
const findings = [];
function walk(directory, isRoot = false) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath).split(path.sep).join('/');
    if (isRoot && !allowedTopLevel.has(entry.name)) {
      findings.push({ path: relativePath, reason: 'top-level path is not allowlisted' });
      continue;
    }
    if (
      forbiddenPath.test(relativePath) ||
      forbiddenPackage.test(relativePath) ||
      entry.name === 'canonical-bilans-pack.json' ||
      /^docker-compose.*\.ya?ml$/i.test(entry.name)
    ) {
      findings.push({ path: relativePath, reason: 'forbidden production content' });
      continue;
    }
    if (entry.isDirectory()) walk(fullPath);
  }
}
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  process.stderr.write(`Standalone artifact directory does not exist: ${root}\n`);
  process.exit(1);
}
walk(root, true);
const report = {
  root,
  allowedTopLevel: [...allowedTopLevel].sort(),
  findings: findings.sort((left, right) => left.path.localeCompare(right.path)),
  passed: findings.length === 0,
};
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
