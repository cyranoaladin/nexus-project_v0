import fs from 'node:fs';
import path from 'node:path';

describe('Planning Studio — Mobile Topbar CSS Contract & Source Parity', () => {
  const toolsStylesPath = path.resolve('tools/planning-studio/assets/styles.css');
  const publicStylesPath = path.resolve('public/planning/assets/styles.css');

  test('PLANNING_SOURCE_GENERATED_PARITY=PASS: tools and public stylesheets are identical', () => {
    const toolsStyles = fs.readFileSync(toolsStylesPath, 'utf8');
    const publicStyles = fs.readFileSync(publicStylesPath, 'utf8');
    expect(publicStyles).toBe(toolsStyles);
  });

  test('MOBILE_TOPBAR_CSS_CONTRACT=PASS: stylesheet enforces sticky topbar and canonical height', () => {
    const css = fs.readFileSync(toolsStylesPath, 'utf8');

    // 1. Base .topbar is sticky with top: 0
    expect(css).toMatch(/\.topbar\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0/);

    // 2. Base --topbar-h definition exists
    expect(css).toMatch(/--topbar-h:\s*58px;/);

    // 3. Mobile breakpoint <=760px overrides --topbar-h to canonical 54px
    const media760Match = css.match(/@media\s*\(\s*max-width:\s*760px\s*\)\s*\{([\s\S]*?)\n\}/);
    expect(media760Match).not.toBeNull();
    expect(media760Match![1]).toMatch(/--topbar-h:\s*54px;/);

    // 4. Mobile breakpoint <=520px explicitly preserves position: sticky; top: 0
    const media520Match = css.match(/@media\s*\(\s*max-width:\s*520px\s*\)\s*\{([\s\S]*?)\n\}/);
    expect(media520Match).not.toBeNull();
    const media520 = media520Match![1];
    expect(media520).not.toMatch(/\.topbar\s*\{[^}]*position:\s*relative/);
    expect(media520).toMatch(/\.topbar\s*\{[^}]*position:\s*sticky;\s*top:\s*0;\s*\}/);

    // 5. Mobile secondary menu anchors within topbar boundaries
    expect(media520).toMatch(/\.more\s*\{[^}]*position:\s*static;\s*\}/);
    expect(media520).toMatch(/\.more-menu\s*\{[^}]*left:\s*8px;\s*right:\s*8px;\s*min-width:\s*0;\s*\}/);
  });
});
