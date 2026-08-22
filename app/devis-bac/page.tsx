import type { Metadata } from 'next';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { DevisWizard } from '@/components/quotes/DevisWizard';

export const metadata: Metadata = {
  title: 'Construisez votre accompagnement Bac français | Nexus Réussite',
  description:
    'Une estimation immédiate de votre accompagnement candidat individuel, puis un devis précis après votre bilan. Aucune obligation, aucun prix caché.',
  alternates: { canonical: '/devis-bac' },
  openGraph: {
    title: 'Construisez votre accompagnement Bac français',
    description: 'Une estimation immédiate, puis un devis précis après votre bilan.',
    url: '/devis-bac',
  },
};

export default function DevisBacPage() {
  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 py-14 pt-28 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="lux-eyebrow text-lux-gold-wash">Candidat individuel · Bac général</span>
          <h1 className="mt-3 text-4xl font-light text-lux-ivory md:text-5xl">
            Construisez votre accompagnement Bac français
          </h1>
          <p className="mt-4 text-lg leading-8 text-lux-on-dark-muted">
            Une estimation immédiate, puis un devis précis après votre bilan.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-lux-on-dark-muted">
            Le bilan ne sert pas à cacher le prix. Il sert à éviter de vous faire payer des matières ou des heures
            dont vous n'avez pas besoin.
          </p>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-12 md:px-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-lux-line bg-lux-white p-6 shadow-md shadow-lux-ink/5 md:p-10">
          <DevisWizard />
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-lux-slate">
          Vous ne payez pas pour remplir un emploi du temps. Vous payez pour répondre à des besoins identifiés.
        </p>
      </section>

      <CorporateFooter />
    </main>
  );
}
