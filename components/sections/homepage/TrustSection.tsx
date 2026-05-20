import {
  LANDING_IMAGES,
  METHODE_STEPS,
  TRUST_POINTS,
} from "@/components/sections/homepage/content";
import LandingIllustration from "@/components/sections/homepage/LandingIllustration";
import { resolveUiIcon } from "@/lib/ui-icons";

export default function TrustSection() {
  return (
    <section className="bg-[#f7fbff] px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-16">
        {/* ─── Méthode Nexus ─── */}
        <div>
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
              La méthode Nexus Réussite
            </p>
            <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
              Un accompagnement en 5 étapes, du diagnostic au suivi.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-700">
              Chaque accompagnement suit une progression structurée. Pas de formule improvisée : un cadre clair, des objectifs définis, une correction exigeante et un suivi continu.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {METHODE_STEPS.map((step) => {
              const StepIcon = resolveUiIcon(step.icon);
              return (
                <article
                  key={step.step}
                  className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eff6ff] text-[#0f3d73]">
                      <StepIcon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <span className="font-mono text-xs text-slate-400">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-slate-950">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>

        {/* ─── Confiance ─── */}
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
              Pourquoi Nexus Réussite
            </p>
            <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
              Un cadre sérieux, exigeant et humain.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-700">
              Nexus Réussite accompagne les élèves qui veulent travailler sérieusement, comprendre leurs erreurs et progresser avec méthode. Le présentiel à Mutuelleville rassure les familles. Le suivi individualisé rend la progression visible.
            </p>
          </div>

          <LandingIllustration
            src={LANDING_IMAGES.value.src}
            alt={LANDING_IMAGES.value.alt}
            aspect="4/3"
            variant="card"
            overlay
            sizes="(min-width: 1024px) 48vw, 100vw"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {TRUST_POINTS.map((point) => (
            <div
              key={point.label}
              className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="font-display text-2xl font-bold text-[#0f3d73]">
                {point.value}
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                {point.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
