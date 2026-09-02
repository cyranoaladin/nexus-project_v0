const GOOGLE_TAG_MANAGER_HOSTS = new Set(['googletagmanager.com', 'www.googletagmanager.com']);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isIgnoredFailedResponseUrl(responseUrl: string, applicationUrl?: string): boolean {
  const response = parseUrl(responseUrl);
  if (!response) {
    return false;
  }

  if (
    response.protocol === 'https:' &&
    response.port === '' &&
    GOOGLE_TAG_MANAGER_HOSTS.has(response.hostname)
  ) {
    return true;
  }

  const application = applicationUrl ? parseUrl(applicationUrl) : null;
  if (!application || response.origin !== application.origin) {
    return false;
  }

  return (
    response.pathname.startsWith('/_next/static/') ||
    response.pathname === '/_next/image' ||
    response.pathname === '/favicon.ico'
  );
}
