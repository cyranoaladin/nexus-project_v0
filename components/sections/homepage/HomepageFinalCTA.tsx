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
    <section id="reservation" className="bg-nexus-bg px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-8 sm:p-10 lg:p-14">
        <div className="max-w-3xl">
          <h2 className="font-display text-h2 font-bold text-white">
            Chaque jour compte. Commence maintenant.
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/58">
            Le stage pour l'intensif. La plateforme pour le quotidien. Les deux pour la mention.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <CTAButton href={STAGES_URL} variant="stage">
            Découvrir les Stages Printemps →
          </CTAButton>
          <CTAButton href={EAF_URL} variant="eaf">
            Essayer la Plateforme EAF gratuitement →
          </CTAButton>
        </div>

        <div className="mt-8 space-y-2 text-sm text-white/60">
          <p>
            <span className="inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-nexus-green" aria-hidden="true" />
              Besoin de conseils ? WhatsApp :
            </span>{" "}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-nexus-green"
            >
              {PHONE_LABEL}
            </a>{" "}
            •{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-white hover:text-nexus-purple">
              <Mail className="mr-1 inline h-4 w-4" aria-hidden="true" />
              {CONTACT_EMAIL}
            </a>
          </p>
          <p>
            <a href={PHONE_URL} className="text-white hover:text-nexus-green">
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
