import { ArrowRight, Check } from "lucide-react";
import TrackedCTAButton from "@/components/sections/homepage/TrackedCTAButton";
import LandingIllustration from "@/components/sections/homepage/LandingIllustration";
import {
  FORFAITS,
  LANDING_IMAGES,
  WHATSAPP_URL_FORFAITS,
} from "@/components/sections/homepage/content";
import { cn } from "@/lib/utils";

export default function Forfaits() {
  return (
    <section id="forfaits" className="bg-white px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
            {FORFAITS.eyebrow}
          </p>
          <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
            {FORFAITS.title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-700">
            {FORFAITS.description}
          </p>
        </div>

        <LandingIllustration
          src={LANDING_IMAGES.forfaits.src}
          alt={LANDING_IMAGES.forfaits.alt}
          aspect="16/9"
          variant="light"
          overlay
          className="mt-10 hidden lg:block"
          sizes="(min-width: 1024px) 1100px, 100vw"
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {FORFAITS.plans.map((plan) => (
            <article
              key={plan.name}
              className={cn(
                "flex h-full flex-col rounded-[24px] border p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                plan.highlighted
                  ? "border-[#0f3d73] bg-[#0f3d73] text-white"
                  : "border-slate-200 bg-white text-slate-950"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-2xl font-bold">
                  {plan.name}
                </h3>
                {plan.badge && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold",
                      plan.highlighted
                        ? "bg-white text-[#0f3d73]"
                        : "bg-[#eff6ff] text-[#0f3d73]"
                    )}
                  >
                    {plan.badge}
                  </span>
                )}
              </div>

              <div className="mt-4">
                <p className="font-display text-3xl font-bold">{plan.hours}</p>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    plan.highlighted ? "text-blue-100" : "text-slate-500"
                  )}
                >
                  {plan.sessions}
                </p>
              </div>

              <p
                className={cn(
                  "mt-3 text-sm font-semibold",
                  plan.highlighted ? "text-blue-200" : "text-[#0f3d73]"
                )}
              >
                {plan.price}
              </p>

              <p
                className={cn(
                  "mt-3 text-sm leading-7",
                  plan.highlighted ? "text-blue-50" : "text-slate-700"
                )}
              >
                {plan.tagline}
              </p>

              <ul className="mt-5 space-y-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        plan.highlighted ? "text-blue-200" : "text-[#0f3d73]"
                      )}
                      aria-hidden="true"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-6">
                <TrackedCTAButton
                  href={WHATSAPP_URL_FORFAITS}
                  variant={plan.highlighted ? "eaf-outline" : "eaf"}
                  fullWidth
                  className={
                    plan.highlighted
                      ? "border-white bg-white text-[#0f3d73] hover:bg-blue-50"
                      : undefined
                  }
                  trackingLocation={`forfait_${plan.name.toLowerCase().replace(/\s+/g, '_')}`}
                >
                  Choisir cette formule
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </TrackedCTAButton>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 mx-auto max-w-3xl space-y-3 rounded-[20px] border border-slate-200 bg-[#f8fbff] p-5">
          <p className="text-sm leading-7 text-slate-600">
            {FORFAITS.groupNote}
          </p>
          <p className="text-xs leading-6 text-slate-500">
            {FORFAITS.note}
          </p>
        </div>
      </div>
    </section>
  );
}
