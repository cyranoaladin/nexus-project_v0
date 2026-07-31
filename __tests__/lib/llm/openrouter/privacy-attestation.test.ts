/** @jest-environment node */

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createOwnerPrivacyAttestation,
  readPrivateOpenRouterPrivacyAttestation,
  toPrivateAttestationEvidence,
} from '@/lib/llm/openrouter/privacy-attestation';

const NOW = new Date('2026-07-31T12:00:00.000Z');

describe('private OpenRouter owner attestation', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(options: Readonly<{
    attestedAt?: string;
    expiresAt?: string;
  }> = {}) {
    const root = mkdtempSync(join(tmpdir(), 'nexus-privacy-attestation-'));
    roots.push(root);
    const directory = join(root, 'nexus-secrets');
    mkdirSync(directory, { mode: 0o700 });
    chmodSync(directory, 0o700);
    const path = join(directory, 'openrouter-privacy-attestation.json');
    const attestation = createOwnerPrivacyAttestation({
      apiKey: 'synthetic-private-key',
      attestedAt: options.attestedAt ?? '2026-07-31T11:00:00.000Z',
      expiresAt: options.expiresAt ?? '2026-08-29T11:00:00.000Z',
      inputOutputLogging: false,
      useOfInputsOutputs: false,
      zdrAccountPolicy: true,
      guardrailEnabled: true,
      keySpendingLimitMicrosUsd: 2_000_000,
    });
    writeFileSync(path, `${JSON.stringify(attestation, null, 2)}\n`, {
      mode: 0o600,
    });
    chmodSync(path, 0o600);
    return { root, directory, path, attestation };
  }

  it('reads a strict valid owner declaration and exposes only safe evidence', () => {
    const { path, attestation } = fixture();
    const parsed = readPrivateOpenRouterPrivacyAttestation(path, NOW);

    expect(parsed).toEqual(attestation);
    expect(toPrivateAttestationEvidence(parsed)).toEqual({
      source: 'OWNER_DECLARATION',
      attestedAt: '2026-07-31T11:00:00.000Z',
      expiresAt: '2026-08-29T11:00:00.000Z',
      evidenceChecksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      accountFingerprint: expect.stringMatching(
        /^hmac-sha256:[a-f0-9]{64}$/,
      ),
      guardrailFingerprint: expect.stringMatching(
        /^sha256:[a-f0-9]{64}$/,
      ),
    });
    expect(JSON.stringify(toPrivateAttestationEvidence(parsed)))
      .not.toContain('synthetic-private-key');
  });

  it('blocks an absent attestation with the canonical status', () => {
    const { path } = fixture();
    rmSync(path);

    expect(() => readPrivateOpenRouterPrivacyAttestation(path, NOW))
      .toThrow(expect.objectContaining({
        code: 'BLOCKED_BY_PRIVACY_ATTESTATION',
      }));
  });

  it.each([
    ['directory mode', ({ directory }: ReturnType<typeof fixture>) =>
      chmodSync(directory, 0o755)],
    ['file mode', ({ path }: ReturnType<typeof fixture>) =>
      chmodSync(path, 0o644)],
    ['unknown key', ({ path, attestation }: ReturnType<typeof fixture>) =>
      writeFileSync(path, JSON.stringify({
        ...attestation,
        unexpected: true,
      }), { mode: 0o600 })],
    ['checksum', ({ path, attestation }: ReturnType<typeof fixture>) =>
      writeFileSync(path, JSON.stringify({
        ...attestation,
        keySpendingLimitMicrosUsd: 1_999_999,
      }), { mode: 0o600 })],
  ])('blocks an invalid %s', (_label, mutate) => {
    const value = fixture();
    mutate(value);
    expect(() => readPrivateOpenRouterPrivacyAttestation(value.path, NOW))
      .toThrow(expect.objectContaining({
        code: 'BLOCKED_BY_PRIVACY_ATTESTATION',
      }));
  });

  it('blocks a symlink without following it', () => {
    const target = fixture();
    const linkRoot = mkdtempSync(join(tmpdir(), 'nexus-attestation-link-'));
    roots.push(linkRoot);
    chmodSync(linkRoot, 0o700);
    const link = join(linkRoot, 'openrouter-privacy-attestation.json');
    symlinkSync(target.path, link);

    expect(() => readPrivateOpenRouterPrivacyAttestation(link, NOW))
      .toThrow(expect.objectContaining({
        code: 'BLOCKED_BY_PRIVACY_ATTESTATION',
      }));
  });

  it.each([
    [
      'expired',
      '2026-07-01T00:00:00.000Z',
      '2026-07-30T00:00:00.000Z',
    ],
    [
      'future',
      '2026-07-31T13:00:00.000Z',
      '2026-08-01T13:00:00.000Z',
    ],
    [
      'longer than thirty days',
      '2026-07-01T00:00:00.000Z',
      '2026-08-01T00:00:00.001Z',
    ],
  ])('blocks an attestation that is %s', (_label, attestedAt, expiresAt) => {
    const { path } = fixture({ attestedAt, expiresAt });
    expect(() => readPrivateOpenRouterPrivacyAttestation(path, NOW))
      .toThrow(expect.objectContaining({
        code: 'BLOCKED_BY_PRIVACY_ATTESTATION',
      }));
  });
});
