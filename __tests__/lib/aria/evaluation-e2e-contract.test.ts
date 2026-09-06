import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeAriaServableManifestSha256,
  resolveAriaRagCorpusCapability,
} from '@/lib/aria/infrastructure/rag/manifest';
import { ARIA_RESOURCE_REGISTRY_SHA256 } from '@/lib/aria/manifests/resource-registry';

interface AriaE2ECase {
  readonly id: string;
  readonly persona: string;
  readonly scenario: string;
  readonly evidence: readonly string[];
}

describe('ARIA E2E qualification registry', () => {
  it('versions exactly E001 through E026 with the required personas and evidence domains', () => {
    const path = resolve(process.cwd(), 'data/aria/evaluation/conversation-e2e.v1.json');
    expect(existsSync(path)).toBe(true);
    const document = JSON.parse(readFileSync(path, 'utf8')) as {
      schemaVersion?: number;
      cases?: AriaE2ECase[];
    };
    expect(document.schemaVersion).toBe(1);
    expect(document.cases).toHaveLength(26);
    expect(document.cases?.map(({ id }) => id)).toEqual(
      Array.from({ length: 26 }, (_, index) => `E${String(index + 1).padStart(3, '0')}`),
    );
    expect(new Set(document.cases?.map(({ id }) => id)).size).toBe(26);

    const personas = new Set(document.cases?.map(({ persona }) => persona));
    for (const persona of [
      'TERMINALE_MATHS',
      'PREMIERE_MATHS',
      'NSI',
      'STMG_NO_CHAT',
      'INCOMPLETE_PROFILE',
      'NOT_ENTITLED',
    ]) expect(personas).toContain(persona);

    expect(document.cases?.map(({ scenario }) => scenario)).toEqual([
      'LOGIN_CHAT',
      'PREMIERE_MATHS_FAIL_CLOSED',
      'NSI_CHAT',
      'NO_CHAT',
      'INCOMPLETE_PROFILE',
      'NOT_ENTITLED',
      'COURSE_SWITCHING',
      'DEEP_CONTEXT_CITATION',
      'HISTORY_RELOAD',
      'RETRY_DISCONNECT',
      'CONVERSATION_BUSY',
      'CANCEL',
      'FEEDBACK',
      'RAG_UNAVAILABLE',
      'MODEL_TIMEOUT',
      'CROSS_STUDENT',
      'CROSS_COURSE',
      'VIEWPORT_390X844',
      'VIEWPORT_768X1024',
      'VIEWPORT_1366X768',
      'VIEWPORT_1440X900',
      'KEYBOARD_FOCUS_LIVE',
      'MARKDOWN_XSS',
      'STREAM_STRESS',
      'RUNTIME_QUALITY',
      'PUBLIC_STATIC_DEMO',
    ]);

    for (const qualification of document.cases ?? []) {
      expect(qualification.evidence.length).toBeGreaterThan(0);
      expect(new Set(qualification.evidence).size).toBe(qualification.evidence.length);
    }
  });

  it('binds the disposable RAG manifest only to active canonical ResourceVersions', () => {
    const digest = 'a09b2844efff34329770358bf9d93a34a1d2194204a1e1396ad552b0195be4e8';
    const path = resolve(process.cwd(), 'data/aria/testing/rag', `${digest}.json`);
    expect(existsSync(path)).toBe(true);
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const { manifest_sha256: manifestSha256, ...payload } = manifest;
    expect(manifestSha256).toBe(digest);
    expect(computeAriaServableManifestSha256(payload)).toBe(digest);
    for (const courseKey of [
      'eds-maths-terminale',
      'eds-nsi-premiere',
      'eds-nsi-terminale',
    ]) {
      expect(resolveAriaRagCorpusCapability({
        courseKey,
        pedagogicalMode: 'DISCOVERY',
        agentRole: 'TUTOR',
        manifest,
        expectedResourceRegistrySha256: ARIA_RESOURCE_REGISTRY_SHA256,
      }).status).toBe('AVAILABLE');
    }
    expect(resolveAriaRagCorpusCapability({
      courseKey: 'eds-maths-premiere',
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
      manifest,
      expectedResourceRegistrySha256: ARIA_RESOURCE_REGISTRY_SHA256,
    }).status).toBe('UNAVAILABLE');
  });
});
