'use client';

import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { RecommendationWizard } from '@/components/premium/RecommendationWizard';

const WHATSAPP_URL = 'https://wa.me/21699192829';

export function RecommandationClient() {
  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      {/* Header */}
      <section className="bg-lux-ink py-14 px-4 md:px-6 pt-28">
        <div className="mx-auto max-w-2xl">
          <span className="lux-eyebrow text-lux-gold-wash">Diagnostic personnalisé</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-fraunces font-light text-lux-ivory">
            Trouver ma formule
          </h1>
          <p className="mt-3 text-base text-lux-ivory/70 font-dm-sans">
            Répondez à 3 questions pour découvrir les formules les plus adaptées
            à votre profil et vos objectifs.
          </p>
        </div>
      </section>

      {/* Wizard */}
      <section className="py-16 px-4 md:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-lux-line bg-lux-white p-6 md:p-10 lux-shadow">
            <RecommendationWizard />
          </div>
        </div>
      </section>

      {/* Why this diagnostic */}
      <section className="bg-lux-paper py-16 px-4 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-2xl md:text-3xl">
            Pourquoi ce diagnostic ?
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                num: '1',
                title: 'Profil unique',
                text: 'Chaque élève a des besoins différents. Nous les identifions pour proposer la meilleure formule.',
              },
              {
                num: '2',
                title: 'Gain de temps',
                text: 'Pas besoin de parcourir tout le catalogue. Découvrez directement les options adaptées.',
              },
              {
                num: '3',
                title: 'Décision éclairée',
                text: 'En choisissant la formule adaptée, vous optimisez l\'investissement et la progression.',
              },
            ].map((item) => (
              <div key={item.num} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-lux-gold/10">
                  <span className="font-fraunces text-lg font-medium text-lux-gold">
                    {item.num}
                  </span>
                </div>
                <h3 className="mb-1 text-lg">{item.title}</h3>
                <p className="text-sm text-lux-slate">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA fallback */}
      <section className="bg-lux-ink py-16 px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">
            Vous préférez échanger directement ?
          </h2>
          <p className="mt-3 text-base text-lux-ivory/70 font-dm-sans">
            Un conseiller peut répondre à toutes vos questions et vous orienter vers la bonne formule.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/bilan-gratuit"
              className="lux-cta-reserve rounded-lg px-8 py-3.5 text-sm font-semibold"
            >
              Demander un bilan gratuit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-lux-gold-wash hover:underline min-h-[44px]"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
