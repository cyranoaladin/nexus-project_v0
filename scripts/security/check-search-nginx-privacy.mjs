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

function isSafe(config) {
  if (!config.trim() || DANGEROUS_VARIABLES.some((variable) => config.includes(variable))) return false;

  const safeLog = config.match(/log_format\s+nexus_safe\s+([\s\S]*?);/)?.[1] ?? '';
  if (!safeLog.includes('$status') || (!safeLog.includes('$uri') && !safeLog.includes('$nexus_safe_uri'))) {
    return false;
  }

  return SEARCH_PATHS.every((endpoint) => {
    const body = exactLocationBody(config, endpoint);
    return body !== null
      && /\berror_log\s+\/dev\/null\s+crit\s*;/.test(body)
      && /\bproxy_pass\b/.test(body);
  });
}

const files = process.argv.slice(2);
let safe = files.length > 0;
for (const file of files) {
  try {
    safe = safe && isSafe(readFileSync(path.resolve(file), 'utf8'));
  } catch {
    safe = false;
  }
}

if (!safe) {
  process.stderr.write('FAIL: unsafe search Nginx privacy configuration\n');
  process.exit(1);
}

process.stdout.write('OK: search Nginx privacy guard\n');
