export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, CalendarDays, Clock3, MapPin, Phone, Video } from 'lucide-react';

import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import {
  formatStageDateRange,
  formatStageDateTime,
  formatStagePrice,
  getLevelLabel,
  getPublicStageBySlug,
  isOnlineLocation,
  subjectLabels,
} from '@/lib/stages/public';
import { LEGAL } from '@/lib/legal';
import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import { canExposePublicStageSlug } from '@/lib/campaigns/pre-rentree-2026/release-gate';

type PageProps = {
  params: Promise<{ stageSlug: string }>;
};

const BASE_URL = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { stageSlug } = await params;
  if (!canExposePublicStageSlug(stageSlug)) {
    return {
      title: 'Stage introuvable | Nexus Réussite',
      robots: { index: false, follow: false, nocache: true },
    };
  }
  const stage = await getPublicStageBySlug(stageSlug);

  if (!stage) {
    return {
      title: 'Stage introuvable | Nexus Réussite',
    };
  }

  return {
    title: `${stage.title} | Nexus Réussite`,
    description: stage.subtitle || stage.description || `Découvrez le stage ${stage.title} et inscrivez-vous en ligne.`,
    alternates: {
      canonical: `/stages/${stage.slug}`,
    },
    openGraph: {
      images: [OG_DEFAULT_IMAGE],
      title: `${stage.title} | Nexus Réussite`,
      description: stage.subtitle || stage.description || `Découvrez le stage ${stage.title}.`,
      type: 'website',
      url: `${BASE_URL}/stages/${stage.slug}`,
    },
  };
}

