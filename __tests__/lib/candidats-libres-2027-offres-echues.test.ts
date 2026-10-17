/**
 * Une offre datée ne survit pas à son échéance.
 *
 * Les frais de dossier sont offerts jusqu'au 31/10 en Terminale et jusqu'au
 * 08/11 en Première. Au 1er novembre, une surface qui annonce encore
 * « offerts jusqu'au 31/10 » sert une offre échue ; au 9 novembre, les deux
 * le sont. C'est la classe de problème que `entreeEnCours()` a réglée pour
 * l'échéancier : la mention doit s'effacer d'elle-même, pas attendre qu'on y
 * pense.
 *
 * Ce garde n'existe pas pour constater que la coupure fonctionne aujourd'hui,
 * mais pour qu'une surface ajoutée demain ne recopie pas la date à la main.
 */
import { construireFaq } from '@/content/marketing/bac-candidat-libre';
import {
  getALaUneCandidatsLibres,
  getCandidatsLibres2027,
  getFraisDossierOffertsActifs,
  getParcoursCandidatLibre,
} from '@/lib/candidats-libres-2027';
import { buildLlmsFullTxt, buildLlmsTxt } from '@/lib/llms-txt';

const data = getCandidatsLibres2027();

/**
 * Les surfaces qui NOMMENT une date d'offre. La FAQ en est absente à dessein :
 * elle parle de « périodes » sans les dater, et son propre garde est plus bas.
 */
function surfaces(maintenant: Date): Record<string, string> {
  return {
    'llms.txt': buildLlmsTxt(maintenant),
    'llms-full.txt': buildLlmsFullTxt(maintenant),
    'accueil — à la une': JSON.stringify(getALaUneCandidatsLibres(maintenant) ?? {}),
  };
}

/** La FAQ, en un seul texte, telle que la page et llms.txt la servent. */
function faq(maintenant: Date): string {
  return construireFaq(data, {
    produitsCourts: false,
    fraisOfferts: getFraisDossierOffertsActifs(maintenant).length > 0,
  })
    .map((q) => `${q.question} ${q.reponse}`)
    .join(' ');
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Les deux écritures d'une date dans nos surfaces : « 31/10 » et « 31 octobre 2026 ». */
function ecrituresDeLaDate(iso: string): string[] {
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  return [`${jour}/${mois}`, `${Number(jour)} ${MOIS[Number(mois) - 1]} ${annee}`];
}

/** « offerts … jusqu'au 31/10 » : une date présentée comme une offre qui court. */
function offreDateePresentee(texte: string, iso: string): boolean {
  return ecrituresDeLaDate(iso).some(
    (date) =>
      new RegExp(`offert[^.]{0,140}${date}`, 'i').test(texte)
      || new RegExp(`${date}[^.]{0,140}offert`, 'i').test(texte),
  );
}

const AU = (iso: string) => new Date(iso);

describe('Frais de dossier offerts — la mention s’efface à l’échéance', () => {
  test('les deux offres ont bien une date limite dans la source', () => {
    expect(getParcoursCandidatLibre('terminale')!.frais_dossier_offerts_jusqu_au).toBe('2026-10-31');
    expect(getParcoursCandidatLibre('premiere')!.frais_dossier_offerts_jusqu_au).toBe('2026-11-08');
    expect(getParcoursCandidatLibre('bac-en-1-an')!.frais_dossier_offerts_jusqu_au).toBeNull();
  });

  // Contrôle positif : sans lui, un garde qui ne trouve jamais rien passe aussi
  // quand la mention a disparu par erreur.
  test('le 14/10, les deux dates SONT annoncées — le garde sait voir', () => {
    for (const [nom, texte] of Object.entries(surfaces(AU('2026-10-14T10:00:00+01:00')))) {
      expect(`${nom}: ${offreDateePresentee(texte, '2026-10-31')}`).toBe(`${nom}: true`);
    }
  });

  test('le 01/11, l’offre Terminale est échue et n’est plus annoncée nulle part', () => {
    for (const [nom, texte] of Object.entries(surfaces(AU('2026-11-01T08:00:00+01:00')))) {
      expect(`${nom}: ${offreDateePresentee(texte, '2026-10-31')}`).toBe(`${nom}: false`);
      // Celle de Première court encore : elle, on l'attend.
      expect(`${nom}: ${offreDateePresentee(texte, '2026-11-08')}`).toBe(`${nom}: true`);
    }
  });

  test('le 09/11, les deux sont échues et aucune surface n’annonce plus d’offre', () => {
    const maintenant = AU('2026-11-09T08:00:00+01:00');
    for (const [nom, texte] of Object.entries(surfaces(maintenant))) {
      for (const iso of ['2026-10-31', '2026-11-08']) {
        expect(`${nom}: ${offreDateePresentee(texte, iso)}`).toBe(`${nom}: false`);
      }
    }
    expect(getALaUneCandidatsLibres(maintenant)!.offre).toBeNull();
    expect(getFraisDossierOffertsActifs(maintenant)).toEqual([]);
  });

  test('le 09/11, la FAQ ne promet plus de période d’offre au présent', () => {
    const echu = faq(AU('2026-11-09T08:00:00+01:00'));
    expect(echu).not.toMatch(/offerts pendant certaines périodes/i);
    // Les frais restent annoncés : ils sont dus, pas effacés.
    expect(echu).toContain(`${data.frais_dossier.montant}`);
    const courant = faq(AU('2026-10-14T10:00:00+01:00'));
    expect(courant).toMatch(/offerts pendant certaines périodes/i);
  });

  test('aucune date d’offre n’est écrite en dur dans une surface', () => {
    const dates = data.parcours
      .map((p) => p.frais_dossier_offerts_jusqu_au)
      .filter((d): d is string => Boolean(d));
    for (const chemin of [
      'app/bac-candidat-libre/page.tsx',
      'components/marketing/CandidatsLibresParcours.tsx',
      'components/marketing/CandidatsLibresALaUne.tsx',
      'content/marketing/bac-candidat-libre.ts',
      'lib/llms-txt.ts',
    ]) {
      const source = require('fs').readFileSync(require('path').join(process.cwd(), chemin), 'utf8');
      for (const iso of dates) {
        for (const ecriture of ecrituresDeLaDate(iso)) expect(source).not.toContain(ecriture);
        expect(source).not.toContain(iso);
      }
    }
  });
});
