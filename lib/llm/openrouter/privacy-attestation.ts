import 'server-only';

import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { createHmac } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { z } from 'zod';

import { sha256Canonical } from './hash';

const MAX_ATTESTATION_BYTES = 16 * 1_024;
const MAX_ATTESTATION_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

const OwnerPrivacyAttestationSchema = z.object({
  schemaVersion: z.literal('openrouter-owner-attestation-v1'),
  source: z.literal('OWNER_DECLARATION'),
  attestedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  accountFingerprint: z.string().regex(/^hmac-sha256:[a-f0-9]{64}$/),
  guardrailFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  inputOutputLogging: z.literal(false),
  useOfInputsOutputs: z.literal(false),
  zdrAccountPolicy: z.literal(true),
  guardrailEnabled: z.literal(true),
  keySpendingLimitMicrosUsd: z.number().int().positive().safe(),
  evidenceChecksum: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type OwnerPrivacyAttestation = z.infer<
  typeof OwnerPrivacyAttestationSchema
>;

export class OpenRouterPrivacyAttestationError extends Error {
  readonly code = 'BLOCKED_BY_PRIVACY_ATTESTATION';

  constructor() {
    super('The private OpenRouter owner attestation is unavailable or invalid.');
    this.name = 'OpenRouterPrivacyAttestationError';
  }
}

type AttestationValues = Omit<OwnerPrivacyAttestation, 'evidenceChecksum'>;

function valuesForChecksum(
  input: OwnerPrivacyAttestation,
): AttestationValues {
  const { evidenceChecksum: _checksum, ...values } = input;
  return values;
}

function attestationError(): never {
  throw new OpenRouterPrivacyAttestationError();
}

function validateDates(
  attestation: OwnerPrivacyAttestation,
  now: Date,
): void {
  const attestedAt = Date.parse(attestation.attestedAt);
  const expiresAt = Date.parse(attestation.expiresAt);
  const current = now.getTime();
  if (
    !Number.isFinite(attestedAt)
    || !Number.isFinite(expiresAt)
    || attestedAt > current
    || expiresAt <= current
    || expiresAt <= attestedAt
    || expiresAt - attestedAt > MAX_ATTESTATION_AGE_MS
  ) {
    attestationError();
  }
}

export function createOwnerPrivacyAttestation(
  input: Readonly<{
    apiKey: string;
    attestedAt: string;
    expiresAt: string;
    inputOutputLogging: false;
    useOfInputsOutputs: false;
    zdrAccountPolicy: true;
    guardrailEnabled: true;
    keySpendingLimitMicrosUsd: number;
  }>,
): OwnerPrivacyAttestation {
  if (input.apiKey.length === 0) attestationError();
  const guardrailValues = {
    inputOutputLogging: input.inputOutputLogging,
    useOfInputsOutputs: input.useOfInputsOutputs,
    zdrAccountPolicy: input.zdrAccountPolicy,
    guardrailEnabled: input.guardrailEnabled,
    keySpendingLimitMicrosUsd: input.keySpendingLimitMicrosUsd,
  };
  const values: AttestationValues = {
    schemaVersion: 'openrouter-owner-attestation-v1',
    source: 'OWNER_DECLARATION',
    attestedAt: input.attestedAt,
    expiresAt: input.expiresAt,
    accountFingerprint: `hmac-sha256:${
      createHmac('sha256', input.apiKey)
        .update('nexus-openrouter-owner-account-v1')
        .digest('hex')
    }`,
    guardrailFingerprint:
      `sha256:${sha256Canonical(guardrailValues)}`,
    ...guardrailValues,
  };
  return OwnerPrivacyAttestationSchema.parse({
    ...values,
    evidenceChecksum: sha256Canonical(values),
  });
}

export function readPrivateOpenRouterPrivacyAttestation(
  path = join(
    homedir(),
    '.config',
    'nexus-secrets',
    'openrouter-privacy-attestation.json',
  ),
  now = new Date(),
): OwnerPrivacyAttestation {
  let descriptor: number | null = null;
  try {
    const directoryStat = statSync(dirname(path));
    const pathStat = lstatSync(path);
    const uid = process.getuid?.();
    if (
      !directoryStat.isDirectory()
      || (directoryStat.mode & 0o777) !== 0o700
      || !pathStat.isFile()
      || pathStat.isSymbolicLink()
      || (pathStat.mode & 0o777) !== 0o600
      || pathStat.size <= 0
      || pathStat.size > MAX_ATTESTATION_BYTES
      || (
        uid !== undefined
        && (directoryStat.uid !== uid || pathStat.uid !== uid)
      )
    ) {
      attestationError();
    }
    descriptor = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const openedStat = fstatSync(descriptor);
    if (
      !openedStat.isFile()
      || openedStat.dev !== pathStat.dev
      || openedStat.ino !== pathStat.ino
      || openedStat.size > MAX_ATTESTATION_BYTES
    ) {
      attestationError();
    }
    const raw = readFileSync(descriptor, {
      encoding: 'utf8',
    });
    const parsedJson: unknown = JSON.parse(raw);
    const parsed = OwnerPrivacyAttestationSchema.parse(parsedJson);
    if (
      parsed.evidenceChecksum
        !== sha256Canonical(valuesForChecksum(parsed))
    ) {
      attestationError();
    }
    validateDates(parsed, now);
    return Object.freeze(parsed);
  } catch (error) {
    if (error instanceof OpenRouterPrivacyAttestationError) throw error;
    throw new OpenRouterPrivacyAttestationError();
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

export function toPrivateAttestationEvidence(
  attestation: OwnerPrivacyAttestation,
): Readonly<{
  source: 'OWNER_DECLARATION';
  attestedAt: string;
  expiresAt: string;
  evidenceChecksum: string;
  accountFingerprint: string;
  guardrailFingerprint: string;
}> {
  const parsed = OwnerPrivacyAttestationSchema.parse(attestation);
  return Object.freeze({
    source: parsed.source,
    attestedAt: parsed.attestedAt,
    expiresAt: parsed.expiresAt,
    evidenceChecksum: parsed.evidenceChecksum,
    accountFingerprint: parsed.accountFingerprint,
    guardrailFingerprint: parsed.guardrailFingerprint,
  });
}
