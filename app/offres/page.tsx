'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
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
import { buildWhatsAppUrl } from '@/lib/whatsapp';

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

// ── FAQ ──

const catalogueFAQ: FAQItem[] = [
  {
    question: `Les tarifs sont-ils en TND\u00A0?`,
    answer: `Oui, tous nos tarifs sont en dinars tunisiens (TND). Aucun paiement en euros.`,
  },
  {
    question: `Comment fonctionne le modèle places-based\u00A0?`,
    answer:
      `Les groupes se remplissent progressivement. Il n\u2019y a pas de date limite artificielle — la rareté est réelle\u00A0: un groupe de 5 se remplit naturellement. Réservez tôt pour garantir votre place.`,
  },
  {
    question: `L\u2019acompte est-il remboursable\u00A0?`,
    answer:
      `L\u2019acompte n\u2019est pas remboursable sauf si le groupe n\u2019atteint pas le seuil d\u2019ouverture (3 ou 4 inscrits). Dans ce cas, remboursement intégral.`,
  },
  {
    question: `Puis-je déduire l\u2019acompte d\u2019un stage si je prends un parcours annuel\u00A0?`,
    answer:
      `Oui. L\u2019acompte versé pour un stage ou un Pass est déductible du parcours annuel. Il est aussi reportable sur l\u2019année suivante.`,
  },
  {
    question: `Les remises sont-elles cumulables\u00A0?`,
    answer:
      `Non. Les remises (fratrie, ancien élève, parrainage, Carte Nexus) ne sont pas cumulables sauf décision de la direction. Le plafond global est de 20\u00A0%, et aucun tarif ne descend sous le plancher horaire.`,
  },
];

// ── Main component ──

