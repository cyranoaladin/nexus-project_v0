import { hasMath, renderMathInHtml, splitMath } from '@/lib/espace/math-text';

describe('splitMath', () => {
  it('sépare texte, formule en ligne et formule centrée', () => {
    expect(splitMath('Soit \\(f(x)=2\\) puis \\[x\\to1\\] fin')).toEqual([
      { kind: 'text', value: 'Soit ' },
      { kind: 'math', value: 'f(x)=2', display: false },
      { kind: 'text', value: ' puis ' },
      { kind: 'math', value: 'x\\to1', display: true },
      { kind: 'text', value: ' fin' },
    ]);
  });
  it('texte sans formule : un seul segment', () => {
    expect(splitMath('rien')).toEqual([{ kind: 'text', value: 'rien' }]);
    expect(hasMath('rien')).toBe(false);
    expect(hasMath('\\(x\\)')).toBe(true);
  });
  it('une parenthèse échappée sans fermeture reste du texte', () => {
    expect(splitMath('prix \\(non fermé')).toEqual([{ kind: 'text', value: 'prix \\(non fermé' }]);
  });
});

describe('renderMathInHtml', () => {
  it('décode &lt; &gt; &amp; avant le rendu et laisse le reste du HTML intact', () => {
    const seen: string[] = [];
    const out = renderMathInHtml('<p>si \\(x&lt;1\\) et \\[a&amp;b\\]</p>', (tex, display) => {
      seen.push(`${display ? 'D' : 'I'}:${tex}`);
      return `[${tex}]`;
    });
    expect(seen).toEqual(['I:x<1', 'D:a&b']);
    expect(out).toBe('<p>si [x<1] et [a&b]</p>');
  });
});
