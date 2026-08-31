import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page, Request as PlaywrightRequest } from '@playwright/test';

export type SearchPrivacyFinding =
  | 'analytics-body'
  | 'artifact-content'
  | 'artifact-name'
  | 'console'
  | 'data-layer'
  | 'first-party-body'
  | 'pageerror'
  | 'request-header'
  | 'request-referrer'
  | 'request-url'
  | 'third-party-body';

const SEARCH_POST_PATHS = new Set([
  '/api/assistante/candidat-individuel/students/search',
  '/api/assistante/candidat-individuel/leads/search',
  '/api/quotes/leads/search',
  '/api/assistante/stages/planning/students/search',
]);

type ObservedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData: string | null;
};

function containsMarker(value: string | null | undefined, markers: readonly string[]): boolean {
  if (!value) return false;
  const normalized = value.toLocaleLowerCase('fr-FR');
  return markers.some((marker) => normalized.includes(marker.toLocaleLowerCase('fr-FR')));
}

function decodeUrlForInspection(url: URL): string {
  try {
    return decodeURIComponent(url.href);
  } catch {
    return url.href;
  }
}

export function inspectSearchPrivacyText(
  surface: Extract<SearchPrivacyFinding, 'console' | 'data-layer' | 'pageerror'>,
  value: string,
  markers: readonly string[],
): SearchPrivacyFinding[] {
  return containsMarker(value, markers) ? [surface] : [];
}

export function inspectSearchPrivacyRequest(
  request: ObservedRequest,
  baseURL: string,
  markers: readonly string[],
): SearchPrivacyFinding[] {
  const findings: SearchPrivacyFinding[] = [];
  const url = new URL(request.url, baseURL);
  const base = new URL(baseURL);
  const headerEntries = Object.entries(request.headers);
  const referrer = headerEntries.find(([name]) => name.toLowerCase() === 'referer')?.[1];

  if (containsMarker(decodeUrlForInspection(url), markers)) findings.push('request-url');
  if (containsMarker(referrer, markers)) findings.push('request-referrer');
  if (headerEntries.some(([name, value]) => containsMarker(`${name}:${value}`, markers))) {
    findings.push('request-header');
  }

  if (containsMarker(request.postData, markers)) {
    const exactAllowedPost = request.method.toUpperCase() === 'POST'
      && url.origin === base.origin
      && SEARCH_POST_PATHS.has(url.pathname)
      && url.search === '';
    if (!exactAllowedPost) {
      if (/google-analytics\.com$|analytics\.google\.com$|\/collect$/i.test(`${url.hostname}${url.pathname}`)) {
        findings.push('analytics-body');
      } else if (url.origin !== base.origin) {
        findings.push('third-party-body');
      } else {
        findings.push('first-party-body');
      }
    }
  }

  return findings;
}

async function artifactFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
      const candidate = path.join(root, entry.name);
      return entry.isDirectory() ? artifactFiles(candidate) : [candidate];
    }));
    return files.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function scanSearchPrivacyArtifacts(
  root: string,
  markers: readonly string[],
): Promise<SearchPrivacyFinding[]> {
  const findings = new Set<SearchPrivacyFinding>();
  for (const file of await artifactFiles(root)) {
    if (containsMarker(path.basename(file), markers)) findings.add('artifact-name');
    if (containsMarker((await readFile(file)).toString('utf8'), markers)) findings.add('artifact-content');
  }
  return [...findings].sort();
}

export function attachSearchPrivacyObserver(page: Page, markers: readonly string[], baseURL: string) {
  const findings: SearchPrivacyFinding[] = [];

  const observeRequest = (request: PlaywrightRequest) => {
    findings.push(...inspectSearchPrivacyRequest({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData(),
    }, baseURL, markers));
  };

  page.on('request', observeRequest);
  page.on('console', (message) => {
    findings.push(...inspectSearchPrivacyText('console', message.text(), markers));
  });
  page.on('pageerror', (error) => {
    findings.push(...inspectSearchPrivacyText('pageerror', error.message, markers));
  });

  return {
    findings,
    async settle() {
      // Request snapshots are captured synchronously, including aborted requests.
    },
    async inspectDataLayer() {
      const leaked = await page.evaluate((searchMarkers) => {
        const dataLayer = (window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? [];
        let serialized = '';
        try {
          serialized = JSON.stringify(dataLayer).toLocaleLowerCase('fr-FR');
        } catch {
          return true;
        }
        return searchMarkers.some((marker) => serialized.includes(marker.toLocaleLowerCase('fr-FR')));
      }, [...markers]);
      if (leaked) findings.push('data-layer');
    },
  };
}
