/**
 * Candidats libres — session 2027 (grille v12, groupes de 12).
 * Verrouille la grille, la cohérence des échéanciers et la coupure automatique
 * des offres datées (frais de dossier offerts, Semaine Diagnostic).
 */
import {
  getCandidatsLibres2027,
  getParcoursCandidatLibre,
  getFraisDossier,
  getFraisDossierOfferts,
  getSemaineDiagnostic,
  getEcheancesCyclades,
  type ParcoursCandidatLibre,
} from '@/lib/candidats-libres-2027';

const tunis = (iso: string) => new Date(iso);

test('les données passent par le chargeur canonique lib/pricing.ts', () => {
  const source = require('fs').readFileSync(require('path').join(__dirname, '../../lib/candidats-libres-2027.ts'), 'utf-8');
  expect(source).not.toMatch(/import [^;]*pricing\.canonical\.json/);
  expect(source).toMatch(/from '@\/lib\/pricing'/);
});

describe('Grille 2026-2027', () => {
  const parcours = getParcoursCandidatLibre();

  test('trois parcours, dans l’ordre Première, Terminale, Bac en 1 an', () => {
    expect(parcours.map((p) => p.id)).toEqual(['premiere', 'terminale', 'bac-en-1-an']);
  });

  test.each([
    ['premiere', 5200, 580, 560, 650, 4940],
    ['terminale', 7600, 850, 800, 950, 7220],
    ['bac-en-1-an', 11600, 1290, 1280, 1450, 11020],
  ])('%s : %i TND, 9 × %i (dernière %i), 8 × %i, comptant %i', (id, annuel, m9, derniere, m8, comptant) => {
    const p = getParcoursCandidatLibre(id as ParcoursCandidatLibre['id'])!;
    expect(p.prix_annuel).toBe(annuel);
    expect(p.echeancier_9).toEqual({ mensualite: m9, derniere });
    expect(p.echeancier_8).toEqual({ mensualite: m8, derniere: m8 });
    expect(p.comptant).toBe(comptant);
  });

  test('chaque échéancier totalise exactement le prix annuel', () => {
    for (const p of parcours) {
      expect(p.echeancier_9.mensualite * 8 + p.echeancier_9.derniere).toBe(p.prix_annuel);
      expect(p.echeancier_8.mensualite * 7 + p.echeancier_8.derniere).toBe(p.prix_annuel);
    }
  });

  test('le comptant applique la remise annoncée', () => {
    const remise = getCandidatsLibres2027().paiement.comptant_remise_pct;
    for (const p of parcours) {
      expect(p.comptant).toBe(Math.round(p.prix_annuel * (1 - remise / 100)));
    }
  });

  test('la répartition des heures retombe sur le volume annoncé', () => {
    for (const p of parcours) {
      if (p.repartition.length === 0) continue;
      expect(p.repartition.reduce((total, ligne) => total + ligne.heures, 0)).toBe(p.heures_cours);
    }
  });

  test('volumes, copies et bilans conformes au dossier GO-LIVE', () => {
    expect(parcours.map((p) => p.heures_cours)).toEqual([189, 285, 511]);
    expect(parcours.map((p) => p.copies_corrigees)).toEqual([9, 14, 18]);
    expect(parcours.every((p) => p.bilans === 3)).toBe(true);
  });

  test('la Première affiche l’échéancier en 8 mensualités (décision du 13/10)', () => {
    expect(getParcoursCandidatLibre('premiere')!.echeancier_affiche).toBe(8);
    expect(getParcoursCandidatLibre('terminale')!.echeancier_affiche).toBe(9);
  });

  test('groupes de 12 au maximum, ouverture à 6 inscrits payants', () => {
    const { groupe } = getCandidatsLibres2027();
    expect(groupe.max).toBe(12);
    // Un seuil publié plus haut que le seuil contractuel engagerait Nexus
    // sur le plus exigeant des deux.
    expect(groupe.ouverture_min).toBe(6);
    expect(groupe.remboursement_jours_ouvres).toBe(7);
  });

  test('la décision d’ouverture précède les premiers cours', () => {
    const { calendrier } = getCandidatsLibres2027();
    expect(calendrier.decision_ouverture).toBe('2026-10-25');
    expect(calendrier.premiers_cours).toBe('2026-10-26');
    // Annoncer une confirmation APRÈS le premier cours est la faute que ce
    // garde empêche de revenir.
    expect(new Date(calendrier.decision_ouverture).getTime())
      .toBeLessThan(new Date(calendrier.premiers_cours).getTime());
  });

  test('EPS et langues vivantes déclarées non préparées ; frais d’examen en sus', () => {
    const data = getCandidatsLibres2027();
    expect(data.non_prepare.join(' ')).toMatch(/EPS/);
    expect(data.non_prepare.join(' ')).toMatch(/langue/i);
    expect(data.frais_examen).toMatch(/Institut français/);
  });
});

