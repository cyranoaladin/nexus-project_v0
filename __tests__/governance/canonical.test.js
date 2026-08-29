describe('canonical JSON + digest determinism', () => {
  let canonicalize;
  let digest;

  beforeAll(async () => {
    ({ canonicalize, digest } = await import('../../scripts/github/lib/canonical.mjs'));
  });

  test('key order does not affect the canonical form', () => {
    const a = canonicalize({ b: 1, a: 2, c: { z: 1, y: 2 } });
    const b = canonicalize({ a: 2, c: { y: 2, z: 1 }, b: 1 });
    expect(a).toBe(b);
  });

  test('digest is stable across repeated calls', () => {
    const value = { foo: [1, 2, { bar: 'baz' }] };
    const d1 = digest(value);
    const d2 = digest(value);
    expect(d1.sha256).toBe(d2.sha256);
    expect(d1.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test('digest changes when content changes', () => {
    const d1 = digest({ a: 1 });
    const d2 = digest({ a: 2 });
    expect(d1.sha256).not.toBe(d2.sha256);
  });
});
