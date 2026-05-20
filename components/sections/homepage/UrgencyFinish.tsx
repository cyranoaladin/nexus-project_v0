"use client";

import { ArrowRight, Check, Clock3, MessageCircle } from "lucide-react";
import TrackedCTAButton from "@/components/sections/homepage/TrackedCTAButton";
import CountdownChip from "@/components/sections/homepage/CountdownChip";
import LandingIllustration from "@/components/sections/homepage/LandingIllustration";
import {
  EAF_EXAM_DATE,
  LANDING_IMAGES,
  PREMIERE_FINISH,
  URGENCY,
  WHATSAPP_URL_FINISH,
} from "@/components/sections/homepage/content";
import { cn } from "@/lib/utils";

export default function UrgencyFinish() {
  return (
    <section
      id="offres-fin-annee"
      className="bg-white px-6 py-20 sm:px-8 lg:px-12"
    >
      <div className="mx-auto max-w-7xl space-y-16">
        {/* ─── Bloc urgence ─── */}
        <div className="rounded-[28px] border border-[#b91c1c]/15 bg-gradient-to-br from-[#fff7f7] to-[#fff1f2]/40 p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#9f1239] px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-[0.12em] text-white">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {URGENCY.eyebrow}
                </span>
                <CountdownChip
                  targetDate={EAF_EXAM_DATE}
                  label="avant les échéances"
                  tone="urgent"
                />
              </div>

              <h2 className="mt-5 font-display text-h2 font-bold text-[#0f2f57]">
                {URGENCY.title}
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-700">
                {URGENCY.description}
              </p>

              <div className="mt-6">
                <TrackedCTAButton href={WHATSAPP_URL_FINISH} variant="stage" trackingLocation="finish_urgency">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Réserver avant le 8 juin
                </TrackedCTAButton>
              </div>
            </div>

            {/* Image urgence */}
            <LandingIllustration
              src={LANDING_IMAGES.finish.src}
              alt={LANDING_IMAGES.finish.alt}
              aspect="4/3"
              variant="light"
              overlay
              className="hidden lg:block"
            />
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {URGENCY.bullets.map((bullet) => (
              <div
                key={bullet}
                className="flex gap-3 rounded-2xl border border-[#b91c1c]/8 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
              >
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#9f1239]"
                  aria-hidden="true"
                />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Offre Première Finish ─── */}
        <div>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#9f1239]">
                {PREMIERE_FINISH.eyebrow}
              </p>
              <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
                {PREMIERE_FINISH.title}
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-700">
                {PREMIERE_FINISH.subtitle}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {PREMIERE_FINISH.audience}
              </p>
            </div>

            {/* Image Première Finish */}
            <LandingIllustration
              src={LANDING_IMAGES.premiereFinish.src}
              alt={LANDING_IMAGES.premiereFinish.alt}
              aspect="4/3"
              variant="light"
              overlay
              className="hidden lg:block"
            />
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {PREMIERE_FINISH.formulas.map((formula) => (
              <article
                key={formula.name}
                className={cn(
                  "flex h-full flex-col rounded-[24px] border p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                  formula.highlighted
                    ? "border-[#0f3d73] bg-[#0f3d73] text-white"
                    : "border-slate-200 bg-white text-slate-950"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl font-bold">
                      Formule {formula.name}
                    </h3>
                    <p
                      className={cn(
                        "mt-1 text-sm",
                        formula.highlighted
                          ? "text-blue-100"
                          : "text-slate-500"
                      )}
                    >
                      {formula.sessions}
                    </p>
                  </div>
                  {formula.highlighted && (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0f3d73]">
                      Recommandée
                    </span>
                  )}
                </div>

                <div className="mt-5">
                  <p className="font-display text-3xl font-bold">
                    {formula.hours}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-medium",
                      formula.highlighted ? "text-blue-100" : "text-[#0f3d73]"
                    )}
                  >
                    {formula.price}
                  </p>
                </div>

                <p
                  className={cn(
                    "mt-4 text-sm leading-7",
                    formula.highlighted ? "text-blue-50" : "text-slate-700"
                  )}
                >
                  {formula.description}
                </p>

                <ul className="mt-5 space-y-2.5 text-sm">
                  {formula.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          formula.highlighted
                            ? "text-blue-200"
                            : "text-[#0f3d73]"
                        )}
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6">
                  <TrackedCTAButton
                    href={WHATSAPP_URL_FINISH}
                    variant={formula.highlighted ? "eaf-outline" : "eaf"}
                    fullWidth
                    className={
                      formula.highlighted
                        ? "border-white bg-white text-[#0f3d73] hover:bg-blue-50"
                        : undefined
                    }
                    trackingLocation={`finish_formula_${formula.name.toLowerCase().replace(/\s+/g, '_')}`}
                  >
                    {PREMIERE_FINISH.ctaLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </TrackedCTAButton>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            {PREMIERE_FINISH.priceNote}
          </p>
        </div>
      </div>
    </section>
  );
}
