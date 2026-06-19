'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';

import socialProof from '@/content/social-proof.json';
import team from '@/content/team.json';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

export const reassuranceItems = [
  'Groupe non ouvert\u00A0? Acompte intégralement remboursé.',
  'Acompte déductible de votre parcours annuel.',
  `Acompte reportable sur l\u2019année suivante.`,
  'Solde réglé avant chaque prestation.',
];

export function ReassuranceChips({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
      {reassuranceItems.map((item) => (
        <div
          key={item}
          className="flex min-h-[44px] items-start gap-2 rounded-xl border border-lux-line/60 bg-lux-white px-4 py-3 text-sm text-lux-ink lux-shadow"
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

const processSteps = [
  {
    title: 'Bilan stratégique gratuit',
    text: 'On fait le point sur le niveau, les besoins et les coefficients prioritaires. Sans engagement.',
  },
  {
    title: 'Recommandation de parcours',
    text: 'Une proposition claire et chiffrée en TND, adaptée au profil et aux objectifs.',
  },
  {
    title: 'Constitution du groupe & premier cours',
    text: `Groupe de 5 maximum, ouvert dès 3 inscrits\u00A0; démarrage dès qu\u2019il est constitué.`,
  },
  {
    title: 'Bilans réguliers & suivi parent',
    text: `Points d\u2019étape tout au long de l\u2019année et suivi accessible en continu.`,
  },
];

export function ProcessSteps() {
  return (
    <section className="bg-lux-paper px-4 py-14 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <span className="lux-eyebrow">Comment ça se passe</span>
          <h2 className="mt-2 text-2xl md:text-3xl">Un parcours clair avant de réserver</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-lux-line bg-lux-white p-5 lux-shadow">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lux-gold/15 text-sm font-bold text-lux-gold-deep">
                {index + 1}
              </div>
              <h3 className="mt-4 text-lg font-fraunces text-lux-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-lux-slate">{step.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-lux-ink">
          <Clock3 className="h-4 w-4 text-lux-gold-deep" aria-hidden="true" />
          Réponse sous 24 h ouvrées.
        </p>
      </div>
    </section>
  );
}

export function TransparencyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-lux-line bg-lux-white p-5 lux-shadow">
      <p className="text-lg font-fraunces text-lux-ink">Des tarifs publics, nets, en dinars.</p>
      <p className={`${compact ? 'mt-2 text-sm' : 'mt-3 text-base'} leading-7 text-lux-slate`}>
        Échéanciers visibles, acompte clair, aucun coût caché. Vous savez exactement ce que vous payez — avant de réserver.
      </p>
    </div>
  );
}

type Advisor = {
  name?: string;
  role?: string;
  photo?: string;
  since?: string;
};

function getAdvisor(): Advisor | null {
  const typedTeam = team as { advisors?: Advisor[] };
  return Array.isArray(typedTeam.advisors) && typedTeam.advisors.length > 0 ? typedTeam.advisors[0] : null;
}

export function ConseillerCard() {
  const advisor = getAdvisor();

  return (
    <div className="rounded-2xl border border-lux-line bg-lux-white p-5 lux-shadow">
      <div className="flex items-start gap-4">
        {advisor?.photo ? (
          <Image
            src={advisor.photo}
            alt={advisor.name ? `${advisor.name}, ${advisor.role ?? 'conseiller Nexus'}` : 'Conseiller Nexus'}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-lux-ink text-lux-gold-wash">
            <Phone className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div>
          <h2 className="font-fraunces text-lg text-lux-ink">
            {advisor?.name ?? 'Un conseiller pédagogique Nexus vous répond'}
          </h2>
          <p className="mt-1 text-sm text-lux-slate">
            {advisor?.role ?? 'Orientation, bilan et choix de formule.'}
            {advisor?.since ? ` Depuis ${advisor.since}.` : ''}
          </p>
        </div>
      </div>
      <CallbackRequestForm />
    </div>
  );
}

export function CallbackRequestForm({ source = 'callback-card' }: { source?: string }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('submitting');

    const payload = {
      name: String(form.get('name') ?? ''),
      email: 'callback@nexusreussite.academy',
      phone: String(form.get('phone') ?? ''),
      profile: 'callback',
      interest: 'Être rappelé sous 24 h',
      urgency: String(form.get('slot') ?? ''),
      source,
      notes: 'Consentement rappel 24 h confirmé. Type: callback.',
      consent: form.get('consent') === 'on',
      type: 'callback',
    };

    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setStatus(response.ok ? 'success' : 'error');
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-lux-ink">
          Nom
          <input name="name" required className="h-11 w-full rounded-lg border border-lux-line bg-lux-paper px-3 text-sm" />
        </label>
        <label className="space-y-1 text-sm font-medium text-lux-ink">
          Téléphone
          <input name="phone" required type="tel" className="h-11 w-full rounded-lg border border-lux-line bg-lux-paper px-3 text-sm" />
        </label>
      </div>
      <label className="space-y-1 text-sm font-medium text-lux-ink">
        Créneau souhaité
        <select name="slot" required className="h-11 w-full rounded-lg border border-lux-line bg-lux-paper px-3 text-sm">
          <option value="">Choisir un créneau</option>
          <option value="matin">Matin</option>
          <option value="apres-midi">Après-midi</option>
          <option value="soir">Soir</option>
        </select>
      </label>
      <label className="flex items-start gap-2 text-xs leading-5 text-lux-slate">
        <input name="consent" type="checkbox" required className="mt-1" />
        Je consens au rappel téléphonique par Nexus Réussite au sujet de ma demande.
      </label>
      <button type="submit" disabled={status === 'submitting'} className="lux-cta-reserve min-h-[44px] w-full rounded-lg px-4 py-3 text-sm font-semibold">
        {status === 'submitting' ? 'Envoi...' : 'Être rappelé(e) sous 24 h'}
      </button>
      {status === 'success' && <p className="text-sm text-lux-evergreen">Demande reçue. Nous revenons vers vous sous 24 h ouvrées.</p>}
      {status === 'error' && <p className="text-sm text-red-600">La demande n&rsquo;a pas pu être envoyée. Vous pouvez nous écrire sur WhatsApp.</p>}
    </form>
  );
}

export function FloatingAdvisorBubble() {
  return (
    <a
      href={buildWhatsAppUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-4 z-40 hidden min-h-[44px] items-center gap-2 rounded-full border border-lux-line/50 bg-lux-ink px-4 py-3 text-sm font-semibold text-lux-ivory shadow-lg transition hover:border-lux-gold/70 md:inline-flex"
    >
      <MessageCircle className="h-4 w-4 text-lux-gold-wash" aria-hidden="true" />
      Une question&nbsp;? Échangez avec un conseiller Nexus.
    </a>
  );
}

export function AccompagnementInclus({ compact = false }: { compact?: boolean }) {
  const items = [
    'Enseignants agrégés & certifiés, spécialistes de l’épreuve',
    'Corrections sur grilles officielles & bacs blancs',
    'Accès à la plateforme ARIA',
    'Bilans réguliers & suivi parent',
    'Carte d’examen personnalisée',
    'Cellule Cyclades (candidats libres)',
  ];

  return (
    <section className={compact ? '' : 'bg-lux-paper px-4 py-14 md:px-6'}>
      <div className={compact ? '' : 'mx-auto max-w-6xl'}>
        <div className="rounded-2xl border border-lux-line bg-lux-white p-6 lux-shadow">
          <p className="font-fraunces text-xl text-lux-ink">
            Chaque parcours Nexus, c'est plus que des heures de cours&nbsp;:
</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm leading-6 text-lux-slate">
                <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  const typedSocialProof = socialProof as {
    reviews: { author: string; date: string; text: string; source: string }[];
    rating: { value: number; count: number; source: string } | null;
  };
  const reviews = typedSocialProof.reviews ?? [];
  const rating = typedSocialProof.rating;

  if (reviews.length === 0 && !rating) return null;

  return (
    <section className="bg-lux-paper px-4 py-14 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <span className="lux-eyebrow">Avis vérifiés</span>
          <h2 className="mt-2 text-2xl md:text-3xl">Retours de familles accompagnées</h2>
        </div>
        {rating ? (
          <p className="mb-5 text-sm text-lux-slate">
            Note {rating.value} / 5, source&nbsp;: {rating.source}, {rating.count} avis.
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((review) => (
            <article key={`${review.author}-${review.date}`} className="rounded-xl border border-lux-line bg-lux-white p-5 lux-shadow">
              <p className="text-sm leading-7 text-lux-slate">“{review.text}”</p>
              <p className="mt-4 text-sm font-semibold text-lux-ink">
                {review.author} · {review.date} · {review.source}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function NewsletterSignup() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('submitting');

    const email = String(form.get('email') ?? '');
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: email,
        email,
        profile: 'newsletter',
        interest: 'Conseils pour réussir le bac français',
        source: 'footer-newsletter',
        notes: 'Consentement newsletter mensuelle confirmé.',
        consent: form.get('consent') === 'on',
        type: 'newsletter',
      }),
    });

    setStatus(response.ok ? 'success' : 'error');
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="font-fraunces text-lg text-lux-ivory">Conseils pour réussir le bac français.</p>
      <p className="mt-2 text-sm leading-6 text-neutral-300">
        Méthode, coefficients, Parcoursup, Grand Oral, EAF — une fois par mois, sans spam.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="newsletter-email">Email newsletter</label>
        <input
          id="newsletter-email"
          name="email"
          required
          type="email"
          placeholder="Votre email"
          className="min-h-[44px] flex-1 rounded-lg border border-white/10 bg-lux-ivory px-3 text-sm text-lux-ink"
        />
        <button type="submit" disabled={status === 'submitting'} className="lux-cta-reserve min-h-[44px] rounded-lg px-4 py-3 text-sm font-semibold">
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
          Recevoir les conseils
        </button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-neutral-300">
        <input name="consent" type="checkbox" required className="mt-1" />
        Je donne mon consentement pour recevoir les conseils mensuels Nexus Réussite.
      </label>
      {status === 'success' && <p className="mt-3 text-sm text-lux-evergreen">Inscription enregistrée.</p>}
      {status === 'error' && <p className="mt-3 text-sm text-red-200">Inscription impossible pour le moment.</p>}
    </form>
  );
}

const enjeux = [
  {
    level: 'Terminale',
    title: `Terminale — l\u2019année décisive.`,
    text: `La terminale concentre les coefficients les plus lourds du bac\u00A0: deux spécialités (coef. 16 chacune), le Grand Oral (coef. 10) et la philosophie (coef. 8). En parallèle, le dossier Parcoursup et l\u2019admission post-bac se jouent dès le premier trimestre. L\u2019enjeu\u00A0: sécuriser les spécialités, préparer le Grand Oral et la philosophie, et construire un dossier solide.`,
    goals: [
      { label: 'Sécuriser mes spécialités', href: '/offres#term-duo' },
      { label: 'Préparer le Grand Oral', href: '/offres#studio-grand-oral' },
      { label: 'Construire mon orientation', href: '/offres#boussole-orientation' },
    ],
  },
  {
    level: 'Première',
    title: `Première — l\u2019année qui engage.`,
    text: `Le contrôle continu pèse pour une part importante du bac, et les épreuves anticipées de français (écrit et oral) se préparent dès le début de l\u2019année. Les choix de spécialités confirmés en première orientent toute la suite. L\u2019enjeu\u00A0: réussir l\u2019EAF, consolider les spécialités et soigner le dossier.`,
    goals: [
      { label: `Réussir l\u2019EAF`, href: '/offres#cap-eaf' },
      { label: 'Renforcer maths & spécialités', href: '/offres#1re-double-secu' },
      { label: 'Sécuriser le dossier', href: '/offres#pass-cap-bac-1re' },
    ],
  },
  {
    level: 'Seconde',
    title: `Seconde — l\u2019année d\u2019orientation.`,
    text: `La seconde marque un saut d\u2019exigence et l\u2019année où se préparent les choix de spécialités. Gagner en méthode et en autonomie y est déterminant. L\u2019enjeu\u00A0: consolider les bases, installer une méthode de travail et choisir ses spécialités en connaissance de cause.`,
    goals: [
      { label: 'Consolider les bases', href: '/offres#2nde-maths' },
      { label: 'Méthode de travail', href: '/offres#boussole-methode' },
      { label: 'Choisir mes spécialités', href: '/offres#boussole-orientation' },
    ],
  },
  {
    level: 'Troisième',
    title: `Troisième — le cap du brevet et l\u2019entrée au lycée.`,
    text: `Le brevet sanctionne la fin du collège et l\u2019entrée au lycée demande méthode et autonomie. L\u2019enjeu\u00A0: préparer les épreuves, ancrer des méthodes durables et aborder le lycée avec confiance.`,
    goals: [
      { label: 'Préparer le brevet', href: '/offres#brevet-complet' },
      { label: 'Maths ciblées', href: '/offres#brevet-maths' },
      { label: 'Gagner en méthode', href: '/offres#boussole-methode' },
    ],
  },
  {
    level: 'Candidat libre',
    title: 'Candidat libre — un vrai cadre pour préparer seul.',
    text: `Préparer le bac en candidat libre demande de l\u2019organisation, un accompagnement administratif (cellule Cyclades) et des conditions d\u2019entraînement réalistes. L\u2019enjeu\u00A0: structurer l\u2019année, sécuriser l\u2019inscription et s\u2019entraîner dans les conditions de l\u2019examen.`,
    goals: [
      { label: 'Un parcours dédié', href: '/offres#term-libre-mixte' },
      { label: 'Inscription & administratif', href: '/offres#pass-candidat-libre' },
      { label: `S\u2019entraîner pour de vrai`, href: '/offres#pass-candidat-libre' },
    ],
  },
];

export function EnjeuxNiveau() {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      let next = activeIndex;
      if (e.key === 'ArrowRight') {
        next = (activeIndex + 1) % enjeux.length;
      } else if (e.key === 'ArrowLeft') {
        next = (activeIndex - 1 + enjeux.length) % enjeux.length;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = enjeux.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      setActiveIndex(next);
      tabsRef.current[next]?.focus();
    },
    [activeIndex],
  );

  const active = enjeux[activeIndex];
  const panelId = `enjeux-panel-${activeIndex}`;
  const tabId = (i: number) => `enjeux-tab-${i}`;

  return (
    <section className="bg-lux-paper px-4 py-14 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <span className="lux-eyebrow">Enjeux par niveau</span>
          <h2 className="mt-2 text-2xl md:text-3xl">Les priorités AEFE à sécuriser</h2>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Niveau scolaire"
          className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {enjeux.map((item, i) => {
            const selected = i === activeIndex;
            return (
              <button
                key={item.level}
                id={tabId(i)}
                ref={(el) => { tabsRef.current[i] = el; }}
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onKeyDown={handleKeyDown}
                onClick={() => setActiveIndex(i)}
                className={`min-h-[44px] shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  selected
                    ? 'bg-lux-ink text-lux-ivory border-lux-ink'
                    : 'border-lux-line text-lux-ink hover:border-lux-gold/60'
                }`}
              >
                {item.level}
              </button>
            );
          })}
        </div>

        {/* Tab panel */}
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(activeIndex)}
          tabIndex={0}
          className="rounded-2xl border border-lux-line bg-lux-white p-6 md:p-8 lux-shadow"
        >
          <h3 className="font-fraunces text-xl text-lux-ink md:text-2xl">{active.title}</h3>
          <p className="mt-4 text-sm leading-7 text-lux-slate md:text-base md:leading-8">
            {active.text}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {active.goals.map((goal) => (
              <Link
                key={goal.label}
                href={goal.href}
                className="flex min-h-[44px] items-center justify-between rounded-lg border border-lux-line/70 px-4 py-2 text-sm font-semibold text-lux-ink transition hover:border-lux-gold/60"
              >
                <span>{goal.label}</span>
                <ArrowRight className="h-4 w-4 flex-none text-lux-gold-deep" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CtaBilanLink({ label = 'Demander un bilan gratuit' }: { label?: string }) {
  return (
    <Link href="/bilan-gratuit" className="lux-cta-reserve inline-flex min-h-[44px] items-center rounded-lg px-6 py-3 text-sm font-semibold">
      {label}
      <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
