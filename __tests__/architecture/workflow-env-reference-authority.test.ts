import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `${{ env.FOO }}` referencing an undefined variable is NOT an error in GitHub
 * Actions — it silently expands to the empty string. `npm install -g npm@` then
 * installs npm latest and `npm ci` dies with EBADENGINE, several steps away
 * from the real cause.
 *
 * That is exactly how `flake-qualification.yml` failed on its first real
 * invocation (run 35108561487): it was copied out of `ci.yml`'s e2e stack
 * without `ci.yml`'s top-level `env:` block, so NODE_VERSION and NPM_VERSION
 * were both empty. Nothing caught it — the references are syntactically valid,
 * the YAML parses, and a `workflow_dispatch` workflow never runs in the CI of
 * its own pull request.
 *
 * This guard resolves every `env.` reference against the definitions that can
 * actually supply it: the workflow's top-level `env:`, the job's `env:`, or the
 * step's `env:`. Anything referenced and never defined is reported.
 */

const WORKFLOW_DIR = '.github/workflows';

// Names supplied by the runner itself, never declared in the workflow.
const RUNNER_PROVIDED = new Set([
  'CI', 'HOME', 'GITHUB_TOKEN', 'GITHUB_REF', 'GITHUB_SHA', 'GITHUB_WORKSPACE',
  'GITHUB_REPOSITORY', 'GITHUB_RUN_ID', 'GITHUB_RUN_NUMBER', 'GITHUB_ACTOR',
  'GITHUB_EVENT_NAME', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF', 'RUNNER_OS',
  'RUNNER_TEMP', 'RUNNER_TOOL_CACHE', 'PATH',
]);

function workflowFiles(): string[] {
  return readdirSync(resolve(process.cwd(), WORKFLOW_DIR))
    .filter(name => /\.ya?ml$/.test(name))
    .map(name => `${WORKFLOW_DIR}/${name}`);
}

/** Every `NAME:` that appears anywhere under any `env:` mapping in the file. */
function definedNames(source: string): Set<string> {
  const defined = new Set<string>();
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const open = /^(\s*)env:\s*$/.exec(lines[i]);
    if (!open) continue;
    const indent = open[1].length;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '' || line.trim().startsWith('#')) continue;
      const lead = line.length - line.trimStart().length;
      if (lead <= indent) break; // the env block ended
      const entry = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
      if (entry) defined.add(entry[1]);
    }
  }
  return defined;
}

function unresolvedEnvReferences(file: string, source: string): string[] {
  const defined = definedNames(source);
  const problems: string[] = [];
  source.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(/\$\{\{\s*env\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) {
      const name = match[1];
      if (defined.has(name) || RUNNER_PROVIDED.has(name)) continue;
      problems.push(`${file}:${index + 1} -> env.${name}`);
    }
  });
  return problems;
}

describe('workflow env reference authority', () => {
  it('never references an env variable no env block defines', () => {
    const offenders = workflowFiles().flatMap(file =>
      unresolvedEnvReferences(file, readFileSync(resolve(process.cwd(), file), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('flags the shape that broke the qualification harness, and clears the fixed form', () => {
    const broken = [
      'jobs:',
      '  build:',
      '    steps:',
      '      - run: npm install -g npm@${{ env.NPM_VERSION }}',
    ].join('\n');
    expect(unresolvedEnvReferences('w.yml', broken)).toEqual(['w.yml:4 -> env.NPM_VERSION']);

    const fixed = ['env:', "  NPM_VERSION: '10.9.8'", ...broken.split('\n')].join('\n');
    expect(unresolvedEnvReferences('w.yml', fixed)).toEqual([]);
  });

  it('accepts a job-level or step-level definition, not only the top level', () => {
    const jobLevel = [
      'jobs:',
      '  build:',
      '    env:',
      "      NPM_VERSION: '10.9.8'",
      '    steps:',
      '      - run: echo ${{ env.NPM_VERSION }}',
    ].join('\n');
    expect(unresolvedEnvReferences('w.yml', jobLevel)).toEqual([]);
  });
});
