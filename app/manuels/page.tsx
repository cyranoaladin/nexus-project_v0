import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { Badge } from '@/components/ui/badge';

import ManuelsShop from './_components/ManuelsShop';

export default function ManuelsPage() {
  return (
    <main className="luxury min-h-screen pb-28 lg:pb-0" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 py-12 pt-24 sm:py-16 sm:pt-28 md:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <Badge className="mb-4 border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            Manuels · candidats individuels
          </Badge>
          <h1 className="font-fraunces text-3xl font-light tracking-tight text-lux-ivory sm:text-4xl md:text-5xl">
            Vos manuels du baccalauréat, au volume ou en lot
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-lux-on-dark-muted sm:text-lg">
            Des manuels écrits pour les candidats qui préparent le baccalauréat général sans être
            scolarisés. Choisissez vos volumes, le prix s’affiche, et la remise de lot se calcule
            au fur et à mesure.
          </p>
          <p className="mx-auto mt-4 max-w-2xl rounded-xl border border-lux-line/40 bg-white/5 px-4 py-3 text-sm leading-6 text-lux-on-dark-muted">
            Le catalogue ouvre en <strong className="text-lux-ivory">pré-commande</strong> : votre
            demande n’engage encore rien. Nous revenons vers vous pour confirmer la disponibilité de
            chaque volume, le délai et le règlement.
          </p>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-10 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-3">
          {[
            {
              titre: 'Un seul barème',
              texte:
                'Le prix dépend du nombre de pages, et de rien d’autre. Les annexes de douze pages et moins sont offertes en PDF.',
            },
            {
              titre: 'Le PDF toujours compris',
              texte:
                'Les deux formules papier incluent le fichier : vous n’achetez pas le contenu deux fois.',
            },
            {
              titre: 'Plus de volumes, moins cher la page',
              texte:
                'La remise de lot s’applique seule, sans code ni condition, dès que la sélection grandit.',
            },
          ].map((c) => (
            <div key={c.titre} className="rounded-2xl border border-lux-line bg-lux-white p-5">
              <h2 className="font-fraunces text-lg text-lux-ink">{c.titre}</h2>
              <p className="mt-2 text-sm leading-6 text-lux-slate">{c.texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-lux-paper px-4 pb-14 md:px-6">
        <ManuelsShop />
      </section>

      <section className="bg-lux-white px-4 py-12 md:px-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-lux-line bg-lux-paper p-6">
          <h2 className="font-fraunces text-xl text-lux-ink">Ce que ce catalogue couvre, et ce qu’il ne couvre pas</h2>
          <p className="mt-3 text-sm leading-6 text-lux-slate">
            Nos manuels portent sur le tronc commun, les enseignements de spécialité listés
            ci-dessus et l’épreuve anticipée de mathématiques. La maison ne publie pas le français
            et son épreuve anticipée, les langues vivantes A et B, l’éducation physique et sportive,
            le Grand oral ni les options.{' '}
            <strong className="text-lux-ink">
              Une sélection, même complète, ne constitue pas une préparation complète au
              baccalauréat.
            </strong>
          </p>
          <p className="mt-3 text-sm leading-6 text-lux-slate">
            Les montants sont indiqués en dinars tunisiens. Une question avant de choisir ? Écrivez-nous,
            nous vous répondons avec la liste exacte des volumes utiles à votre inscription.
          </p>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
