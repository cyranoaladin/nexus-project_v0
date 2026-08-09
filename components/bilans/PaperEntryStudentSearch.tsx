'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const PAPER_ENTRY_PATH = '/dashboard/assistante/bilans/saisie-papier';
const SEARCH_DELAY_MS = 250;

export function PaperEntryStudentSearch({ initialQuery }: Readonly<{ initialQuery: string }>) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (query === initialQuery) return undefined;
    const timeout = window.setTimeout(() => {
      const normalized = query.trim();
      const target = normalized.length === 0
        ? PAPER_ENTRY_PATH
        : `${PAPER_ENTRY_PATH}?${new URLSearchParams({ q: normalized }).toString()}`;
      router.replace(target);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [initialQuery, query, router]);

  return (
    <form action={PAPER_ENTRY_PATH} method="GET" className="mt-4 flex flex-wrap gap-3">
      <label className="sr-only" htmlFor="paper-entry-household-search">
        Rechercher un foyer ou un enfant
      </label>
      <input
        id="paper-entry-household-search"
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nom de l’élève ou adresse du parent"
        className="min-w-64 flex-1 rounded-xl border border-white/15 bg-slate-950 px-4 py-2.5 text-sm text-white"
      />
      <button type="submit" className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-100">
        Rechercher
      </button>
    </form>
  );
}