export default async function StageDetailPage({ params }: PageProps) {
  const { stageSlug } = await params;
  if (!canExposePublicStageSlug(stageSlug)) notFound();
  const stage = await getPublicStageBySlug(stageSlug);

  if (!stage) {
    notFound();
  }

  const sessionsByDay = stage.sessions.reduce<Record<string, typeof stage.sessions>>((acc, session) => {
    const key = new Date(session.startAt).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    acc[key] = acc[key] ? [...acc[key], session] : [session];
    return acc;
  }, {});

  const practicalHours = stage.sessions.length > 0
    ? `${new Date(stage.sessions[0].startAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })} → ${new Date(stage.sessions[stage.sessions.length - 1].endAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Horaires communiqués après validation';

  return (
    <div className="relative min-h-screen bg-lux-ink">
      <CorporateNavbar />

      <main id="main-content" className="relative z-10 pt-28">
        <section className="mx-auto max-w-7xl px-6 pb-10">
          <div className="rounded-[36px] border border-lux-line/40 bg-[radial-gradient(circle_at_top_left,rgba(191,160,106,0.18),transparent_40%),linear-gradient(145deg,rgba(17,24,38,0.95),rgba(7,11,18,0.98))] px-8 py-10 md:px-12 md:py-14">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-lux-gold/35 bg-lux-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-lux-gold">
                {stage.typeLabel}
              </span>
              {stage.subject.map((subject) => (
                <span key={subject} className="inline-flex rounded-full border border-lux-line/40 bg-white/5 px-3 py-1 text-xs font-medium text-lux-on-dark-muted">
                  {subjectLabels[subject]}
                </span>
              ))}
              {stage.level.map((level) => (
                <span key={level} className="inline-flex rounded-full border border-lux-line/40 bg-white/5 px-3 py-1 text-xs font-medium text-lux-on-dark-muted">
                  {getLevelLabel(level)}
                </span>
              ))}
            </div>

            <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <h1 className="text-4xl md:text-5xl font-fraunces font-light text-lux-ivory">{stage.title}</h1>
                {stage.subtitle ? (
                  <p className="mt-4 max-w-3xl text-lg leading-8 text-lux-on-dark-muted">{stage.subtitle}</p>
                ) : null}
                {stage.description ? (
                  <p className="mt-6 max-w-3xl text-base leading-8 text-lux-on-dark-muted">{stage.description}</p>
                ) : null}

                <div className="mt-8 grid gap-3 text-sm text-lux-on-dark-muted sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-3">
                    <CalendarDays className="h-4 w-4 text-lux-gold" />
                    <span>{formatStageDateRange(stage.startDate, stage.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-3">
                    {isOnlineLocation(stage.location) ? <Video className="h-4 w-4 text-lux-gold" /> : <MapPin className="h-4 w-4 text-lux-gold" />}
                    <span>{stage.location || 'Centre Nexus Réussite'}</span>
                  </div>
                  <div className="rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-3">
                    <span className="text-lux-on-dark-subtle">Places restantes</span>
                    <p className="mt-1 font-semibold text-lux-ivory">{stage.availablePlaces}</p>
                  </div>
                  <div className="rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-3">
                    <span className="text-lux-on-dark-subtle">Tarif</span>
                    <p className="mt-1 font-semibold text-lux-ivory">{formatStagePrice(stage.priceAmount, stage.priceCurrency)}</p>
                  </div>
                </div>
              </div>

              <aside className="rounded-[28px] border border-lux-line/40 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-lux-on-dark-subtle">Réserver une place</p>
                <p className="mt-3 text-sm leading-7 text-lux-on-dark-muted">
                  L&apos;inscription est transmise à notre équipe, qui confirme ensuite le créneau, le groupe et les modalités de paiement.
                </p>
                {stage.isOpen ? (
                  <Link
                    href={`/stages/${stage.slug}/inscription`}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-lux-gold px-5 py-3 text-sm font-semibold text-lux-ink transition hover:bg-lux-gold-bright"
                  >
                    S&apos;inscrire
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-lux-line/40 bg-white/5 px-5 py-3 text-sm font-semibold text-lux-on-dark-subtle">
                    Inscriptions fermées
                  </span>
                )}
              </aside>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[28px] border border-lux-line/40 bg-white/5 p-6">
            <h2 className="text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">Programme détaillé</h2>
            <div className="mt-6 space-y-5">
              {Object.entries(sessionsByDay).map(([day, sessions]) => (
                <div key={day} className="rounded-[24px] border border-lux-line/40 bg-white/5 p-5">
                  <p className="text-sm font-semibold capitalize text-lux-gold">{day}</p>
                  <div className="mt-4 space-y-3">
                    {sessions.map((session) => (
                      <div key={session.id} className="rounded-2xl border border-lux-line/40 bg-white/5 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-lux-ivory">{session.title}</h3>
                            <p className="mt-1 text-sm text-lux-on-dark-muted">
                              {subjectLabels[session.subject]}{session.coach?.pseudonym ? ` · ${session.coach.pseudonym}` : ''}
                            </p>
                          </div>
                          <p className="text-sm text-lux-on-dark-muted">{formatStageDateTime(session.startAt, session.endAt)}</p>
                        </div>
                        {session.description ? (
                          <p className="mt-3 text-sm leading-6 text-lux-on-dark-muted">{session.description}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {stage.sessions.length === 0 ? (
                <p className="rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-5 text-sm text-lux-on-dark-muted">
                  Le programme détaillé sera communiqué lors de l&apos;ouverture des séances.
                </p>
              ) : null}
            </div>
          </div>

          <aside className="rounded-[28px] border border-lux-line/40 bg-white/5 p-6">
            <h2 className="text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">Infos pratiques</h2>
            <div className="mt-6 space-y-4 text-sm text-lux-on-dark-muted">
              <div className="rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-4">
                <div className="flex items-center gap-2 text-lux-on-dark-subtle">
                  <Clock3 className="h-4 w-4" />
                  Horaires globaux
                </div>
                <p className="mt-2 text-lux-ivory">{practicalHours}</p>
              </div>
              <div className="rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-4">
                <div className="flex items-center gap-2 text-lux-on-dark-subtle">
                  {isOnlineLocation(stage.location) ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  Lieu
                </div>
                <p className="mt-2 text-lux-ivory">{stage.location || 'Centre Nexus Réussite'}</p>
              </div>
              <div className="rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-4">
                <p className="text-lux-on-dark-subtle">Prix & modalités</p>
                <p className="mt-2 text-lux-ivory">{formatStagePrice(stage.priceAmount, stage.priceCurrency)}</p>
                <p className="mt-2 text-lux-on-dark-muted">
                  Paiement validé avec notre équipe après confirmation de l&apos;inscription.
                </p>
              </div>
              <div className="rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-4">
                <div className="flex items-center gap-2 text-lux-on-dark-subtle">
                  <Phone className="h-4 w-4" />
                  Questions
                </div>
                <p className="mt-2 text-lux-ivory">{LEGAL.contact.email}</p>
                <p className="mt-1 text-lux-on-dark-muted">{LEGAL.contact.phone}</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-10">
          <div className="rounded-[28px] border border-lux-line/40 bg-white/5 p-6">
            <h2 className="text-2xl md:text-3xl font-fraunces font-light text-lux-ivory">Nos coachs pour ce stage</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {stage.coaches.map((assignment) => (
                <div key={assignment.id} className="rounded-[24px] border border-lux-line/40 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-lux-gold">{assignment.role || 'Coach référent'}</p>
                  <h3 className="mt-3 text-xl font-semibold text-lux-ivory">{assignment.coach.pseudonym}</h3>
                  <p className="mt-1 text-sm text-lux-on-dark-subtle">{assignment.coach.title || assignment.coach.tag || 'Coach Nexus Réussite'}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(assignment.coach.subjects as string[]).map((subject) => (
                      <span key={subject} className="rounded-full border border-lux-line/40 bg-white/5 px-3 py-1 text-xs font-medium text-lux-on-dark-muted">
                        {subjectLabels[subject as keyof typeof subjectLabels] ?? subject}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-lux-on-dark-muted">
                    {assignment.coach.description || assignment.coach.expertise || 'Encadrement rigoureux, suivi précis et feedback individualisé sur tout le stage.'}
                  </p>
                </div>
              ))}
              {stage.coaches.length === 0 ? (
                <p className="rounded-2xl border border-lux-line/40 bg-white/5 px-4 py-5 text-sm text-lux-on-dark-muted">
                  Les coachs assignés seront annoncés prochainement.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="rounded-[32px] border border-lux-line/40 bg-[linear-gradient(135deg,rgba(191,160,106,0.18),rgba(191,160,106,0.08))] p-8 text-center md:p-12">
            <p className="text-xs uppercase tracking-[0.18em] text-lux-on-dark-subtle">Réservez votre place</p>
            <h2 className="mt-3 text-2xl md:text-3xl font-fraunces font-light text-lux-ivory md:text-4xl">
              Un stage bien dimensionné, un planning clair, un suivi humain du premier contact jusqu&apos;au bilan.
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-lux-on-dark-muted md:text-base">
              Remplissez le formulaire d&apos;inscription pour recevoir votre statut de réservation et être recontacté rapidement par l&apos;équipe Nexus Réussite.
            </p>
            {stage.isOpen ? (
              <Link
                href={`/stages/${stage.slug}/inscription`}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-lux-gold px-6 py-3 text-sm font-semibold text-lux-ink transition hover:bg-lux-gold-bright"
              >
                S&apos;inscrire au stage
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="mt-8 inline-flex items-center rounded-full border border-lux-line/40 bg-white/5 px-6 py-3 text-sm font-semibold text-lux-on-dark-subtle">
                Inscriptions fermées
              </span>
            )}
          </div>
        </section>
      </main>

      <CorporateFooter />
    </div>
  );
}
