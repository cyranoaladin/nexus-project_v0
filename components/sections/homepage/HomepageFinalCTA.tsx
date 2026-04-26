import CTAButton from "@/components/sections/homepage/CTAButton";
import { Mail, MessageCircle, Phone } from "lucide-react";
import {
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  EAF_URL,
  PHONE_LABEL,
  PHONE_URL,
  STAGES_URL,
  WHATSAPP_URL,
} from "@/components/sections/homepage/content";

export default function HomepageFinalCTA() {
  return (
    <section id="reservation" className="bg-white px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-[#0f3d73]/10 bg-[radial-gradient(circle_at_bottom_right,rgba(219,234,254,0.88),transparent_42%),linear-gradient(180deg,#ffffff,#f8fbff)] p-8 shadow-xl shadow-slate-200/60 sm:p-10 lg:p-14">
        <div className="max-w-3xl">
          <h2 className="font-display text-h2 font-bold text-[#0f2f57]">
            Trouver la bonne formule commence par un diagnostic clair.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            Cours hebdomadaires, stages intensifs, packs par objectif ou plateforme EAF : Nexus Réussite accompagne votre enfant toute l'année avec une trajectoire lisible.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <CTAButton href={WHATSAPP_URL} variant="eaf">
            Demander un diagnostic
          </CTAButton>
          <CTAButton href={STAGES_URL} variant="stage">
            Voir les stages
          </CTAButton>
          <CTAButton href={EAF_URL} variant="eaf-outline">
            Accéder à la plateforme EAF
          </CTAButton>
        </div>

        <div className="mt-8 space-y-2 text-sm text-slate-700">
          <p>
            <span className="inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#0f3d73]" aria-hidden="true" />
              Besoin de conseils ? WhatsApp :
            </span>{" "}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#0f3d73] underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d73] focus-visible:ring-offset-2"
            >
              {PHONE_LABEL}
            </a>{" "}
            •{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#0f3d73] underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d73] focus-visible:ring-offset-2">
              <Mail className="mr-1 inline h-4 w-4" aria-hidden="true" />
              {CONTACT_EMAIL}
            </a>
          </p>
          <p>
            <a href={PHONE_URL} className="font-medium text-[#0f3d73] underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d73] focus-visible:ring-offset-2">
              <Phone className="mr-1 inline h-4 w-4" aria-hidden="true" />
              {PHONE_LABEL}
            </a>{" "}
            • {CONTACT_ADDRESS}
          </p>
        </div>
      </div>
    </section>
  );
}
