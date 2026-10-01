/**
 * One public, build-time video capability contract. This module is safe in a
 * client bundle, on Edge, and in Node. Do not import server secrets here.
 *
 * An absent mode is the pre-existing JITSI contract, not an opt-out. Preview
 * delivery must choose an explicit mode; its dispatcher validates that choice.
 */
export type VideoMode = 'DISABLED' | 'JITSI';

export function parseVideoMode(value: string | undefined): VideoMode {
  if (value === undefined) return 'JITSI';
  if (value === 'DISABLED' || value === 'JITSI') return value;
  throw new Error('VIDEO_MODE_INVALID');
}

export function getVideoMode(): VideoMode {
  return parseVideoMode(process.env.NEXT_PUBLIC_VIDEO_MODE);
}

/** No silent fallback for explicit JITSI delivery configuration. */
export function parseDedicatedJitsiUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('NEXT_PUBLIC_JITSI_SERVER_URL_INVALID');
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    !hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    hostname === 'meet.jit.si' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.test') ||
    hostname.endsWith('.example') ||
    hostname.endsWith('.invalid')
  ) {
    throw new Error('NEXT_PUBLIC_JITSI_SERVER_URL_INVALID');
  }
  return url;
}
