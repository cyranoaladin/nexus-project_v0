import { execFileSync as defaultExecFileSync } from 'node:child_process';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

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
    const args = ['api', 'graphql', '-f', `query=${query}`];
    for (const [key, value] of Object.entries(fields)) {
      args.push('-f', `${key}=${value}`);
    }
    return JSON.parse(raw(args));
  }

  function writeCallCount() {
    return calls.filter((args) => {
      const flagIndex = args.indexOf('-X');
      return flagIndex !== -1 && WRITE_METHODS.has(args[flagIndex + 1]);
    }).length;
  }

  return { raw, apiJson, graphql, calls, writeCallCount };
}
