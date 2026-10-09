/**
 * Security regression for GHSA-238p-pmpm-9mq7 (KaTeX: existing prototype
 * pollution can bypass trust restrictions, vulnerable >=0.11.0 <0.18.2).
 *
 * The app renders lesson TeX through katex.renderToString with trust:false
 * (components/espace/shared/RichText.tsx: texToHtml). This proves that even when
 * Object.prototype is polluted, trust stays disabled: no \href link, no
 * javascript: URL, no external resource is emitted. On a vulnerable KaTeX
 * (<0.18.2) the pollution flips trust on and \href renders a live anchor — this
 * test goes RED there and GREEN on the pinned 0.18.2.
 */
import katex from 'katex';

// Exact options used by the app's render path (RichText.tsx texToHtml).
const APP_OPTIONS = {
  displayMode: false,
  throwOnError: false,
  output: 'htmlAndMathml' as const,
  strict: 'ignore' as const,
  trust: false,
};

function render(tex: string, options: Record<string, unknown> = {}) {
  return katex.renderToString(tex, { ...APP_OPTIONS, ...options });
}

describe('KaTeX trust under prototype pollution (GHSA-238p-pmpm-9mq7)', () => {
  const pollutionKeys = ['trust'];
  let polluted = false;

  afterEach(() => {
    if (polluted) {
      for (const key of pollutionKeys) {
        delete (Object.prototype as Record<string, unknown>)[key];
      }
      polluted = false;
    }
  });

  function pollutePrototype() {
    // The advisory's gadget: an attacker-controlled prototype makes `trust`
    // resolve truthy on objects that never set it as an own property.
    (Object.prototype as Record<string, unknown>).trust = true;
    polluted = true;
  }

  test('pinned KaTeX is >= 0.18.2 (advisory fixed range)', () => {
    const [major, minor, patch] = (katex.version as string).split('.').map(Number);
    const atLeast = major > 0 || (major === 0 && (minor > 18 || (minor === 18 && patch >= 2)));
    expect(atLeast).toBe(true);
  });

  // Security property: \href is never HONORED under trust:false — no live anchor,
  // no href attribute, no loaded resource. (KaTeX with strict:'ignore' echoes the
  // raw TeX source inside the MathML <annotation>; that inert text is not a link
  // and is deliberately not asserted against.)
  test('a polluted prototype cannot enable a dangerous \\href link', () => {
    pollutePrototype();
    const html = render('\\href{javascript:alert(1)}{click}');
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/href\s*=/i);
    expect(html).not.toMatch(/href\s*=\s*["']?javascript:/i);
  });

  test('a polluted prototype cannot enable an external https \\href link', () => {
    pollutePrototype();
    const html = render('\\href{https://evil.example/steal}{x}');
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/href\s*=/i);
  });

  test('a polluted prototype cannot load an external resource via \\includegraphics', () => {
    pollutePrototype();
    const html = render('\\includegraphics[width=1em]{https://evil.example/pixel.png}');
    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/src\s*=\s*["']?https/i);
  });

  test('without pollution, trust:false already refuses \\href (baseline invariant)', () => {
    const html = render('\\href{https://evil.example}{x}');
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/href\s*=/i);
  });

  test('macro-expansion is bounded (no hang) and output stays string', () => {
    // throwOnError:false renders an error node rather than throwing; the default
    // maxExpand (1000) bounds expansion so a macro bomb cannot run unbounded.
    const bomb = '\\def\\a{\\b\\b}\\def\\b{\\a\\a}\\a';
    const html = render(bomb);
    expect(typeof html).toBe('string');
    expect(html).not.toMatch(/<a\b/i);
  });

  test('normal lesson math still renders the stable .katex markup', () => {
    const html = render('x^2 + y^2 = z^2');
    expect(html).toMatch(/class="[^"]*\bkatex\b/);
  });
});
