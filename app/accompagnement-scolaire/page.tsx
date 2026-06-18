'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, BookOpen, Users, MessageCircle, ShieldCheck } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const WHATSAPP_URL = 'https://wa.me/21699192829';

const pillars = [
  'Groupes réduits',
  'Enseignants qualifiés',
  'Bilans individualisés',
  'Progression mesurable',
  'Suivi parent clair',
  'Présentiel à Mutuelleville ou en ligne',
];

const offers = [
  {
    title: 'Accompagnement annuel',
    description: 'Pour les familles qui veulent un cadre régulier, une méthode structurée et des bilans de progression.',
  },
  {
    title: 'Stages et remises à niveau',
    description: 'Pour reprendre de l’avance, combler les lacunes et préparer les échéances importantes.',
  },
  {
    title: 'Plateforme et ARIA',
    description: 'Un complément numérique utile, à relire et travailler avec méthode, sans remplacer l’encadrement humain.',
  },
];

export default function AccompagnementScolairePage() {
  return (
    <main className="luxury min-h-screen" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink py-16 px-4 md:px-6 pt-28">
        <div className="mx-auto max-w-5xl text-center">
          <Badge className="mb-4 border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            Accompagnement scolaire
          </Badge>
          <h1 className="font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">
            Un cadre exigeant pour progresser avec méthode
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-lux-ivory/75">
            Nexus Réussite accompagne les élèves du système français à Tunis avec des groupes réduits,
            des bilans individualisés et un suivi parent lisible.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Demander un bilan gratuit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold text-lux-ivory border-lux-line/40">
              <MessageCircle className="mr-2 h-4 w-4" />
              Écrire sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto max-w-6xl grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {pillars.map((pillar) => (
            <Card key={pillar} className="border-lux-line !bg-lux-white !text-lux-ink lux-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-lux-evergreen" />
                  <p className="text-sm font-semibold !text-lux-ink">{pillar}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-lux-line bg-lux-white lux-shadow">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-lux-gold" />
                <h2 className="text-2xl font-fraunces text-lux-ink">Ce que couvre le service</h2>
              </div>
              <div className="mt-6 space-y-4">
                {offers.map((offer) => (
                  <div key={offer.title} className="rounded-xl border border-lux-line/60 bg-lux-paper/60 p-4">
                    <h3 className="font-semibold text-lux-ink">{offer.title}</h3>
                    <p className="mt-1 text-sm text-lux-slate">{offer.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-lux-gold-wash" />
                <h2 className="text-2xl font-fraunces text-lux-ivory">ARIA en complément</h2>
              </div>
              <p className="mt-4 text-sm text-lux-ivory/75">
                ARIA complète l’accompagnement humain. Elle ne remplace ni l’enseignant ni les bilans.
                Les réponses doivent être relues et travaillées avec méthode.
              </p>
              <div className="mt-6 space-y-3 text-sm text-lux-ivory/75">
                <div>Accès selon formule ou add-on.</div>
                <div>Utilisation utile pour réviser, s’entraîner et structurer le travail.</div>
                <div>Le suivi humain reste la référence principale.</div>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/plateforme-aria" className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold text-lux-ivory border-lux-line/40">
                  Découvrir ARIA
                </Link>
                <Link href="/offres" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
                  Voir les offres
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-lux-line bg-lux-white p-6 md:p-8 lux-shadow">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-lux-gold" />
            <h2 className="text-2xl font-fraunces text-lux-ink">Pour qui ?</h2>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-lux-slate">
            Familles, élèves scolarisés, candidats libres et double cursus: nous cadrons le besoin,
            nous orientons vers la bonne formule et nous gardons un langage clair pour les parents.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Demander un bilan gratuit
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold text-lux-ink border-lux-line/40">
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
