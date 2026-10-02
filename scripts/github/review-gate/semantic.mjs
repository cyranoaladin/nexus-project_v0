import { spawn } from 'node:child_process';

const PASSES = ['correctness', 'security', 'runtime'];
const MAX_OUTPUT_BYTES = 64 * 1024;

const fail = (reason) => ({ passed: false, reason, blockingFindings: [] });
const plainObject = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value, names) => plainObject(value) &&
  Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));

function failedProcessCategory(stderr) {
  if (/Failed to initialize samplers|failed to launch slot/i.test(stderr)) {
    return 'MODEL_SAMPLER_INIT_FAILED';
  }
  // Never return stderr itself: a model/runtime may echo untrusted PR text.
  if (/error while loading shared libraries|cannot open shared object file/i.test(stderr)) {
    return 'MODEL_MISSING_RUNTIME_LIBRARY';
  }
  if (/json.schema|grammar/i.test(stderr) && /error|invalid|failed/i.test(stderr)) {
    return 'MODEL_SCHEMA_REJECTED';
  }
  if (/unknown argument|invalid argument|unrecognized option/i.test(stderr)) {
    return 'MODEL_ARGUMENT_REJECTED';
  }
  if (/failed to load model|model load failed|could not load model|server exited before becoming ready/i.test(stderr)) {
    return 'MODEL_LOAD_FAILED';
  }
  return 'MODEL_PROCESS_FAILED';
}

function compactJsonWhitespace(raw) {
  let compact = '';
  let quoted = false;
  let escaped = false;
  for (const char of raw) {
    if (quoted) {
      compact += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true;
      compact += char;
    } else if (!/\s/.test(char)) {
      compact += char;
    }
  }
  return compact;
}

function validFinding(finding, allowedFiles) {
  return exactKeys(finding, ['file', 'reason', 'confidence']) &&
    typeof finding.file === 'string' && finding.file.length > 0 && finding.file.length <= 300 &&
    allowedFiles.has(finding.file) &&
    typeof finding.reason === 'string' && finding.reason.trim().length > 0 &&
    finding.reason.length <= 1000 &&
    typeof finding.confidence === 'number' && Number.isFinite(finding.confidence) &&
    finding.confidence >= 0 && finding.confidence <= 1;
}

export function parseSemanticResponse(raw, allowedFiles) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_OUTPUT_BYTES ||
      !(allowedFiles instanceof Set) || allowedFiles.size === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    // JSON.parse silently keeps the last duplicate key. Canonical equality
    // rejects duplicate/ambiguous keys and noncanonical numeric escapes.
    if (compactJsonWhitespace(raw) !== JSON.stringify(parsed)) return null;
    if (!exactKeys(parsed, ['review_complete', 'blocking_findings', 'warnings']) ||
        parsed.review_complete !== true || !Array.isArray(parsed.blocking_findings) ||
        !Array.isArray(parsed.warnings) || parsed.blocking_findings.length > 20 ||
        parsed.warnings.length > 20 ||
        [...parsed.blocking_findings, ...parsed.warnings].some((item) =>
          !validFinding(item, allowedFiles))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function decideSemanticReview({ qualifiedModel, allowedFiles, outputs } = {}) {
  if (qualifiedModel !== true) return fail('MODEL_UNQUALIFIED');
  if (!Array.isArray(allowedFiles) || allowedFiles.length === 0 ||
      allowedFiles.some((file) => typeof file !== 'string' || file.length === 0)) {
    return fail('MODEL_SCOPE_INVALID');
  }
  if (!exactKeys(outputs, PASSES)) return fail('MODEL_OUTPUT_MISSING');
  const files = new Set(allowedFiles);
  const findings = [];
  for (const pass of PASSES) {
    if (outputs[pass] === undefined) return fail('MODEL_OUTPUT_MISSING');
    const parsed = parseSemanticResponse(outputs[pass], files);
    if (!parsed) return fail('MODEL_OUTPUT_INVALID');
    findings.push(...parsed.blocking_findings);
  }
  if (findings.length > 0) return { passed: false, reason: 'MODEL_BLOCKING_FINDING', blockingFindings: findings };
  return { passed: true, reason: 'PASS', blockingFindings: [] };
}

/** Run only a trusted, absolute-path binary; PR text is stdin data, never a shell command. */
export function runBoundedReviewer({ command, args = [], prompt, timeoutMs, maxOutputBytes = MAX_OUTPUT_BYTES } = {}) {
  if (typeof command !== 'string' || !command.startsWith('/') ||
      !Array.isArray(args) || args.some((arg) => typeof arg !== 'string') ||
      typeof prompt !== 'string' || Buffer.byteLength(prompt, 'utf8') > 256 * 1024 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10 * 60 * 1000 ||
      !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > MAX_OUTPUT_BYTES) {
    return Promise.resolve({ ok: false, reason: 'MODEL_PROCESS_CONFIG_INVALID' });
  }

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        shell: false,
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C.UTF-8' },
      });
    } catch {
      resolve({ ok: false, reason: 'MODEL_START_FAILED' });
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let tooLarge = false;
    let settled = false;
    const killGroup = () => {
      try {
        if (Number.isSafeInteger(child.pid) && child.pid > 0) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
      finish({ ok: false, reason: 'MODEL_TIMEOUT' });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (Buffer.byteLength(stdout, 'utf8') > maxOutputBytes) {
        tooLarge = true;
        killGroup();
        finish({ ok: false, reason: 'MODEL_OUTPUT_TOO_LARGE' });
      }
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 8192) stderr += chunk.toString('utf8').slice(0, 8192 - stderr.length);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
    child.on('error', () => finish({ ok: false, reason: 'MODEL_START_FAILED' }));
    child.on('close', (code) => {
      if (timedOut) return finish({ ok: false, reason: 'MODEL_TIMEOUT' });
      if (tooLarge) return finish({ ok: false, reason: 'MODEL_OUTPUT_TOO_LARGE' });
      if (/Failed to initialize samplers|failed to launch slot/i.test(stderr)) {
        return finish({ ok: false, reason: 'MODEL_SAMPLER_INIT_FAILED' });
      }
      if (code !== 0) return finish({ ok: false,
        reason: failedProcessCategory(`${stderr}\n${stdout.slice(0, 8192)}`) });
      finish({ ok: true, stdout });
    });
  });
}
