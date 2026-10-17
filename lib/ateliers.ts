/**
 * Ateliers gratuits d'information au centre (20 → 30 octobre 2026).
 *
 * Source unique de la page /ateliers. Les dates ont été arrêtées par la direction le
 * 17 octobre 2026, en dehors de ses propres cours ; les salles sont confirmées. Aucune
 * donnée de famille n'est stockée par le site : la demande est rédigée ici puis envoyée
 * par le parent lui-même sur WhatsApp.
 */

export type ThemeAtelier = '1P' | '2P' | 'MIX';
export type ClasseTunisienne = '2ème année' | '3ème année' | '4ème année' | 'Autre situation';

export const CLASSES: readonly ClasseTunisienne[] = ['2ème année', '3ème année', '4ème année', 'Autre situation'];

export const THEMES: Record<ThemeAtelier, { titre: string; classes: readonly ClasseTunisienne[] }> = {
  '1P': { titre: '1ère partie du bac français', classes: ['2ème année', '3ème année'] },
  '2P': { titre: '2ème partie du bac français', classes: ['3ème année', '4ème année'] },
  MIX: { titre: '1ère et 2ème partie', classes: ['2ème année', '3ème année', '4ème année'] },
};

export type Atelier = {
  id: string;
  /** Début, heure de Tunis (UTC+1, sans changement d'heure). */
  debut: string;
  jour: string;
  heure: string;
  theme: ThemeAtelier;
};

export const PLACES_PAR_ATELIER = 15;
export const DUREE_MINUTES = 60;

export const ATELIERS: readonly Atelier[] = [
  { id: 'A1', debut: '2026-10-20T18:30:00+01:00', jour: 'Mardi 20/10', heure: '18 h 30', theme: '1P' },
  { id: 'A2', debut: '2026-10-21T18:30:00+01:00', jour: 'Mercredi 21/10', heure: '18 h 30', theme: '2P' },
  { id: 'A3', debut: '2026-10-24T10:00:00+01:00', jour: 'Samedi 24/10', heure: '10 h', theme: '2P' },
  { id: 'A4', debut: '2026-10-24T16:00:00+01:00', jour: 'Samedi 24/10', heure: '16 h', theme: '1P' },
  { id: 'A5', debut: '2026-10-25T11:00:00+01:00', jour: 'Dimanche 25/10', heure: '11 h', theme: 'MIX' },
  { id: 'A6', debut: '2026-10-26T18:30:00+01:00', jour: 'Lundi 26/10', heure: '18 h 30', theme: '2P' },
  { id: 'A7', debut: '2026-10-27T18:30:00+01:00', jour: 'Mardi 27/10', heure: '18 h 30', theme: '1P' },
  { id: 'A8', debut: '2026-10-28T18:30:00+01:00', jour: 'Mercredi 28/10', heure: '18 h 30', theme: '2P' },
  { id: 'A9', debut: '2026-10-30T18:00:00+01:00', jour: 'Vendredi 30/10', heure: '18 h', theme: 'MIX' },
];

/** Ateliers pas encore commencés, éventuellement filtrés par la classe de l'élève. */
export function ateliersOuverts(maintenant: Date, classe?: ClasseTunisienne | ''): Atelier[] {
  return ATELIERS.filter((a) => new Date(a.debut).getTime() > maintenant.getTime()
    && (!classe || classe === 'Autre situation' || THEMES[a.theme].classes.includes(classe)));
}

export type DemandeAtelier = {
  atelierId: string;
  parent: string;
  telephone: string;
  email: string;
  eleve: string;
  classe: ClasseTunisienne | '';
  lycee: string;
  ville: string;
  personnes: string;
  attentes: string;
  source: string;
  accord: boolean;
};

/** Champs manquants ou invalides, dans l'ordre du formulaire ; vide si la demande est complète. */
export function erreursDemande(d: DemandeAtelier, maintenant: Date): string[] {
  const erreurs: string[] = [];
  if (!d.parent.trim()) erreurs.push('votre nom');
  if (!/^\+?[\d\s.-]{8,}$/.test(d.telephone.trim())) erreurs.push('un téléphone valide');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) erreurs.push('un e-mail valide');
  if (!d.eleve.trim()) erreurs.push("le prénom de l'élève");
  if (!d.classe) erreurs.push('la classe');
  if (!d.ville.trim()) erreurs.push('la ville');
  if (!ateliersOuverts(maintenant, d.classe).some((a) => a.id === d.atelierId)) erreurs.push("l'atelier");
  if (!d.accord) erreurs.push("l'accord pour être recontacté(e)");
  return erreurs;
}

/** Message WhatsApp envoyé par le parent : tout ce dont l'équipe a besoin pour confirmer. */
export function messageDemande(d: DemandeAtelier): string {
  const a = ATELIERS.find((x) => x.id === d.atelierId);
  if (!a) throw new Error('ATELIER_INCONNU');
  return [
    'INSCRIPTION ATELIER GRATUIT',
    `Atelier : ${a.jour} · ${a.heure} — ${THEMES[a.theme].titre} (${a.id})`,
    `Parent : ${d.parent.trim()}`,
    `Téléphone : ${d.telephone.trim()}`,
    `E-mail : ${d.email.trim()}`,
    `Élève : ${d.eleve.trim()} — ${d.classe}${d.lycee.trim() ? `, ${d.lycee.trim()}` : ''}`,
    `Ville : ${d.ville.trim()}`,
    `Personnes : ${d.personnes}`,
    `Attentes : ${d.attentes.trim() || '—'}`,
    `Source : ${d.source}`,
  ].join('\n');
}
