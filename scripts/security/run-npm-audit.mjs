#!/usr/bin/env node

/**
 * run-npm-audit.mjs — Bounded retry runner for npm audit.
 *
 * Distinguishes:
 * 1. REAL VULNERABILITIES: Valid JSON indicating vulnerabilities >= threshold -> FAIL IMMEDIATELY (0 retries).
 * 2. TRANSPORT / REGISTRY ERRORS (503, 502, 500, 429, ETIMEDOUT, ECONNRESET) -> Bounded exponential retry (max 3).
 * 3. EXHAUSTION / UNKNOWN ERRORS -> FAIL CLOSED (exit 1). Never PASS on network error.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

export const AUDIT_LEVEL_SEVERITY = {
  info: 1,
  low: 2,
  moderate: 3,
  high: 4,
  critical: 5,
};

export function isTransportError(output = '') {
  const text = String(output);
  return (
    /503\s+Service\s+Unavailable/i.test(text) ||
    /502\s+Bad\s+Gateway/i.test(text) ||
    /504\s+Gateway\s+Timeout/i.test(text) ||
    /500\s+Internal\s+Server\s+Error/i.test(text) ||
    /429\s+Too\s+Many\s+Requests/i.test(text) ||
    /\bETIMEDOUT\b/i.test(text) ||
    /\bECONNRESET\b/i.test(text) ||
    /\bECONNREFUSED\b/i.test(text) ||
    /\bENOTFOUND\b/i.test(text) ||
    /\bfetch\s+failed\b/i.test(text) ||
    /request\s+to\s+https?:\/\/registry\.npmjs\.org.*failed/i.test(text) ||
    /npm\s+ERR!\s+code\s+(?:E503|E502|E504|E500|E429|ETIMEDOUT|ECONNRESET)/i.test(text)
  );
}

function isNonNegativeInteger(val) {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0;
}

export function validateCanonicalAuditReport(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, reason: 'Report must be a JSON object' };
  }

  if (typeof parsed.auditReportVersion !== 'number') {
    return { valid: false, reason: 'auditReportVersion must be a number' };
  }

  const vulns = parsed.metadata?.vulnerabilities;
  if (!vulns || typeof vulns !== 'object' || Array.isArray(vulns)) {
    return { valid: false, reason: 'metadata.vulnerabilities must be an object' };
  }

  const requiredLevels = ['info', 'low', 'moderate', 'high', 'critical', 'total'];
  for (const level of requiredLevels) {
    if (!isNonNegativeInteger(vulns[level])) {
      return {
        valid: false,
        reason: `metadata.vulnerabilities.${level} must be a non-negative integer`,
      };
    }
  }

  const calculatedTotal =
    vulns.info + vulns.low + vulns.moderate + vulns.high + vulns.critical;
  if (vulns.total !== calculatedTotal) {
    return {
      valid: false,
      reason: `metadata.vulnerabilities.total (${vulns.total}) does not match sum of severity counts (${calculatedTotal})`,
    };
  }

  return { valid: true, counts: vulns };
}

export function classifyAuditResult(result, minAuditLevel = 'high') {
  const { status, stdout = '', stderr = '' } = result;
  const combined = `${stdout}\n${stderr}`;
  const trimmedStdout = stdout.trim();

  // 1. If stdout starts with JSON delimiters, parse and validate strictly as audit report first.
  // No JSON output may ever be downgraded to or retried as a transport error.
  if (trimmedStdout.startsWith('{') || trimmedStdout.startsWith('[')) {
    let parsed = null;
    try {
      parsed = JSON.parse(trimmedStdout);
    } catch {
      return {
        type: 'FATAL_ERROR',
        message: 'Malformed JSON in npm audit stdout: fail closed',
        raw: combined,
      };
    }

    const validation = validateCanonicalAuditReport(parsed);
    if (!validation.valid) {
      // Partial or non-canonical JSON audit output fails closed immediately.
      // PARTIAL_AUDIT_JSON_FAILS_CLOSED=YES
      // AUDIT_JSON_CAN_NEVER_BE_RETRIED_AS_TRANSPORT=YES
      return {
        type: 'FATAL_ERROR',
        message: `Invalid canonical npm audit report schema: ${validation.reason}`,
        raw: combined,
      };
    }

    const counts = validation.counts;
    const minSeverityRank = AUDIT_LEVEL_SEVERITY[minAuditLevel] ?? 4;

    let hasViolations = false;
    for (const [level, count] of Object.entries(counts)) {
      const rank = AUDIT_LEVEL_SEVERITY[level] ?? 0;
      if (rank >= minSeverityRank && count > 0) {
        hasViolations = true;
        break;
      }
    }

    if (hasViolations) {
      return {
        type: 'VULNERABILITY',
        report: parsed,
        counts,
        raw: stdout,
      };
    }

    return {
      type: 'CLEAN',
      report: parsed,
      counts,
      raw: stdout,
    };
  }

  // 2. Non-JSON output / stderr: check for recognized registry/transport errors for bounded retry
  if (isTransportError(combined)) {
    return {
      type: 'TRANSPORT_ERROR',
      reason: combined.trim().slice(0, 500),
      raw: combined,
    };
  }

  // 3. Any empty output, plain-text output, or unrecognized non-transport format MUST fail closed
  if (!trimmedStdout) {
    return {
      type: 'FATAL_ERROR',
      message: 'Empty audit output: dependency audit requires valid JSON audit evidence',
      raw: combined,
    };
  }

  return {
    type: 'FATAL_ERROR',
    message: combined.trim().slice(0, 500) || `Unrecognized npm audit output (status: ${status})`,
    raw: combined,
  };
}

/**
 * @param {Object} options
 * @param {string[]} [options.args]
 * @param {string|null} [options.outputFile]
 * @param {string} [options.auditLevel]
 * @param {number} [options.maxAttempts]
 * @param {number} [options.backoffBaseMs]
 * @param {((args: string[]) => { status: number | null, stdout: string, stderr: string }) | null} [options.runner]
 * @param {((ms: number) => Promise<void>)} [options.sleepFn]
 * @param {{ info: (...args: any[]) => void, warn: (...args: any[]) => void, error: (...args: any[]) => void }} [options.logger]
 */
