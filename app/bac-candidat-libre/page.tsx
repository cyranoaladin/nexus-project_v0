import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, CheckCircle2, Clock, MapPin, MessageCircle } from 'lucide-react';

import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { FraisDossier } from '@/components/marketing/CandidatsLibresParcours';
import { fmtMontant } from '@/components/premium/format';
import {
  META,
  PAGE_PATH,
  construireFaq,
  jourMois,
  jourMoisHeure,
} from '@/content/marketing/bac-candidat-libre';
import {
  dureeIso,
  echeanciersParMoisEntree,
  texteTotalEncadre,
  getAteliersCycladesAVenir,
  getCandidatsLibres2027,
  getFraisDossierOffertsActifs,
  getSemaineDiagnostic,
  produitsCourtsPublies,
  type ParcoursCandidatLibre,
} from '@/lib/candidats-libres-2027';
import { lienCycladesOfficiel, lienInstitutFrancaisOfficiel } from '@/lib/liens-officiels';
import { LEGAL } from '@/lib/legal';
import { buildPageMetadata, serialiserJsonLd } from '@/lib/seo';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

/** Régénérée toutes les heures : les offres datées disparaissent d'elles-mêmes à leur échéance. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
  ...buildPageMetadata({ title: META.title, description: META.description, path: PAGE_PATH }),
};

const NBSP = ' ';
const tnd = (n: number) => `${fmtMontant(n)}${NBSP}TND`;

function Mensualite({ parcours, maintenant }: { parcours: ParcoursCandidatLibre; maintenant: Date }) {
  const entrees = echeanciersParMoisEntree(parcours, maintenant);
  const enAvant = entrees.find((e) => e.enAvant) ?? entrees[0];
  return (
    <div className="mt-5">
      <p className="font-fraunces text-4xl font-light tabular-nums text-lux-ink">
        {fmtMontant(enAvant.echeancier.mensualite)}
        <span className="ml-1 font-body text-base text-lux-slate">{NBSP}TND / mois</span>
      </p>
      <p className="mt-1 text-sm font-semibold text-lux-ink">
        {tnd(parcours.prix_annuel)} par an · comptant {tnd(parcours.comptant)}
      </p>
      {/* Les deux entrées sont à égalité : le nombre de versements n'est pas un
          choix de la famille, il découle du mois de son inscription. */}
      <ul className="mt-2 space-y-1 text-sm">
        {entrees.map((e) => (
          <li key={e.versements} className={e.enAvant ? 'text-lux-ink' : 'text-lux-slate'}>
            {e.cadence} · {e.montants} · {e.entree}
          </li>
        ))}
      </ul>
      <FraisDossier id={parcours.id} maintenant={maintenant} />
    </div>
  );
}

