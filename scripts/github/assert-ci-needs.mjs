#!/usr/bin/env node

export function assertCiNeeds(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('CI_NEEDS_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CI_NEEDS_INVALID');
  }
  const entries = Object.entries(parsed);
  if (entries.length === 0) throw new Error('CI_NEEDS_EMPTY');
  for (const [job, value] of entries) {
    const result = value && typeof value === 'object' ? value.result : undefined;
    if (typeof result !== 'string') throw new Error(`CI_REQUIRED_JOB_RESULT_INVALID:${job}`);
    if (result !== 'success') throw new Error(`CI_REQUIRED_JOB_NOT_SUCCESS:${job}:${result}`);
  }
  return entries.map(([job]) => job).sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const jobs = assertCiNeeds(process.env.CI_NEEDS_JSON ?? '');
  process.stdout.write(`CI_REQUIRED_JOBS_SUCCESS=${jobs.length}\n`);
}
