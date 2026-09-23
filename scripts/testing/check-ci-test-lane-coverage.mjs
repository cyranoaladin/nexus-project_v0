#!/usr/bin/env node
/**
 * Every test file must be reachable from a workflow.
 *
 * `jest.config.db.js` collected 55 suites and no workflow ever named it. The
 * 18 non-ARIA suites in it — including the three `*-delete-restrict.db.test.ts`
 * guards that hold the "real account history must not disappear through a
 * cascade delete" invariant — therefore gated nothing, silently, for months.
 * Four Playwright specs under `__tests__/e2e/` sat outside every
 * `testDir` for the same reason. A test that no gate runs is not a weaker
 * test; it is a false assurance, because a green pipeline is read as proof
 * that its assertions hold.
 *
 * This check closes that class of failure at its root: it resolves which
 * runners the workflows actually invoke, asks those runners which files they
 * collect, and fails when any test file in the repository is collected by
 * none of them.
 *
 * Resolution, in order:
 *   1. every `.github/workflows/*.yml` is read as text and as YAML;
 *   2. `npm run <script>`, `npm test`, and matrix `script:` values become
 *      package.json script names — matrix values are taken from the YAML so
 *      `npm run ${{ matrix.script }}` resolves to the lanes it expands to;
 *   3. each script's command is scanned for `--config <cfg>`, for nested
 *      `npm run`, for `node <file>` run directly, and for shell runners under
 *      `scripts/`, whose own text is scanned for `--config` and for
 *      `jest_config='<cfg>'` assignments;
 *   4. a jest configuration counts as *fully* invoked unless every one of its
 *      invocations restricts the path set (`--runTestsByPath`,
 *      `--testPathPattern`, or a positional path). A configuration invoked
 *      only under restriction covers just the paths it names.
 *
 * `--listTests` / `--list` then give the collected set, from the runners
 * themselves rather than from a re-implementation of their matching rules.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowDir = path.join(repoRoot, '.github', 'workflows');

const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const JEST_CONFIG = /(?:--config[= ]+)(['"]?)([\w./-]*jest[\w.-]*\.(?:js|cjs|mjs|ts))\1/g;
const SHELL_JEST_CONFIG = /jest_config=(['"])([\w./-]+)\1/g;
const NPM_RUN = /npm run ([\w:.-]+)/g;
const NPX_PLAYWRIGHT = /playwright test[^\n|&;]*/g;
const PLAYWRIGHT_CONFIG = /--config[= ]+(['"]?)([\w./-]*playwright[\w.-]*\.(?:ts|js|mjs))\1/;
// `scripts/aria/run-e2e-suite.sh` hands its configuration to the containerised
// runner through the environment rather than on the command line.
const PLAYWRIGHT_CONFIG_ENV = /PLAYWRIGHT_CONFIG[=:]\s*(['"]?)([\w./-]*playwright[\w.-]*\.(?:ts|js|mjs))\1/g;
const RUNNER_SCRIPT = /(?:bash|sh|node|npx tsx|tsx) (scripts\/[\w./-]+)/g;
const NODE_TEST_FILE = /node (\S*\.(?:test|spec)\.(?:mjs|cjs|js|ts))/g;
const RESTRICTED = /--runTestsByPath|--testPathPattern/;

const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const npmScripts = packageJson.scripts ?? {};

/** Raw text of every workflow, plus every matrix value that names an npm script. */
function readWorkflows() {
  const texts = [];
  const scriptNames = new Set();

  for (const entry of readdirSync(workflowDir)) {
    if (!/\.ya?ml$/.test(entry)) continue;
    const text = readFileSync(path.join(workflowDir, entry), 'utf8');
    texts.push({ file: `.github/workflows/${entry}`, text });

    let document;
    try {
      document = YAML.parse(text);
    } catch {
      // A workflow GitHub cannot parse is a separate failure; here it simply
      // contributes no matrix values, and its raw text is still scanned.
      continue;
    }
    for (const value of collectMatrixValues(document)) {
      if (Object.hasOwn(npmScripts, value)) scriptNames.add(value);
    }
  }

  return { texts, matrixScriptNames: scriptNames };
}

function* collectMatrixValues(node) {
  if (Array.isArray(node)) {
    for (const item of node) yield* collectMatrixValues(item);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && /^(script|lane|npmScript)$/.test(key)) yield value;
    else yield* collectMatrixValues(value);
  }
}

/** Every command line the workflows run, plus every command they reach through npm. */
function resolveCommands() {
  const { texts, matrixScriptNames } = readWorkflows();
  const commands = [];
  const seenScripts = new Set();

  for (const { text } of texts) commands.push(text);

  const pending = [...matrixScriptNames];
  for (const { text } of texts) {
    for (const [, name] of text.matchAll(NPM_RUN)) pending.push(name);
    if (/\bnpm test\b/.test(text)) pending.push('test');
  }

  while (pending.length > 0) {
    const name = pending.pop();
    if (seenScripts.has(name) || !Object.hasOwn(npmScripts, name)) continue;
    seenScripts.add(name);

    const command = npmScripts[name];
    commands.push(command);
    for (const [, nested] of command.matchAll(NPM_RUN)) pending.push(nested);
    if (/\bnpm test\b/.test(command)) pending.push('test');

    for (const [, runner] of command.matchAll(RUNNER_SCRIPT)) {
      const runnerPath = path.join(repoRoot, runner);
      if (existsSync(runnerPath)) commands.push(readFileSync(runnerPath, 'utf8'));
    }
  }

  return commands;
}

/** Jest invocations, keyed by configuration, with the paths each one names. */
function jestInvocations(commands) {
  const byConfig = new Map();

  const record = (config, restricted, namedPaths) => {
    const entry = byConfig.get(config) ?? { full: false, paths: new Set() };
    if (restricted) for (const named of namedPaths) entry.paths.add(named);
    else entry.full = true;
    byConfig.set(config, entry);
  };

  for (const command of commands) {
    for (const line of splitInvocations(command)) {
      for (const [, , config] of line.matchAll(JEST_CONFIG)) {
        const named = positionalTestPaths(line);
        record(config, RESTRICTED.test(line) || named.length > 0, named);
      }
      for (const [, , config] of line.matchAll(SHELL_JEST_CONFIG)) record(config, false, []);
    }
  }

  return byConfig;
}

/**
 * Workflow text is many commands at once; jest flags belong to the invocation
 * they sit in, so cut on the shell separators that end one.
 */
function splitInvocations(command) {
  return command
    .replace(/\\\n/g, ' ')
    .split(/\n\s*-\s|[\n;&|]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function positionalTestPaths(line) {
  return line
    .split(/\s+/)
    .filter((token) => TEST_FILE.test(token) && !token.startsWith('--'));
}

function playwrightConfigs(commands) {
  const configs = new Set();
  for (const command of commands) {
    for (const match of command.matchAll(NPX_PLAYWRIGHT)) {
      const configured = match[0].match(PLAYWRIGHT_CONFIG);
      configs.add(configured ? configured[2] : 'playwright.config.ts');
    }
    for (const [, , config] of command.matchAll(PLAYWRIGHT_CONFIG_ENV)) configs.add(config);
  }
  return configs;
}

function directlyRunTestFiles(commands) {
  const files = new Set();
  for (const command of commands) {
    for (const [, file] of command.matchAll(NODE_TEST_FILE)) {
      files.add(path.posix.normalize(file));
    }
  }
  return files;
}

function listJestTests(config) {
  const output = execFileSync(
    'npx',
    ['jest', '--config', config, '--listTests'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('/'))
    .map((absolute) => path.relative(repoRoot, absolute));
}

function listPlaywrightTests(config) {
  const output = execFileSync(
    'npx',
    ['playwright', 'test', '--config', config, '--list', '--reporter=list'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Collection loads each spec module but never runs hooks or tests. Keep
      // fail-closed E2E guards intact while giving collection the same exact
      // disposable identity used by the auth CI lane.
      env: {
        ...process.env,
        E2E_DISPOSABLE_STACK: '1',
        CORE_V2_DATABASE_URL: 'postgresql://postgres@localhost:5435/core_v2_e2e',
      },
    },
  );
  const testDir = playwrightTestDir(config);
  const files = new Set();
  for (const line of output.split('\n')) {
    const match = line.match(/›\s*([\w./-]+\.spec\.[jt]sx?):\d+:\d+/);
    if (match) files.add(path.posix.join(testDir, match[1]));
  }
  return [...files];
}

function playwrightTestDir(config) {
  const source = readFileSync(path.join(repoRoot, config), 'utf8');
  const match = source.match(/testDir:\s*(['"])([^'"]+)\1/);
  return match ? path.posix.normalize(match[2]) : '.';
}

function repositoryTestFiles() {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => TEST_FILE.test(line))
    .filter((line) => !line.startsWith('node_modules/'));
}

function main() {
  const commands = resolveCommands();
  const covered = new Set(directlyRunTestFiles(commands));
  const lanes = [];

  for (const [config, invocation] of jestInvocations(commands)) {
    if (!existsSync(path.join(repoRoot, config))) {
      lanes.push({ config, kind: 'jest', collected: 0, note: 'configuration absente du dépôt' });
      continue;
    }
    if (invocation.full) {
      const collected = listJestTests(config);
      for (const file of collected) covered.add(file);
      lanes.push({ config, kind: 'jest', collected: collected.length });
    } else {
      for (const file of invocation.paths) covered.add(path.posix.normalize(file));
      lanes.push({ config, kind: 'jest', collected: invocation.paths.size, note: 'invoquée par chemins uniquement' });
    }
  }

  for (const config of playwrightConfigs(commands)) {
    if (!existsSync(path.join(repoRoot, config))) continue;
    const collected = listPlaywrightTests(config);
    for (const file of collected) covered.add(file);
    lanes.push({ config, kind: 'playwright', collected: collected.length });
  }

  for (const lane of lanes.sort((a, b) => a.config.localeCompare(b.config))) {
    const note = lane.note ? ` — ${lane.note}` : '';
    console.log(`  ${lane.kind.padEnd(10)} ${lane.config.padEnd(34)} ${String(lane.collected).padStart(5)} fichier(s)${note}`);
  }

  const orphans = repositoryTestFiles().filter((file) => !covered.has(file));
  console.log(`\n${covered.size} fichier(s) de test atteignables depuis un workflow.`);

  if (orphans.length > 0) {
    console.error(
      `\nÉCHEC : ${orphans.length} fichier(s) de test ne sont collectés par aucune lane invoquée ` +
      `par un workflow. Ils n'ont donc jamais gaté une fusion :\n`,
    );
    for (const orphan of orphans) console.error(`  ${orphan}`);
    console.error(
      '\nRattachez chaque fichier à une lane réellement invoquée, ou supprimez-le. ' +
      "Un test que rien n'exécute est une fausse assurance, pas une assurance faible.",
    );
    process.exit(1);
  }

  console.log('Aucun fichier de test orphelin.');
}

main();
