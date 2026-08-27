/**
 * Landing de l'espace candidat individuel (brief §3 / §34, hotfix branding
 * salon §5) — écran de stand, hiérarchie très claire, quatre entrées
 * conceptuelles. Vue 360° (P1A) est la synthèse de l'espace — mise en avant
 * visuellement (highlight).
 */
import { Compass, GraduationCap, Sparkles, Telescope } from 'lucide-react';
import { FeatureEntryCard } from '@/components/demo/utica-2026/FeatureEntryCard';

export default function UticaDemoLandingPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-surface-card to-surface-darker p-8 text-center sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-accent">Espace Candidat Individuel</p>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-50 sm:text-4xl">
          Un parcours piloté de bout en bout.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-neutral-400 sm:text-base">
          Administratif, planning, pédagogie, accompagnement et autonomie réunis dans un même espace.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-xs text-neutral-500">Lina B. — Candidate individuelle · Session 2027</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureEntryCard
          icon={Compass}
          title="Espace Parent"
          description="Une vision claire de tout le parcours de mon enfant, en un coup d'œil."
          href="/demo/utica-2026/parent"
          ctaLabel="Ouvrir l'espace"
        />
        <FeatureEntryCard
          icon={GraduationCap}
          title="Espace Élève"
          description="Je sais toujours quelle est ma prochaine étape."
          href="/demo/utica-2026/eleve"
          ctaLabel="Ouvrir l'espace"
        />
        <FeatureEntryCard
          icon={Sparkles}
          title="ARIA — autonomie accompagnée"
          description="Entre deux séances, mon travail autonome reste structuré."
          href="/demo/utica-2026/aria"
          ctaLabel="Accéder"
        />
        <FeatureEntryCard
          icon={Telescope}
          title="Vue 360°"
          description="Découvrez comment administratif, pédagogie, planning et autonomie se rejoignent dans un même parcours."
          href="/demo/utica-2026/360"
          ctaLabel="Voir la synthèse"
          highlight
        />
      </section>
    </div>
  );
}