function CarteParcours({ parcours, maintenant }: { parcours: ParcoursCandidatLibre; maintenant: Date }) {
  const titreId = `parcours-${parcours.id}`;
  const b1a = parcours.id === 'bac-en-1-an';
  return (
    <article
      id={parcours.id}
      aria-labelledby={titreId}
      className="flex flex-col rounded-2xl border border-lux-line bg-lux-white p-6 lux-shadow"
    >
      <p className="lux-eyebrow">{parcours.accroche}</p>
      <h3 id={titreId} className="mt-2 font-fraunces text-2xl text-lux-ink">
        {parcours.titre}
      </h3>
      <Mensualite parcours={parcours} maintenant={maintenant} />
      <ul className="mt-5 space-y-2.5 text-sm leading-6 text-lux-slate">
        <li className="flex gap-2">
          <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-lux-ink">{parcours.heures_cours}{NBSP}h de cours</strong>
            {parcours.repartition.length > 0
              ? ` — ${parcours.repartition.map((r) => `${r.matiere} ${r.heures}${NBSP}h`).join(', ')}`
              : ' — épreuves anticipées et terminales réunies, avec des reprises dédiées en journée'}
          </span>
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
          <span>{parcours.copies_corrigees} copies d’épreuves blanches corrigées</span>
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
          <span>{parcours.oraux}</span>
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
          <span>{parcours.bilans} bilans avec la famille</span>
        </li>
        <li className="flex gap-2">
          <Clock className="mt-1 h-4 w-4 flex-none text-lux-gold-deep" aria-hidden="true" />
          <span>{parcours.creneaux}</span>
        </li>
      </ul>
      {/* Le total encadré, affiché parce qu'il est déclaré : le JSON-LD le
          porte en courseWorkload, et une donnée structurée absente de la page
          décrit une page qui n'existe pas. Les deux lisent le même champ. */}
      <p className="mt-4 text-sm font-medium leading-6 text-lux-ink">{texteTotalEncadre(parcours)}</p>
      <p className="mt-2 text-xs leading-5 text-lux-slate">{parcours.public}</p>
      <a
        href={buildWhatsAppUrl(
          b1a
            ? 'Bonjour Nexus Réussite, je souhaite vérifier mon éligibilité au parcours Bac en 1 an (session 2027).'
            : `Bonjour Nexus Réussite, je souhaite inscrire mon enfant au parcours ${parcours.niveau} candidat libre (session 2027).`,
          { exactMessage: true },
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="lux-cta-primary mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold"
      >
        {b1a ? 'Vérifier mon éligibilité sur WhatsApp' : 'Je veux ce parcours — WhatsApp'}
      </a>
    </article>
  );
}

export default function BacCandidatLibrePage() {
  const maintenant = new Date();
  const data = getCandidatsLibres2027();
  const [premiere, terminale] = data.parcours;
  const produitsCourts = produitsCourtsPublies();
  const semaine = getSemaineDiagnostic(maintenant);
  const ateliers = getAteliersCycladesAVenir(maintenant);
  const lienCyclades = lienCycladesOfficiel();
  const lienIft = lienInstitutFrancaisOfficiel();
  const offres = getFraisDossierOffertsActifs(maintenant);
  const faq = construireFaq(data, { produitsCourts, fraisOfferts: offres.length > 0 });
  const echeances = [
    { libelle: 'Inscription Terminale', cloture: terminale.cyclades.cloture, ouverture: terminale.cyclades.ouverture },
    { libelle: 'Inscription Première', cloture: premiere.cyclades.cloture, ouverture: premiere.cyclades.ouverture },
  ];
  const adresse = LEGAL.addresses.pedagogique;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: 'Préparation au bac français en candidat libre — session 2027',
      description: META.description,
      inLanguage: 'fr',
      educationalCredentialAwarded: 'Baccalauréat français (candidat individuel)',
      provider: {
        '@type': 'EducationalOrganization',
        // Même identifiant que le graphe global : moteurs et assistants
        // rattachent ce cours à l'organisation déjà décrite, au lieu d'en
        // déduire une seconde entité du même nom.
        '@id': `${LEGAL.web.url}/#organisation`,
        name: LEGAL.entity.tradeName,
        url: LEGAL.web.url,
        telephone: LEGAL.contact.phone,
        address: {
          '@type': 'PostalAddress',
          streetAddress: adresse.street,
          addressLocality: `${adresse.neighborhood}, ${adresse.city}`,
          addressCountry: 'TN',
        },
      },
      hasCourseInstance: data.parcours.map((p) => ({
        '@type': 'CourseInstance',
        name: p.titre,
        courseMode: 'onsite',
        location: adresse.full,
        // Le contrat vend les heures de cours ET le total encadré ; c'est le
        // second qui est le total de ce que la famille reçoit — cours, épreuves
        // blanches, oraux, bilans — et c'est cette donnée qu'une machine cite.
        // Déclarer les seules heures de cours annoncerait moins que le contrat.
        // Le texte lisible, lui, garde les heures de cours, là où elles sont nommées.
        courseWorkload: dureeIso(p.heures_encadrees_total),
      })),
      offers: data.parcours.map((p) => ({
        '@type': 'Offer',
        name: p.titre,
        price: p.prix_annuel,
        priceCurrency: 'TND',
        category: 'Parcours annuel',
        url: `${LEGAL.web.url}${PAGE_PATH}#${p.id}`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.reponse } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: LEGAL.web.url },
        { '@type': 'ListItem', position: 2, name: 'Bac français en candidat libre', item: `${LEGAL.web.url}${PAGE_PATH}` },
      ],
    },
  ];

  return (
    <main className="luxury min-h-screen bg-lux-paper" id="main-content">
      {jsonLd.map((bloc) => (
        // JSON-LD statique construit par JSON.stringify sur des données du dépôt (aucune entrée utilisateur) — même motif que app/layout.tsx.
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        <script key={bloc['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(bloc) }} />
      ))}
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 pb-16 pt-32 md:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="lux-eyebrow text-lux-gold-wash">
            Candidats individuels · Session {data.session} · {adresse.neighborhood}, {adresse.city}
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-fraunces font-light text-lux-ivory md:text-5xl">
            Le bac français en candidat libre, le soir et le week-end, sans quitter le lycée tunisien.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-lux-on-dark-muted md:text-lg">
            Cours en groupes de {data.groupe.max} au plus, épreuves blanches corrigées, oraux blancs, bilans avec la
            famille et inscription Cyclades accompagnée. Tout est compté et daté avant que vous vous engagiez.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#parcours" className="lux-cta-reserve inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 py-3.5 text-sm font-semibold">
              Voir les parcours et les prix
            </a>
            <a
              href={buildWhatsAppUrl('le bac français en candidat libre (session 2027)')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-lux-ivory"
            >
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Poser une question sur WhatsApp
            </a>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {echeances.map((e) => {
              const close = maintenant >= new Date(e.cloture);
              const avant = maintenant < new Date(`${e.ouverture}T00:00:00+01:00`);
              return (
                <li key={e.libelle} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-on-dark-muted">
                  <CalendarDays className="h-4 w-4 flex-none text-lux-gold-wash" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-lux-ivory">{e.libelle} (Cyclades)</span>
                    {' — '}
                    {close
                      ? 'clôturée'
                      : avant
                        ? `du ${jourMois(e.ouverture)} au ${jourMoisHeure(e.cloture)}`
                        : `jusqu’au ${jourMoisHeure(e.cloture)}, heure de Paris`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {offres.length > 0 ? (
        <section className="border-b border-lux-line bg-lux-gold-wash/40 px-4 py-5 md:px-6">
          <p className="mx-auto max-w-5xl text-center text-sm leading-6 text-lux-ink">
            <strong className="font-semibold">{data.frais_dossier.libelle} offerts</strong> ({tnd(data.frais_dossier.montant)})
            {' pour toute inscription conclue '}
            {offres.map((x, i) => (
              <span key={x.parcours.id}>
                {i > 0 ? ' et ' : ''}
                jusqu’au {jourMois(x.offre.jusqu_au)} en {x.parcours.niveau}
              </span>
            ))}
            .
          </p>
        </section>
      ) : null}

      <section id="parcours" aria-labelledby="titre-parcours" className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="lux-eyebrow">Session {data.session}</p>
          <h2 id="titre-parcours" className="mt-2 text-3xl font-fraunces text-lux-ink md:text-4xl">
            Trois parcours, un prix annuel par élève
          </h2>
          <div className="lux-filet-gold mt-3 w-16" />
          <p className="mt-4 max-w-3xl text-base leading-7 text-lux-slate">{data.paiement.note}</p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {data.parcours.map((p) => (
              <CarteParcours key={p.id} parcours={p} maintenant={maintenant} />
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-lux-line bg-lux-white p-5 text-sm leading-6 text-lux-slate">
            <p>
              <strong className="font-semibold text-lux-ink">{data.groupe.max} places au maximum par groupe.</strong>{' '}
              Un groupe ouvre à {data.groupe.ouverture_min} inscrits payants{NBSP}; s’il n’ouvre pas, vous êtes
              intégralement remboursé, frais de dossier compris, sous {data.groupe.remboursement_jours_ouvres}{NBSP}jours
              ouvrés. La décision d’ouverture est prise au plus tard le {jourMois(data.calendrier.decision_ouverture)},
              avant les premiers cours du {jourMois(data.calendrier.premiers_cours)}.
            </p>
            <p className="mt-2">
              Le remboursement est intégral si le groupe n’ouvre pas, si vous renoncez avant le premier cours
              {NBSP}— hors frais de dossier lorsqu’ils sont dus{NBSP}— ou si votre enfant s’avère inéligible au parcours
              souscrit. Après le début des cours, le prix annuel reste dû, sauf motif grave documenté ou interruption
              de notre fait. Les conditions complètes sont remises avant toute signature.
            </p>
            <p className="mt-2">
              Spécialités préparées — Première{NBSP}: {data.specialites.premiere.join(', ')} · Terminale{NBSP}:{' '}
              {data.specialites.terminale.join(' et ')}. Non préparées par Nexus{NBSP}: {data.non_prepare.join(', ')}
              {' '}(épreuves obligatoires dues par le candidat). {data.frais_examen}
            </p>
            <ul className="mt-3 space-y-1.5">
              {data.inclus_communs.map((inclus) => (
                <li key={inclus} className="flex gap-2">
                  <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
                  <span>{inclus}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="titre-edt" className="bg-lux-white px-4 py-16 md:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 id="titre-edt" className="text-3xl font-fraunces text-lux-ink">Un emploi du temps compatible avec le lycée</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-lux-slate">
            En moyenne {data.emploi_du_temps.charge_moyenne.terminale} en Terminale et {data.emploi_du_temps.charge_moyenne.premiere} en
            Première, jamais plus de {data.emploi_du_temps.charge_max_hors_stage} hors stage. Bac blanc aux vacances d’octobre, puis un
            stage intensif à chaque vacances, aux dates officielles du calendrier scolaire tunisien.
          </p>
          {/* Zone défilante atteignable au clavier (tableau plus large que l’écran sur mobile). */}
          <div
            className="mt-8 overflow-x-auto rounded-2xl border border-lux-line lux-focus"
            tabIndex={0}
            role="region"
            aria-label="Créneaux hebdomadaires, défilement horizontal sur petit écran"
          >
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Créneaux hebdomadaires par niveau</caption>
              <thead className="bg-lux-ink text-lux-ivory">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">Niveau</th>
                  {data.emploi_du_temps.jours.map((jour) => (
                    <th key={jour} scope="col" className="px-3 py-3 font-semibold">{jour}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['terminale', 'premiere'] as const).map((niveau) => (
                  <tr key={niveau} className="border-t border-lux-line">
                    <th scope="row" className="px-3 py-3 font-semibold text-lux-ink">{niveau === 'terminale' ? 'Terminale' : 'Première'}</th>
                    {data.emploi_du_temps[niveau].map((creneau, i) => (
                      <td key={data.emploi_du_temps.jours[i]} className="px-3 py-3 tabular-nums text-lux-slate">{creneau ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {semaine ? (
        <section aria-labelledby="titre-diagnostic" className="px-4 py-16 md:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 id="titre-diagnostic" className="text-3xl font-fraunces text-lux-ink">
              Semaine Diagnostic du {jourMois(semaine.du)} au {jourMois(semaine.au)}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-lux-slate">
              Avant de vous engager, sachez où en est votre enfant{NBSP}: épreuves blanches en conditions d’examen, correction
              détaillée, puis bilan individuel avec vous. Entièrement déduite du prix annuel si vous inscrivez votre enfant
              avant le {jourMois(semaine.deduit_si_inscription_avant)}. Inscriptions jusqu’au {jourMois(semaine.inscriptions_jusqu_au)},
              dans la limite de {semaine.places_par_niveau} places par niveau.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {semaine.niveaux.map((n) => (
                <div key={n.id} className="rounded-2xl border border-lux-line bg-lux-white p-6 lux-shadow">
                  <h3 className="font-fraunces text-xl text-lux-ink">
                    {n.id === 'terminale' ? 'Terminale' : 'Première'} · {tnd(n.prix)}
                  </h3>
                  <ul className="mt-4 space-y-2 text-sm text-lux-slate">
                    {n.contenu.map((ligne) => (
                      <li key={ligne} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
                        <span>{ligne}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <a
              href={buildWhatsAppUrl('Bonjour Nexus Réussite, je souhaite réserver une place à la Semaine Diagnostic.', { exactMessage: true })}
              target="_blank"
              rel="noopener noreferrer"
              className="lux-cta-primary mt-8 inline-flex min-h-[44px] items-center rounded-lg px-6 py-3 text-sm font-semibold"
            >
              Réserver une place sur WhatsApp
            </a>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="titre-cyclades" className="bg-lux-ink px-4 py-16 md:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 id="titre-cyclades" className="text-3xl font-fraunces font-light text-lux-ivory">
            L’inscription au bac sur Cyclades, avec vous
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-lux-on-dark-muted">
            L’inscription est personnelle et se fait sur{' '}
            <a
              href={lienCyclades}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-lux-gold-wash underline underline-offset-4 hover:text-lux-ivory"
            >
              Cyclades, espace candidat<span className="sr-only"> (nouvel onglet)</span>
            </a>
            . Nous vous accompagnons étape par étape, mais nous ne la faisons jamais à votre place.
            {ateliers.length > 0
              ? ` Atelier gratuit les samedis ${ateliers.map(jourMois).join(', ')} à ${data.ateliers_cyclades.heure}, ${data.ateliers_cyclades.lieu}.`
              : ''}
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[terminale, premiere].map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="font-fraunces text-xl text-lux-ivory">{p.niveau}</h3>
                <p className="mt-2 text-sm leading-6 text-lux-on-dark-muted">
                  Du {jourMois(p.cyclades.ouverture)} au {jourMoisHeure(p.cyclades.cloture)} (heure de Paris). Spécialités, langues
                  et modalités sont figées à la clôture{NBSP}; la confirmation signée est renvoyée avec les justificatifs et les frais
                  sont payés à l’Institut français.
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-6 text-lux-on-dark-muted">
            Le mode d’emploi complet de la campagne, écran par écran{NBSP}:{' '}
            <Link href="/inscription-bac-2027" className="font-semibold text-lux-gold-wash underline underline-offset-4 hover:text-lux-ivory">
              nos dossiers d’inscription 2027
            </Link>
            {' '}(bac général et bac STMG).
          </p>
          <p className="mt-3 text-sm leading-6 text-lux-on-dark-muted">
            Pour suivre la session — calendrier, convocations, frais d’examen{NBSP}:{' '}
            <a
              href={lienIft}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-lux-gold-wash underline underline-offset-4 hover:text-lux-ivory"
            >
              Institut français de Tunisie, Examens &amp; concours<span className="sr-only"> (nouvel onglet)</span>
            </a>
            .
          </p>
        </div>
      </section>

      {/* Grille adoptée par la direction le 16/10/2026, mais régime fiscal non
          attesté par le comptable : le dossier bloque toute offre commerciale
          ferme sur ce point. Rien n'est publié sans PRODUITS_COURTS_PUBLIES. */}
      {produitsCourts ? (
        <section aria-labelledby="titre-stages" className="px-4 py-16 md:px-6">
          <div className="mx-auto max-w-5xl">
            <h2 id="titre-stages" className="text-3xl font-fraunces text-lux-ink">Déjà inscrit ailleurs{NBSP}? Les produits courts</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-lux-slate">{data.produits_courts.note}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {data.produits_courts.produits.map((produit) => (
                <li key={produit.id} className="rounded-xl border border-lux-line bg-lux-white px-4 py-3 text-sm text-lux-slate">
                  <span className="font-semibold text-lux-ink">{produit.libelle}</span> ·{' '}
                  <span className="tabular-nums text-lux-ink">{tnd(produit.prix)}</span>
                  <span className="mt-1 block">{produit.contenu} · {produit.paiement}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="titre-faq" className="bg-lux-white px-4 py-16 md:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 id="titre-faq" className="text-3xl font-fraunces text-lux-ink">Questions fréquentes</h2>
          <div className="mt-8 space-y-4">
            {faq.map((q) => (
              <div key={q.question} className="rounded-xl border border-lux-line/70 bg-lux-paper/70 p-5">
                <h3 className="text-base font-semibold text-lux-ink">{q.question}</h3>
                <p className="mt-2 text-sm leading-6 text-lux-slate">{q.reponse}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-lux-ink px-4 py-16 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-fraunces font-light text-lux-ivory">Parlons du projet de votre enfant</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-lux-on-dark-muted">
            Du lundi au samedi, de 9{NBSP}h à 20{NBSP}h. Réponse sous 2{NBSP}heures sur WhatsApp.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={buildWhatsAppUrl('le bac français en candidat libre (session 2027)')}
              target="_blank"
              rel="noopener noreferrer"
              className="lux-cta-reserve inline-flex min-h-[44px] items-center rounded-lg px-6 py-3.5 text-sm font-semibold"
            >
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Écrire sur WhatsApp · {LEGAL.contact.phone}
            </a>
            <Link href="/contact" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-lux-ivory">
              Être rappelé
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-lux-on-dark-muted">
            <MapPin className="h-4 w-4 text-lux-gold-wash" aria-hidden="true" />
            Centre pédagogique — {adresse.full}
          </p>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
