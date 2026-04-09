import CTAButton from "./CTAButton";
import {
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  PHONE,
  PHONE_LINK,
  WHATSAPP_URL,
} from "../_lib/constants";

export default function FinalCTA() {
  return (
    <section
      id="reservation"
      className="relative overflow-hidden bg-nexus-bg px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.22),transparent_42%)]" />

      <div className="relative mx-auto max-w-4xl text-center">
        <h2 className="font-display text-h2 font-bold text-white">
          Le 2 mai, tes révisions sont terminées.
        </h2>
        <p className="mt-5 text-base leading-8 text-white/60">
          Le reste n'est que du bonus. 6 élèves max, inscription dans l'ordre d'arrivée.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <CTAButton href={WHATSAPP_URL} external className="sm:min-w-[250px]">
            Sécuriser ma Mention 🎯
          </CTAButton>
          <CTAButton href={PHONE_LINK} variant="outline" className="sm:min-w-[250px]">
            📞 Bilan gratuit
          </CTAButton>
        </div>

        <div className="mt-8 space-y-2 text-sm leading-7 text-white/55">
          <p>{CONTACT_ADDRESS}</p>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">
              {CONTACT_EMAIL}
            </a>{" "}
            •{" "}
            <a href={PHONE_LINK} className="hover:text-white">
              {PHONE}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
