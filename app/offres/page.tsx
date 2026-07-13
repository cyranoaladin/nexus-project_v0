import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WhatsAppLogo, WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import {
  ExamCard,
  PassCard,
  CarteNexusCard,
  FAQAccordion,
  type FAQItem,
} from '@/components/premium';
import {
  getOffersByLevel,
  getOffersByTrack,
  getStageFormats,
  getStageEditions,
  getPonctuelOffers,
  getCoachingOffers,
  getPacks,
  getCarte,
  getRules,
  getEffectivePrice,
  getAnnualOfferPaymentSchedule,
  getStageFormat,
  getStageEdition,
  getPonctuelOffer,
  getCoachingOffer,
  type Pack,
} from '@/lib/pricing';
import {
  AccompagnementInclus,
  ReassuranceChips,
  Testimonials,
  TransparencyBanner,
} from '@/components/marketing/acadomia-inspired';
import { PaymentMethodsNote } from '@/components/marketing/PaymentMethodsNote';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import OffersFiltersClient from './_components/OffersFiltersClient';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

// ── Category filter ──

type Category = 'all' | 'annual' | 'libre' | 'plateforme' | 'intensifs' | 'ponctuel' | 'coaching' | 'pass' | 'carte';

const categories: { id: Category; label: string }[] = [
  { id: 'all', label: 'Tout voir' },
  { id: 'annual', label: 'Parcours annuels' },
  { id: 'libre', label: 'Candidat libre' },
  { id: 'plateforme', label: 'Plateforme' },
  { id: 'intensifs', label: 'Les Intensifs' },
  { id: 'ponctuel', label: 'Prépa épreuves' },
  { id: 'coaching', label: 'Boussole' },
  { id: 'pass', label: 'Pass' },
  { id: 'carte', label: 'Carte Nexus' },
];

// ── Mega-parcours grouping ──

const MEGA_ANNEE: Category[] = ['annual', 'libre', 'plateforme'];
const MEGA_STAGES: Category[] = ['intensifs', 'ponctuel'];
const MEGA_SURMESURE: Category[] = ['coaching', 'pass', 'carte'];

// ── Helpers for Pack component labels ──

function resolvePackComponentLabels(pack: Pack): string[] {
  return pack.components.map((c) => {
    if (c.type === 'stage' && c.format_id) {
      const fmt = getStageFormat(c.format_id);
      const ed = c.edition_id ? getStageEdition(c.edition_id) : undefined;
      const edLabel = ed ? ` (${ed.title})` : '';
      return `${c.qty}× ${fmt?.title || c.format_id}${edLabel}`;
    }
    if (c.type === 'ponctuel' && c.id) {
      const p = getPonctuelOffer(c.id);
      return `${c.qty}× ${p?.title || c.id}`;
    }
    if (c.type === 'coaching' && c.id) {
      const co = getCoachingOffer(c.id);
      return `${c.qty}× ${co?.title || c.id}`;
    }
    if (c.type === 'service' && c.label) {
      return c.label;
    }
    return `${c.qty}× ${c.type}`;
  });
}

function filterSectionAttrs(categories: string) {
  return {
    'data-offres-block': '1',
    'data-offres-categories': categories,
  } satisfies Record<string, string>;
}

// ── Navy separator band ──

function NavyBand({
  eyebrow,
  title,
  intro,
  testId,
  dataCategories,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  testId: string;
  dataCategories?: string;
}) {
  return (
    <section
      data-testid={testId}
      {...(dataCategories ? filterSectionAttrs(dataCategories) : undefined)}
      className="bg-lux-ink py-10 px-4 md:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <span className="lux-eyebrow text-lux-gold-wash">{eyebrow}</span>
        <h2 className="mt-2 text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">
          {title}
        </h2>
        <div className="lux-filet-gold mt-3 w-16" />
        <p className="mt-3 max-w-2xl text-base text-lux-on-dark-muted font-dm-sans">
          {intro}
        </p>
      </div>
    </section>
  );
}

// ── FAQ ──

