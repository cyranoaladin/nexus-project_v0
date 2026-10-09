/** @jest-environment node */
import { randomBytes } from 'node:crypto';
import { extractCoreAccountMailToken } from '@/e2e/helpers/core-v2-mail-link';

const paths = ['/auth/activate', '/auth/reset-password'] as const;
test.each(paths)('reads a versioned token from a real URL in text and HTML (%s)', path => {
  const verifier = `v1:e2e:${randomBytes(32).toString('base64url')}`;
  const link = `http://app-e2e:3000${path}?purpose=core-v2&token=${encodeURIComponent(verifier)}`;
  expect(extractCoreAccountMailToken(`Lien : ${link}`, path) === verifier).toBe(true);
  expect(extractCoreAccountMailToken(`<a href="${link.replaceAll('&', '&amp;')}">Activer</a>`, path) === verifier).toBe(true);
});

test.each(paths)('refuses wrong purpose, path, duplicate tokens and invalid formats (%s)', path => {
  const verifier = `v1:e2e:${randomBytes(32).toString('base64url')}`;
  for (const candidate of [
    `${path}?purpose=parent&token=${encodeURIComponent(verifier)}`,
    `/unrelated?purpose=core-v2&token=${encodeURIComponent(verifier)}`,
    `${path}?purpose=core-v2&token=${encodeURIComponent(verifier)}&token=duplicate`,
    `${path}?purpose=core-v2&token=${'a'.repeat(43)}`,
    `${path}?purpose=core-v2&token=${encodeURIComponent(verifier + ':extra')}`,
  ]) expect(extractCoreAccountMailToken(`http://app-e2e:3000${candidate}`, path) === null).toBe(true);
});
