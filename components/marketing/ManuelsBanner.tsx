import Link from 'next/link';
import { ArrowRight, BookOpen, Truck } from 'lucide-react';

/**
 * Appel d'accueil vers la boutique de manuels.
 *
 * Occupe l'emplacement d'en-tête, au-dessus du héros, et porte donc aussi le
 * dégagement sous la barre de navigation fixe (`pt-[5.75rem]`) : le retirer
 * sans remplaçant décalerait le héros.
 *
 * Les deux chiffres affichés — 41 volumes, dès 15 DT — ne sont pas décoratifs :
 * __tests__/marketing/manuels-banner.test.tsx les recalcule depuis le catalogue
 * canonique et échoue s'ils cessent d'être vrais. Ils ne sont pas lus ici à
 * l'exécution pour ne pas imposer le catalogue au paquet de la page d'accueil.
 */
export function ManuelsBanner({ asHeader = true }: { asHeader?: boolean } = {}) {
  // Le dégagement sous la barre de navigation fixe appartient au PREMIER bloc
  // de la page. Quand une autre bannière occupe déjà cette place, celle-ci se
  // pose en dessous et ne doit pas le reprendre, sous peine de doubler l'espace.
  const degagement = asHeader ? 'pt-[5.75rem] md:pt-[6.75rem]' : 'pt-6 md:pt-8';
  return (
    <section
      aria-label="Manuels Nexus Réussite pour les candidats individuels au baccalauréat"
      data-testid="manuels-banner"
      className={`relative z-10 bg-lux-paper px-4 pb-6 sm:px-6 md:pb-8 ${degagement}`}
    >
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-lux-gold/60 border-l-[5px] bg-lux-ivory shadow-[0_22px_55px_rgba(7,26,58,0.32)] lg:grid-cols-[9.5rem_minmax(0,1fr)_15.5rem]">
        <div className="flex items-center gap-4 bg-lux-ink px-5 py-4 text-lux-ivory sm:justify-center sm:gap-5 lg:flex-col lg:gap-1 lg:px-4 lg:py-6 lg:text-center">
          <BookOpen className="h-5 w-5 shrink-0 text-lux-gold" aria-hidden="true" />
          <p className="sr-only">41 volumes au catalogue</p>
          <p aria-hidden="true" className="font-fraunces text-4xl leading-none sm:text-5xl">41</p>
          <span aria-hidden="true" className="text-sm font-semibold tracking-[0.18em] text-lux-gold-wash">
            VOLUMES
          </span>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6 lg:px-8">
          <span className="inline-flex min-h-7 items-center rounded-full border border-lux-evergreen/30 bg-lux-evergreen/10 px-3 py-1 text-xs font-semibold text-lux-evergreen">
            Pré-commande
          </span>
          <h2
            className="mt-3 font-fraunces text-2xl leading-tight sm:text-3xl"
            style={{ color: 'var(--color-lux-ink)' }}
          >
            Les manuels des candidats individuels
          </h2>
          <p className="mt-2 font-semibold text-lux-ink">
            Préparer le baccalauréat général sans être scolarisé, avec des manuels écrits pour cela
          </p>
          <p className="mt-3 text-sm leading-6 text-lux-slate">
            Choisissez vos volumes discipline par discipline : le prix s’affiche, et la remise de lot
            se calcule au fur et à mesure. En PDF, ou en PDF accompagné du papier.
          </p>

          <ul className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium text-lux-ink sm:flex sm:flex-wrap">
            <li className="inline-flex min-h-9 items-center rounded-full border border-lux-line bg-white px-3">
              Dès 15 DT
            </li>
            <li className="inline-flex min-h-9 items-center rounded-full border border-lux-line bg-white px-3">
              PDF ou papier
            </li>
            <li className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-lux-line bg-white px-3">
              <Truck className="h-3.5 w-3.5 text-lux-gold-deep" aria-hidden="true" />
              Retrait ou livraison offerte
            </li>
          </ul>
        </div>

        <div className="grid content-center gap-3 border-t border-lux-line bg-lux-paper px-5 py-5 sm:px-7 lg:border-l lg:border-t-0 lg:px-6">
          <Link
            href="/manuels"
            className="lux-cta-reserve inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-semibold lux-focus"
          >
            Voir les manuels
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
