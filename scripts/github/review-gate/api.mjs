const API = 'https://api.github.com';
const REPO = 'cyranoaladin/nexus-project_v0';

export function createGateClients({ readToken, appToken, fetchImpl = fetch } = {}) {
  if (typeof readToken !== 'string' || !readToken ||
      typeof appToken !== 'string' || !appToken || typeof fetchImpl !== 'function') {
    throw new Error('GITHUB_TOKEN_MISSING');
  }
  async function request(token, path, body, method = body === undefined ? 'GET' : 'POST') {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') ||
        /[\r\n#]/.test(path)) throw new Error('GITHUB_API_PATH_INVALID');
    let response;
    try {
      response = await fetchImpl(`${API}${path}`, {
        method,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch { throw new Error('GITHUB_API_UNAVAILABLE'); }
    if (!response.ok) throw new Error(`GITHUB_API_HTTP_${response.status}`);
    try { return await response.json(); } catch { throw new Error('GITHUB_API_RESPONSE_INVALID'); }
  }
  const readApi = (path) => request(readToken, path);
  return {
    readApi,
    readGraphql: (query, variables) => request(readToken, '/graphql', { query, variables }),
    createCheck: (body) => request(appToken, `/repos/${REPO}/check-runs`, body),
    updateCheck: (id, body) => {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('CHECK_ID_INVALID');
      return request(appToken, `/repos/${REPO}/check-runs/${id}`, body, 'PATCH');
    },
    readCheck: (id) => {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('CHECK_ID_INVALID');
      return readApi(`/repos/${REPO}/check-runs/${id}`);
    },
  };
}
