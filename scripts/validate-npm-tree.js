#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

const treePath = option('--tree');
const exceptionsPath = option('--exceptions');
const artifactPath = option('--artifact');

if (!treePath || !exceptionsPath) {
  fail('Usage: validate-npm-tree.js --tree <npm-ls.json> --exceptions <exceptions.json> [--artifact <standalone-dir>]');
  process.exit();
}

const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
const exceptionsDocument = JSON.parse(fs.readFileSync(exceptionsPath, 'utf8'));

// --- Schema validation for exceptions document ---
const requiredExceptionFields = ['type', 'name', 'version', 'path', 'reason', 'upstreamIssue', 'platform', 'artifactAllowed', 'expiresOn'];
const requiredPlatformFields = ['node', 'npm', 'os', 'arch'];

if (typeof exceptionsDocument.schemaVersion !== 'number' || exceptionsDocument.schemaVersion !== 1) {
  fail(`exceptions document must have schemaVersion: 1, got ${exceptionsDocument.schemaVersion}`);
}

for (const exception of exceptionsDocument.exceptions || []) {
  for (const field of requiredExceptionFields) {
    if (exception[field] === undefined || exception[field] === null) {
      fail(`exception ${exception.name || '(unknown)'} missing required field: ${field}`);
    }
  }
  if (exception.platform) {
    for (const field of requiredPlatformFields) {
      if (!exception.platform[field]) {
        fail(`exception ${exception.name} platform missing: ${field}`);
      }
    }
  }
}

const rootPath = path.resolve(tree.path || process.cwd());
const findings = [];
const rootProblems = tree.problems || [];

function visit(node, parent, dependencyName) {
  if (!node || typeof node !== 'object') return;
  for (const type of ['extraneous', 'missing', 'invalid']) {
    if (node[type] === true) {
      const absolutePath = node.path || '';
      findings.push({
        type,
        name: node.name || dependencyName || path.basename(absolutePath),
        version: node.version || '',
        path: absolutePath ? path.relative(rootPath, absolutePath) : '',
        dependent: parent?.name || null,
      });
    }
  }
  for (const [name, child] of Object.entries(node.dependencies || {})) visit(child, node, name);
}

visit(tree, null, tree.name);

for (const problem of rootProblems) {
  const representedByFinding = findings.some((finding) => problem.includes(`${finding.type}: ${finding.name}@${finding.version}`));
  if (!representedByFinding) {
    findings.push({ type: 'root-problem', name: 'root', version: '', path: '', dependent: null, problem });
  }
}

const allowed = exceptionsDocument.exceptions || [];
const today = new Date().toISOString().slice(0, 10);
const currentPlatform = {
  node: process.versions.node,
  npm: execFileSync(process.env.npm_execpath ? process.execPath : 'npm', process.env.npm_execpath
    ? [process.env.npm_execpath, '--version']
    : ['--version'], { encoding: 'utf8' }).trim(),
  os: os.platform(),
  arch: os.arch(),
};

// Validate each exception declaration
for (const exception of allowed) {
  if (exception.expiresOn < today) fail(`npm tree exception expired on ${exception.expiresOn}`);
  if (exception.artifactAllowed !== false) fail(`npm tree exception must set artifactAllowed=false: ${exception.name}`);
  for (const [key, value] of Object.entries(currentPlatform)) {
    if (exception.platform?.[key] !== value) {
      fail(`npm tree exception platform mismatch for ${key}: expected ${exception.platform?.[key]}, got ${value}`);
    }
  }
}

// Match findings to exceptions
const usedExceptions = new Set();
const unmatched = [];

for (const finding of findings) {
  const matchIdx = allowed.findIndex((exception) =>
    exception.type === finding.type &&
    exception.name === finding.name &&
    exception.version === finding.version &&
    exception.path === finding.path &&
    exception.expiresOn >= today,
  );
  if (matchIdx === -1) {
    unmatched.push(finding);
  } else {
    usedExceptions.add(matchIdx);
  }
}

// Core rules:
// 1. Zero findings + zero exceptions = clean tree (pass)
// 2. Zero findings + non-zero exceptions = stale exceptions (fail)
// 3. Exactly 1 finding matched by exactly 1 exception = controlled (pass)
// 4. Any unmatched finding = fail
// 5. Any unused exception = fail (stale)
// 6. More than 1 matched finding = fail

const matchedFindingCount = findings.length - unmatched.length;

if (findings.length === 0 && allowed.length > 0) {
  fail(`tree is clean but ${allowed.length} exception(s) still declared — remove stale exceptions`);
}

if (unmatched.length > 0) {
  for (const finding of unmatched) {
    fail(`npm tree ${finding.type}: ${finding.name}@${finding.version} ${finding.path}`);
  }
}

if (matchedFindingCount > 1) {
  fail(`more than one allowed extraneous finding was found (${matchedFindingCount})`);
}

const unusedExceptions = allowed.filter((_, idx) => !usedExceptions.has(idx));
if (unusedExceptions.length > 0) {
  for (const unused of unusedExceptions) {
    fail(`unused exception: ${unused.name}@${unused.version} — remove it or the anomaly has been resolved`);
  }
}

// Artifact forbidden-package check
if (artifactPath) {
  const forbidden = ['@emnapi/runtime', 'sharp-wasm32'];
  const stack = [artifactPath];
  while (stack.length) {
    const current = stack.pop();
    if (!fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (forbidden.some((name) => candidate.includes(name))) fail(`forbidden artifact package: ${candidate}`);
      if (entry.isDirectory()) stack.push(candidate);
    }
  }
}

if (process.exitCode) process.exit();
process.stdout.write(`${JSON.stringify({
  findings,
  rootProblems,
  allowedException: allowed.length > 0 && usedExceptions.size > 0 ? allowed[[...usedExceptions][0]] : null,
}, null, 2)}\n`);