export async function runAuditWithRetry({
  args = [],
  outputFile = null,
  auditLevel = 'high',
  maxAttempts = 3,
  backoffBaseMs = 2000,
  runner = null,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  logger = console,
}) {
  const execute =
    runner ??
    ((cmdArgs) => {
      const fullArgs = ['audit', '--json', ...cmdArgs];
      return spawnSync('npm', fullArgs, {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      });
    });

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      const delay = backoffBaseMs * Math.pow(2, attempt - 2);
      logger.warn(`[run-npm-audit] Retry attempt ${attempt}/${maxAttempts} after ${delay}ms delay...`);
      await sleepFn(delay);
    }

    let result;
    try {
      result = execute(args);
    } catch (err) {
      result = {
        status: 1,
        stdout: '',
        stderr: String(err?.message || err),
      };
    }

    const classification = classifyAuditResult(result, auditLevel);

    if (classification.type === 'VULNERABILITY') {
      logger.error(
        `[run-npm-audit] Security vulnerabilities >= ${auditLevel} detected! Failing immediately without retry.`,
      );
      if (outputFile && classification.raw) {
        writeFileSync(outputFile, classification.raw, 'utf8');
      }
      return {
        success: false,
        exitCode: 1,
        classification,
        attempts: attempt,
      };
    }

    if (classification.type === 'CLEAN') {
      logger.info(`[run-npm-audit] Audit clean (0 vulnerabilities >= ${auditLevel}) on attempt ${attempt}.`);
      if (outputFile && classification.raw) {
        writeFileSync(outputFile, classification.raw, 'utf8');
      }
      return {
        success: true,
        exitCode: 0,
        classification,
        attempts: attempt,
      };
    }

    if (classification.type === 'TRANSPORT_ERROR') {
      logger.warn(
        `[run-npm-audit] Registry/transport error on attempt ${attempt}/${maxAttempts}: ${classification.reason}`,
      );
      lastError = classification;
      continue;
    }

    // FATAL_ERROR (malformed non-transport or unexpected failure)
    logger.error(`[run-npm-audit] Unrecoverable error on attempt ${attempt}: ${classification.message}`);
    return {
      success: false,
      exitCode: 1,
      classification,
      attempts: attempt,
    };
  }

  // All retries exhausted: FAIL CLOSED
  logger.error(
    `[run-npm-audit] All ${maxAttempts} attempts exhausted due to registry transport issues. Failing closed.`,
  );
  return {
    success: false,
    exitCode: 1,
    classification: lastError,
    attempts: maxAttempts,
  };
}

// CLI entrypoint if executed directly
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  (async () => {
    const rawArgs = process.argv.slice(2);
    let outputFile = null;
    let auditLevel = 'high';
    const npmAuditArgs = [];

    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      if (arg === '--output' || arg === '-o') {
        outputFile = rawArgs[++i];
      } else if (arg.startsWith('--output=')) {
        outputFile = arg.split('=')[1];
      } else if (arg === '--audit-level') {
        const next = rawArgs[++i];
        if (next) {
          auditLevel = next.toLowerCase();
          npmAuditArgs.push(arg, next);
        }
      } else if (arg.startsWith('--audit-level=')) {
        auditLevel = arg.slice('--audit-level='.length).toLowerCase();
        npmAuditArgs.push(arg);
      } else {
        npmAuditArgs.push(arg);
      }
    }

    const outcome = await runAuditWithRetry({
      args: npmAuditArgs,
      outputFile,
      auditLevel,
    });

    process.exit(outcome.exitCode);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
