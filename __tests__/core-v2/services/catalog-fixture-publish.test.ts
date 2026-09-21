import { createHash } from 'node:crypto';
import { publishCatalogFixture, type CatalogFixtureContent } from '@/lib/core-v2/diagnostics/catalog';
import { setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function content(overrides: Partial<CatalogFixtureContent> = {}): CatalogFixtureContent {
  return {
    instrumentKey: 'PUBLISH-TEST-01',
    version: '1.0.0',
    title: 'Publish test instrument',
    subject: 'Test',
    level: 'Toutes',
    targetSession: 'DEMO',
    form: 'FORM_TEST',
    durationMinutes: 10,
    modalities: 'Test only.',
    catalogStatus: 'DEMO_FIXTURE',
    manifestChecksum: sha256('manifest'),
    manifestVersion: 'test/1.0',
    subjectSha256: sha256('subject-content-v1'),
    ...overrides,
  };
}

describe('publishCatalogFixture — mission §5 idempotency contract', () => {
  test('creates a new row when the (instrumentKey, version) pair does not exist yet', async () => {
    const result = await publishCatalogFixture(h.client, content());
    expect(result.created).toBe(true);
    expect(result.instrument.subjectSha256).toBe(sha256('subject-content-v1'));
  });

  test('a repeated publish with IDENTICAL content is a no-op — same row, created=false', async () => {
    const first = await publishCatalogFixture(h.client, content());
    const second = await publishCatalogFixture(h.client, content());
    expect(second.created).toBe(false);
    expect(second.instrument.id).toBe(first.instrument.id);

    const count = await h.client.diagnosticInstrumentRef.count({
      where: { instrumentKey: 'PUBLISH-TEST-01', version: '1.0.0' },
    });
    expect(count).toBe(1); // never a second row, never a silent update
  });

  test('publishing DIFFERENT content under the SAME (instrumentKey, version) is refused explicitly — never a silent replacement', async () => {
    await publishCatalogFixture(h.client, content());
    await expect(
      publishCatalogFixture(h.client, content({ subjectSha256: sha256('a-completely-different-subject') })),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });

    const stored = await h.client.diagnosticInstrumentRef.findUniqueOrThrow({
      where: { instrumentKey_version: { instrumentKey: 'PUBLISH-TEST-01', version: '1.0.0' } },
    });
    expect(stored.subjectSha256).toBe(sha256('subject-content-v1')); // untouched by the refused attempt
  });

  test('publishing different content under a NEW version succeeds normally — versions are how content actually changes', async () => {
    await publishCatalogFixture(h.client, content());
    const v2 = await publishCatalogFixture(
      h.client,
      content({ version: '2.0.0', subjectSha256: sha256('subject-content-v2') }),
    );
    expect(v2.created).toBe(true);

    const rows = await h.client.diagnosticInstrumentRef.findMany({ where: { instrumentKey: 'PUBLISH-TEST-01' } });
    expect(rows).toHaveLength(2);
  });
});
