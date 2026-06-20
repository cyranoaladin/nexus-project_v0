/**
 * G7 — Background alternation guard.
 *
 * Rule: No two consecutive sections share the same background shade.
 * bg-lux-white and bg-lux-paper alternate; bg-lux-ink breaks the sequence.
 * Tested on rendered DOM, not source regex.
 */
import { render } from '@testing-library/react';

// Mocks for external components
jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <nav data-testid="navbar" />,
}));
jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <footer data-testid="footer" />,
}));
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

import { HomePageClient } from '@/app/HomePageClient';

/** Extract the background class from an element's className */
function extractBg(className: string): string | null {
  const match = className.match(/bg-lux-(white|paper|ink)/);
  return match ? match[1] : null;
}

describe('G7 — background alternation', () => {
  it('no two consecutive sections share the same background shade on the homepage', () => {
    const { container } = render(<HomePageClient />);
    const main = container.querySelector('main');
    expect(main).not.toBeNull();

    // Get direct children of main that have a bg-lux-* class (top-level sections)
    const sections = Array.from(main!.children).filter(
      (el) => (el as HTMLElement).className?.includes('bg-lux-')
    );

    const backgrounds: { tag: string; bg: string | null; index: number }[] = [];
    for (let i = 0; i < sections.length; i++) {
      const el = sections[i] as HTMLElement;
      const bg = extractBg(el.className);
      if (bg) {
        backgrounds.push({ tag: el.tagName, bg, index: i });
      }
    }

    // Check: no two consecutive entries share the same background
    const violations: string[] = [];
    for (let i = 1; i < backgrounds.length; i++) {
      if (backgrounds[i].bg === backgrounds[i - 1].bg) {
        violations.push(
          `Sections ${backgrounds[i - 1].index} and ${backgrounds[i].index} both have bg-lux-${backgrounds[i].bg}`
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
