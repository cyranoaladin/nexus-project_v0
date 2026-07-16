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
const unmatched = [];
const currentPlatform = {
  node: process.versions.node,
  npm: execFileSync(process.env.npm_execpath ? process.execPath : 'npm', process.env.npm_execpath
    ? [process.env.npm_execpath, '--version']
    : ['--version'], { encoding: 'utf8' }).trim(),
  os: os.platform(),
  arch: os.arch(),
};

for (const exception of allowed) {
  if (exception.expiresOn < today) fail(`npm tree exception expired on ${exception.expiresOn}`);
  if (exception.artifactAllowed !== false) fail(`npm tree exception must set artifactAllowed=false: ${exception.name}`);
  for (const [key, value] of Object.entries(currentPlatform)) {
    if (exception.platform?.[key] !== value) {
      fail(`npm tree exception platform mismatch for ${key}: expected ${exception.platform?.[key]}, got ${value}`);
    }
  }
}

for (const finding of findings) {
  const matchingException = allowed.find((exception) =>
    exception.type === finding.type &&
    exception.name === finding.name &&
    exception.version === finding.version &&
    exception.path === finding.path &&
    exception.expiresOn >= today,
  );
  if (!matchingException) unmatched.push(finding);
}

const usedAllowed = allowed.filter((exception) => findings.some((finding) =>
  exception.type === finding.type &&
  exception.name === finding.name &&
  exception.version === finding.version &&
  exception.path === finding.path,
));
const allowedFindingCount = findings.filter((finding) => allowed.some((exception) =>
  exception.type === finding.type &&
  exception.name === finding.name &&
  exception.version === finding.version &&
  exception.path === finding.path,
)).length;

if (allowed.length !== 1 || usedAllowed.length > 1 || unmatched.length > 0 || allowedFindingCount > 1) {
  for (const finding of unmatched) fail(`npm tree ${finding.type}: ${finding.name}@${finding.version} ${finding.path}`);
  if (allowed.length !== 1) fail(`expected exactly one exception, found ${allowed.length}`);
  if (usedAllowed.length > 1) fail('more than one exception was used');
  if (allowedFindingCount > 1) fail('more than one allowed extraneous finding was found');
}

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
process.stdout.write(`${JSON.stringify({ findings, rootProblems, allowedException: usedAllowed[0] || null }, null, 2)}\n`);
