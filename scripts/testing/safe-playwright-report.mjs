#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, lstatSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = value => Array.isArray(value) ? value : [];
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const states = new Set(['passed', 'failed', 'timedOut', 'interrupted', 'skipped', 'expected', 'unexpected', 'flaky']);
const projects = new Set(['chromium', 'firefox', 'webkit', 'firefox-smoke', 'webkit-smoke', 'mobile-smoke', 'aria-desktop', 'aria-mobile', 'aria-a11y', 'aria-smoke']);
const invalidReference = value => typeof value === 'string' && /^invalid:[a-f0-9]{64}$/.test(value);
const safeState = value => states.has(value) || invalidReference(value) ? value : `invalid:${hash(value)}`;
const safeProject = value => projects.has(value) || invalidReference(value) ? value : `invalid:${hash(value)}`;
const requirementPattern = /(?<![\p{L}\p{N}\p{M}_])(?:ARIA-B-R|[UAIDHESP])\d{3}(?![\p{L}\p{N}\p{M}_])/gu;

function title(value) {
  if (typeof value !== 'string') return undefined;
  // Idempotent: sealing a sanitized report must preserve test signatures.
  if (/^(?:(?:ARIA-B-R|[UAIDHESP])\d{3} )*case:[a-f0-9]{64}$/.test(value)) return value;
  const requirements = [...new Set([...value.matchAll(requirementPattern)].map(match => match[0]))];
  return `${requirements.length ? requirements.join(' ') + ' ' : ''}case:${hash(value)}`;
}

function file(value, root, selector = false) {
  if (typeof value !== 'string') return undefined;
  if (invalidReference(value)) return value;
  const relative = path.posix.isAbsolute(value) ? path.posix.relative(root, value) : value;
  const pattern = selector ? /^[a-zA-Z0-9.*_/-]+$/ : /^[a-zA-Z0-9._/-]+\.spec\.ts$/;
  return pattern.test(relative) && !relative.split('/').includes('..')
    ? relative : `invalid:${hash(value)}`;
}

function errors(value) {
  // Count and retain every failure without copying messages, stacks or causes.
  return array(value).map(() => ({ message: 'PRIVATE_DIAGNOSTIC_REDACTED' }));
}

function visualAttachments(value, allowed) {
  if (!allowed) return [];
  return array(value).filter(value => {
    const attachment = record(value);
    return /^aria-(?:390x844|768x1024|1366x768|1440x900)-(?:ready|streaming|citations-visible|history-loaded|feedback-submitted|rag-unavailable|timeout-error|course-unavailable)$/.test(attachment.name ?? '')
      && attachment.contentType === 'image/png';
  }).map(value => {
    const attachment = record(value);
    const body = attachment.body;
    if (typeof body !== 'string' || body.length > 8 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body)) {
      throw new Error('VISUAL_ATTACHMENT_NOT_PUBLISHABLE');
    }
    const bytes = Buffer.from(body, 'base64');
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('VISUAL_ATTACHMENT_NOT_PUBLISHABLE');
    let offset = 8;
    let ended = false;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const kind = bytes.subarray(offset + 4, offset + 8).toString('ascii');
      if (!['IHDR', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'pHYs', 'cHRM', 'PLTE', 'tRNS'].includes(kind)
        || offset + length + 12 > bytes.length) throw new Error('VISUAL_ATTACHMENT_NOT_PUBLISHABLE');
      offset += length + 12;
      if (kind === 'IEND') { ended = true; break; }
    }
    if (!ended || offset !== bytes.length) throw new Error('VISUAL_ATTACHMENT_NOT_PUBLISHABLE');
    return { name: attachment.name, contentType: 'image/png', body };
  });
}

const phasePattern = /^ARIA_PHASE:(?:transport:(?:send|request|response|body)|(?:rag|timeout):(?:send|alert)|capture:(?:ready|streaming|citations-visible|history-loaded|feedback-submitted|rag-unavailable|timeout-error|course-unavailable):(?:layout|axe|screenshot))$/;

function phases(input) {
  const output = [];
  const visit = values => {
    for (const value of array(values)) {
      const step = record(value);
      if (typeof step.title === 'string' && phasePattern.test(step.title)) {
        output.push({ phase: step.title, duration: number(step.duration), failed: Boolean(step.error) });
      }
      visit(step.steps);
    }
  };
  visit(input.steps);
  // Preserve only previously sealed, fixed-label diagnostics on resealing.
  if (output.length === 0) {
    for (const value of array(input.phases)) {
      const phase = record(value);
      if (typeof phase.phase === 'string' && phasePattern.test(phase.phase)) {
        output.push({ phase: phase.phase, duration: number(phase.duration), failed: phase.failed === true });
      }
    }
  }
  return output;
}

function result(value, visualAllowed) {
  const input = record(value);
  const attachments = visualAttachments(input.attachments, visualAllowed);
  const total = Number.isSafeInteger(input.attachmentCount) ? number(input.attachmentCount) : array(input.attachments).length;
  return {
    status: safeState(input.status), retry: number(input.retry), duration: number(input.duration),
    workerIndex: number(input.workerIndex), parallelIndex: number(input.parallelIndex),
    errors: errors(input.errors),
    ...(input.error ? { error: { message: 'PRIVATE_DIAGNOSTIC_REDACTED' } } : {}),
    stdout: [], stderr: [], attachments, phases: phases(input),
    attachmentCount: total, excludedAttachmentCount: total - attachments.length,
  };
}

