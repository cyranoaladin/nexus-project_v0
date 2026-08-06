'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createCanonicalAttempt } from '@/lib/bilans/passation/pilot-protocol';

export type CanonicalStartPack = Readonly<{ slug: string; label: string }>;

function newIdempotencyKey(): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pilot-${suffix}`;
}

export function CanonicalAssessmentStart({ packs }: Readonly<{ packs: readonly CanonicalStartPack[] }>) {
  const router = useRouter();
  // One idempotency key per pack: retrying the SAME pack after an ambiguous
  // failure must reuse its key, but selecting a DIFFERENT pack must never
  // replay the first pack's stored attempt via a shared key.
  const keys = useRef<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(pack: CanonicalStartPack) {
    keys.current[pack.slug] ??= newIdempotencyKey();
    const key = keys.current[pack.slug];
    setLoading(pack.slug);
    setError(null);
    try {
      const attempt = await createCanonicalAttempt(pack.slug, key);
      router.replace(`/bilan-gratuit/assessment?attemptId=${encodeURIComponent(attempt.attemptId)}`);
    } catch {
      setError('Le questionnaire ne peut pas être démarré pour le moment. Réessayez sans fermer cette page.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-12">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Bilan de positionnement</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-slate-950">Commencer mon questionnaire</h1>
        <p className="mt-3 leading-7 text-slate-600">Le questionnaire enregistre chaque réponse et peut être repris après un rechargement.</p>
        {packs.length === 0 ? (
          <p className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">Aucun questionnaire n’est ouvert actuellement. Nexus vous communiquera l’accès après validation pédagogique.</p>
        ) : (
          <div className="mt-7 space-y-3">
            {packs.map((pack) => (
              <button key={pack.slug} type="button" disabled={loading !== null} onClick={() => void start(pack)} className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-left font-semibold text-white disabled:opacity-50">
                {loading === pack.slug ? 'Création du questionnaire…' : pack.label}
              </button>
            ))}
          </div>
        )}
        {error !== null && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">{error}</p>}
      </section>
    </main>
  );
}
