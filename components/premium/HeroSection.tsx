import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { WhatsAppLogo, WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';

const reassuranceItems = [
  'Enseignants agrégés & certifiés',
  'Groupes de 5 max',
  'Cellule Cyclades',
];

export function HeroSection() {
  return (
    <section data-hero className="relative overflow-hidden bg-lux-ink">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24 lg:py-28">
        <div className="grid items-center gap-10 md:grid-cols-[1.15fr_0.85fr] md:gap-14 lg:gap-20">

          {/* ── Left column: copy ── */}
          <div className="order-2 md:order-1 space-y-6 lux-fade-in" data-lux-animate>
            {/* Eyebrow */}
            <span className="inline-block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-lux-gold-wash">
              Accompagnement · bac français, réseau AEFE · Tunis
            </span>

            {/* Title — serif display */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-fraunces font-light leading-[1.08] text-lux-ivory text-balance">
              Préparer le bac français avec méthode, suivi et exigence.
            </h1>

            {/* Description */}
            <p className="max-w-lg text-base leading-relaxed text-lux-on-dark-muted font-dm-sans">
              Un cadre structurant pensé pour les familles&nbsp;: enseignants agrégés et certifiés,
              groupes de 5, bacs blancs sur grilles officielles, et la plateforme ARIA.
            </p>

            {/* CTA row */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:flex-wrap">
              <Link
                href="/recommandation"
                className="lux-cta-reserve rounded-lg px-7 py-3.5 text-sm font-semibold inline-flex items-center justify-center"
              >
                Trouver ma formule
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/offres"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-lux-ivory/30 px-7 py-3.5 text-sm font-semibold text-lux-ivory transition-all hover:border-lux-ivory/60 hover:bg-lux-ivory/5 min-h-[44px]"
              >
                Voir les offres &amp; tarifs
              </Link>
              <a
                href={buildWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium transition-all hover:opacity-80 min-h-[44px]"
                style={{ color: WHATSAPP_BRAND_GREEN }}
              >
                <WhatsAppLogo className="h-5 w-5" />
                WhatsApp
              </a>
            </div>

            {/* Reassurance pills */}
            <div className="flex flex-wrap gap-x-3 gap-y-2 pt-3">
              {reassuranceItems.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-lux-ivory/15 px-3.5 py-1.5 text-[0.65rem] font-medium text-lux-on-dark-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* ── Right column: hero image ── */}
          <div className="order-1 md:order-2 lux-fade-in lux-fade-in-delay" data-lux-animate>
            <div className="overflow-hidden rounded-2xl shadow-lg shadow-lux-ink/20 ring-1 ring-lux-gold/10">
              <Image
                src="/hero/hero.webp"
                alt="Stages de prérentrée Nexus Réussite — Août 2026"
                width={1672}
                height={941}
                className="block w-full h-auto"
                priority
                sizes="(max-width: 768px) 100vw, 45vw"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Bottom gradient transition to ivory */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-lux-ivory to-transparent" />
    </section>
  );
}
