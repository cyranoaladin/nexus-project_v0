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
  if (raw !== raw.trim()) {
    throw new Error('NEXT_PUBLIC_JITSI_SERVER_URL_INVALID');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('NEXT_PUBLIC_JITSI_SERVER_URL_INVALID');
  }
  // A final DNS dot names the same host, including the forbidden public
  // fallback and local/test names. URL.hostname deliberately retains it.
  const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
  const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
  const octets = ipv4?.slice(1).map(Number);
  const privateIpv4 = octets !== undefined && (
    octets[0] === 0 || octets[0] === 10 || octets[0] === 127 ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
  const ipv6 = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1) : null;
  const privateIpv6 = ipv6 !== null && (
    ipv6 === '::' || ipv6 === '::1' ||
    /^f[cd]/.test(ipv6) || /^fe[89ab]/.test(ipv6) ||
    ipv6.startsWith('::ffff:')
  );
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
    privateIpv4 ||
    privateIpv6 ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.test') ||
    hostname.endsWith('.example') ||
    hostname.endsWith('.invalid')
  ) {
    throw new Error('NEXT_PUBLIC_JITSI_SERVER_URL_INVALID');
  }
  return url;
}
