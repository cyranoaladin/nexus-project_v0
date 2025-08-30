"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeWidget } from "@/components/ui/badge-widget";
import { toast } from "sonner";

export default function EleveBadgesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement de vos badges...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== "ELEVE") {
    router.push("/auth/signin");
    return null;
  }

  const [filter, setFilter] = useState<string>('ALL');
  const [counts, setCounts] = useState<{ ALL: number; ASSIDUITE: number; PROGRESSION: number; ARIA: number }>({ ALL: 0, ASSIDUITE: 0, PROGRESSION: 0, ARIA: 0 });
  const [countsLoading, setCountsLoading] = useState<boolean>(true);
  const searchParams = useSearchParams();

  // Normalize categories used by the API
  const canonicalCategory = (c: string) => {
    const up = String(c || '').toUpperCase();
    if (up === 'CURIOSITE') return 'ARIA';
    return up;
  };

  // Initialize filter from ?cat= query param and keep it in sync on navigation
  useEffect(() => {
    const valid = new Set(['ALL', 'ASSIDUITE', 'PROGRESSION', 'ARIA']);
    const q = searchParams?.get('cat');
    const norm = q ? String(q).toUpperCase() : 'ALL';
    if (valid.has(norm) && norm !== filter) setFilter(norm);
    if (!q && filter !== 'ALL') setFilter('ALL');
  }, [searchParams]);

  // Fetch counts per category for labels
  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      try {
        setCountsLoading(true);
        const res = await fetch(`/api/students/${session!.user.id}/badges`);
        if (!res.ok) return;
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data.badges;
        const acc = { ALL: 0, ASSIDUITE: 0, PROGRESSION: 0, ARIA: 0 } as any;
        for (const b of (arr || [])) {
          acc.ALL += 1;
          acc[canonicalCategory(b.category || b?.badge?.category || 'ASSIDUITE')] += 1;
        }
        if (!cancelled) setCounts(acc);
      } catch (e) {
        if (!cancelled) toast.error('Échec de l’actualisation des badges', { description: 'Réessayez dans un instant.', duration: 2500, icon: <AlertCircle className="w-4 h-4 text-red-600" /> });
      }
      finally {
        if (!cancelled) setCountsLoading(false);
      }
    };
    if (session?.user?.id) loadCounts();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const labels = useMemo(() => ({
    ALL: countsLoading ? `Toutes les catégories (\u2026)` : `Toutes les catégories (${counts.ALL})`,
    ASSIDUITE: countsLoading ? `Assiduité (\u2026)` : `Assiduité (${counts.ASSIDUITE})`,
    PROGRESSION: countsLoading ? `Progression (\u2026)` : `Progression (${counts.PROGRESSION})`,
    ARIA: countsLoading ? `Curiosité (\u2026)` : `Curiosité (${counts.ARIA})`,
  }), [counts, countsLoading]);

  const onChangeFilter = (next: string) => {
    setFilter(next);
    const sp = new URLSearchParams(searchParams?.toString() || '');
    if (next === 'ALL') {
      sp.delete('cat');
    } else {
      sp.set('cat', next);
    }
    // Update the URL without scrolling
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">Mes Badges</h1>
          <nav className="mt-2 text-sm text-gray-500" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/dashboard/eleve" className="text-blue-600 hover:underline">
                  Tableau de bord
                </Link>
              </li>
              <li aria-hidden="true" className="text-gray-400">/</li>
              <li aria-current="page" className="text-gray-700">
                Mes Badges
              </li>
            </ol>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">Filtrer par catégorie</div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => onChangeFilter(e.target.value)}
              disabled={countsLoading}
              className={`border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${countsLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="ALL">{labels.ALL}</option>
              <option value="ASSIDUITE">{labels.ASSIDUITE}</option>
              <option value="PROGRESSION">{labels.PROGRESSION}</option>
              <option value="ARIA">{labels.ARIA}</option>
            </select>
            {countsLoading && (
              <Loader2 aria-hidden className="ml-2 w-4 h-4 animate-spin text-gray-400" />
            )}
            <button
              type="button"
              onClick={() => onChangeFilter('ALL')}
              disabled={filter === 'ALL'}
              className="text-xs text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
              aria-label="Réinitialiser le filtre"
            >
              Réinitialiser
            </button>
          </div>
        </div>
        <BadgeWidget studentId={session.user.id} defaultShowAll={true} filterCategory={filter} />
      </main>
    </div>
  );
}

