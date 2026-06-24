'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Category =
  | 'all'
  | 'annual'
  | 'libre'
  | 'plateforme'
  | 'intensifs'
  | 'ponctuel'
  | 'coaching'
  | 'pass'
  | 'carte';

type OffersFiltersClientProps = {
  categories: ReadonlyArray<{ id: Category; label: string }>;
};

function getFilterCategory(element: Element | null): string[] {
  if (!element) return [];
  const raw = element.getAttribute('data-offres-categories');
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function applyVisibility(activeCategory: Category, root: ParentNode = document) {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-offres-block]'));
  for (const block of blocks) {
    const categories = getFilterCategory(block);
    const isVisible = activeCategory === 'all' || categories.includes(activeCategory);
    if (isVisible) {
      block.classList.remove('hidden');
      block.removeAttribute('aria-hidden');
    } else {
      block.classList.add('hidden');
      block.setAttribute('aria-hidden', 'true');
    }
  }
}

export function OffersFiltersClient({ categories }: OffersFiltersClientProps) {
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const buttons = useMemo(() => categories, [categories]);

  useEffect(() => {
    applyVisibility(activeCategory);
  }, [activeCategory]);

  const onFilterChange = useCallback((category: Category) => {
    setActiveCategory(category);
    applyVisibility(category);
  }, []);

  return (
    <nav aria-label="Filtres des offres" className="sticky top-0 z-20 border-b border-lux-line bg-lux-ivory/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl overflow-x-auto px-4 md:px-6">
        <div className="flex gap-1 py-3">
          {buttons.map((cat) => (
            <button
              key={cat.id}
              type="button"
              aria-pressed={activeCategory === cat.id}
              onClick={() => onFilterChange(cat.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all lux-focus min-h-[44px] ${
                activeCategory === cat.id
                  ? 'bg-lux-ink text-lux-ivory'
                  : 'text-lux-ink hover:bg-lux-paper'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default OffersFiltersClient;
