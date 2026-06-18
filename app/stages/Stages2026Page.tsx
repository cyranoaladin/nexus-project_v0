'use client';

import Link from 'next/link';
import { CalendarDays, CheckCircle2, MapPin, MessageCircle, ArrowRight } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const WHATSAPP_URL = 'https://wa.me/21699192829';

const periods = [
  {
    title: 'Prérentrée août 2026',
    description: 'Reprendre le rythme, consolider les bases et lancer l’année avec un plan clair.',
  },
  {
    title: 'Toussaint',
    description: 'Corriger les premières lacunes et sécuriser les méthodes de travail.',
  },
  {
    title: 'Hiver / février',
    description: 'Renforcer les acquis avant les évaluations intermédiaires et les choix d’orientation.',
  },
  {
    title: 'Printemps',
    description: 'Installer les automatismes, travailler les épreuves et stabiliser les acquis.',
  },
  {
    title: 'Sprint final',
    description: 'Préparer les dernières échéances avec un cadre court, dense et exigeant.',
  },
];

const pillars = [
  'Prise d’avance',
  'Remise à niveau',
  'Stages par matière',
  'Présentiel à Mutuelleville ou en ligne',
  'Groupes réduits',
  'Bilan et pré-inscription',
];

export default function Stages2026Page() {
  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink py-16 px-4 md:px-6 pt-28">
        <div className="mx-auto max-w-5xl">
          <Badge className="border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            Stages 2026/2027
          </Badge>
          <h1 className="mt-4 max-w-3xl text-4xl md:text-5xl font-fraunces font-light text-lux-ivory">
            Des stages utiles, structurés et pensés pour la progression réelle
          </h1>
          <p className="mt-4 max-w-3xl text-base text-lux-ivory/70">
            Les dates précises sont communiquées selon le niveau, l’établissement et la formule recommandée.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Pré-inscription
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-lux-line/40 px-6 py-3.5 text-sm font-semibold text-lux-ivory min-h-[44px]">
              <MessageCircle className="mr-2 h-4 w-4" />
              Écrire sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {periods.map((period) => (
              <Card key={period.title} className="border-lux-line bg-lux-ink text-lux-ivory">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-lux-gold">
                    <CalendarDays className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em]">Période</span>
                  </div>
                  <h2 className="mt-3 text-xl font-fraunces text-lux-ivory">{period.title}</h2>
                  <p className="mt-2 text-sm text-lux-ivory/75">{period.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 px-4 md:px-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card className="border-lux-line bg-lux-ink text-lux-ivory">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-fraunces text-lux-ivory">Ce que couvrent les stages</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {pillars.map((pillar) => (
                  <div key={pillar} className="flex items-center gap-3 rounded-lg border border-lux-line/50 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-lux-evergreen" />
                    <span className="text-sm text-lux-ivory/80">{pillar}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-ink text-lux-ivory">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-2 text-lux-gold-wash">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">Format</span>
              </div>
              <h2 className="mt-3 text-2xl font-fraunces">Mutuelleville ou en ligne</h2>
              <p className="mt-3 text-sm text-lux-ivory/75">
                Les stages sont pensés pour fonctionner en présentiel à Mutuelleville ou à distance selon la formule recommandée.
              </p>
              <div className="mt-6 space-y-3 text-sm text-lux-ivory/80">
                <div>Groupes réduits pour garder un vrai suivi.</div>
                <div>Bilan avant inscription pour orienter le bon niveau.</div>
                <div>Préparation méthodique par matière et par objectif.</div>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
                  Demander un bilan
                </Link>
                <Button asChild variant="outline" className="border-lux-line/40 text-lux-ivory hover:bg-white/5">
                  <Link href="/offres">
                    Voir les offres
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto max-w-5xl rounded-2xl border border-lux-line bg-lux-white p-6 md:p-8">
          <h2 className="text-2xl font-fraunces text-lux-ink">Prêt à sécuriser une place ?</h2>
          <p className="mt-2 text-sm text-lux-slate">
            Un bilan gratuit permet de confirmer le bon stage, le bon niveau et le bon rythme de travail.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Pré-inscription
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-lux-line px-6 py-3.5 text-sm font-semibold text-lux-ink min-h-[44px]">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