function getCatalogueFAQ(groupMax: number, lyceeMinOpen: number, collegeMinOpen: number): FAQItem[] {
  return [
    {
      question: `Les tarifs sont-ils en TND ?`,
      answer: `Oui, tous nos tarifs sont en dinars tunisiens (TND). Aucun paiement en euros.`,
    },
    {
      question: `Comment fonctionne le modèle places-based ?`,
      answer:
        `Les groupes se remplissent progressivement. Un groupe compte ${groupMax} élèves maximum et ouvre dès ${lyceeMinOpen} inscrits au lycée. Réserver tôt permet de choisir plus facilement le créneau souhaité.`,
    },
    {
      question: `L’acompte est-il remboursable ?`,
      answer:
        `L’acompte n’est pas remboursable sauf si le groupe n’atteint pas le seuil d’ouverture (${lyceeMinOpen} inscrits au lycée ou ${collegeMinOpen} au Brevet). Dans ce cas, remboursement intégral.`,
    },
    {
      question: `Puis-je déduire l’acompte d’un stage si je prends un parcours annuel ?`,
      answer:
        `Oui. L’acompte versé pour un stage ou un Pass est déductible du parcours annuel. Il est aussi reportable sur l’année suivante.`,
    },
    {
      question: `Les remises sont-elles cumulables ?`,
      answer:
        `Non. Les remises (fratrie, ancien élève, parrainage, Carte Nexus) ne sont pas cumulables sauf décision de la direction. Le plafond global est de 20 %, et aucun tarif ne descend sous le plancher horaire.`,
    },
  ];
}

// ── Main component ──

