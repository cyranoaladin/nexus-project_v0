import { resolvePublicLinkTarget } from '../../e2e/helpers/public-link-target';

const base = 'https://synthetic.invalid/offres';

describe('public link request boundary', () => {
  test.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' \tjavascript:alert(1)', 'java\nscript:alert(1)', '\u0000javascript:alert(1)', 'data:text/plain,synthetic', 'file:///synthetic', 'blob:https://synthetic.invalid/synthetic', 'http://[', 'https://fixture@synthetic.invalid/contact', 'https://synthetic.invalid@external.invalid/contact', 'https://user:pass@external.invalid/', 'http://:secret@external.invalid/'])('rejects an unsafe target: %j', href => {
    expect(resolvePublicLinkTarget(href, base)).toEqual({ kind: 'UNSAFE' });
  });

  test.each(['/contact', 'https://synthetic.invalid/contact', 'HTTPS://SYNTHETIC.INVALID/contact'])('checks an internal HTTP target: %s', href => {
    expect(resolvePublicLinkTarget(href, base)).toEqual({ kind: 'INTERNAL', url: 'https://synthetic.invalid/contact' });
  });

  test.each(['//external.invalid/contact', 'https://synthetic.invalid.external.invalid/contact', 'https://synthetiс.invalid/contact'])('does not request an external origin: %s', href => {
    expect(resolvePublicLinkTarget(href, base)).toEqual({ kind: 'EXTERNAL' });
  });

  test.each(['#details', 'mailto:fixture@synthetic.invalid', 'tel:+000000000'])('preserves intentional non-navigation links: %s', href => {
    expect(resolvePublicLinkTarget(href, base)).toEqual({ kind: 'SKIP' });
  });
});
