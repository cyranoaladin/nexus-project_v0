import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const reassuranceItems = [
  'Enseignants agrégés & certifiés',
  'Groupes de 5 max',
  'Cellule Cyclades',
];

/** WhatsApp official logo (brand green) */
function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/** Credibility card: coefficients réseau AEFE */
function CredibilityCard() {
  return (
    <div className="rounded-xl bg-lux-paper/95 p-4 shadow-lg shadow-lux-ink/10 backdrop-blur-sm border border-lux-line/30">
      <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-lux-gold-deep">
        Coefficients · réseau AEFE
      </span>
      <div className="mt-2 space-y-1.5 text-sm">
        {[
          { name: 'Spécialités', coef: 16 },
          { name: 'Grand Oral', coef: 10 },
          { name: 'Philosophie', coef: 8 },
        ].map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <span className="text-lux-slate">{item.name}</span>
            <span className="font-dm-sans font-semibold text-lux-gold-deep">coef.&nbsp;{item.coef}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
                className="inline-flex items-center gap-2 text-sm font-medium text-[#25D366] transition-all hover:text-[#20BD5A] min-h-[44px]"
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

          {/* ── Right column: hero image + credibility card ── */}
          <div className="relative order-1 md:order-2 lux-fade-in lux-fade-in-delay" data-lux-animate>
            {/* Image zone */}
            <div className="relative overflow-hidden rounded-2xl bg-lux-ink/50 border-l-2 border-lux-gold/20 min-h-[280px] sm:min-h-[320px] md:min-h-[380px]">
              <Image
                src="/images/hero-study-session.webp"
                alt="Séance de travail en petit groupe — Nexus Réussite"
                fill
                className="object-cover object-center"
                priority
                sizes="(max-width: 768px) 100vw, 45vw"
              />
              {/* Subtle overlay for contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-lux-ink/40 via-transparent to-transparent" />
            </div>

            {/* Credibility card — superposed at bottom */}
            <div className="absolute -bottom-4 left-4 right-4 sm:left-6 sm:right-6 md:-bottom-6">
              <CredibilityCard />
            </div>
          </div>

        </div>
      </div>

      {/* Bottom gradient transition to ivory */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-lux-ivory to-transparent" />
    </section>
  );
}