export default function OffresPage() {
  const rules = getRules();
  const libreOffers = getOffersByTrack('libre');
  const platformOffers = getOffersByTrack('plateforme');
  const stageFormats = getStageFormats();
  const stageEditions = getStageEditions();
  const ponctuelOffers = getPonctuelOffers();
  const coachingOffers = getCoachingOffers();
  const packs = getPacks();
  const carte = getCarte();
  const preRentree = getPreRentreeLandingDTO();

  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      {/* Header */}
      <section className="bg-lux-ink py-14 px-4 md:px-6 pt-28">
        <div className="mx-auto max-w-6xl">
          <span className="lux-eyebrow text-lux-gold-wash">Catalogue 2026/2027</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-fraunces font-light text-lux-ivory">
            Offres & tarifs
          </h1>
          <p className="mt-3 text-lg leading-8 text-lux-on-dark-muted font-dm-sans">
            Tous les parcours, stages, Pass et formules. Groupes de {rules.group_max} max,
            tarifs en TND, échéanciers transparents.
          </p>
          <div className="mt-5 inline-flex flex-wrap gap-2 text-sm text-lux-on-dark-muted">
            <span className="rounded-full border border-lux-line/40 bg-white/5 px-3 py-1">Groupes de {rules.group_max} maximum</span>
            <span className="rounded-full border border-lux-line/40 bg-white/5 px-3 py-1">Tarifs en TND</span>
            <span className="rounded-full border border-lux-line/40 bg-white/5 px-3 py-1">Acompte 30 %</span>
            <span className="rounded-full border border-lux-line/40 bg-white/5 px-3 py-1">Échéanciers transparents</span>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <TransparencyBanner compact />
            <ReassuranceChips compact />
          </div>
          <div className="mt-4 max-w-2xl">
            <PaymentMethodsNote tone="dark" />
          </div>
        </div>
      </section>

      <OffersFiltersClient categories={categories} />

      {/* AccompagnementInclus — standalone intro */}
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-12">
        <AccompagnementInclus compact />
      </div>

      {/* ════════════════════════════════════════════════════════════
         MÉGA-PARCOURS 1 — Accompagnement à l'année
         (annuel scolarisé + candidat libre + plateforme ARIA)
         ════════════════════════════════════════════════════════════ */}

      <NavyBand
        testId="mega-annee"
        eyebrow="Parcours annuels"
        title="Accompagnement à l'année"
        intro="Scolarisés, candidats libres ou 100 % en ligne — un parcours adapté à chaque profil, de septembre à juin."
        dataCategories={MEGA_ANNEE.join(',')}
      />

      {/* Annuel scolarisé — bg white */}
      <section
        id="section-annual"
        data-testid="section-annual"
        {...filterSectionAttrs('annual')}
        className="bg-lux-white py-12 px-4 md:px-6 scroll-mt-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <span className="lux-eyebrow">Parcours présentiel</span>
            <h2 className="mt-2 text-2xl md:text-3xl">Accompagnement annuel — scolarisés</h2>
            <div className="lux-filet-gold mt-3 w-16" />
            <p className="mt-3 text-sm text-lux-slate">
              {rules.group_max} élèves max, ouverture dès {rules.group_min_open.lycee}. Acompte 30 % + mensualités.
            </p>
          </div>
          {(['terminale', 'premiere', 'seconde', 'troisieme'] as const).map((level) => {
            const offers = getOffersByLevel(level).filter((o) => o.track === 'scolarise');
            if (offers.length === 0) return null;
            const displayLevel = {
              terminale: 'Terminale',
              premiere: 'Première',
              seconde: 'Seconde',
              troisieme: 'Troisième',
            }[level];
            return (
              <div key={level} className="mb-10">
                <h3 className="mb-4 text-lg text-lux-slate">{displayLevel}</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {offers.map((o) => {
                    const price = getEffectivePrice(o);
                    if (price == null) return null;
                    const payment = getAnnualOfferPaymentSchedule(o);
                    return (
                      <div key={o.id} id={o.id} className="scroll-mt-28">
                        <ExamCard
                          eyebrow={`${displayLevel} · Présentiel`}
                          title={o.title}
                          subtitle={o.subjects}
                          price={price}
                          pricingDisplay={o.pricing_display ?? undefined}
                          hoursPerWeek={o.hours_per_week ?? undefined}
                          totalHours={o.hours_per_year ?? undefined}
                          groupMax={o.group_max ?? rules.group_max}
                          groupMinOpen={o.group_min_open ?? rules.group_min_open.lycee}
                          effectifType="groupe"
                          payment={payment ? { ...payment, depositPct: rules.payment.deposit_pct_annual } : undefined}
                          ctaText="Réserver ma place"
                          ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(o.id)}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Candidat libre — bg paper */}
      <section
        id="section-libre"
        data-testid="section-libre"
        {...filterSectionAttrs('libre')}
        className="bg-lux-paper py-12 px-4 md:px-6 scroll-mt-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <span className="lux-eyebrow">Candidat libre</span>
            <h2 className="mt-2 text-2xl md:text-3xl">Parcours candidats libres</h2>
            <div className="lux-filet-gold mt-3 w-16" />
            <p className="mt-3 text-sm text-lux-slate">
              Cellule Cyclades intégrée. Formules en ligne, mixte ou avec coaching.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {libreOffers.map((o) => {
              const price = getEffectivePrice(o);
              if (price == null) return null;
              const displayLevel = o.level === 'premiere' ? 'Première' : o.level === 'terminale' ? 'Terminale' : o.level;
              const payment = getAnnualOfferPaymentSchedule(o);
              return (
                <div key={o.id} id={o.id} className="scroll-mt-28">
                  <ExamCard
                    eyebrow={`${displayLevel} · Libre`}
                    title={o.title}
                    subtitle={o.subjects}
                    price={price}
                    pricingDisplay={o.pricing_display ?? undefined}
                    groupMax={o.group_max ?? rules.group_max}
                    groupMinOpen={o.group_min_open ?? rules.group_min_open.online_live}
                    effectifType="groupe"
                    payment={payment ? { ...payment, depositPct: rules.payment.deposit_pct_annual } : undefined}
                    ctaText="Réserver ma place"
                    ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(o.id)}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Plateforme ARIA — bg white */}
      <section
        id="section-plateforme"
        data-testid="section-plateforme"
        {...filterSectionAttrs('plateforme')}
        className="bg-lux-white py-12 px-4 md:px-6 scroll-mt-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <span className="lux-eyebrow">Plateforme</span>
            <h2 className="mt-2 text-2xl md:text-3xl">Trois paliers numériques</h2>
            <div className="lux-filet-gold mt-3 w-16" />
            <p className="mt-3 text-sm text-lux-slate">
              Ressources, parcours, fiches, exercices — avec ou sans accompagnement live.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {platformOffers.map((o) => {
              const price = o.price_annual ?? 0;
              return (
                <div key={o.id} id={o.id} className="scroll-mt-28">
                  <ExamCard
                    eyebrow="Plateforme"
                    title={o.title}
                    subtitle={o.subjects}
                    price={price}
                    pricingDisplay={o.pricing_display ?? undefined}
                    features={o.included}
                    effectifType={o.group_max ? 'groupe' : 'none'}
                    groupMax={o.group_max ?? undefined}
                    groupMinOpen={o.group_min_open ?? undefined}
                    ctaText="Réserver ma place"
                    ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(o.id)}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
         MÉGA-PARCOURS 2 — Stages & prépa épreuves
         (intensifs + ponctuel)
         ════════════════════════════════════════════════════════════ */}

      <NavyBand
        testId="mega-stages"
        eyebrow="Formules ponctuelles"
        title="Stages & prépa épreuves"
        intro="Vacances scolaires ou semaines ciblées — des formats courts pour progresser vite sur les points clés."
        dataCategories={MEGA_STAGES.join(',')}
      />

      {/* Les Intensifs — bg white */}
      <section
        id="section-intensifs"
        data-testid="section-intensifs"
        {...filterSectionAttrs('intensifs')}
        className="bg-lux-white py-12 px-4 md:px-6 scroll-mt-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <span className="lux-eyebrow">Les Intensifs</span>
            <h2 className="mt-2 text-2xl md:text-3xl">Stages intensifs — toutes les vacances</h2>
            <div className="lux-filet-gold mt-3 w-16" />
            <p className="mt-3 text-sm text-lux-slate">
              {stageEditions.length} éditions par an, {stageFormats.length} formats. Groupes de {rules.group_max} max.
            </p>
            <Link href={preRentree.campaign.canonicalPath} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-lux-gold-deep underline">
              Découvrir la Pré-rentrée 2026 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>

          {/* Formats grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-10">
            {stageFormats.map((f) => (
              <div key={f.format_id} id={f.format_id} className="scroll-mt-28">
                <ExamCard
                  eyebrow={`Intensif · ${f.hours}h`}
                  title={f.title}
                  subtitle={`${f.hours}h de travail concentré`}
                  price={f.price_per_student}
                  groupMax={f.group_max}
                  groupMinOpen={f.group_min_open}
                  effectifType="groupe"
                  payment={{ deposit: f.payment.deposit, solde: f.payment.solde }}
                  ctaText="Réserver ma place"
                  ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(f.format_id)}`}
                />
              </div>
            ))}
          </div>

          {/* Editions calendar */}
          <div className="rounded-xl border border-lux-line bg-lux-white p-6 lux-shadow">
            <h3 className="mb-4 text-lg">Calendrier des éditions</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stageEditions.map((ed) => (
                <div key={ed.edition_id} className="rounded-lg border border-lux-line/50 p-4">
                  <p className="font-semibold text-lux-ink">{ed.title}</p>
                  <p className="text-sm text-lux-slate">{ed.period}</p>
                  <p className="mt-1 text-xs text-lux-slate">
                    Formats&nbsp;: {ed.formats.map((fid) => getStageFormat(fid)?.title || fid).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Prépa épreuves — bg paper */}
      <section
        data-testid="section-ponctuel"
        {...filterSectionAttrs('ponctuel')}
        className="bg-lux-paper py-12 px-4 md:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <span className="lux-eyebrow">Prépa épreuves</span>
            <h2 className="mt-2 text-2xl md:text-3xl">Cap EAF, Cap Maths, Grand Oral, Épreuve Blanche</h2>
            <div className="lux-filet-gold mt-3 w-16" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {ponctuelOffers.map((p) => (
              <div key={p.id} id={p.id} className="scroll-mt-28">
                <ExamCard
                  eyebrow={`Prépa · ${p.public}`}
                  title={p.title}
                  subtitle={p.description}
                  price={p.price_per_student}
                  totalHours={p.hours ?? undefined}
                  groupMax={p.group_max ?? rules.group_max}
                  groupMinOpen={p.group_min_open ?? rules.group_min_open.lycee}
                  effectifType="groupe"
                  payment={
                    p.payment.full_at_booking
                      ? undefined
                      : { deposit: p.payment.deposit, solde: p.payment.solde }
                  }
                  ctaText="Réserver ma place"
                  ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(p.id)}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
         MÉGA-PARCOURS 3 — Sur-mesure & fidélité
         (coaching + pass + carte)
         ════════════════════════════════════════════════════════════ */}

      <NavyBand
        testId="mega-surmesure"
        eyebrow="Formules individuelles"
        title="Sur-mesure & fidélité"
        intro="Coaching individuel, packs combinés et Carte Nexus — des solutions flexibles pour compléter ou personnaliser votre parcours."
        dataCategories={MEGA_SURMESURE.join(',')}
      />

      {/* Boussole (coaching) — bg white */}
      <section
        data-testid="section-coaching"
        {...filterSectionAttrs('coaching')}
        className="bg-lux-white py-12 px-4 md:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <span className="lux-eyebrow">Boussole</span>
            <h2 className="mt-2 text-2xl md:text-3xl">Coaching méthode, orientation & individuel</h2>
            <div className="lux-filet-gold mt-3 w-16" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {coachingOffers.map((c) => (
              <div key={c.id} id={c.id} className="scroll-mt-28">
                <ExamCard
                  eyebrow={`Boussole · ${c.effectif}`}
                  title={c.title}
                  subtitle={c.format}
                  price={c.price}
                  effectifType={c.effectif === 'individuel' ? 'individuel' : 'groupe'}
                  groupMax={c.group_max ?? undefined}
                  groupMinOpen={c.group_min_open ?? undefined}
                  payment={
                    c.payment.full_at_booking
                      ? undefined
                      : {
                          deposit: c.payment.deposit,
                          solde: c.payment.solde,
                          installments: c.payment.solde_schedule,
                        }
                  }
                  features={
                    c.campaign_free
                      ? ['Offert en campagne', c.deductible ? 'Déductible du parcours annuel' : ''].filter(Boolean)
                      : undefined
                  }
                  ctaText="Réserver ma place"
                  ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(c.id)}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pass — bg paper */}
      <section
        data-testid="section-pass"
        {...filterSectionAttrs('pass')}
        className="bg-lux-paper py-12 px-4 md:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <span className="lux-eyebrow">Les Pass</span>
            <h2 className="mt-2 text-2xl md:text-3xl">Packs fidélité — simplifiez votre parcours</h2>
            <div className="lux-filet-gold mt-3 w-16" />
            <p className="mt-3 text-sm text-lux-slate">
              Acompte déductible du parcours annuel. Solde avant chaque prestation.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {packs.map((p, i) => (
              <div key={p.id} id={p.id} className="scroll-mt-28">
                <PassCard
                  pack={p}
                  componentLabels={resolvePackComponentLabels(p)}
                  highlighted={i === 0}
                  ctaText="Réserver ma place"
                  ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(p.id)}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Carte Nexus — bg white */}
      <section
        data-testid="section-carte"
        id="carte-nexus"
        {...filterSectionAttrs('carte')}
        className="bg-lux-white py-12 px-4 md:px-6 scroll-mt-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <span className="lux-eyebrow">Carte Nexus</span>
            <h2 className="mt-2 text-2xl md:text-3xl">L&apos;accompagnement Nexus toute l&apos;année</h2>
            <div className="lux-filet-gold mt-3 w-16" />
          </div>
          <div className="max-w-md">
            <CarteNexusCard carte={carte} ctaText="Réserver ma place" ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(carte.id)}`} />
          </div>
        </div>
      </section>

      <FAQAccordion
        items={getCatalogueFAQ(rules.group_max, rules.group_min_open.lycee, rules.group_min_open.college)}
        title="Questions sur les tarifs"
      />

      <Testimonials />

      {/* CTA */}
      <section className="bg-lux-ink py-16 px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">
            Besoin d&apos;aide pour choisir ?
          </h2>
          <p className="mt-3 text-base text-lux-on-dark-muted font-dm-sans">
            Notre diagnostic gratuit identifie la formule adaptée en 3 questions.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/recommandation"
              className="lux-cta-reserve rounded-lg px-8 py-3.5 text-sm font-semibold"
            >
              Trouver ma formule
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href={buildWhatsAppUrl('les offres Nexus')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-lux-gold-wash hover:underline min-h-[44px]"
            >
              <WhatsAppLogo className="h-4 w-4" style={{ color: WHATSAPP_BRAND_GREEN }} />
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
