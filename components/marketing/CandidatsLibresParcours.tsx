import 'server-only';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { fmtMontant } from '@/components/premium/format';
import { getCandidatsLibres2027, getFraisDossier, jourMois, texteEcheancier } from '@/lib/candidats-libres-2027';

const NBSP = ' ';

/** Frais de dossier du parcours : toujours annoncés, avec la date limite tant qu'ils sont offerts. */
export function FraisDossier({ id, maintenant }: { id: Parameters<typeof getFraisDossier>[0]; maintenant: Date }) {
  const frais = getFraisDossier(id, maintenant);
  return (
    <p className="mt-1 text-xs text-lux-slate">
      + frais de dossier et d’accompagnement Cyclades{NBSP}: {fmtMontant(frais.montant)}{NBSP}TND
      {frais.offertJusquAu ? `, offerts jusqu’au ${jourMois(frais.offertJusquAu)}` : ''}
    </p>
  );
}

/**
 * Les trois parcours candidats libres de la session 2027, en cartes compactes.
 * Prix lus dans pricing.canonical.json ; le détail est sur /bac-candidat-libre.
 */
export function CandidatsLibresParcours() {
  const data = getCandidatsLibres2027();
  const maintenant = new Date();
  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        {data.parcours.map((p) => {
          const titreId = `offre-cl-${p.id}`;
          const echeancier = p.echeancier_affiche === 8 ? p.echeancier_8 : p.echeancier_9;
          return (
            <article
              key={p.id}
              aria-labelledby={titreId}
              className="flex flex-col rounded-2xl border border-lux-line bg-lux-white p-6 lux-shadow"
            >
              {/* Le public est nommé sur chaque bloc : deux catalogues cohabitent
                  sur le site, et une famille peut opposer la règle de l'autre. */}
              <p className="text-[11px] font-semibold uppercase tracking-wide text-lux-gold-deep">
                Candidats individuels
              </p>
              <p className="lux-eyebrow mt-1">{p.accroche}</p>
              <h3 id={titreId} className="mt-2 font-fraunces text-xl text-lux-ink">{p.titre}</h3>
              <p className="mt-4 font-fraunces text-3xl font-light tabular-nums text-lux-ink">
                {fmtMontant(echeancier.mensualite)}
                <span className="ml-1 font-body text-sm text-lux-slate">{NBSP}TND / mois</span>
              </p>
              <p className="mt-1 text-sm text-lux-slate">
                {texteEcheancier(echeancier, p.echeancier_affiche)}
                {' · '}{fmtMontant(p.prix_annuel)}{NBSP}TND / an · comptant {fmtMontant(p.comptant)}{NBSP}TND
              </p>
              <FraisDossier id={p.id} maintenant={maintenant} />
              {p.id === 'terminale' ? (
                <p className="mt-3 rounded-lg bg-lux-paper px-3 py-2 text-xs leading-5 text-lux-slate">
                  {data.eligibilite.terminale}
                </p>
              ) : null}
              <p className="mt-4 text-sm leading-6 text-lux-slate">
                {p.heures_cours}{NBSP}h de cours, {p.copies_corrigees} copies corrigées, {p.oraux.toLowerCase()}, {p.bilans} bilans avec la famille.
              </p>
              <Link
                href={`/bac-candidat-libre#${p.id}`}
                className="mt-auto inline-flex min-h-[44px] items-center pt-5 text-sm font-semibold text-lux-gold-deep hover:text-lux-ink lux-focus"
              >
                Détail du parcours {p.niveau}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-sm leading-6 text-lux-slate">
        <strong className="font-semibold text-lux-ink">{data.groupe.max} places au maximum par groupe</strong>, ouverture à{' '}
        {data.groupe.ouverture_min} inscrits, remboursement intégral si le groupe n’ouvre pas. Inscription Cyclades accompagnée.
        Non préparées{NBSP}: {data.non_prepare.join(', ')}. {data.frais_examen}
      </p>
    </>
  );
}
