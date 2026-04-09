import { BadgeDollarSign, Clock3 } from "lucide-react";

import { PRICING_ROWS } from "../_data/packs";

export default function PricingTable() {
  return (
    <section id="tarifs" className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
            Grille tarifaire complète
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Un tableau clair pour décider vite, sans perdre de temps dans les calculs.
          </h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/58">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
              <Clock3 className="h-4 w-4 text-nexus-green" aria-hidden="true" />
              Early Bird jusqu'au 12 avril
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
              <BadgeDollarSign className="h-4 w-4 text-white/40" aria-hidden="true" />
              Colonne Classique = tarif équivalent en cours individuel
            </span>
          </div>
        </div>

        <div className="mt-10 overflow-x-auto rounded-[28px] border border-white/8 bg-white/[0.02]">
          <table className="min-w-full text-left text-sm text-white/72">
            <thead className="bg-white/[0.04] font-mono text-[11px] uppercase tracking-[0.16em] text-white/52">
              <tr>
                <th className="px-5 py-4">Formule</th>
                <th className="px-5 py-4">Durée</th>
                <th className="px-5 py-4">Early Bird</th>
                <th className="px-5 py-4">Normal</th>
                <th className="px-5 py-4">Classique</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_ROWS.map((row) => (
                <tr key={row.label} className="border-t border-white/6">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span>{row.label}</span>
                      {row.popular ? (
                        <span className="rounded-full bg-nexus-amber/12 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-nexus-amber">
                          Populaire
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-white/52">{row.hours}</td>
                  <td className="px-5 py-4 font-display text-lg font-bold text-nexus-green">
                    {row.earlyBird} TND
                  </td>
                  <td className="px-5 py-4">{row.normal} TND</td>
                  <td className="px-5 py-4 text-nexus-red line-through decoration-nexus-red/70">
                    {row.classic}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
