export type BrowserDiagnosticClassification = 'APPLICATION' | 'THIRD_PARTY' | 'NETWORK';

type ObservedHttpResponse = {
  method: string;
  status: number;
  url: string;
};

const CONSOLE_NETWORK_ERROR = /Failed to (?:load resource|fetch)|net::ERR_|NetworkError|network error|fetch failed/i;
const EXPECTED_REQUEST_ABORT = /ERR_ABORTED|cancel(?:l?ed|lation)|target (?:page, context or browser|page|context|browser)?\s*(?:has been )?closed/i;

export function isSameOriginUrl(url: string, baseURL: string) {
  if (!/^https?:/i.test(url)) return false;
  return new URL(url).origin === new URL(baseURL).origin;
}

function isNonAppBrowserNoise(url: string, message: string, baseURL: string) {
  return /(?:google-analytics|googletagmanager|gtag\/js|\bGA\b|\bVM\d+\b|startTime)/i.test(`${url} ${message}`)
    || (/^https?:/i.test(url) && !isSameOriginUrl(url, baseURL));
}

function isAllowedHttpRejection(response: ObservedHttpResponse, scenario: string) {
  const { status, method } = response;
  const pathname = new URL(response.url).pathname;

  if (scenario.includes('ACTIVE_PUBLIC')) {
    return status === 400 && method === 'PATCH' && pathname === '/api/admin/config';
  }
  if (scenario.includes('RBAC, OFF')) {
    return ((status === 400 || status === 403) && method === 'POST'
      && pathname === '/api/assistante/candidat-individuel/simulate');
  }
  if (scenario.includes('wizard réel')) {
    return (status === 422 && method === 'POST'
      && /^\/api\/assistante\/candidat-individuel\/profils\/[^/]+\/quote$/.test(pathname))
      || (status === 404 && method === 'GET'
        && /^\/api\/public\/candidat-individuel\/quotes\/[^/]+$/.test(pathname));
  }
  if (scenario.includes('SVC_SECOND_GROUPE')) {
    return (status === 400 && method === 'POST'
      && pathname === '/api/assistante/candidat-individuel/simulate')
      || (status === 404 && method === 'GET'
        && /^\/api\/public\/candidat-individuel\/quotes\/[^/]+$/.test(pathname));
  }
  return false;
}

export function classifyBrowserConsole(url: string, message: string, baseURL: string): BrowserDiagnosticClassification {
  if (CONSOLE_NETWORK_ERROR.test(message)) return 'NETWORK';
  if (isNonAppBrowserNoise(url, message, baseURL)) return 'THIRD_PARTY';
  return 'APPLICATION';
}

export function classifyBrowserRequestFailure(url: string, message: string, baseURL: string): BrowserDiagnosticClassification {
  if (isNonAppBrowserNoise(url, message, baseURL)) return 'THIRD_PARTY';
  return EXPECTED_REQUEST_ABORT.test(message) ? 'NETWORK' : 'APPLICATION';
}

export function classifyObservedHttpResponse(
  response: ObservedHttpResponse,
  scenario: string,
  baseURL: string,
): BrowserDiagnosticClassification | null {
  if (!isSameOriginUrl(response.url, baseURL) || response.status < 400) return null;
  return response.status < 500 && isAllowedHttpRejection(response, scenario)
    ? 'NETWORK'
    : 'APPLICATION';
}