export default function OffresPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const rules = getRules();
  const libreOffers = getOffersByTrack('libre');
  const platformOffers = getOffersByTrack('plateforme');
  const stageFormats = getStageFormats();
  const stageEditions = getStageEditions();
  const ponctuelOffers = getPonctuelOffers();
  const coachingOffers = getCoachingOffers();
  const packs = getPacks();
  const carte = getCarte();

  const showSection = (cat: Category) => activeCategory === 'all' || activeCategory === cat;

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
          <p className="mt-3 max-w-2xl text-base text-lux-on-dark-muted font-dm-sans">
            Tous les parcours, stages, Pass et formules. Groupes de {rules.group_max} max,
            tarifs en TND, échéanciers transparents.
          </p>
          <div className="mt-5 inline-flex flex-wrap gap-2 text-sm text-lux-on-dark-muted">
            <span className="rounded-full border border-lux-line/40 bg-white/5 px-3 py-1">Groupes de 5 maximum</span>
            <span className="rounded-full border border-lux-line/40 bg-white/5 px-3 py-1">Tarifs en TND</span>
            <span className="rounded-full border border-lux-line/40 bg-white/5 px-3 py-1">Acompte 30 %</span>
            <span className="rounded-full border border-lux-line/40 bg-white/5 px-3 py-1">Échéanciers transparents</span>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <TransparencyBanner compact />
            <ReassuranceChips compact />
          </div>
        </div>
      </section>

      {/* Filter bar */}
      <nav aria-label="Filtres des offres" className="sticky top-0 z-20 border-b border-lux-line bg-lux-ivory/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl overflow-x-auto px-4 md:px-6">
          <div className="flex gap-1 py-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all lux-focus min-h-[44px] ${
                  activeCategory === cat.id
                    ? 'bg-lux-ink text-lux-ivory'
                    : 'text-lux-ink hover:bg-lux-paper'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 md:px-6 py-12 space-y-16">
        <AccompagnementInclus compact />

        {/* Parcours annuels (scolarisé) */}
        {showSection('annual') && (
          <section>
            <div className="mb-8">
              <span className="lux-eyebrow">Parcours présentiel</span>
              <h2 className="mt-2 text-2xl md:text-3xl">Accompagnement annuel — scolarisés</h2>
              <p className="mt-2 text-sm text-lux-slate">
                {rules.group_max} élèves max, garanti dès {rules.group_min_open.lycee}. Acompte 30 % + mensualités.
              </p>
            </div>
            {(['terminale', 'premiere', 'seconde', 'troisieme'] as const).map((level) => {
              const offers = getOffersByLevel(level).filter(o => o.track === 'scolarise');
              if (offers.length === 0) return null;
              const displayLevel = { terminale: 'Terminale', premiere: 'Première', seconde: 'Seconde', troisieme: 'Troisième' }[level];
              return (
                <div key={level} className="mb-10">
                  <h3 className="mb-4 text-lg text-lux-slate">{displayLevel}</h3>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {offers.map((o) => {
                      const price = getEffectivePrice(o);
                      if (price == null) return null;
                      return (
                        <div key={o.id} id={o.id} className="scroll-mt-28">
                        <ExamCard
                          eyebrow={`${displayLevel} · Présentiel`}
                          title={o.title}
                          subtitle={o.subjects}
                          price={price}
                          monthlyDisplay={o.monthly_display ?? undefined}
                          hoursPerWeek={o.hours_per_week ?? undefined}
                          totalHours={o.hours_per_year ?? undefined}
                          groupMax={o.group_max ?? rules.group_max}
                          groupMinOpen={o.group_min_open ?? rules.group_min_open.lycee}
                          effectifType="groupe"
                          payment={getAnnualOfferPaymentSchedule(o) ?? undefined}
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
          </section>
        )}

        {/* Candidat libre */}
        {showSection('libre') && libreOffers.length > 0 && (
          <section>
            <div className="mb-8">
              <span className="lux-eyebrow">Candidat libre</span>
              <h2 className="mt-2 text-2xl md:text-3xl">Parcours candidats libres</h2>
              <p className="mt-2 text-sm text-lux-slate">
                Cellule Cyclades intégrée. Formules en ligne, mixte ou avec coaching.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {libreOffers.map((o) => {
                const price = getEffectivePrice(o);
                if (price == null) return null;
                const displayLevel = o.level === 'premiere' ? 'Première' : o.level === 'terminale' ? 'Terminale' : o.level;
                return (
                  <div key={o.id} id={o.id} className="scroll-mt-28">
                  <ExamCard
                    eyebrow={`${displayLevel} · Libre`}
                    title={o.title}
                    subtitle={o.subjects}
                    price={price}
                    monthlyDisplay={o.monthly_display ?? undefined}
                    groupMax={o.group_max ?? rules.group_max}
                    groupMinOpen={o.group_min_open ?? rules.group_min_open.online_live}
                    effectifType="groupe"
                    payment={getAnnualOfferPaymentSchedule(o) ?? undefined}
                    ctaText="Réserver ma place"
                    ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(o.id)}`}
                  />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Plateforme */}
        {showSection('plateforme') && (
          <section>
            <div className="mb-8">
              <span className="lux-eyebrow">Plateforme</span>
              <h2 className="mt-2 text-2xl md:text-3xl">Trois paliers numériques</h2>
              <p className="mt-2 text-sm text-lux-slate">
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
                      monthlyDisplay={o.monthly_display ?? undefined}
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
          </section>
        )}

        {/* Les Intensifs */}
        {showSection('intensifs') && (
          <section id="les-intensifs" className="scroll-mt-28">
            <div className="mb-8">
              <span className="lux-eyebrow">Les Intensifs</span>
              <h2 className="mt-2 text-2xl md:text-3xl">Stages intensifs — toutes les vacances</h2>
              <p className="mt-2 text-sm text-lux-slate">
                {stageEditions.length} éditions par an, {stageFormats.length} formats. Groupes de {rules.group_max} max.
              </p>
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
          </section>
        )}

        {/* Prépa épreuves (ponctuel) */}
        {showSection('ponctuel') && ponctuelOffers.length > 0 && (
          <section>
            <div className="mb-8">
              <span className="lux-eyebrow">Prépa épreuves</span>
              <h2 className="mt-2 text-2xl md:text-3xl">Cap EAF, Cap Maths, Grand Oral, Épreuve Blanche</h2>
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
          </section>
        )}

        {/* Boussole (coaching) */}
        {showSection('coaching') && coachingOffers.length > 0 && (
          <section>
            <div className="mb-8">
              <span className="lux-eyebrow">Boussole</span>
              <h2 className="mt-2 text-2xl md:text-3xl">Coaching méthode, orientation & individuel</h2>
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
          </section>
        )}

        {/* Pass */}
        {showSection('pass') && packs.length > 0 && (
          <section>
            <div className="mb-8">
              <span className="lux-eyebrow">Les Pass</span>
              <h2 className="mt-2 text-2xl md:text-3xl">Packs fidélité — simplifiez votre parcours</h2>
              <p className="mt-2 text-sm text-lux-slate">
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
          </section>
        )}

        {/* Carte Nexus */}
        {showSection('carte') && (
          <section id="carte-nexus" className="scroll-mt-28">
            <div className="mb-8">
              <span className="lux-eyebrow">Carte Nexus</span>
              <h2 className="mt-2 text-2xl md:text-3xl">L&apos;accompagnement Nexus toute l&apos;année</h2>
            </div>
            <div className="max-w-md">
              <CarteNexusCard carte={carte} ctaText="Réserver ma place" ctaHref={`/bilan-gratuit?offer=${encodeURIComponent(carte.id)}`} />
            </div>
          </section>
        )}

      </div>

      <FAQAccordion items={catalogueFAQ} title="Questions sur les tarifs" />

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
