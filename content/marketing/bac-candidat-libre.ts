import 'server-only';

import { fmtMontant } from '@/components/premium/format';
import { jourMois, jourMoisHeure, texteEcheancierProse, type CandidatsLibres2027 } from '@/lib/candidats-libres-2027';

export { jourMois, jourMoisHeure };
import { LEGAL } from '@/lib/legal';

/**
 * Textes de la page /bac-candidat-libre (session 2027).
 * Les montants, volumes et dates viennent de pricing.canonical.json, jamais d'ici.
 * Typographie : apostrophe courbe, espace insécable avant « : ; ! ? ».
 */

export const PAGE_PATH = '/bac-candidat-libre';

export const META = {
  title: 'Bac français en candidat libre à Tunis — session 2027 | Nexus Réussite',
  description:
    'Préparer le bac français en candidat libre (candidat individuel) à Tunis, session 2027\u00a0: Première, Terminale ou Bac en 1 an, le soir et le week-end, groupes de 12 au plus, inscription Cyclades accompagnée. Prix publics en TND.',
};

export type QuestionReponse = { question: string; reponse: string };

/**
 * `produitsCourts` : leur grille est adoptée par la direction mais leur régime
 * fiscal n'est pas attesté par le comptable, et le dossier bloque toute offre
 * commerciale ferme sur ce point. Tant qu'il est faux, la question disparaît
 * plutôt que d'être réécrite sans son prix.
 */
export function construireFaq(
  data: CandidatsLibres2027,
  { produitsCourts }: { produitsCourts: boolean },
): QuestionReponse[] {
  const [premiere, terminale, b1a] = data.parcours;
  const tnd = (n: number) => `${fmtMontant(n)} TND`;
  return [
    {
      question: 'Qu’est-ce qu’un candidat libre au bac français ?',
      reponse:
        'Un candidat libre, appelé officiellement candidat individuel, passe le baccalauréat français sans être inscrit dans un lycée du réseau français. Il n’a pas de contrôle continu : toutes les épreuves se jouent à l’examen. En Tunisie, l’inscription se fait sur Cyclades, et les frais d’examen sont réglés à l’Institut français de Tunisie.',
    },
    {
      question: 'Mon enfant peut-il suivre le lycée tunisien et préparer le bac français ?',
      reponse: `Oui, c’est le format de nos parcours : cours après 18 h 30, le samedi et le dimanche, et un stage intensif à chaque vacances scolaires tunisiennes. La charge moyenne est de ${data.emploi_du_temps.charge_moyenne.terminale} en Terminale et de ${data.emploi_du_temps.charge_moyenne.premiere} en Première, jamais plus de ${data.emploi_du_temps.charge_max_hors_stage} hors stage.`,
    },
    {
      question: 'Combien coûte la préparation du bac français en candidat libre à Tunis ?',
      reponse: `Pour la session 2027, chez Nexus Réussite : Première ${tnd(premiere.prix_annuel)} par an, Terminale ${tnd(terminale.prix_annuel)}, Bac en 1 an ${tnd(b1a.prix_annuel)}. Le prix annuel ne change pas avec l’entrée : il est réparti depuis le mois de l’inscription. Pour une inscription en octobre, 9 versements d’octobre à juin (${texteEcheancierProse(premiere.echeancier_9, 9)}, ${texteEcheancierProse(terminale.echeancier_9, 9)} ou ${texteEcheancierProse(b1a.echeancier_9, 9)}) ; pour une inscription en novembre, 8 versements de novembre à juin (${texteEcheancierProse(premiere.echeancier_8, 8)}, ${texteEcheancierProse(terminale.echeancier_8, 8)} ou ${texteEcheancierProse(b1a.echeancier_8, 8)}) ; ou comptant avec ${data.paiement.comptant_remise_pct} % de remise. Sans acompte. S’y ajoutent les frais de dossier et d’accompagnement Cyclades (${tnd(data.frais_dossier.montant)}, offerts pendant certaines périodes en Première et en Terminale) et les frais d’examen de l’Institut français.`,
    },
    {
      question: 'Que se passe-t-il si le groupe n’ouvre pas ?',
      reponse: `Un groupe ouvre à ${data.groupe.ouverture_min} inscrits payants. La décision d’ouverture est prise au plus tard le ${jourMois(data.calendrier.decision_ouverture)}, avant les premiers cours du ${jourMois(data.calendrier.premiers_cours)}. Si le groupe n’ouvre pas, vous êtes intégralement remboursé, frais de dossier compris, sous ${data.groupe.remboursement_jours_ouvres} jours ouvrés.`,
    },
    {
      question: `Pourquoi des groupes de ${data.groupe.max} ?`,
      reponse: `${data.groupe.max} est un maximum. Les copies, les oraux et les bilans restent individuels : en Terminale, ${terminale.copies_corrigees} copies corrigées et un Grand oral blanc rien que pour votre enfant.`,
    },
    {
      question: 'L’EPS et les langues vivantes sont-elles préparées ?',
      reponse: `Non. Nexus Réussite ne prépare pas l’${data.non_prepare.join(' ni les ')}. Ces épreuves restent obligatoires pour le candidat ; nous vous expliquons comment elles se déroulent.`,
    },
    {
      question: 'Quelles spécialités préparez-vous ?',
      reponse: `En Première : ${data.specialites.premiere.join(', ')}. En Terminale : ${data.specialites.terminale.join(' et ')}. Si la spécialité de votre enfant n’y figure pas, écrivez-nous : nous vous dirons honnêtement si nous pouvons l’accompagner.`,
    },
    {
      question: 'Qui fait l’inscription sur Cyclades ?',
      reponse: `L’inscription est personnelle : c’est la famille qui la fait. Nous l’accompagnons étape par étape, en atelier gratuit ou sur WhatsApp, sans jamais nous substituer à l’inscription officielle. Clôture le ${jourMoisHeure(terminale.cyclades.cloture)} (heure de Paris) en Terminale et le ${jourMoisHeure(premiere.cyclades.cloture)} en Première.`,
    },
    {
      question: 'Où ont lieu les cours ?',
      reponse: `Au centre pédagogique Nexus Réussite, ${LEGAL.addresses.pedagogique.full}. Les ateliers Cyclades peuvent aussi se suivre en ligne.`,
    },
    ...(produitsCourts
      ? [
          {
            question: 'Mon enfant est déjà inscrit ailleurs : peut-il suivre un stage seul ?',
            reponse: `Oui, dans la limite des places restantes\u00a0: mono-spécialité, stage intensif ou pack d’épreuves blanches, à partir de ${tnd(Math.min(...data.produits_courts.produits.map((produit) => produit.prix)))}. Il est aussi possible de rejoindre un parcours en cours d’année, aux échéances restantes.`,
          },
        ]
      : []),
  ];
}
