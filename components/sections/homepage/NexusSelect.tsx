import { ArrowRight, Check, Info, MessageCircle, Users } from "lucide-react";
import CTAButton from "@/components/sections/homepage/CTAButton";
import LandingIllustration from "@/components/sections/homepage/LandingIllustration";
import {
  LANDING_IMAGES,
  NEXUS_SELECT,
  WHATSAPP_URL_SELECT,
} from "@/components/sections/homepage/content";

export default function NexusSelect() {
  return (
    <section
      id="nexus-select"
      className="bg-[#0f2f57] px-6 py-20 sm:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-7xl space-y-16">
        {/* ─── Header ─── */}
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-mono uppercase tracking-[0.14em] text-blue-200">
              {NEXUS_SELECT.eyebrow}
            </span>

            <h2 className="mt-5 font-display text-h2 font-bold text-white">
              {NEXUS_SELECT.title}
            </h2>

            <p className="mt-5 text-lg leading-8 text-blue-100">
              {NEXUS_SELECT.headline}
            </p>

            <p className="mt-4 text-base leading-8 text-blue-200/80">
              {NEXUS_SELECT.description}
            </p>

            {/* Disclaimer anti-Parcoursup */}
            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-blue-300/80">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {NEXUS_SELECT.disclaimer}
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <CTAButton
                href={WHATSAPP_URL_SELECT}
                variant="eaf-outline"
                className="border-white bg-white text-[#0f3d73] hover:bg-blue-50"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {NEXUS_SELECT.ctaLabel}
              </CTAButton>
            </div>
          </div>

          {/* Objectifs */}
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">
              Objectifs du stage
            </p>
            <ul className="mt-5 space-y-3">
              {NEXUS_SELECT.objectives.map((objective) => (
                <li
                  key={objective}
                  className="flex gap-3 text-sm leading-7 text-blue-100"
                >
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-blue-300"
                    aria-hidden="true"
                  />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─── Public visé ─── */}
        <div className="flex flex-wrap gap-2">
          {NEXUS_SELECT.audience.map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-medium text-blue-200"
            >
              {item}
            </span>
          ))}
        </div>

        {/* ─── Visual Select ─── */}
        <LandingIllustration
          src={LANDING_IMAGES.select.src}
          alt={LANDING_IMAGES.select.alt}
          aspect="16/9"
          variant="dark"
          overlay
          sizes="(min-width: 1024px) 1100px, 100vw"
        />

        {/* ─── Pricing & features Select ─── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">
              Tarif Nexus Select
            </p>
            <p className="mt-4 font-display text-2xl font-bold text-white">
              {NEXUS_SELECT.pricing.label}
            </p>
            <p className="mt-3 text-sm leading-7 text-blue-200/70">
              {NEXUS_SELECT.pricing.note}
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">
              Inclus dans Nexus Select
            </p>
            <ul className="mt-4 space-y-2.5">
              {NEXUS_SELECT.features.map((feature) => (
                <li
                  key={feature}
                  className="flex gap-3 text-sm leading-7 text-blue-100"
                >
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-blue-300"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─── 4 groupes Select maths ─── */}
        <div>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-300" aria-hidden="true" />
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">
              4 groupes de mathématiques
            </p>
          </div>

          <h3 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">
            Des groupes de niveau pour un accompagnement réel.
          </h3>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {NEXUS_SELECT.groups.map((group) => (
              <article
                key={group.level}
                className="rounded-[22px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition duration-200 hover:border-white/20 hover:bg-white/8"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-400">
                  {group.level}
                </span>
                <h4 className="mt-3 font-display text-xl font-bold text-white">
                  {group.name}
                </h4>
                <p className="mt-3 text-sm leading-7 text-blue-200/80">
                  {group.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs text-blue-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-sm text-blue-300/70">
            {NEXUS_SELECT.groupsNote}
          </p>
        </div>

        {/* ─── CTA ─── */}
        <div className="flex flex-col items-center gap-4 rounded-[24px] border border-white/10 bg-white/5 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-display text-xl font-bold text-white">
              Prêt à changer de niveau ?
            </p>
            <p className="mt-1 text-sm text-blue-200/80">
              Contactez-nous pour un entretien de positionnement et connaître les groupes disponibles.
            </p>
          </div>
          <CTAButton
            href={WHATSAPP_URL_SELECT}
            variant="eaf-outline"
            className="shrink-0 border-white bg-white text-[#0f3d73] hover:bg-blue-50"
          >
            WhatsApp : 99 19 28 29
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
