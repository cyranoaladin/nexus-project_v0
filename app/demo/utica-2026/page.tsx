/**
 * Landing du démonstrateur UTICA 2026 (brief §3 / §34) — écran de stand,
 * hiérarchie très claire, quatre entrées conceptuelles. Vue 360° (P1A) est
 * la synthèse du démonstrateur — mise en avant visuellement (highlight).
 */
import { Compass, GraduationCap, Sparkles, Telescope } from 'lucide-react';
import { FeatureEntryCard } from '@/components/demo/utica-2026/FeatureEntryCard';
import { DemoBadge } from '@/components/demo/utica-2026/DemoBadge';

export default function UticaDemoLandingPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-surface-card to-surface-darker p-8 text-center sm:p-12">
        <DemoBadge className="mx-auto" />
        <h1 className="mt-5 text-3xl font-semibold text-neutral-50 sm:text-4xl">
          Le parcours d&apos;un candidat individuel,
          <br className="hidden sm:block" /> piloté de bout en bout.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-neutral-400 sm:text-base">
          Nexus Réussite ne suit pas seulement des notes : administratif, planning, pédagogie et travail autonome
          reposent sur un seul dossier. Découvrez le cas de Lina B., candidate individuelle — session 2027.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureEntryCard
          icon={Compass}
          title="Espace Parent"
          description="Une vision claire de tout le parcours de mon enfant, en un coup d'œil."
          href="/demo/utica-2026/parent"
          ctaLabel="Découvrir"
        />
        <FeatureEntryCard
          icon={GraduationCap}
          title="Espace Élève"
          description="Je sais toujours quelle est ma prochaine étape."
          href="/demo/utica-2026/eleve"
          ctaLabel="Découvrir"
        />
        <FeatureEntryCard
          icon={Sparkles}
          title="ARIA — autonomie accompagnée"
          description="Entre deux séances, mon travail autonome reste structuré."
          href="/demo/utica-2026/aria"
          ctaLabel="Découvrir"
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
