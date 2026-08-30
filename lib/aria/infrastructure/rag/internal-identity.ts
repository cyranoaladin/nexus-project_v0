import { createHash, createHmac } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import internalIdentityEnvelopeSchema from '@/data/aria/generated/rag-contracts/v1/internal-identity-envelope.json';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateInternalIdentityEnvelope = ajv.compile(internalIdentityEnvelopeSchema);

const IDENTITY_CONFIGURATION_ERROR = 'ARIA_RAG_IDENTITY_CONFIGURATION_INVALID';
const IDENTITY_ENVELOPE_ERROR = 'ARIA_RAG_IDENTITY_ENVELOPE_INVALID';

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  throw new Error(IDENTITY_ENVELOPE_ERROR);
}

export function canonicalAriaRagJson(value: unknown): Uint8Array {
  return Buffer.from(JSON.stringify(canonicalize(value)), 'utf8');
}

export function sha256AriaRagJson(value: unknown): string {
  return createHash('sha256').update(canonicalAriaRagJson(value)).digest('hex');
}

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

function requireValidEnvelope(envelope: unknown): asserts envelope is Record<string, unknown> {
  if (!validateInternalIdentityEnvelope(envelope)) throw new Error(IDENTITY_ENVELOPE_ERROR);

  const transport = envelope as Record<string, unknown>;
  const identity = transport.identity as Record<string, unknown>;
  const requestSha256 = transport.request_sha256;
  const manifestSha256 = transport.manifest_sha256;
  const iat = transport.iat as number;
  const exp = transport.exp as number;

  if (transport.sub !== identity.sub
    || transport.jti !== identity.jti
    || exp > (identity.exp as number)
    || iat > exp
    || (requestSha256 === null) !== (manifestSha256 === null)
    || (typeof requestSha256 === 'string' && exp - iat > 30)) {
    throw new Error(IDENTITY_ENVELOPE_ERROR);
  }
}

export interface AriaRagIdentitySignerConfig {
  readonly signingKey: string;
  readonly issuer: string;
  readonly audience: string;
  readonly identityIssuer: string;
  readonly identityAudience: string;
}

export function loadAriaRagIdentitySignerConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AriaRagIdentitySignerConfig {
  const config = {
    signingKey: env.NEXUS_INTERNAL_TOKEN_SECRET?.trim() ?? '',
    issuer: env.NEXUS_INTERNAL_TOKEN_ISSUER?.trim() ?? '',
    audience: env.NEXUS_INTERNAL_TOKEN_AUDIENCE?.trim() ?? '',
    identityIssuer: env.NEXUS_SSO_ISSUER?.trim() ?? '',
    identityAudience: env.NEXUS_SSO_AUDIENCE?.trim() ?? '',
  };
  if (Object.values(config).some((value) => !value)
    || Buffer.byteLength(config.signingKey, 'utf8') < 32
    || config.identityAudience.includes(',')) {
    throw new Error(IDENTITY_CONFIGURATION_ERROR);
  }
  return Object.freeze(config);
}

export function createAriaRagInternalIdentityToken(input: {
  readonly envelope: unknown;
  readonly signingKey: string;
}): string {
  if (Buffer.byteLength(input.signingKey, 'utf8') < 32) {
    throw new Error(IDENTITY_CONFIGURATION_ERROR);
  }
  requireValidEnvelope(input.envelope);
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}', 'ascii');
  const signingInput = `${base64Url(header)}.${base64Url(canonicalAriaRagJson(input.envelope))}`;
  const signature = createHmac('sha256', input.signingKey).update(signingInput, 'ascii').digest();
  return `${signingInput}.${base64Url(signature)}`;
}
