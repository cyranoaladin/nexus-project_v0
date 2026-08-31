import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  inspectSearchPrivacyRequest,
  inspectSearchPrivacyText,
  scanSearchPrivacyArtifacts,
} from '@/e2e/helpers/search-privacy';

const markers = ['Privacy Search Name', 'privacy-search@example.invalid'];
const baseURL = 'https://nexus.example.test';

describe('search privacy browser harness', () => {
  test('excludes only exact first-party search POST bodies', () => {
    for (const pathname of [
      '/api/assistante/candidat-individuel/students/search',
      '/api/assistante/candidat-individuel/leads/search',
      '/api/quotes/leads/search',
      '/api/assistante/stages/planning/students/search',
    ]) {
      expect(inspectSearchPrivacyRequest({
        url: `${baseURL}${pathname}`,
        method: 'POST',
        headers: { referer: `${baseURL}/dashboard/admin/candidat-individuel` },
        postData: JSON.stringify({ query: markers[0] }),
      }, baseURL, markers)).toEqual([]);
    }

    expect(inspectSearchPrivacyRequest({
      url: `${baseURL}/api/quotes/leads/search?query=${encodeURIComponent(markers[0])}`,
      method: 'POST', headers: {}, postData: JSON.stringify({ query: markers[0] }),
    }, baseURL, markers)).toEqual(expect.arrayContaining(['request-url']));
    expect(inspectSearchPrivacyRequest({
      url: `${baseURL}/api/quotes/leads/search`, method: 'GET', headers: {}, postData: markers[0],
    }, baseURL, markers)).toEqual(expect.arrayContaining(['first-party-body']));
  });

  test('detects headers, referrer, console, pageerror, dataLayer, collect, and third-party bodies without returning PII', () => {
    const findings = [
      ...inspectSearchPrivacyRequest({ url: `${baseURL}/safe`, method: 'GET', headers: { referer: `${baseURL}/?q=${markers[0]}` }, postData: null }, baseURL, markers),
      ...inspectSearchPrivacyRequest({ url: `https://www.google-analytics.com/g/collect?q=${encodeURIComponent(markers[0])}`, method: 'POST', headers: { 'x-marker': markers[1] }, postData: markers[0] }, baseURL, markers),
      ...inspectSearchPrivacyText('console', markers[0], markers),
      ...inspectSearchPrivacyText('pageerror', markers[1], markers),
      ...inspectSearchPrivacyText('data-layer', JSON.stringify({ search_term: markers[0] }), markers),
    ];
    expect(findings).toEqual(expect.arrayContaining([
      'request-referrer', 'request-url', 'request-header', 'analytics-body', 'console', 'pageerror', 'data-layer',
    ]));
    expect(JSON.stringify(findings)).not.toContain(markers[0]);
    expect(JSON.stringify(findings)).not.toContain(markers[1]);
  });

  test('scans artifact names and content while returning stable PII-free findings', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'ci-search-privacy-'));
    try {
      await mkdir(path.join(root, 'trace'), { recursive: true });
      await writeFile(path.join(root, `trace/${markers[0]}.json`), JSON.stringify({ safe: true }));
      await writeFile(path.join(root, 'trace/network.har'), JSON.stringify({ value: markers[1] }));
      const findings = await scanSearchPrivacyArtifacts(root, markers);
      expect(findings).toEqual(['artifact-content', 'artifact-name']);
      expect(JSON.stringify(findings)).not.toContain(markers[0]);
      expect(JSON.stringify(findings)).not.toContain(markers[1]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