describe('Frais de dossier offerts — coupure automatique', () => {
  test('montant de 250 TND, offert en Terminale jusqu’au 31/10 inclus', () => {
    expect(getFraisDossierOfferts('terminale', tunis('2026-10-31T23:30:00+01:00'))).toEqual(
      expect.objectContaining({ montant: 250, jusqu_au: '2026-10-31' }),
    );
    expect(getFraisDossierOfferts('terminale', tunis('2026-11-01T00:00:00+01:00'))).toBeNull();
  });

  test('offert en Première jusqu’au 08/11 inclus', () => {
    expect(getFraisDossierOfferts('premiere', tunis('2026-11-08T20:00:00+01:00'))).not.toBeNull();
    expect(getFraisDossierOfferts('premiere', tunis('2026-11-09T00:00:00+01:00'))).toBeNull();
  });

  test('aucune offre de frais pour le Bac en 1 an', () => {
    expect(getFraisDossierOfferts('bac-en-1-an', tunis('2026-10-14T10:00:00+01:00'))).toBeNull();
  });
});

describe('Frais de dossier — toujours annoncés', () => {
  test('Bac en 1 an : 250 TND dus, jamais offerts', () => {
    expect(getFraisDossier('bac-en-1-an', tunis('2026-10-14T10:00:00+01:00'))).toEqual({ montant: 250, offertJusquAu: null });
  });

  test('Terminale : offerts jusqu’au 31/10, dus ensuite', () => {
    expect(getFraisDossier('terminale', tunis('2026-10-20T10:00:00+01:00'))).toEqual({ montant: 250, offertJusquAu: '2026-10-31' });
    expect(getFraisDossier('terminale', tunis('2026-11-02T10:00:00+01:00'))).toEqual({ montant: 250, offertJusquAu: null });
  });
});

describe('Semaine Diagnostic', () => {
  test('ouverte aux inscriptions jusqu’au 23/10 inclus, avec les deux tarifs', () => {
    const avant = getSemaineDiagnostic(tunis('2026-10-23T22:00:00+01:00'))!;
    expect(avant.du).toBe('2026-10-26');
    expect(avant.au).toBe('2026-10-30');
    expect(avant.niveaux.map((n) => [n.id, n.prix])).toEqual([['terminale', 290], ['premiere', 190]]);
    expect(avant.deduit_si_inscription_avant).toBe('2026-11-08');
  });

  test('disparaît une fois les inscriptions closes', () => {
    expect(getSemaineDiagnostic(tunis('2026-10-24T00:00:00+01:00'))).toBeNull();
  });
});

describe('Échéances Cyclades', () => {
  test('Terminale 16/10 → 12/11 18 h, Première 02/11 → 20/11 18 h (heure de Paris)', () => {
    const e = getEcheancesCyclades();
    expect(e.terminale).toEqual({ ouverture: '2026-10-16', cloture: '2026-11-12T18:00:00+01:00' });
    expect(e.premiere).toEqual({ ouverture: '2026-11-02', cloture: '2026-11-20T18:00:00+01:00' });
  });
});

describe('Garde-fous de cohérence — ce qui a déjà produit une faute', () => {
  test('chaque échéancier retombe exactement sur le prix annuel', () => {
    // La faute « 9 × 580 = 5 220 » pour un parcours à 5 200 TND vient d'un
    // échéancier écrit à la main. Ici il est recalculé.
    for (const parcours of getParcoursCandidatLibre()) {
      const neuf = parcours.echeancier_9.mensualite * 8 + parcours.echeancier_9.derniere;
      const huit = parcours.echeancier_8.mensualite * 7 + parcours.echeancier_8.derniere;
      expect(neuf).toBe(parcours.prix_annuel);
      expect(huit).toBe(parcours.prix_annuel);
    }
  });

  test('le comptant applique exactement la remise annoncée', () => {
    const { avantages } = getCandidatsLibres2027();
    for (const parcours of getParcoursCandidatLibre()) {
      const attendu = Math.round(parcours.prix_annuel * (1 - avantages.comptant_remise_pct / 100));
      expect(parcours.comptant).toBe(attendu);
    }
  });

  test('le total encadré dépasse toujours les heures de cours', () => {
    for (const parcours of getParcoursCandidatLibre()) {
      expect(parcours.heures_encadrees_total).toBeGreaterThan(parcours.heures_cours);
    }
  });

  test('la Terminale porte sa condition d’éligibilité', () => {
    const { eligibilite } = getCandidatsLibres2027();
    expect(eligibilite.terminale).toMatch(/épreuves anticipées/i);
  });

  test('les produits courts suivent la grille adoptée, et elle seule', () => {
    const { produits_courts } = getCandidatsLibres2027();
    expect(produits_courts.adoptee_le).toBe('2026-10-16');
    expect(produits_courts.produits.map((p) => p.prix).sort((a, b) => a - b))
      .toEqual([450, 530, 620, 2090, 4070]);
  });
});
