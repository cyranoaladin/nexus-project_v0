"use client";
import { Bot, GraduationCap, ShieldCheck } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              <span className="h-2.5 w-2.5 rounded-full bg-white ring-1 ring-gray-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            </div>
            <span className="text-xs text-gray-700">Enseignement français – Tunisie</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 leading-tight">
            L’excellence de l’enseignement français, en Tunisie
          </h1>
          <p className="text-gray-600 mt-3 max-w-xl">
            Professeurs agrégés + IA ARIA. Parcours premium pour Bac & Parcoursup,
            hybride (présentiel + distanciel) et garanti.
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Pour les lycéens du cycle terminal et les candidats libres.
          </p>
          <p className="text-xs text-gray-600 mt-1">Enseignement français en Tunisie</p>

          <div className="mt-6 flex items-center gap-3">
            <a
              href="/bilan-gratuit"
              data-analytics="cta_hero_bilan"
              className="rounded-xl bg-gray-900 text-white px-5 py-2.5 text-sm hover:bg-black"
              aria-label="Commencer mon bilan stratégique gratuit"
            >
              Bilan stratégique gratuit
            </a>
            <a
              href="/offres/nexus-cortex"
              data-analytics="cta_hero_aria"
              className="rounded-xl border border-gray-300 text-gray-700 px-5 py-2.5 text-sm hover:bg-gray-100"
            >
              Découvrez ARIA
            </a>
            <a
              href="/auth/signin"
              data-testid="cta-signup"
              className="rounded-xl border border-blue-600 text-blue-700 px-5 py-2.5 text-sm hover:bg-blue-50"
            >
              S'inscrire
            </a>
            <button
              type="button"
              data-testid="open-aria-chat"
              className="rounded-xl border border-gray-300 text-gray-700 px-5 py-2.5 text-sm hover:bg-gray-100"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const btn = document.querySelector('[data-testid="open-aria-chat"]');
                  btn?.dispatchEvent(new Event('aria:open', { bubbles: true }));
                }
              }}
            >
              Ouvrir ARIA
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-sm text-gray-700">
            <div className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-blue-700" /><span>Profs agrégés</span></div>
            <div className="flex items-center gap-2"><Bot className="w-5 h-5 text-red-600" /><span>ARIA 24/7</span></div>
            <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /><span>Garantie Bac</span></div>
          </div>
        </div>

        <div className="h-64 md:h-80 rounded-2xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-500">
          Visuel (élève + interface ARIA)
        </div>
      </div>
    </section>
  );
}
