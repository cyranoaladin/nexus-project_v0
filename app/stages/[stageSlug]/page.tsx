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

type PageProps = {
  params: Promise<{ stageSlug: string }>;
};

const BASE_URL = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { stageSlug } = await params;
  const stage = await getPublicStageBySlug(stageSlug);

  if (!stage) {
    return {
      title: 'Stage introuvable | Nexus Réussite',
    };
  }

  return {
    title: `${stage.title} | Nexus Réussite`,
    description: stage.subtitle || stage.description || `Découvrez le stage ${stage.title} et inscrivez-vous en ligne.`,
    openGraph: {
      title: `${stage.title} | Nexus Réussite`,
      description: stage.subtitle || stage.description || `Découvrez le stage ${stage.title}.`,
      type: 'website',
      url: `${BASE_URL}/stages/${stage.slug}`,
    },
  };
}

export default async function StageDetailPage({ params }: PageProps) {
  const { stageSlug } = await params;
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
    <div className="relative min-h-screen bg-surface-darker text-neutral-100">
      <CorporateNavbar />

      <main className="relative z-10 pt-28">
        <section className="mx-auto max-w-7xl px-6 pb-10">
          <div className="rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(143,175,196,0.18),transparent_40%),linear-gradient(145deg,rgba(17,24,38,0.95),rgba(7,11,18,0.98))] px-8 py-10 md:px-12 md:py-14">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-brand-accent/35 bg-brand-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
                {stage.typeLabel}
              </span>
              {stage.subject.map((subject) => (
                <span key={subject} className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-200">
                  {subjectLabels[subject]}
                </span>
              ))}
              {stage.level.map((level) => (
                <span key={level} className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-200">
                  {getLevelLabel(level)}
                </span>
              ))}
            </div>

            <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">{stage.title}</h1>
                {stage.subtitle ? (
                  <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-300">{stage.subtitle}</p>
                ) : null}
                {stage.description ? (
                  <p className="mt-6 max-w-3xl text-base leading-8 text-neutral-300">{stage.description}</p>
                ) : null}

                <div className="mt-8 grid gap-3 text-sm text-neutral-200 sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <CalendarDays className="h-4 w-4 text-brand-accent" />
                    <span>{formatStageDateRange(stage.startDate, stage.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    {isOnlineLocation(stage.location) ? <Video className="h-4 w-4 text-brand-accent" /> : <MapPin className="h-4 w-4 text-brand-accent" />}
                    <span>{stage.location || 'Centre Nexus Réussite'}</span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-neutral-500">Places restantes</span>
                    <p className="mt-1 font-semibold text-white">{stage.availablePlaces}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-neutral-500">Tarif</span>
                    <p className="mt-1 font-semibold text-white">{formatStagePrice(stage.priceAmount, stage.priceCurrency)}</p>
                  </div>
                </div>
              </div>

              <aside className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Réserver une place</p>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  L&apos;inscription est transmise à notre équipe, qui confirme ensuite le créneau, le groupe et les modalités de paiement.
                </p>
                {stage.isOpen ? (
                  <Link
                    href={`/stages/${stage.slug}/inscription`}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
                  >
                    S&apos;inscrire
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-neutral-500">
                    Inscriptions fermées
                  </span>
                )}
              </aside>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold text-white">Programme détaillé</h2>
            <div className="mt-6 space-y-5">
              {Object.entries(sessionsByDay).map(([day, sessions]) => (
                <div key={day} className="rounded-[24px] border border-white/10 bg-surface-darker/60 p-5">
                  <p className="text-sm font-semibold capitalize text-brand-accent">{day}</p>
                  <div className="mt-4 space-y-3">
                    {sessions.map((session) => (
                      <div key={session.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{session.title}</h3>
                            <p className="mt-1 text-sm text-neutral-300">
                              {subjectLabels[session.subject]}{session.coach?.pseudonym ? ` · ${session.coach.pseudonym}` : ''}
                            </p>
                          </div>
                          <p className="text-sm text-neutral-300">{formatStageDateTime(session.startAt, session.endAt)}</p>
                        </div>
                        {session.description ? (
                          <p className="mt-3 text-sm leading-6 text-neutral-300">{session.description}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {stage.sessions.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-surface-darker/60 px-4 py-5 text-sm text-neutral-300">
                  Le programme détaillé sera communiqué lors de l&apos;ouverture des séances.
                </p>
              ) : null}
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold text-white">Infos pratiques</h2>
            <div className="mt-6 space-y-4 text-sm text-neutral-200">
              <div className="rounded-2xl border border-white/10 bg-surface-darker/60 px-4 py-4">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Clock3 className="h-4 w-4" />
                  Horaires globaux
                </div>
                <p className="mt-2 text-white">{practicalHours}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-surface-darker/60 px-4 py-4">
                <div className="flex items-center gap-2 text-neutral-500">
                  {isOnlineLocation(stage.location) ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  Lieu
                </div>
                <p className="mt-2 text-white">{stage.location || 'Centre Nexus Réussite'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-surface-darker/60 px-4 py-4">
                <p className="text-neutral-500">Prix & modalités</p>
                <p className="mt-2 text-white">{formatStagePrice(stage.priceAmount, stage.priceCurrency)}</p>
                <p className="mt-2 text-neutral-300">
                  Paiement validé avec notre équipe après confirmation de l&apos;inscription.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-surface-darker/60 px-4 py-4">
                <div className="flex items-center gap-2 text-neutral-500">
                  <Phone className="h-4 w-4" />
                  Questions
                </div>
                <p className="mt-2 text-white">contact@nexusreussite.academy</p>
                <p className="mt-1 text-neutral-300">+216 99 19 28 29</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-10">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold text-white">Nos coachs pour ce stage</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {stage.coaches.map((assignment) => (
                <div key={assignment.id} className="rounded-[24px] border border-white/10 bg-surface-darker/60 p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-brand-accent">{assignment.role || 'Coach référent'}</p>
                  <h3 className="mt-3 text-xl font-semibold text-white">{assignment.coach.pseudonym}</h3>
                  <p className="mt-1 text-sm text-neutral-400">{assignment.coach.title || assignment.coach.tag || 'Coach Nexus Réussite'}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(assignment.coach.subjects as string[]).map((subject) => (
                      <span key={subject} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-200">
                        {subjectLabels[subject as keyof typeof subjectLabels] ?? subject}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-neutral-300">
                    {assignment.coach.description || assignment.coach.expertise || 'Encadrement rigoureux, suivi précis et feedback individualisé sur tout le stage.'}
                  </p>
                </div>
              ))}
              {stage.coaches.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-surface-darker/60 px-4 py-5 text-sm text-neutral-300">
                  Les coachs assignés seront annoncés prochainement.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(143,175,196,0.14))] p-8 text-center md:p-12">
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Réservez votre place</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
              Un stage bien dimensionné, un planning clair, un suivi humain du premier contact jusqu&apos;au bilan.
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-neutral-300 md:text-base">
              Remplissez le formulaire d&apos;inscription pour recevoir votre statut de réservation et être recontacté rapidement par l&apos;équipe Nexus Réussite.
            </p>
            {stage.isOpen ? (
              <Link
                href={`/stages/${stage.slug}/inscription`}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-surface-darker transition hover:bg-neutral-100"
              >
                S&apos;inscrire au stage
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="mt-8 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-neutral-500">
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
