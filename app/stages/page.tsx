import { StageCard } from "@/components/StageCard";

const excellenceModules = [
  {
    title: "Analyse Avancée :",
    description: "Initiation aux limites et à la continuité",
  },
  {
    title: "Raisonnement :",
    description: "Problèmes ouverts et démonstrations",
  },
  {
    title: "Produit Scalaire :",
    description: "Maîtrise approfondie de la géométrie vectorielle",
  },
  {
    title: "Anticipation Terminale :",
    description: "Suites numériques et optimisation",
  },
];

export default function StagesPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-900 px-4 py-14 text-white md:px-8 md:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.14),transparent_36%),radial-gradient(circle_at_85%_80%,rgba(99,102,241,0.2),transparent_42%)]" />

      <section className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300 md:text-sm">
            Stages Vacances | Lycée Pierre Mendès France
          </p>
          <h1 className="text-3xl font-black leading-tight md:text-5xl">
            Offre Premium de Mathématiques
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-300 md:text-base">
            Une expérience intensive en petit groupe, conçue pour élever la rigueur, accélérer la progression et préparer
            les élèves de Première aux exigences de Terminale.
          </p>
        </div>

        <div className="w-full max-w-3xl">
          <StageCard
            status="4 places restantes 🔒"
            squad="6 Éleves Max"
            title="🚀 MATHS : OBJECTIF AVANCÉ"
            subtitle="Pallier 2"
            currentPrice="842 TND"
            standardPrice="990 TND"
            savings="ÉCONOMISEZ 15%"
            tagline="Approfondir les notions, anticiper le programme de Terminale et développer un raisonnement avancé."
            modules={excellenceModules}
            footer="Viser l'Excellence. Pédagogie différenciée garantie par nos professeurs agrégés et certifiés."
            ctaLabel="VOIR LE PROGRAMME DÉTAILLÉ"
            ctaHref="/stages/dashboard-excellence"
          />
        </div>
      </section>
    </main>
  );
}
