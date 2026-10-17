import { readFileSync } from 'fs';
import { join } from 'path';

import {
  ATELIERS,
  ateliersOuverts,
  erreursDemande,
  messageDemande,
  type DemandeAtelier,
} from '@/lib/ateliers';

/**
 * Ateliers gratuits au centre (17/10/2026) : la page /ateliers rédige une demande que le
 * parent envoie lui-même sur WhatsApp. Rien n'est stocké par le site.
 */
const AVANT = new Date('2026-10-19T12:00:00+01:00');

const demande = (champs: Partial<DemandeAtelier> = {}): DemandeAtelier => ({
  atelierId: 'A2', parent: 'Parent Test', telephone: '22 123 456', email: 'parent@example.test',
  eleve: 'Sami', classe: '4ème année', lycee: '', ville: 'Ariana', personnes: '2',
  attentes: 'Quelle partie choisir ?', source: 'Facebook', accord: true, ...champs,
});

describe('Ateliers gratuits — dates et filtrage', () => {
  it('neuf ateliers, du 20 au 30 octobre, jamais un jeudi', () => {
    expect(ATELIERS).toHaveLength(9);
    for (const a of ATELIERS) {
      const d = new Date(a.debut);
      expect(d >= new Date('2026-10-20T00:00:00+01:00') && d <= new Date('2026-10-31T00:00:00+01:00')).toBe(true);
      expect(d.getUTCDay()).not.toBe(4);
    }
  });

  it('propose à chaque classe la partie qui la concerne', () => {
    const ids = (classe: DemandeAtelier['classe']) => ateliersOuverts(AVANT, classe).map((a) => a.theme);
    expect(ids('2ème année')).not.toContain('2P');
    expect(ids('4ème année')).not.toContain('1P');
    expect(ids('3ème année')).toHaveLength(9);
  });

  it('un atelier commencé n’est plus proposé', () => {
    const apresA1 = new Date('2026-10-20T18:31:00+01:00');
    expect(ateliersOuverts(apresA1).map((a) => a.id)).not.toContain('A1');
    expect(ateliersOuverts(new Date('2026-10-31T00:00:00+01:00'))).toHaveLength(0);
  });
});

describe('Ateliers gratuits — demande WhatsApp', () => {
  it('une demande complète ne signale rien et porte toutes les données utiles', () => {
    expect(erreursDemande(demande(), AVANT)).toEqual([]);
    const m = messageDemande(demande());
    for (const attendu of ['INSCRIPTION ATELIER GRATUIT', 'Mercredi 21/10 · 18 h 30', '(A2)', 'Parent : Parent Test',
      'Téléphone : 22 123 456', 'E-mail : parent@example.test', 'Élève : Sami — 4ème année', 'Ville : Ariana',
      'Personnes : 2', 'Attentes : Quelle partie choisir ?', 'Source : Facebook']) {
      expect(m).toContain(attendu);
    }
  });

  it('refuse un atelier qui ne correspond pas à la classe, un e-mail invalide et l’absence d’accord', () => {
    expect(erreursDemande(demande({ classe: '2ème année' }), AVANT)).toContain("l'atelier");
    expect(erreursDemande(demande({ email: 'parent' }), AVANT)).toContain('un e-mail valide');
    expect(erreursDemande(demande({ accord: false }), AVANT)).toContain("l'accord pour être recontacté(e)");
  });

  it('le formulaire passe par lib/whatsapp et n’écrit aucun lien wa.me lui-même', () => {
    const source = readFileSync(join(process.cwd(), 'components/ateliers/AtelierInscriptionForm.tsx'), 'utf-8');
    expect(source).toContain('buildWhatsAppUrl(messageDemande(d), { exactMessage: true })');
    expect(source).not.toMatch(/wa\.me\//);
  });
});
