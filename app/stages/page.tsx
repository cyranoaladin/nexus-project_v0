export const dynamic = 'force-dynamic';

import { CalendarDays, GraduationCap, Sparkles } from 'lucide-react';

import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { PublicStageCard } from '@/components/stages/PublicStageCard';
import { listPublicStages } from '@/lib/stages/public';

export default async function StagesPage() {
  const stages = await listPublicStages();
  const openStages = stages.filter((stage) => stage.isOpen).length;

  return (
    <div className="relative min-h-screen bg-surface-darker text-neutral-100">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      />
      <CorporateNavbar />

      <main className="relative z-10 pt-28">
        <section className="mx-auto max-w-7xl px-6 pb-12">
          <div className="rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(143,175,196,0.18),transparent_42%),linear-gradient(135deg,rgba(17,24,38,0.95),rgba(7,11,18,0.98))] px-8 py-10 shadow-2xl md:px-12 md:py-14">
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em] text-neutral-400">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <Sparkles className="h-4 w-4 text-brand-accent" />
                Catalogue stages 2026
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <CalendarDays className="h-4 w-4 text-brand-accent" />
                {stages.length} stage{stages.length > 1 ? 's' : ''} visible{stages.length > 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <GraduationCap className="h-4 w-4 text-brand-accent" />
                {openStages} inscription{openStages > 1 ? 's' : ''} ouverte{openStages > 1 ? 's' : ''}
              </span>
            </div>

            <div className="mt-8 max-w-4xl">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Les stages Nexus Réussite, pensés pour convertir une période courte en progrès mesurable.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-300 md:text-lg">
                Retrouvez ici l’ensemble de nos stages visibles : formats intensifs, semaines blanches, préparations Grand Oral ou Bac Français. Chaque programme détaille ses créneaux, ses matières, ses coachs et ses modalités d’inscription.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-20">
          {stages.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center">
              <h2 className="text-2xl font-semibold text-white">Aucun stage disponible</h2>
              <p className="mt-3 text-sm leading-7 text-neutral-300">
                Aucun stage n’est publié pour le moment. Vous pouvez contacter l’équipe Nexus Réussite pour connaître la prochaine ouverture.
              </p>
              <a
                href="/contact"
                className="mt-6 inline-flex items-center rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
              >
                Contacter l&apos;équipe
              </a>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {stages.map((stage) => (
                <PublicStageCard key={stage.id} stage={stage} />
              ))}
            </div>
          )}
        </section>
      </main>

      <CorporateFooter />
    </div>
  );
}
