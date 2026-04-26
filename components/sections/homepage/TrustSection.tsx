import Image from "next/image";
import { TRUST_COMMITMENTS, TRUST_METRICS } from "@/components/sections/homepage/content";
import { resolveUiIcon } from "@/lib/ui-icons";

export default function TrustSection() {
  return (
    <section className="bg-[#f7fbff] px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
              Confiance
            </p>
            <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
              Une structure pensée pour rassurer les parents et faire progresser les élèves.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-700">
              Nexus Réussite n'est pas seulement une offre saisonnière : c'est un cadre d'accompagnement scolaire premium, avec méthode, enseignants, petits groupes, suivi et outils numériques.
            </p>
          </div>

          <div className="relative min-h-[280px] overflow-hidden rounded-[28px] border border-white bg-white shadow-xl shadow-slate-200/70">
            <Image
              src="/images/Image_PartenariatFamilial.png"
              alt="Partenariat familial et suivi personnalisé Nexus Réussite"
              fill
              sizes="(min-width: 1024px) 48vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f2f57]/55 via-transparent to-transparent" />
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TRUST_METRICS.map((metric) => (
            <div key={metric.label} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="font-display text-2xl font-bold text-[#0f3d73]">{metric.value}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                {metric.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {TRUST_COMMITMENTS.map((item) => (
            <article key={item.title} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
              {(() => {
                const CommitmentIcon = resolveUiIcon(item.icon);
                return (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#0f3d73]">
                <CommitmentIcon className="h-5 w-5" aria-hidden="true" />
              </div>
                );
              })()}
              <h3 className="mt-4 font-display text-xl font-bold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
