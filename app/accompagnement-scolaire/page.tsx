import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { getPreRentreePublicSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';

export default function AccompagnementScolairePage() {
  const preRentree = getPreRentreePublicSurfaceDTO();
  const whatsappUrl = buildWhatsAppUrl('Bonjour, je souhaite être orienté vers une offre Nexus adaptée.', { exactMessage: true });

  return (
    <main className="luxury min-h-screen" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 pb-16 pt-28 md:px-6 md:pb-20" aria-labelledby="accompagnement-heading">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lux-gold-wash">Accompagnement scolaire</p>
          <h1 id="accompagnement-heading" className="mt-4 font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">Trouver un cadre adapté au besoin réel</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-lux-on-dark-muted">
            Nexus Réussite présente chaque parcours avec son public, ses matières, son format, ses éléments inclus et ses conditions. Un service n’est annoncé que lorsqu’il appartient à l’offre concernée.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/offres" className="lux-cta-reserve inline-flex min-h-11 items-center rounded-lg px-6 py-3 text-sm font-semibold">Consulter les offres <ArrowRight className="ml-2 h-4 w-4" /></Link>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-lux-line/50 px-6 py-3 text-sm font-semibold text-lux-ivory">Écrire sur WhatsApp</a>
          </div>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-14 md:px-6 md:py-20" aria-labelledby="parcours-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="parcours-heading" className="font-fraunces text-3xl text-lux-ink">Portes d’entrée</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {preRentree && (
              <article className="rounded-2xl border border-lux-line bg-white p-6 lux-shadow">
                <p className="text-xs font-semibold uppercase tracking-wide text-lux-gold-deep">{preRentree.startLabel}</p>
                <h3 className="mt-2 font-fraunces text-2xl text-lux-ink">Pré-rentrée</h3>
                <p className="mt-3 text-sm leading-6 text-lux-slate">{preRentree.promise}</p>
                <p className="mt-4 text-sm font-semibold text-lux-ink">{preRentree.offers.length} offres publiées · capacités et tarifs affichés offre par offre.</p>
                <Link href={preRentree.canonicalPath} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-lux-gold-deep underline">Voir la Pré-rentrée <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </article>
            )}
            <article className="rounded-2xl border border-lux-line bg-white p-6 lux-shadow">
              <p className="text-xs font-semibold uppercase tracking-wide text-lux-gold-deep">Pendant l’année</p>
              <h3 className="mt-2 font-fraunces text-2xl text-lux-ink">Parcours annuels</h3>
              <p className="mt-3 text-sm leading-6 text-lux-slate">Les matières, la fréquence, l’effectif, le tarif et les services sont ceux de la fiche sélectionnée. La page catalogue permet de comparer sans supposer un socle commun.</p>
              <Link href="/offres#section-annual" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-lux-gold-deep underline">Voir les parcours annuels <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </article>
            <article className="rounded-2xl border border-lux-line bg-white p-6 lux-shadow">
              <p className="text-xs font-semibold uppercase tracking-wide text-lux-gold-deep">Selon le profil</p>
              <h3 className="mt-2 font-fraunces text-2xl text-lux-ink">Candidats libres</h3>
              <p className="mt-3 text-sm leading-6 text-lux-slate">Les modalités académiques et administratives ne sont pas généralisées. Seuls les éléments explicitement inclus dans l’offre choisie s’appliquent.</p>
              <Link href="/offres#section-libre" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-lux-gold-deep underline">Voir les offres correspondantes <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </article>
          </div>
        </div>
      </section>

      {preRentree && <section className="bg-white px-4 py-14 md:px-6 md:py-20" aria-labelledby="pre-rentree-levels-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="pre-rentree-levels-heading" className="font-fraunces text-3xl text-lux-ink">Pré-rentrée : matières vérifiées par niveau</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {preRentree.levels.map((level) => (
              <article key={level.id} className="rounded-xl border border-lux-line bg-lux-paper p-5">
                <h3 className="font-semibold text-lux-ink">{level.label}</h3>
                <p className="mt-2 text-sm leading-6 text-lux-slate">{level.subjects.map((subject) => subject.label).join(' · ')}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-lux-gold/30 bg-lux-paper p-6">
            <h2 className="font-fraunces text-2xl text-lux-ink">Besoin d’une orientation simple ?</h2>
            <p className="mt-3 text-sm text-lux-slate">Indiquez la classe, la matière et le statut scolaire. Nexus répond avec l’offre applicable et ses conditions.</p>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="lux-cta-reserve mt-5 inline-flex min-h-11 items-center rounded-lg px-5 py-3 text-sm font-semibold">WhatsApp {preRentree.contact.whatsappDisplay}</a>
          </div>
        </div>
      </section>}

      <CorporateFooter />
    </main>
  );
}
