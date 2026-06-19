import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const reassuranceItems = [
  'Cellule Cyclades',
  'Bacs blancs sur grilles officielles',
  'Groupes de 5 max',
  'Enseignants agrégés & certifiés',
];

/** Mini live exam card artifact — coefficients/priorities display */
function ExamCardArtifact() {
  return (
    <div className="relative w-full max-w-sm rounded-xl border border-lux-line bg-lux-white p-5 lux-shadow-hover" data-lux-animate>
      {/* Filigrane N */}
      <div
        className="pointer-events-none absolute right-3 top-2 select-none font-fraunces text-[80px] font-light leading-none opacity-[0.03]"
        aria-hidden="true"
      >
        N
      </div>

      <span className="lux-eyebrow text-lux-gold-deep">Carte d&apos;examen · Terminale</span>
      <p className="mt-2 font-fraunces text-lg font-medium text-lux-ink" role="presentation">
        Spécialités &amp; épreuves
      </p>
      <div className="lux-filet-gold mt-2 w-12" />

      <div className="mt-4 space-y-2 text-sm">
        {[
          { name: 'Spécialité 1', coef: 16, priority: 'haute' },
          { name: 'Spécialité 2', coef: 16, priority: 'haute' },
          { name: 'Grand Oral', coef: 10, priority: 'moyenne' },
          { name: 'Philosophie', coef: 8, priority: 'ciblée' },
        ].map((item) => (
          <div key={item.name} className="flex items-center justify-between border-b border-lux-line/30 pb-1.5">
            <span className="text-lux-slate">{item.name}</span>
            <div className="flex items-center gap-3">
              <span className="lux-price text-xs font-semibold text-lux-slate">
                coef.&nbsp;{item.coef}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${
                item.priority === 'haute'
                  ? 'bg-lux-gold/15 text-lux-gold-deep'
                  : item.priority === 'moyenne'
                    ? 'bg-lux-evergreen/10 text-lux-evergreen'
                    : 'bg-lux-ivory text-lux-slate'
              }`}>
                {item.priority}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-lux-slate">
        Stratégie personnalisée selon vos coefficients
      </p>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-lux-ink py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
          {/* Left — always visible for LCP. Animation via CSS only (lux-fade-in). */}
          <div
            className="space-y-6 lux-fade-in"
            data-lux-animate
          >
            <span className="lux-eyebrow text-lux-gold-wash">
              Établissement d&apos;accompagnement · Bac français · Tunis
            </span>

            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-fraunces font-light leading-[1.08] text-lux-ivory text-balance">
              Préparer le bac français avec méthode, suivi et exigence.
            </h1>

            <p className="max-w-lg text-base leading-relaxed text-lux-on-dark-muted font-dm-sans">
              Un cadre structurant pour préparer le bac français&nbsp;:
              enseignants agrégés, groupes de 5, bacs blancs,
              carte d&apos;examen et plateforme ARIA.
            </p>

            {/* CTA group */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Link
                href="/recommandation"
                className="lux-cta-reserve rounded-lg px-7 py-3.5 text-sm font-semibold"
              >
                Trouver ma formule
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/offres"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-lux-ivory/30 px-7 py-3.5 text-sm font-semibold text-lux-ivory transition-all hover:border-lux-ivory/50 min-h-[44px]"
              >
                Voir les offres & tarifs
              </Link>
              <a
                href={buildWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-lux-gold-wash transition-all hover:underline min-h-[44px]"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </div>

            {/* Reassurance strip */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-4">
              {reassuranceItems.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-lux-ivory/15 px-3 py-1 text-[0.65rem] font-medium text-lux-on-dark-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: exam card artifact */}
          <div
            className="flex justify-center lux-fade-in lux-fade-in-delay"
            data-lux-animate
          >
            <ExamCardArtifact />
          </div>
        </div>
      </div>

      {/* Bottom fade to ivory */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-lux-ivory to-transparent" />
    </section>
  );
}
