import 'server-only';

import { fmtPrice } from '@/components/premium/format';
import { construireFaq } from '@/content/marketing/bac-candidat-libre';
import {
  getAteliersCycladesAVenir,
  getCandidatsLibres2027,
  getFraisDossierOffertsActifs,
  getSemaineDiagnostic,
  type ParcoursCandidatLibre,
} from '@/lib/candidats-libres-2027';
import { LEGAL } from '@/lib/legal';

/**
 * /llms.txt et /llms-full.txt (format proposé sur llmstxt.org) : fiche factuelle
 * destinée aux assistants génératifs. Tout est calculé depuis LEGAL et
 * pricing.canonical.json ; les offres datées disparaissent à leur échéance.
 */

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 2026-11-12T18:00:00+01:00 » → « 12 novembre 2026 ». */
function dateLongue(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-').map(Number);
  return `${jour} ${MOIS[mois - 1]} ${annee}`;
}

const tnd = (n: number) => `${fmtPrice(n)} TND`;

function ligneParcours(p: ParcoursCandidatLibre): string {
  return (
    `- **${p.titre}** : ${tnd(p.prix_annuel)} par an — ` +
    `9 mensualités de ${tnd(p.echeancier_9.mensualite)} d’octobre à juin, ou 8 mensualités de ${tnd(p.echeancier_8.mensualite)} de novembre à juin, ` +
    `ou ${tnd(p.comptant)} comptant. ${p.heures_cours} h de cours, ${p.copies_corrigees} copies d’épreuves blanches corrigées, ` +
    `${p.oraux.toLowerCase()}, ${p.bilans} bilans avec la famille. Public : ${p.public}`
  );
}

function blocCandidatsLibres(maintenant: Date): string[] {
  const data = getCandidatsLibres2027();
  const [premiere, terminale] = data.parcours;
  const url = LEGAL.web.url;
  const offres = getFraisDossierOffertsActifs(maintenant);
  const semaine = getSemaineDiagnostic(maintenant);
  const ateliers = getAteliersCycladesAVenir(maintenant);

  return [
    `## Candidats libres (candidats individuels) — session ${data.session}`,
    '',
    ...data.parcours.map(ligneParcours),
    `- Groupes de ${data.groupe.max} places au maximum ; un groupe ouvre à ${data.groupe.ouverture_min} inscrits ; remboursement intégral sous ${data.groupe.confirmation_remboursement_jours} jours si le groupe n’ouvre pas. Sans acompte.`,
    `- Cours le soir et le week-end, compatibles avec une scolarité au lycée tunisien (en moyenne ${data.emploi_du_temps.charge_moyenne.terminale} en Terminale, ${data.emploi_du_temps.charge_moyenne.premiere} en Première), bac blanc aux vacances d’octobre et un stage intensif à chaque vacances.`,
    `- Spécialités préparées : Première ${data.specialites.premiere.join(', ')} ; Terminale ${data.specialites.terminale.join(' et ')}.`,
    `- Non préparé par Nexus Réussite : ${data.non_prepare.join(', ')}. ${data.frais_examen}`,
    `- Inscription à l’examen sur Cyclades, faite par la famille : Terminale du ${dateLongue(terminale.cyclades.ouverture)} au ${dateLongue(terminale.cyclades.cloture)} à 18 h (heure de Paris), Première du ${dateLongue(premiere.cyclades.ouverture)} au ${dateLongue(premiere.cyclades.cloture)} à 18 h. Nexus Réussite accompagne la démarche sans s’y substituer.`,
    ...(ateliers.length > 0 ? [`- Ateliers Cyclades gratuits : ${ateliers.map(dateLongue).join(', ')} à ${data.ateliers_cyclades.heure}, ${data.ateliers_cyclades.lieu}.`] : []),
    ...(semaine
      ? [`- Semaine Diagnostic du ${dateLongue(semaine.du)} au ${dateLongue(semaine.au)} : ${semaine.niveaux.map((n) => `${n.id === 'terminale' ? 'Terminale' : 'Première'} ${tnd(n.prix)}`).join(', ')}, déduite du prix annuel en cas d’inscription avant le ${dateLongue(semaine.deduit_si_inscription_avant)} ; inscriptions jusqu’au ${dateLongue(semaine.inscriptions_jusqu_au)}.`]
      : []),
    ...(offres.length > 0
      ? [`- ${data.frais_dossier.libelle} (${tnd(data.frais_dossier.montant)}) offerts pour une inscription conclue ${offres.map((x) => `jusqu’au ${dateLongue(x.offre.jusqu_au)} en ${x.parcours.niveau}`).join(' et ')}.`]
      : []),
    `- Détail, emploi du temps et contact : [Bac français en candidat libre à Tunis — session ${data.session}](${url}/bac-candidat-libre)`,
  ];
}

