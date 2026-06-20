import Image from "next/image";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import CTAButton from "@/components/sections/homepage/CTAButton";
import TrackedCTAButton from "@/components/sections/homepage/TrackedCTAButton";
import CountdownChip from "@/components/sections/homepage/CountdownChip";
import {
  EAF_EXAM_DATE,
  HERO,
  LANDING_IMAGES,
  PHONE_LABEL,
  WHATSAPP_URL,
} from "@/components/sections/homepage/content";

export default function HomeHero() {
  return (
    <section
      id="hero"
      className="scroll-mt-28 relative overflow-hidden bg-[#f8fbff] px-6 pb-16 pt-24 sm:px-8 sm:pb-20 sm:pt-32 lg:px-12 lg:pb-28"
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98)_48%,rgba(219,234,254,0.45))]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-8 sm:gap-12 lg:min-h-[calc(100vh-64px)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* ─── Copy ─── */}
        <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0f3d73]/15 bg-white px-3 py-1.5 text-xs font-mono uppercase tracking-[0.14em] text-[#0f3d73] shadow-sm sm:px-4 sm:py-2">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {HERO.badge}
          </div>

          <h1 className="mt-5 max-w-[640px] font-display text-hero font-bold leading-[0.96] text-[#0f2f57] sm:mt-6">
            {HERO.title}
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 sm:mt-6 sm:text-lg sm:leading-8">
            {HERO.subtitle}
          </p>

          <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-[#0f3d73]">
            {HERO.transition}
          </p>

          {/* CTA — full-width on mobile */}
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
            <TrackedCTAButton href={WHATSAPP_URL} variant="eaf" trackingLocation="hero" fullWidth className="sm:w-auto">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {HERO.ctaPrimary}
            </TrackedCTAButton>
            <CTAButton href="#offres-fin-annee" variant="eaf-outline" fullWidth className="sm:w-auto">
              {HERO.ctaSecondary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CTAButton>
          </div>

          {/* Chips — show only key ones on mobile */}
          <div className="mt-5 flex flex-wrap gap-2 sm:mt-7">
            <CountdownChip
              targetDate={EAF_EXAM_DATE}
              label="avant les épreuves"
              tone="urgent"
            />
            {HERO.chips.map((chip, i) => (
              <span
                key={chip}
                className={`inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ${i >= 4 ? "hidden sm:inline-flex" : ""}`}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* ─── Visual — hidden on mobile, visible lg+ ─── */}
        <div className="relative hidden lg:block">
          <div className="overflow-hidden rounded-[32px] border border-white bg-white shadow-2xl shadow-slate-200/80">
            <div className="relative aspect-[4/3] min-h-[360px]">
              <Image
                src={LANDING_IMAGES.hero.src}
                alt={LANDING_IMAGES.hero.alt}
                fill
                sizes="(min-width: 1024px) 48vw, 1px"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f2f57]/72 via-[#0f2f57]/10 to-transparent" />

              <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/20 bg-white/92 p-5 shadow-xl backdrop-blur-md">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0f3d73]">
                  Nexus Réussite · Tunis
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Stages intensifs · Cours hebdomadaires · Bilans personnalisés · Livrets de travail · Suivi élève-parent
                </p>
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#0f3d73]">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp : {PHONE_LABEL}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
