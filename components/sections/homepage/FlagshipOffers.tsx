import Image from "next/image";
import CTAButton from "@/components/sections/homepage/CTAButton";
import CountdownChip from "@/components/sections/homepage/CountdownChip";
import {
  ArrowRight,
  BookOpen,
  Check,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  COMPARISON_ROWS,
  EAF_EXAM_DATE,
  EAF_URL,
  METHOD_STEPS,
  OBJECTIVES,
  OFFER_FAMILIES,
  PRICING_PLANS,
  SPECIALTIES,
  STAGES_URL,
} from "@/components/sections/homepage/content";
import { resolveUiIcon } from "@/lib/ui-icons";
import { cn } from "@/lib/utils";

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
        {eyebrow}
      </p>
      <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
        {title}
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-8 text-slate-700">
        {description}
      </p>
    </div>
  );
}

export default function FlagshipOffers() {
  return (
    <section id="offres" className="bg-white px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-20">
        <div>
          <SectionIntro
            eyebrow="Notre méthode"
            title="Une académie premium pour progresser avec un cadre clair."
            description="Nexus Réussite accompagne les élèves toute l'année : diagnostic, cours réguliers, stages intensifs, packs ciblés, plateforme numérique et suivi individualisé."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
            <div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-sm">
              <Image
                src="/images/classroom.jpg"
                alt="Salle de cours lumineuse pour l'accompagnement scolaire Nexus Réussite"
                fill
                sizes="(min-width: 1024px) 44vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f2f57]/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/92 p-4 shadow-lg backdrop-blur">
                <p className="font-display text-xl font-bold text-[#0f2f57]">Un cadre lisible pour progresser</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">Cours, stages, packs et suivi réunis dans une même trajectoire.</p>
              </div>
            </div>

            <div className="grid gap-4">
              {METHOD_STEPS.map((step) => {
                const StepIcon = resolveUiIcon(step.icon);
                return (
                  <article
                    key={step.title}
                    className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#0f3d73]">
                        <StepIcon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-bold text-slate-950">
                          {step.title}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-[#0f3d73]/10 bg-[#eff6ff] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-mono uppercase tracking-[0.14em] text-[#0f3d73]">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Plateforme numérique
                </span>
                <h3 className="mt-4 font-display text-2xl font-bold text-[#0f2f57] sm:text-3xl">
                  Un outil fort pour l'EAF, intégré à l'accompagnement Nexus.
                </h3>
                <p className="mt-4 text-base leading-8 text-slate-700">
                  L'EAF signifie Épreuves anticipées de français. La plateforme aide les élèves de Première à préparer l'écrit et l'oral en autonomie, avec quiz adaptatifs, entraînements guidés et tableau de bord de progression.
                </p>
              </div>
              <CountdownChip targetDate={EAF_EXAM_DATE} label="avant l'EAF" tone="eaf" />
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SPECIALTIES.slice(0, 6).map((benefit) => (
                <div key={benefit} className="flex gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0f3d73]" aria-hidden="true" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <SectionIntro
            eyebrow="Nos objectifs"
            title="Chaque formule sert un objectif scolaire concret."
            description="La bonne offre dépend rarement d'une seule matière : elle dépend du niveau, du calendrier, de la confiance et du degré d'autonomie de l'élève."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {OBJECTIVES.map((objective) => (
              <article key={objective} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
                <Sparkles className="h-5 w-5 text-[#0f3d73]" aria-hidden="true" />
                <h3 className="mt-4 font-display text-lg font-bold text-slate-950">{objective}</h3>
              </article>
            ))}
          </div>
        </div>

        <div>
          <SectionIntro
            eyebrow="Nos accompagnements"
            title="Cours, stages, plateforme et packs : une offre complète, pas une seule porte d'entrée."
            description="Les familles peuvent commencer par un suivi annuel, un stage de vacances, un pack objectif ou la plateforme EAF selon l'urgence et l'ambition."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {OFFER_FAMILIES.map((offer) => {
              const OfferIcon = resolveUiIcon(offer.icon);
              return (
                <article key={offer.title} className="flex h-full flex-col rounded-[22px] border border-slate-200 bg-[#fbfdff] p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#0f3d73]">
                    <OfferIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold text-[#0f2f57]">{offer.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{offer.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {offer.bullets.map((bullet) => (
                      <span key={bullet} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {bullet}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto pt-6">
                    <CTAButton href={offer.href} variant={offer.href === STAGES_URL ? "stage" : "eaf-outline"}>
                      {offer.cta}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </CTAButton>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div>
          <SectionIntro
            eyebrow="Pourquoi Nexus Réussite"
            title="Un cadre plus lisible qu'une succession de cours isolés."
            description="L'académie articule l'humain, le présentiel, les outils numériques et le suivi pour éviter les révisions dispersées."
          />

          <div className="mt-10 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="grid bg-[#0f3d73] text-sm font-semibold text-white md:grid-cols-[0.8fr_1fr_1fr]">
              <div className="hidden px-5 py-4 md:block">Critère</div>
              <div className="px-5 py-4">Préparation non structurée</div>
              <div className="px-5 py-4">Avec Nexus Réussite</div>
            </div>
            {COMPARISON_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid border-t border-slate-200 text-sm md:grid-cols-[0.8fr_1fr_1fr]"
              >
                <div className="bg-slate-50 px-5 py-4 font-mono text-xs uppercase tracking-[0.12em] text-slate-500">
                  {row.label}
                </div>
                <div className="px-5 py-4 text-slate-600">{row.classique}</div>
                <div className="px-5 py-4 font-medium text-[#0f2f57]">{row.nexus}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionIntro
            eyebrow="Offres et packs"
            title="Choisir une formule selon le rythme et l'objectif."
            description="La homepage oriente d'abord vers le bon type d'accompagnement, puis vers l'offre précise : suivi annuel, pack objectif, stage ou plateforme."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {PRICING_PLANS.map((plan) => (
              <article
                key={plan.name}
                className={cn(
                  "flex h-full flex-col rounded-[24px] border p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                  plan.highlighted
                    ? "border-[#0f3d73] bg-[#0f3d73] text-white"
                    : "border-slate-200 bg-white text-slate-950"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
                    <p className={cn("mt-2 text-sm leading-6", plan.highlighted ? "text-blue-100" : "text-slate-600")}>
                      {plan.tagline}
                    </p>
                  </div>
                      {plan.highlighted && (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0f3d73]">
                      Annuel
                    </span>
                  )}
                </div>

                <div className="mt-6">
                  <p className="font-display text-3xl font-bold">{plan.price}</p>
                  <p className={cn("mt-1 text-sm", plan.highlighted ? "text-blue-100" : "text-slate-500")}>
                    {plan.cadence}
                  </p>
                </div>

                <p className={cn("mt-5 text-sm leading-7", plan.highlighted ? "text-blue-50" : "text-slate-700")}>
                  {plan.description}
                </p>

                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <Check
                        className={cn("mt-0.5 h-4 w-4 shrink-0", plan.highlighted ? "text-blue-100" : "text-[#0f3d73]")}
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-7">
                  <CTAButton
                    href={plan.href}
                    variant={plan.highlighted ? "eaf-outline" : "eaf"}
                    fullWidth
                    className={plan.highlighted ? "border-white bg-white text-[#0f3d73] hover:bg-blue-50" : undefined}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </CTAButton>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[#b91c1c]/15 bg-[#fff7f7]">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div className="p-6 sm:p-8 lg:p-10">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#9f1239]">
                Présentiel en complément
              </p>
              <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
                Un ancrage local à Mutuelleville, avec une plateforme en appui.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-700">
                Le présentiel rassure les familles : diagnostic, cours, stages, petits groupes et échanges directs. La plateforme numérique complète ce cadre pour l'entraînement autonome, notamment en EAF.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <CTAButton href={STAGES_URL} variant="stage">
                  Voir les stages
                </CTAButton>
                <CTAButton href={EAF_URL} variant="eaf-outline">
                  Continuer sur la plateforme
                </CTAButton>
              </div>
            </div>

            <div className="relative min-h-[360px] overflow-hidden bg-slate-100 lg:h-full">
              <Image
                src="/images/salle_travail.webp"
                alt="Espace de travail Nexus Réussite à Mutuelleville"
                fill
                sizes="(min-width: 1024px) 38vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f2f57]/70 via-[#0f2f57]/5 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/20 bg-white/92 p-5 shadow-xl backdrop-blur">
                <div className="flex items-center gap-3 text-[#9f1239]">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                  <p className="font-display text-xl font-bold">Mutuelleville</p>
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
                  <li>Petit groupe et cadre de travail.</li>
                  <li>Cours hebdomadaires, stages et packs ciblés.</li>
                  <li>Plateforme EAF associée pour l'entraînement.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
