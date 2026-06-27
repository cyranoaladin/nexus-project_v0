'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { WhatsAppLogo, WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import {
  HeroSection,
  MethodSection,
  FAQAccordion,
  type FAQItem,
} from '@/components/premium';
import {
  getReperes,
  getRules,
} from '@/lib/pricing';
import {
  EnjeuxNiveau,
  ProcessSteps,
  ReassuranceChips,
  Testimonials,
  TransparencyBanner,
} from '@/components/marketing/acadomia-inspired';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

// ── Router par niveau (near hero) ──

const levelRoutes = [
  { label: 'Terminale', href: '/offres#section-annual', sublabel: 'Spécialités, Grand Oral, Parcoursup' },
  { label: 'Première', href: '/offres#section-annual', sublabel: 'EAF, contrôle continu, spécialités' },
  { label: 'Seconde', href: '/offres#section-annual', sublabel: 'Méthode, orientation, spécialités' },
  { label: 'Troisième', href: '/offres#section-annual', sublabel: 'Brevet, préparation lycée' },
  { label: 'Candidat libre', href: '/offres#section-libre', sublabel: 'Cyclades, organisation, épreuves' },
];

function LevelRouter() {
  return (
    <section className="bg-lux-white px-4 py-10 md:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="mb-5 text-center text-sm font-semibold text-lux-ink">
          Mon enfant est en…
        </p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {levelRoutes.map((route) => (
            <Link
              key={route.label}
              href={route.href}
              data-card="level-primary"
              className="flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-lux-line bg-lux-paper px-4 py-3 text-center lux-shadow transition-all hover:border-lux-gold/60 hover:lux-shadow-hover lux-focus"
            >
              <span className="text-sm font-semibold text-lux-ink">{route.label}</span>
              <span className="mt-0.5 text-xs text-lux-slate">{route.sublabel}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Repères tarifaires + Transparence + Chips réassurance (merged) ──

function PricingReperesSection() {
  const reperes = getReperes();
  const rules = getRules();

  const anchors = [
    {
      label: 'Spécialité simple',
      sublabel: 'Terminale · 2h/semaine',
      value: reperes.terminaleSimpleMois,
    },
    {
      label: 'Double Sécurité',
      sublabel: 'Première · 4h/semaine',
      value: reperes.premiereDuoMois,
    },
    {
      label: 'Stage Intensif',
      sublabel: 'Toutes vacances',
      value: reperes.stagesBase,
    },
    {
      label: 'Plateforme ARIA',
      sublabel: 'Autonomie · en ligne',
      value: reperes.plateformeAn,
    },
  ];

  return (
    <section className="bg-lux-white px-4 py-14 md:py-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <span className="lux-eyebrow">Repères tarifaires</span>
          <h2 className="mt-3 text-2xl md:text-3xl font-fraunces text-balance">
            Des formules pour chaque besoin
          </h2>
          <div className="lux-filet-gold mx-auto mt-3 w-16" />
          <p className="mx-auto mt-3 max-w-xl text-base text-lux-slate">
            Groupes de {rules.group_max} max, ouverture dès {rules.group_min_open.lycee}.
            Tous les tarifs en TND.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {anchors.map((anchor) => (
            <div
              key={anchor.label}
              className="rounded-xl border border-lux-line bg-lux-paper p-5 lux-shadow transition-all hover:lux-shadow-hover"
            >
              <p className="text-sm font-semibold text-lux-ink">{anchor.label}</p>
              <p className="mt-0.5 text-xs text-lux-slate">{anchor.sublabel}</p>
              <p className="mt-3 lux-price text-lg text-lux-gold-deep">{anchor.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <TransparencyBanner compact />
        </div>

        {/* Reassurance chips — rattachées au bloc tarifs */}
        <div className="mt-6">
          <ReassuranceChips />
        </div>

        <div className="mt-6 text-center">
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

// ── Confiance vérifiable (fusionnée AccompagnementInclus + TrustSection) ──

function getVerifiableItems(groupMax: number): string[] {
  return [
  'Enseignants agrégés et certifiés, spécialistes de l’épreuve',
  'Corrections sur grilles officielles du baccalauréat et bacs blancs',
  `Groupes de ${groupMax} élèves maximum — suivi individualisé`,
  'Transparence tarifaire : tous les prix publics, en TND',
  'Accès à la plateforme ARIA — ressources et révisions en continu',
  'Bilans réguliers et suivi parent en temps réel',
  'Carte d’examen personnalisée',
  'Cellule Cyclades intégrée pour les candidats libres',
  'Cadre réseau AEFE — programme et exigences de l’enseignement français',
  ];
}

function VerifiableSection() {
  const { group_max: groupMax } = getRules();
  const verifiableItems = getVerifiableItems(groupMax);

  return (
    <section className="bg-lux-paper px-4 py-14 md:py-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <span className="lux-eyebrow">Le cadre Nexus</span>
          <h2 className="mt-3 text-2xl md:text-3xl font-fraunces text-balance">
            Un accompagnement vérifiable, pas des promesses
          </h2>
          <div className="lux-filet-gold mx-auto mt-3 w-16" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {verifiableItems.map((item) => (
            <div
              key={item}
              data-card="verifiable-secondary"
              className="flex items-start gap-3 rounded-xl border border-lux-line bg-lux-white p-5"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-lux-evergreen" aria-hidden="true" />
              <span className="text-sm leading-6 text-lux-ink">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ──

function getFaqItems(rules: { group_max: number; group_min_open: Record<string, number> }): FAQItem[] {
  const groupMax = rules.group_max;
  const lyceeMin = rules.group_min_open.lycee;
  const collegeMin = rules.group_min_open.college;

  return [
  {
    question: `Comment fonctionnent les groupes de ${groupMax} maximum ?`,
    answer:
      `Chaque groupe est limité à ${groupMax} élèves afin de préserver un suivi personnalisé. Le groupe est ouvert dès ${lyceeMin} inscrits au lycée et ${collegeMin} au Brevet. Si le seuil n’est pas atteint, l’acompte est intégralement remboursé.`,
  },
  {
    question: 'Qui sont les enseignants ?',
    answer:
      'Nos enseignants sont agrégés et certifiés de l’enseignement français à l’étranger, spécialistes de chaque épreuve du baccalauréat. Ils connaissent les grilles de correction officielles et les attentes des jurys.',
  },
  {
    question: 'Comment fonctionne l’échéancier de paiement ?',
    answer:
      'Un acompte de 30 % est versé à la réservation, puis le solde est réparti en mensualités. L’acompte d’un stage ou Pass est déductible si vous souscrivez ensuite un parcours annuel.',
  },
  {
    question: 'Qu’est-ce que la plateforme ARIA ?',
    answer:
      'ARIA est notre plateforme numérique avec des ressources, parcours de révision, fiches et exercices. Elle complète l’accompagnement humain et s’utilise selon la formule choisie.',
  },
  {
    question: 'Proposez-vous un accompagnement pour les candidats libres ?',
    answer:
      'Oui, nous avons des parcours dédiés aux candidats libres (Essentiel, Mixte, Premium) avec cellule Cyclades intégrée pour l’accompagnement administratif. Le Pass Candidat Libre regroupe diagnostic, stages et épreuves blanches.',
  },
  ];
}

// ── Main ──

export function HomePageClient() {
  const faqItems = getFaqItems(getRules());

  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      {/* 1. Hero (bg-lux-ink) — H1 SEO + slogan + CTA */}
      <HeroSection />

      {/* 2. Router par niveau (bg-lux-white) — navigation immédiate */}
      <LevelRouter />

      {/* 3. Priorités par niveau (bg-lux-paper) — onglets par niveau */}
      <EnjeuxNiveau />

      {/* 4. Méthode (bg-lux-ink) — rupture sombre, 4 piliers */}
      <MethodSection />

      {/* 5. Tarifs + Transparence + Chips réassurance (bg-lux-white) */}
      <PricingReperesSection />

      {/* 6. Confiance vérifiable (bg-lux-paper) — fusionnée */}
      <VerifiableSection />

      {/* 7. Parcours en 4 étapes (bg-lux-white) */}
      <ProcessSteps />

      {/* Testimonials — hidden tant que social-proof.json est vide */}
      <Testimonials />

      {/* 8. FAQ (bg-lux-paper) */}
      <FAQAccordion items={faqItems} className="bg-lux-paper" />

      {/* 9. CTA bilan gratuit (bg-lux-ink) */}
      <section className="bg-lux-ink px-4 py-14 md:py-20 md:px-6" aria-label="Demander un bilan gratuit">
        <div className="mx-auto max-w-2xl text-center">
          <span className="lux-eyebrow text-lux-gold-wash">Commencer</span>
          <h2 className="mt-3 text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">
            Trouvez la formule adaptée à votre enfant
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-lux-on-dark-muted font-dm-sans">
            Un diagnostic gratuit pour identifier les besoins,
            définir les priorités et recommander le meilleur parcours.
          </p>
          <p className="mt-3 text-sm text-lux-on-dark-subtle">
            Sans engagement · Réponse sous 24 h ouvrées
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
              href={buildWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-lux-gold-wash hover:underline min-h-[44px]"
            >
              <WhatsAppLogo className="h-4 w-4" style={{ color: WHATSAPP_BRAND_GREEN }} />
              Nous écrire sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
