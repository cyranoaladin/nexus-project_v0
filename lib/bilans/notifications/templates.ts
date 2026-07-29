import 'server-only';

import { hashBilanToken } from '@/lib/bilans/requests/tokens';

const CANONICAL_PUBLIC_ORIGIN = 'https://nexusreussite.academy';

type PublicOriginEnvironment = Readonly<{
  nodeEnv?: string;
  nextAuthUrl?: string;
  publicAppUrl?: string;
}>;

type BilanMagicLinkEmailInput = Readonly<{
  publicOrigin: string;
  rawToken: string;
  parentFirstName?: string | null;
}>;

export type BilanMagicLinkEmail = Readonly<{
  subject: string;
  html: string;
  text: string;
  url: string;
}>;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function resolveBilanPublicOrigin(
  environment: PublicOriginEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  },
): string {
  const candidate = environment.nextAuthUrl
    ?? environment.publicAppUrl
    ?? CANONICAL_PUBLIC_ORIGIN;

  try {
    const url = new URL(candidate);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const allowedProtocol = url.protocol === 'https:'
      || (environment.nodeEnv !== 'production' && isLocal && url.protocol === 'http:');
    const cleanOrigin = !url.username
      && !url.password
      && (url.pathname === '' || url.pathname === '/')
      && !url.search
      && !url.hash;

    if (!allowedProtocol || !cleanOrigin) {
      throw new Error('Invalid bilan public origin');
    }
    return url.origin;
  } catch {
    throw new Error('Invalid bilan public origin');
  }
}

export function buildBilanMagicLinkEmail(
  input: BilanMagicLinkEmailInput,
): BilanMagicLinkEmail {
  hashBilanToken(input.rawToken);
  const publicOrigin = resolveBilanPublicOrigin({
    nodeEnv: process.env.NODE_ENV,
    nextAuthUrl: input.publicOrigin,
  });
  const url = `${publicOrigin}/auth/bilan-magic#token=${encodeURIComponent(input.rawToken)}`;
  const greeting = input.parentFirstName?.trim()
    ? `Bonjour ${escapeHtml(input.parentFirstName.trim())},`
    : 'Bonjour,';

  return {
    subject: 'Reprenez votre demande de bilan Nexus Réussite',
    url,
    html: [
      `<p>${greeting}</p>`,
      '<p>Votre lien sécurisé vous permet de reprendre votre demande de bilan.</p>',
      `<p><a href="${escapeHtml(url)}">Reprendre ma demande</a></p>`,
      '<p>Ce lien est personnel, à usage unique et expire rapidement.</p>',
    ].join(''),
    text: [
      input.parentFirstName?.trim()
        ? `Bonjour ${input.parentFirstName.trim()},`
        : 'Bonjour,',
      '',
      'Votre lien sécurisé vous permet de reprendre votre demande de bilan.',
      url,
      '',
      'Ce lien est personnel, à usage unique et expire rapidement.',
    ].join('\n'),
  };
}
