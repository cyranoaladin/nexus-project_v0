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
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <CorporateNavbar />

      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
              Accompagnement scolaire
            </Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Un cadre exigeant pour progresser avec méthode
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-300">
              Nexus Réussite accompagne les élèves du système français à Tunis avec des groupes réduits,
              des bilans individualisés et un suivi parent lisible.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/bilan-gratuit" className="btn-primary">
                Demander un bilan gratuit
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <MessageCircle className="mr-2 h-4 w-4" />
                Écrire sur WhatsApp
              </a>
            </div>
          </div>

          <section className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pillars.map((pillar) => (
              <Card key={pillar} className="border-white/10 bg-white/5 backdrop-blur">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <p className="text-sm font-semibold text-white">{pillar}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-brand-accent" />
                  <h2 className="text-2xl font-semibold text-white">Ce que couvre le service</h2>
                </div>
                <div className="mt-6 space-y-4">
                  {offers.map((offer) => (
                    <div key={offer.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <h3 className="font-semibold text-white">{offer.title}</h3>
                      <p className="mt-1 text-sm text-neutral-300">{offer.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-brand-accent" />
                  <h2 className="text-2xl font-semibold text-white">ARIA en complément</h2>
                </div>
                <p className="mt-4 text-sm text-neutral-300">
                  ARIA complète l’accompagnement humain. Elle ne remplace ni l’enseignant ni les bilans.
                  Les réponses doivent être relues et travaillées avec méthode.
                </p>
                <div className="mt-6 space-y-3 text-sm text-neutral-300">
                  <div>Accès selon formule ou add-on.</div>
                  <div>Utilisation utile pour réviser, s’entraîner et structurer le travail.</div>
                  <div>Le suivi humain reste la référence principale.</div>
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/plateforme-aria" className="btn-outline">
                    Découvrir ARIA
                  </Link>
                  <Link href="/offres" className="btn-primary">
                    Voir les offres
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 backdrop-blur">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-brand-accent" />
              <h2 className="text-2xl font-semibold text-white">Pour qui ?</h2>
            </div>
            <p className="mt-4 max-w-3xl text-sm text-neutral-300">
              Familles, élèves scolarisés, candidats libres et double cursus: nous cadrons le besoin, nous orientons vers
              la bonne formule et nous gardons un langage clair pour les parents.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/bilan-gratuit" className="btn-primary">
                Être conseillé
              </Link>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </section>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
