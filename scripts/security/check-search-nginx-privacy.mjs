#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const SEARCH_PATHS = [
  '/api/assistante/candidat-individuel/students/search',
  '/api/assistante/candidat-individuel/leads/search',
  '/api/quotes/leads/search',
  '/api/assistante/stages/planning/students/search',
];
const DANGEROUS_VARIABLES = ['$request_uri', '$args', '$query_string', '$request_body'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactLocationBody(config, endpoint) {
  return config.match(new RegExp(`location\\s*=\\s*${escapeRegExp(endpoint)}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))?.[1] ?? null;
}

function withoutComments(config) {
  return config.replace(/#.*$/gm, '');
}

function safeAccessLog(directive) {
  return /^access_log\s+(?:off|[^\s;]+\s+nexus_safe(?:\s+[^;]+)?)\s*;$/.test(directive.trim());
}

function validationFailure(rawConfig) {
  const config = withoutComments(rawConfig);
  if (!config.trim()) return 'EMPTY_CONFIG';

  const loggingDirectives = config.match(/\b(?:log_format|access_log|error_log)\b[^;]*;/g) ?? [];
  if (loggingDirectives.some((directive) => DANGEROUS_VARIABLES.some((variable) => directive.includes(variable)))) {
    return 'UNSAFE_LOG_VARIABLE';
  }

  const accessLogs = config.match(/\baccess_log\b[^;]*;/g) ?? [];
  if (accessLogs.length === 0) return 'MISSING_ACCESS_LOG';
  if (!accessLogs.every(safeAccessLog)) return 'UNSAFE_ACCESS_LOG';

  const safeLog = config.match(/log_format\s+nexus_safe\s+([\s\S]*?);/)?.[1] ?? '';
  if (!safeLog.includes('$status') || (!safeLog.includes('$uri') && !safeLog.includes('$nexus_safe_uri'))) {
    return 'UNSAFE_LOG_FORMAT';
  }

  for (const endpoint of SEARCH_PATHS) {
    const body = exactLocationBody(config, endpoint);
    if (body === null) return 'MISSING_SEARCH_LOCATION';
    const errorLogs = body.match(/\berror_log\b[^;]*;/g) ?? [];
    if (errorLogs.length === 0) return 'MISSING_ERROR_LOG';
    if (!errorLogs.every((directive) => /^error_log\s+\/dev\/null\s+crit\s*;$/.test(directive.trim()))) {
      return 'UNSAFE_ERROR_LOG';
    }
    if (!/\bproxy_pass\b[^;]*;/.test(body)) return 'MISSING_PROXY_PASS';
  }

  return null;
}

const files = process.argv.slice(2);
let failure = files.length > 0 ? null : 'MISSING_CONFIG';
for (const file of files) {
  try {
    failure ??= validationFailure(readFileSync(path.resolve(file), 'utf8'));
  } catch {
    failure ??= 'UNREADABLE_CONFIG';
  }
}

if (failure) {
  process.stderr.write(`FAIL: unsafe search Nginx privacy configuration [${failure}]\n`);
  process.exit(1);
}

process.stdout.write('OK: search Nginx privacy guard\n');
