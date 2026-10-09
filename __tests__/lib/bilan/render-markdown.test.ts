import { markdownToHtml } from '@/lib/bilan/render-markdown';

describe('untrusted pedagogical markdown', () => {
  test.each([
    '<script>globalThis.compromised = true</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '| <img src=x onerror=alert(1)> | safe |',
    '## <iframe srcdoc="<script>alert(1)</script>"></iframe>',
  ])('renders source markup as text rather than executable elements: %s', source => {
    const node = document.createElement('div');
    node.innerHTML = markdownToHtml(source);
    expect(node.querySelector('script,img,svg,iframe')).toBeNull();
    const expected = source.startsWith('|') ? '<img src=x onerror=alert(1)>' : source.replace(/^## /, '');
    expect(node.textContent).toContain(expected);
  });

  it('preserves entity-like input as literal text', () => {
    const node = document.createElement('div');
    node.innerHTML = markdownToHtml('&lt;img src=x&gt;');
    expect(node.textContent).toBe('&lt;img src=x&gt;');
  });

  it('keeps supported headings and emphasis', () => {
    const node = document.createElement('div');
    node.innerHTML = markdownToHtml('## Priorités\n\n**Réviser** et *comprendre*.');
    expect(node.querySelector('h2')?.textContent).toBe('Priorités');
    expect(node.querySelector('strong')?.textContent).toBe('Réviser');
    expect(node.querySelector('em')?.textContent).toBe('comprendre');
  });
});
