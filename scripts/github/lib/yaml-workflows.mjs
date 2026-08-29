import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

// Real YAML 1.2 parsing only — never regex over workflow source. YAML 1.2
// core schema (this package's default) does not fold an `on:` mapping key
// into the boolean `true`, unlike YAML-1.1 parsers; that distinction is
// exactly why a regex/line-scan approach on GitHub Actions files is unsafe.
export function parseWorkflowFile(path) {
  const raw = readFileSync(path, 'utf8');
  return parseYaml(raw, { strict: false, uniqueKeys: false });
}

export function jobContextName(jobKey, job) {
  if (typeof job?.name === 'string' && job.name.length > 0) {
    return job.name;
  }
  return jobKey;
}

function cartesianProduct(axisEntries) {
  if (axisEntries.length === 0) return [];
  return axisEntries.reduce((acc, [axisName, values]) => {
    if (!Array.isArray(values)) return acc;
    const next = [];
    const base = acc.length ? acc : [{}];
    for (const partial of base) {
      for (const value of values) {
        next.push({ ...partial, [axisName]: value });
      }
    }
    return next;
  }, []);
}

// Expands `strategy.matrix` axes into the parenthesised context suffix
// GitHub reports, e.g. "E2E (Playwright) / Playwright E2E (chromium)".
// `include`/`exclude` entries are not axes and are intentionally excluded
// from the cartesian product (GitHub Actions matrix semantics: include/
// exclude modify combinations, they don't define new axes).
export function listJobContexts(doc) {
  const jobs = doc?.jobs ?? {};
  const contexts = [];
  for (const [jobKey, job] of Object.entries(jobs)) {
    const baseName = jobContextName(jobKey, job);
    const matrix = job?.strategy?.matrix;
    if (matrix && typeof matrix === 'object' && !Array.isArray(matrix)) {
      const axisEntries = Object.entries(matrix).filter(
        ([axisName]) => axisName !== 'include' && axisName !== 'exclude',
      );
      const combos = cartesianProduct(axisEntries);
      if (combos.length === 0) {
        contexts.push({ jobKey, context: baseName, matrix: null });
      } else {
        for (const combo of combos) {
          const suffix = Object.values(combo)
            .map((value) => String(value))
            .join(', ');
          contexts.push({ jobKey, context: `${baseName} (${suffix})`, matrix: combo });
        }
      }
    } else {
      contexts.push({ jobKey, context: baseName, matrix: null });
    }
  }
  return contexts;
}

export function findJobContext(doc, jobKey) {
  return listJobContexts(doc).find((entry) => entry.jobKey === jobKey) ?? null;
}

export function listInvariantContinueOnErrorSteps(doc) {
  const jobs = doc?.jobs ?? {};
  const findings = [];
  for (const [jobKey, job] of Object.entries(jobs)) {
    for (const step of job?.steps ?? []) {
      const name = typeof step?.name === 'string' ? step.name : '';
      if (/invariant/i.test(name) && step?.['continue-on-error'] === true) {
        findings.push({ jobKey, stepName: name });
      }
    }
  }
  return findings;
}

export function hasPullRequestTrigger(doc) {
  const on = doc?.on;
  if (on == null) return false;
  if (typeof on === 'string') return on === 'pull_request';
  if (Array.isArray(on)) return on.includes('pull_request');
  if (typeof on === 'object') {
    return Object.prototype.hasOwnProperty.call(on, 'pull_request');
  }
  return false;
}

export function topLevelPermissions(doc) {
  return doc?.permissions ?? null;
}
