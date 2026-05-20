"use client";

import { useState } from "react";
import { ChevronDown, Mail, MessageCircle, Phone } from "lucide-react";
import CTAButton from "@/components/sections/homepage/CTAButton";
import TrackedCTAButton from "@/components/sections/homepage/TrackedCTAButton";
import LandingIllustration from "@/components/sections/homepage/LandingIllustration";
import {
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  FAQ_ITEMS,
  LANDING_IMAGES,
  PHONE_LABEL,
  PHONE_URL,
  WHATSAPP_URL,
} from "@/components/sections/homepage/content";
import { cn } from "@/lib/utils";

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-[#0f3d73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d73] focus-visible:ring-offset-2"
      >
        <span className="font-display text-base font-semibold text-[#0f2f57]">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200",
          open ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-7 text-slate-600">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomepageFinalCTA() {
  return (
    <section id="contact" className="scroll-mt-28 bg-gradient-to-b from-[#f0f5ff] to-white px-6 py-16 sm:px-8 sm:py-20 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-16">
        {/* ─── FAQ ─── */}
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
            Questions fréquentes
          </p>
          <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
            Tout ce qu'il faut savoir avant de réserver.
          </h2>

          <div className="mt-8 rounded-[24px] border border-slate-200 bg-white px-6 shadow-sm">
            {FAQ_ITEMS.map((item) => (
              <FAQItem
                key={item.question}
                question={item.question}
                answer={item.answer}
              />
            ))}
          </div>
        </div>

        {/* ─── CTA Final ─── */}
        <div className="overflow-hidden rounded-[32px] border border-[#0f3d73]/10 bg-[radial-gradient(circle_at_bottom_right,rgba(219,234,254,0.88),transparent_42%),linear-gradient(180deg,#ffffff,#f8fbff)] p-8 shadow-xl shadow-slate-200/60 sm:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
              Réserver une place
            </p>
            <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
              Un accompagnement exigeant commence par un premier échange.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-700">
              Contactez-nous sur WhatsApp pour échanger sur le profil de l'élève, ses objectifs et la formule la plus adaptée. Groupes limités, places attribuées par ordre de contact.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <TrackedCTAButton href={WHATSAPP_URL} variant="eaf" trackingLocation="final_cta">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Échanger sur le profil de l'élève
            </TrackedCTAButton>
            <CTAButton href={`mailto:${CONTACT_EMAIL}`} variant="eaf-outline">
              <Mail className="h-4 w-4" aria-hidden="true" />
              Écrire par email
            </CTAButton>
          </div>

          <div className="mt-8 space-y-2 text-sm text-slate-700">
            <p className="flex items-center gap-2">
              <MessageCircle
                className="h-4 w-4 text-[#0f3d73]"
                aria-hidden="true"
              />
              <span>WhatsApp :</span>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#0f3d73] underline-offset-4 transition hover:underline"
              >
                {PHONE_LABEL}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Phone
                className="h-4 w-4 text-[#0f3d73]"
                aria-hidden="true"
              />
              <a
                href={PHONE_URL}
                className="font-medium text-[#0f3d73] underline-offset-4 transition hover:underline"
              >
                {PHONE_LABEL}
              </a>
              <span className="text-slate-500">·</span>
              <span>{CONTACT_ADDRESS}</span>
            </p>
            <p className="flex items-center gap-2">
              <Mail
                className="h-4 w-4 text-[#0f3d73]"
                aria-hidden="true"
              />
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-[#0f3d73] underline-offset-4 transition hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>

          <LandingIllustration
            src={LANDING_IMAGES.finalCta.src}
            alt={LANDING_IMAGES.finalCta.alt}
            aspect="4/3"
            variant="card"
            overlay
            className="hidden lg:block"
          />
          </div>
        </div>
      </div>
    </section>
  );
}
