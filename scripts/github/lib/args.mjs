export function fail(code, details = '') {
  const suffix = details ? `: ${details}` : '';
  process.stderr.write(`${code}${suffix}\n`);
  process.exit(1);
}

// Extends the repo's `--key value` pair convention (see
// scripts/security/validate-dev-tooling-exception.mjs) with boolean flags
// (--apply, --offline, --live) that governance tooling needs and the
// original strict-pairs parser cannot express.
export function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) {
      fail('INVALID_ARGUMENTS', token ?? '(missing)');
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

export function requireArguments(parsed, names) {
  for (const name of names) {
    if (parsed[name] === undefined) {
      fail('INVALID_ARGUMENTS', `--${name}`);
    }
  }
}
