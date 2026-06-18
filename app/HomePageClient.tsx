'use client';

import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import {
  HeroSection,
  MethodSection,
  ForWhoSection,
  ExamCard,
  ComparisonTable,
  FAQAccordion,
  fmtTND,
  fmtDesMonthly,
  type ComparisonRow,
  type FAQItem,
} from '@/components/premium';
import {
  getOffersByLevel,
  getReperes,
  getRules,
} from '@/lib/pricing';

const WHATSAPP_URL = 'https://wa.me/21699192829';

// ── Repères tarifaires — read from JSON via loader ──

function PricingReperesSection() {
  const reperes = getReperes();
  const rules = getRules();

  // Show a few repères as anchor points
  const anchors = [
    {
      label: 'Spécialité simple',
      sublabel: 'Terminale · 2h/semaine',
      value: reperes?.['term-spe-simple'] || 'dès 3 900 TND/an',
    },
    {
      label: 'Double Sécurité',
      sublabel: 'Première · 4h/semaine',
      value: reperes?.['1re-double-secu'] || 'dès 5 400 TND/an',
    },
    {
      label: 'Stage Intensif Express',
      sublabel: '10h · toutes vacances',
      value: reperes?.['intensif-express'] || 'dès 490 TND',
    },
    {
      label: 'Plateforme Masterium',
      sublabel: 'Autonomie · en ligne',
      value: reperes?.['plateforme-autonomie'] || 'dès 590 TND/an',
    },
  ];

  // Fallback: if repères is empty, use loader data directly
  const termSpe = getOffersByLevel('terminale')?.[0];

  return (
    <section className="py-20 px-4 md:px-6 bg-lux-paper">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <span className="lux-eyebrow">Repères tarifaires</span>
          <h2 className="mt-3 text-3xl md:text-4xl text-balance">
            Des formules pour chaque besoin
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-lux-slate">
            Groupes de {rules.group_max} max, garanti dès {rules.group_min_open.lycee}.
            Tous les tarifs en TND.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {anchors.map((anchor) => (
            <div
              key={anchor.label}
              className="rounded-xl border border-lux-line bg-lux-white p-5 lux-shadow transition-all hover:lux-shadow-hover"
            >
              <p className="text-sm font-semibold text-lux-ink">{anchor.label}</p>
              <p className="mt-0.5 text-xs text-lux-slate">{anchor.sublabel}</p>
              <p className="mt-3 lux-price text-lg text-lux-gold">{anchor.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/offres"
            className="lux-cta-secondary rounded-lg px-6 py-3 text-sm"
          >
            Voir tous les tarifs
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Comparison data ──

const comparisonRows: ComparisonRow[] = [
  { feature: 'Effectif', nexus: '5 élèves max', traditional: '15 à 30 élèves' },
  { feature: 'Enseignants', nexus: 'Agrégés / certifiés', traditional: 'Variable' },
  { feature: 'Carte d\'examen personnalisée', nexus: true, traditional: false },
  { feature: 'Bacs blancs sur grilles officielles', nexus: true, traditional: false },
  { feature: 'Plateforme numérique (Masterium)', nexus: true, traditional: false },
  { feature: 'Suivi parents en temps réel', nexus: true, traditional: false },
  { feature: 'Cellule Cyclades (candidats libres)', nexus: true, traditional: false },
  { feature: 'Coaching orientation / Parcoursup', nexus: 'Boussole (en option)', traditional: false },
];

// ── FAQ ──

const faqItems: FAQItem[] = [
  {
    question: 'Comment fonctionnent les groupes de 5 maximum ?',
    answer:
      'Chaque groupe est limité à 5 élèves (4 pour le Brevet) pour garantir un suivi personnalisé. Le groupe est ouvert dès 3 inscrits. Si le seuil n\'est pas atteint, l\'acompte est intégralement remboursé.',
  },
  {
    question: 'Qui sont les enseignants ?',
    answer:
      'Nos enseignants sont agrégés et certifiés de l\'enseignement français à l\'étranger, spécialistes de chaque épreuve du baccalauréat. Ils connaissent les grilles de correction officielles et les attentes des jurys.',
  },
  {
    question: 'Comment fonctionne l\'échéancier de paiement ?',
    answer:
      'Un acompte de 30 % est versé à la réservation, puis le solde est réparti en mensualités. L\'acompte d\'un stage ou Pass est déductible si vous souscrivez ensuite un parcours annuel.',
  },
  {
    question: 'Qu\'est-ce que la plateforme Masterium ?',
    answer:
      'Masterium est notre plateforme numérique avec trois paliers (Autonomie, Suivi, Accompagnée). Elle offre des ressources, parcours de révision, fiches et exercices, avec un suivi adapté à chaque niveau d\'abonnement.',
  },
  {
    question: 'Proposez-vous un accompagnement pour les candidats libres ?',
    answer:
      'Oui, nous avons des parcours dédiés aux candidats libres (Essentiel, Mixte, Premium) avec cellule Cyclades intégrée pour l\'accompagnement administratif. Le Pass Candidat Libre regroupe diagnostic, stages et épreuves blanches.',
  },
];

// ── Main ──

export function HomePageClient() {
  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      <HeroSection />

      <MethodSection />

      <ForWhoSection />

      <PricingReperesSection />

      {/* Comparatif */}
      <section className="py-20 px-4 md:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <span className="lux-eyebrow">Pourquoi Nexus Réussite</span>
            <h2 className="mt-3 text-3xl md:text-4xl text-balance">
              Nexus Réussite vs soutien classique
            </h2>
          </div>
          <ComparisonTable rows={comparisonRows} />
        </div>
      </section>

      <FAQAccordion items={faqItems} />

      {/* CTA bilan gratuit */}
      <section className="bg-lux-ink py-20 px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="lux-eyebrow text-lux-gold-wash">Commencer</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-fraunces font-light text-lux-ivory">
            Trouvez la formule adaptée à votre enfant
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-lux-ivory/70 font-dm-sans">
            Un diagnostic gratuit pour identifier les besoins,
            définir les priorités et recommander le meilleur parcours.
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
              Nous écrire sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
