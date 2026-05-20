import { ArrowRight, Check, GraduationCap, Info, MessageCircle } from "lucide-react";
import CTAButton from "@/components/sections/homepage/CTAButton";
import TrackedCTAButton from "@/components/sections/homepage/TrackedCTAButton";
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
      className="bg-[#0f2f57] px-6 py-16 sm:px-8 sm:py-20 lg:px-12"
    >
      <div className="mx-auto max-w-7xl space-y-12 sm:space-y-16">
        {/* ─── 1. Header ─── */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-mono uppercase tracking-[0.14em] text-blue-200">
            {NEXUS_SELECT.eyebrow}
          </span>

          <h2 className="mt-5 font-display text-h2 font-bold text-white">
            {NEXUS_SELECT.title}
          </h2>

          <p className="mt-4 text-base leading-7 text-blue-100 sm:mt-5 sm:text-lg sm:leading-8">
            {NEXUS_SELECT.headline}
          </p>

          <p className="mt-3 text-sm leading-7 text-blue-200/80 sm:mt-4 sm:text-base sm:leading-8">
            {NEXUS_SELECT.description}
          </p>

          {/* Disclaimer Parcoursup */}
          <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-blue-300/80">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {NEXUS_SELECT.disclaimer}
          </p>
        </div>

        {/* ─── 2. Format — 4 cartes (mobile: 2×2 grid) ─── */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {NEXUS_SELECT.format.map((item) => (
            <article
              key={item.value}
              className="rounded-[18px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:rounded-[22px] sm:p-6"
            >
              <p className="font-display text-2xl font-bold text-white sm:text-3xl">
                {item.value}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-blue-400 sm:text-[11px]">
                {item.label}
              </p>
              <p className="mt-2 hidden text-sm leading-7 text-blue-200/80 sm:block">
                {item.detail}
              </p>
            </article>
          ))}
        </div>

        {/* ─── 3. Tarif — early on mobile for conversion ─── */}
        <div className="rounded-[20px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:rounded-[24px] sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">
            {NEXUS_SELECT.pricing.label}
          </p>
          <p className="mt-3 font-display text-4xl font-bold text-white sm:mt-4 sm:text-5xl">
            {NEXUS_SELECT.pricing.price}
          </p>
          <p className="mt-2 text-sm font-medium text-blue-100 sm:mt-3 sm:text-base">
            {NEXUS_SELECT.pricing.details}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {NEXUS_SELECT.pricingIncludes.map((item) => (
              <span
                key={item}
                className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs text-blue-300"
              >
                {item}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-blue-300/60 sm:text-sm">
            {NEXUS_SELECT.pricing.note}
          </p>
        </div>

        {/* ─── 4. CTA mobile-first ─── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <TrackedCTAButton
            href={WHATSAPP_URL_SELECT}
            variant="eaf-outline"
            className="border-white bg-white text-[#0f3d73] hover:bg-blue-50"
            trackingLocation="select"
            fullWidth
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {NEXUS_SELECT.ctaLabel}
          </TrackedCTAButton>
          <CTAButton
            href={WHATSAPP_URL_SELECT}
            variant="eaf-outline"
            className="border-white/30 text-white hover:bg-white/10"
            fullWidth
          >
            {NEXUS_SELECT.ctaSecondary}
          </CTAButton>
        </div>

        {/* ─── 5. Image ─── */}
        <LandingIllustration
          src={LANDING_IMAGES.select.src}
          alt={LANDING_IMAGES.select.alt}
          aspect="16/9"
          variant="dark"
          overlay
          sizes="(min-width: 1024px) 1100px, 100vw"
        />

        {/* ─── 6. Pedagogy + description ─── */}
        <div>
          <p className="text-sm leading-7 text-blue-200/80 sm:text-base sm:leading-8">
            {NEXUS_SELECT.pedagogy}
          </p>
        </div>

        {/* ─── 7. Public cible ─── */}
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">
            Ce stage s'adresse aux élèves
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {NEXUS_SELECT.audience.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-blue-200 sm:px-4 sm:py-2"
              >
                {item}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm leading-7 text-blue-300/70">
            {NEXUS_SELECT.audienceFilter}
          </p>
          <p className="mt-2 text-sm text-blue-300/60">
            {NEXUS_SELECT.admissionNote}
          </p>
        </div>

        {/* ─── 8. Objectifs + Expertise (side by side on lg, stacked on mobile) ─── */}
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* Objectifs */}
          <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:rounded-[24px] sm:p-6">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">
              Objectifs pédagogiques
            </p>
            <ul className="mt-4 space-y-2.5">
              {NEXUS_SELECT.objectives.map((objective) => (
                <li
                  key={objective}
                  className="flex gap-3 text-sm leading-6 text-blue-100"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
                    aria-hidden="true"
                  />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Expertise enseignant */}
          <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:rounded-[24px] sm:p-6">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-blue-300" aria-hidden="true" />
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">
                Expertise pédagogique
              </p>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-white sm:text-xl">
              {NEXUS_SELECT.expertiseTitle}
            </h3>
            <ul className="mt-4 space-y-2">
              {NEXUS_SELECT.expertiseBullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-3 text-sm leading-6 text-blue-100"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
                    aria-hidden="true"
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-7 text-blue-200/70">
              {NEXUS_SELECT.expertiseNote}
            </p>
          </div>
        </div>

        {/* ─── 9. Inclus dans le stage ─── */}
        <div className="rounded-[20px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:rounded-[24px] sm:p-6">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-300">
            Inclus dans le stage
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {NEXUS_SELECT.features.map((feature) => (
              <li
                key={feature}
                className="flex gap-3 text-sm leading-6 text-blue-100"
              >
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-blue-300"
                  aria-hidden="true"
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ─── 10. CTA final ─── */}
        <div className="flex flex-col items-center gap-4 rounded-[20px] border border-white/10 bg-white/5 p-6 text-center sm:flex-row sm:justify-between sm:rounded-[24px] sm:p-8 sm:text-left">
          <div>
            <p className="font-display text-lg font-bold text-white sm:text-xl">
              Deux semaines pour changer de rythme.
            </p>
            <p className="mt-1 text-sm text-blue-200/80">
              Préparer le choc de niveau avant qu'il ne commence.
            </p>
          </div>
          <TrackedCTAButton
            href={WHATSAPP_URL_SELECT}
            variant="eaf-outline"
            className="w-full shrink-0 border-white bg-white text-[#0f3d73] hover:bg-blue-50 sm:w-auto"
            trackingLocation="select_bottom"
          >
            {NEXUS_SELECT.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </TrackedCTAButton>
        </div>
      </div>
    </section>
  );
}
