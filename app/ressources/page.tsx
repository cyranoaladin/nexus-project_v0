import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, FileText, GraduationCap } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';

export const metadata: Metadata = {
  title: 'Ressources bac français | Nexus Réussite',
  description:
    'Guides du bac français (candidat libre, EAF, Grand Oral), révisions interactives de mathématiques et documents corrigés, par Nexus Réussite à Tunis.',
  alternates: { canonical: '/ressources' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: 'Ressources bac français | Nexus Réussite',
    description: 'Guides, révisions interactives et documents corrigés pour préparer le bac français.',
    type: 'website',
  },
};

type Ressource = { href: string; titre: string; description: string; externe?: boolean; reserve?: string };

const GUIDES: Ressource[] = [
  {
    href: '/candidat-libre-bac-francais',
    titre: 'Candidat libre : statut, modalités et coefficients',
    description: 'Ce qui change sans contrôle continu, modalités A et B, coefficients de la session 2027, points de vigilance.',
  },
  {
    href: '/bac-candidat-libre',
    titre: 'Bac français en candidat libre — session 2027',
    description: 'Inscription Cyclades étape par étape, calendrier, parcours Première, Terminale et Bac en 1 an.',
  },
  {
    href: '/inscription-bac-2027',
    titre: 'S’inscrire au bac 2027 en candidat individuel',
    description: 'La campagne Cyclades écran par écran : calendrier, pièces à fournir, choix d’épreuves et pièges à éviter, en bac général et en bac STMG.',
  },
  {
    href: '/reussir-eaf',
    titre: 'Réussir l’EAF',
    description: 'Écrit et oral de français : commentaire, dissertation, explication linéaire, grammaire et descriptif.',
  },
  {
    href: '/grand-oral',
    titre: 'Préparer le Grand Oral',
    description: 'Les deux questions, l’exposé, l’échange avec le jury et la méthode de préparation.',
  },
  {
    href: '/preparation-bac-francais-tunis',
    titre: 'Préparer le bac français à Tunis',
    description: 'Élève scolarisé ou candidat libre : les deux logiques de préparation et les repères clés.',
  },
];

const REVISIONS: Ressource[] = [
  {
    href: '/programme/maths-1ere',
    titre: 'Mathématiques de Première — révisions interactives',
    description: 'Le programme de spécialité chapitre par chapitre, avec exercices et suivi de progression, depuis l’espace élève.',
    // Page protégée : un visiteur sans session est redirigé vers /offres.
    reserve: 'Réservé aux élèves accompagnés',
  },
];

const DOCUMENTS: Ressource[] = [
  {
    href: '/api/public-documents/corrige-dnb-maths-2026',
    titre: 'Corrigé du DNB de mathématiques 2026',
    description: 'Corrigé détaillé rédigé par l’équipe Nexus Réussite (PDF).',
    externe: true,
  },
];

function CarteRessource({ ressource }: { ressource: Ressource }) {
  const contenu = (
    <>
      <span className="flex items-center justify-between gap-3 font-fraunces text-lg text-lux-ink">
        {ressource.titre}
        <ArrowRight className="h-4 w-4 flex-none text-lux-slate transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </span>
      <span className="mt-2 block text-sm leading-6 text-lux-slate">{ressource.description}</span>
      {ressource.reserve ? (
        <span className="mt-3 inline-block rounded-full border border-lux-line px-3 py-1 text-xs font-semibold text-lux-gold-deep">
          {ressource.reserve}
        </span>
      ) : null}
    </>
  );
  const classes = 'group block h-full rounded-2xl border border-lux-line bg-lux-white p-5 lux-shadow lux-focus';
  return ressource.externe ? (
    <a href={ressource.href} target="_blank" rel="noopener noreferrer" className={classes}>
      {contenu}
    </a>
  ) : (
    <Link href={ressource.href} className={classes}>
      {contenu}
    </Link>
  );
}

function Section({ id, titre, icone: Icone, ressources }: { id: string; titre: string; icone: typeof BookOpen; ressources: Ressource[] }) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="flex items-center gap-3 text-2xl font-fraunces text-lux-ink">
        <Icone className="h-5 w-5 text-lux-gold-deep" aria-hidden="true" />
        {titre}
      </h2>
      <div className="lux-filet-gold mt-3 w-16" />
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {ressources.map((r) => (
          <li key={r.href}>
            <CarteRessource ressource={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RessourcesPage() {
  return (
    <main className="luxury min-h-screen bg-lux-paper" id="main-content">
      <CorporateNavbar />
      <section className="bg-lux-ink px-4 pb-14 pt-32 md:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="lux-eyebrow text-lux-gold-wash">Ressources</p>
          <h1 className="mt-3 text-3xl font-fraunces font-light text-lux-ivory md:text-5xl">
            Ressources pour réussir le bac français
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-lux-on-dark-muted">
            Des guides pour comprendre les épreuves, des révisions interactives et des documents corrigés, relus par
            l’équipe pédagogique.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-4 pb-16 md:px-6">
        <Section id="ressources-guides" titre="Guides" icone={GraduationCap} ressources={GUIDES} />
        <Section id="ressources-revisions" titre="Réviser en ligne" icone={BookOpen} ressources={REVISIONS} />
        <Section id="ressources-documents" titre="Documents corrigés" icone={FileText} ressources={DOCUMENTS} />
        <div className="mt-14 flex flex-col items-center justify-center gap-3 rounded-2xl border border-lux-line bg-lux-white p-6 text-center lux-shadow sm:flex-row">
          <p className="text-sm text-lux-slate">Besoin d’un accompagnement adapté au profil de votre enfant&nbsp;?</p>
          <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3 text-sm font-semibold">
            Demander un bilan gratuit
          </Link>
        </div>
      </div>
      <CorporateFooter />
    </main>
  );
}