function entete(): string[] {
  const centre = LEGAL.addresses.pedagogique;
  return [
    '# Nexus Réussite',
    '',
    `> Nexus Réussite est un centre d’accompagnement au baccalauréat français à Tunis (Tunisie). Il prépare les élèves des lycées du réseau français et les candidats libres (candidats individuels) : cours en petits groupes, épreuves blanches corrigées, bilans avec la famille et inscription Cyclades accompagnée. Centre pédagogique : ${centre.full}. Téléphone et WhatsApp : ${LEGAL.contact.phone}. E-mail : ${LEGAL.contact.email}.`,
    '',
    'Informations factuelles générées à partir des données du site. Prix en dinars tunisiens (TND), par élève.',
    '',
  ];
}

function pagesCles(): string[] {
  const url = LEGAL.web.url;
  return [
    '## Pages clés',
    '',
    `- [Bac français en candidat libre — session 2027](${url}/bac-candidat-libre) : parcours, prix, dates Cyclades, FAQ`,
    `- [Offres et tarifs 2026-2027](${url}/offres) : élèves scolarisés (accompagnement annuel, stages, plateforme ARIA) et candidats libres`,
    `- [Stages intensifs](${url}/stages) : stages pendant les vacances scolaires`,
    `- [Candidat libre : statut, modalités et coefficients](${url}/candidat-libre-bac-francais)`,
    `- [Préparer le bac français à Tunis](${url}/preparation-bac-francais-tunis)`,
    `- [Réussir l’EAF (épreuves anticipées de français)](${url}/reussir-eaf)`,
    `- [Préparer le Grand oral](${url}/grand-oral)`,
    `- [Centre pédagogique](${url}/notre-centre) et [contact](${url}/contact)`,
    '',
  ];
}

function engagements(): string[] {
  return [
    '## Ce que Nexus Réussite ne promet pas',
    '',
    '- Aucun résultat à l’examen n’est promis : Nexus Réussite s’engage sur les moyens (cours, corrections, bilans, suivi), pas sur une note.',
    '- Nexus Réussite n’est pas l’autorité d’examen : l’inscription officielle, la convocation et les frais d’examen relèvent de la famille, de Cyclades, de l’académie et de l’Institut français de Tunisie.',
    '',
  ];
}

export function buildLlmsTxt(maintenant: Date = new Date()): string {
  return [
    ...entete(),
    ...blocCandidatsLibres(maintenant),
    '',
    ...pagesCles(),
    ...engagements(),
    '## Optional',
    '',
    `- [Fiche détaillée (FAQ, emploi du temps, stages à la carte)](${LEGAL.web.url}/llms-full.txt)`,
    '',
  ].join('\n');
}

export function buildLlmsFullTxt(maintenant: Date = new Date()): string {
  const data = getCandidatsLibres2027();
  const edt = data.emploi_du_temps;
  const creneaux = (niveau: 'terminale' | 'premiere') =>
    edt.jours.map((jour, i) => (edt[niveau][i] ? `${jour} ${edt[niveau][i]}` : null)).filter(Boolean).join(', ');

  return [
    ...entete(),
    '## Organisation',
    '',
    `- Raison sociale : ${LEGAL.entity.name}, marque ${LEGAL.entity.tradeName}.`,
    `- Siège social administratif : ${LEGAL.addresses.siege.full}.`,
    `- Centre pédagogique (cours, stages, rendez-vous) : ${LEGAL.addresses.pedagogique.full}.`,
    `- Site : ${LEGAL.web.url}`,
    '',
    ...blocCandidatsLibres(maintenant),
    '',
    `## Détail des parcours candidats libres — session ${data.session}`,
    '',
    ...data.parcours.flatMap((p) => [
      `### ${p.titre}`,
      '',
      `- Prix : ${tnd(p.prix_annuel)} par an ; 9 × ${tnd(p.echeancier_9.mensualite)} (dernière mensualité ${tnd(p.echeancier_9.derniere)}), 8 × ${tnd(p.echeancier_8.mensualite)}, ou ${tnd(p.comptant)} comptant.`,
      `- Volume : ${p.heures_cours} h de cours${p.repartition.length > 0 ? ` (${p.repartition.map((r) => `${r.matiere} ${r.heures} h`).join(', ')})` : ''}.`,
      `- Inclus : ${p.copies_corrigees} copies d’épreuves blanches corrigées, ${p.oraux.toLowerCase()}, ${p.bilans} bilans avec la famille.`,
      `- Créneaux : ${p.creneaux}.`,
      `- Public : ${p.public}`,
      '',
    ]),
    '## Emploi du temps hebdomadaire',
    '',
    `- Terminale : ${creneaux('terminale')}.`,
    `- Première : ${creneaux('premiere')}.`,
    `- Charge maximale hors stage : ${edt.charge_max_hors_stage}.`,
    '',
    '## Stages à la carte',
    '',
    `${data.stages_a_la_carte.note}`,
    ...data.stages_a_la_carte.stages.map((s) => `- ${s.periode}, ${s.niveau} : ${s.heures} h, ${tnd(s.prix)}.`),
    '',
    '## Questions fréquentes sur le bac français en candidat libre',
    '',
    ...construireFaq(data).flatMap((q) => [`### ${q.question}`, '', q.reponse, '']),
    ...pagesCles(),
    ...engagements(),
  ].join('\n');
}