function test(value, visualSpec) {
  const input = record(value);
  return {
    projectName: safeProject(input.projectName), expectedStatus: safeState(input.expectedStatus),
    status: safeState(input.status), timeout: number(input.timeout),
    annotations: array(input.annotations).map(value => {
      const annotation = record(value);
      const type = ['skip', 'fixme', 'fail', 'slow'].includes(annotation.type)
        || (typeof annotation.type === 'string' && /^custom:[a-f0-9]{64}$/.test(annotation.type))
        ? annotation.type : `custom:${hash(annotation.type)}`;
      return { type };
    }),
    results: array(input.results).map(value => result(value, visualSpec && input.projectName === 'aria-mobile')),
  };
}

function suite(value, root) {
  const input = record(value);
  return {
    title: title(input.title), file: file(input.file, root), line: number(input.line), column: number(input.column),
    suites: array(input.suites).map(value => suite(value, root)),
    specs: array(input.specs).map(value => {
      const spec = record(value);
      const safeFile = file(spec.file, root);
      const visualSpec = safeFile?.endsWith('visual-a11y.spec.ts') === true
        && typeof spec.title === 'string' && /\bE0(?:18|19|20|21)\b/.test(spec.title);
      // Playwright's opaque test id includes the repeat index. Retain only a
      // one-way reference so qualification can reject duplicate executions.
      const executionId = typeof spec.executionId === 'string' && /^execution:[a-f0-9]{64}$/.test(spec.executionId)
        ? spec.executionId : typeof spec.id === 'string' && spec.id.length > 0
          ? `execution:${hash(spec.id)}` : undefined;
      return { title: title(spec.title), file: safeFile, line: number(spec.line), column: number(spec.column),
        ...(executionId ? { executionId } : {}),
        ok: spec.ok === true, tests: array(spec.tests).map(value => test(value, visualSpec)) };
    }),
  };
}

/** Allowlist evidence; arbitrary fields, user text and embedded resources never leave the runner. */
export function sanitizePlaywrightReport(value) {
  const input = record(value);
  if (!Array.isArray(input.suites) || !Array.isArray(input.errors)) throw new Error('PLAYWRIGHT_REPORT_INVALID');
  const config = record(input.config);
  const originalRoot = typeof config.rootDir === 'string' ? config.rootDir : '';
  const suffix = ['e2e/auth', 'e2e/aria', 'e2e'].find(root => originalRoot.endsWith(`/${root}`));
  const stats = record(input.stats);
  return {
    privacyFormat: 'playwright-allowlist/1',
    config: {
      rootDir: suffix ? `/workspace/${suffix}` : '/invalid-root',
      projects: array(config.projects).map(value => {
        const project = record(value);
        return { name: safeProject(project.name),
          testMatch: Array.isArray(project.testMatch) ? project.testMatch.map(value => file(value, originalRoot, true)) : undefined,
          testIgnore: Array.isArray(project.testIgnore) ? project.testIgnore.map(value => file(value, originalRoot, true)) : undefined };
      }),
    },
    suites: input.suites.map(value => suite(value, originalRoot)), errors: errors(input.errors),
    stats: { duration: number(stats.duration), expected: number(stats.expected), unexpected: number(stats.unexpected),
      flaky: number(stats.flaky), skipped: number(stats.skipped) },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [source, destination, expectedHead] = process.argv.slice(2);
  if (!source || !destination || path.resolve(source) === path.resolve(destination) || existsSync(destination)) {
    throw new Error('SAFE_PLAYWRIGHT_DESTINATION_MUST_BE_NEW');
  }
  const relativeDestination = path.relative(process.cwd(), path.resolve(destination));
  if (!relativeDestination.startsWith(`.artifacts${path.sep}`) || relativeDestination.split(path.sep).includes('..')) {
    throw new Error('SAFE_PLAYWRIGHT_DESTINATION_OUTSIDE_ARTIFACTS');
  }
  let parent = process.cwd();
  for (const segment of relativeDestination.split(path.sep).slice(0, -1)) {
    parent = path.join(parent, segment);
    if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) throw new Error('SAFE_PLAYWRIGHT_DESTINATION_SYMLINK');
  }
  let report;
  try {
    if (!statSync(source).isFile() || statSync(source).size > 128 * 1024 * 1024) throw new Error('REPORT_SIZE_REFUSED');
    report = JSON.parse(readFileSync(source, 'utf8'));
  } catch { throw new Error('PLAYWRIGHT_REPORT_READ_FAILED'); }
  const sanitized = sanitizePlaywrightReport(report);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('EXACT_HEAD_REQUIRED');
  if (expectedHead !== undefined && (!/^[a-f0-9]{40}$/.test(expectedHead) || expectedHead !== head)) throw new Error('SOURCE_HEAD_CHANGED');
  const jobStatus = process.env.ARIA_JOB_STATUS;
  if (jobStatus !== undefined && !['success', 'failure', 'cancelled', 'skipped'].includes(jobStatus)) throw new Error('JOB_STATUS_INVALID');
  mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  writeFileSync(destination, JSON.stringify(sanitized) + '\n', { mode: 0o600, flag: 'wx' });
  writeFileSync(path.join(path.dirname(destination), 'head.sha'), head + '\n', { mode: 0o600, flag: 'wx' });
  if (jobStatus !== undefined) {
    writeFileSync(path.join(path.dirname(destination), 'job-status.txt'), jobStatus + '\n', { mode: 0o600, flag: 'wx' });
  }
}
