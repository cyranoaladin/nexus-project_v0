import { execFileSync as defaultExecFileSync } from 'node:child_process';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// A GraphQL mutation travels as `gh api graphql -f query=…` with no `-X`, so
// counting verbs alone reported it as a read. That made "API_WRITE_CALLS=0" a
// claim about REST only, while the repository's first GraphQL mutations (the
// classic branch-protection operator path) would have passed unnoticed.
const GRAPHQL_MUTATION = /^\s*(?:#[^\n]*\n\s*)*mutation\b/;

function isWriteCall(args) {
  const verbIndex = args.indexOf('-X');
  if (verbIndex !== -1 && WRITE_METHODS.has(args[verbIndex + 1])) return true;
  if (!args.includes('graphql')) return false;
  return args.some((arg) => GRAPHQL_MUTATION.test(String(arg).replace(/^query=/, '')));
}

// execFileSyncImpl is injectable so callers (and tests) never depend on a
// real `gh` binary or network access — see __tests__/governance for fakes
// that record every invocation instead of executing it.
export function createGhClient(execFileSyncImpl = defaultExecFileSync) {
  const calls = [];

  function raw(args) {
    calls.push([...args]);
    return execFileSyncImpl('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  function apiJson(path, { method = 'GET', fields = [] } = {}) {
    const args = ['api', path, '-X', method];
    for (const [key, value] of fields) {
      args.push('-f', `${key}=${value}`);
    }
    return JSON.parse(raw(args));
  }

  function graphql(query, fields = {}) {
    // `query` is always a string, so `-f` (raw-field) is correct for it.
    // GraphQL variables are typed (e.g. Int!), so they must go through
    // `-F` (typed field), which lets `gh` coerce numeric/boolean literals
    // instead of sending everything as a string.
    const args = ['api', 'graphql', '-f', `query=${query}`];
    for (const [key, value] of Object.entries(fields)) {
      args.push('-F', `${key}=${value}`);
    }
    return JSON.parse(raw(args));
  }

  function writeCallCount() {
    return calls.filter(isWriteCall).length;
  }

  return { raw, apiJson, graphql, calls, writeCallCount };
}
