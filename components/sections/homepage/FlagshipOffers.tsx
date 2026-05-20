import { ArrowRight } from "lucide-react";
import TrackedCTAButton from "@/components/sections/homepage/TrackedCTAButton";
import LandingIllustration from "@/components/sections/homepage/LandingIllustration";
import {
  ACCOMPAGNEMENTS,
  ACCOMPAGNEMENTS_INTRO,
  LANDING_IMAGES,
  WHATSAPP_URL_FORFAITS,
} from "@/components/sections/homepage/content";
import { resolveUiIcon } from "@/lib/ui-icons";

export default function FlagshipOffers() {
  return (
    <section id="accompagnements" className="bg-gradient-to-b from-[#eaf1ff] to-[#dfe9fb] px-6 py-16 sm:px-8 sm:py-20 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
              Nos accompagnements
            </p>
            <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
              Un cadre complet, pas une simple succession de cours.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-700">
              {ACCOMPAGNEMENTS_INTRO}
            </p>
          </div>

          <LandingIllustration
            src={LANDING_IMAGES.personalizedSupport.src}
            alt={LANDING_IMAGES.personalizedSupport.alt}
            aspect="4/3"
            variant="light"
            overlay
            className="hidden lg:block"
          />
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {ACCOMPAGNEMENTS.map((item) => {
            const ItemIcon = resolveUiIcon(item.icon);
            return (
              <article
                key={item.title}
                className="flex h-full flex-col rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6ff] text-[#0f3d73]">
                  <ItemIcon className="h-5 w-5" aria-hidden="true" />
                </div>

                <h3 className="mt-5 font-display text-xl font-bold text-[#0f2f57]">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {item.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {item.bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {bullet}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <TrackedCTAButton href={WHATSAPP_URL_FORFAITS} variant="eaf" trackingLocation="accompagnements">
            Choisir ma formule sur WhatsApp
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </TrackedCTAButton>
        </div>
      </div>
    </section>
  );
}
