/**
 * Les valeurs opaques — URL, jetons signés — ne traversent JAMAIS une passe
 * de transformation de texte.
 *
 * Défaut réel du 13/08/2026 : le message WhatsApp passait entier (liens
 * inclus) dans `frenchTypography`, dont la notation mathématique convertit
 * `lettre_chiffre` en indice. Un secret base64url `…3U_5zM…` devenait
 * `…3U₅zM…` : « page introuvable » chez le parent. La base était saine —
 * seule la présentation corrompait le jeton.
 *
 * Ces tests verrouillent la chaîne complète : génération (alphabet strict),
 * passe typographique (URL préservées octet par octet), et message WhatsApp
 * (le lien reçu EST le lien signé).
 */

import { randomBytes } from 'node:crypto';

import { frenchTypography, mathNotation } from '@/lib/bilans/render/typography';
import { buildBilanWhatsAppMessage } from '@/lib/bilans/staff/whatsapp-message';

// Des secrets synthétiques générés au runtime couvrant chaque règle
// de transformation : indice (_5), exposant (^2 après lettre/chiffre),
// apostrophe absente de base64url mais présente dans un chemin.
const ADVERSARIAL_SECRETS = [
  `${randomBytes(18).toString('base64url')}_5${randomBytes(12).toString('base64url')}`,
  'a_1b_2c_3d_4e_5f_6g_7h_8i_9j_0',
  'x2_9YZ-aa_0Qq',
  'AAAA____9999----zzzz',
];

describe('frenchTypography — les URL sont opaques', () => {
  it.each(ADVERSARIAL_SECRETS)('préserve octet par octet un lien portant le secret %s', (secret) => {
    const url = `https://nexusreussite.academy/bilan/consultation/cmsric0ej0024mgsunrncueeh.${secret}`;
    const message = `Voici vos accès : ${url} — valables 30 jours. L'équation v_0 = 3^2 reste convertie.`;
    const out = frenchTypography(message);
    expect(out).toContain(url);
    // La prose autour, elle, reste typographiée.
    expect(out).toContain('v₀');
    expect(out).toContain('3²');
    expect(out).toContain('’');
  });

  it('préserve plusieurs URL dans un même texte, dans l’ordre', () => {
    const a = 'https://exemple.fr/a_1/b^2';
    const b = 'https://exemple.fr/autre_5';
    const out = frenchTypography(`Lien parent : ${a} puis lien élève : ${b} !`);
    expect(out.indexOf(a)).toBeGreaterThan(-1);
    expect(out.indexOf(b)).toBeGreaterThan(out.indexOf(a));
  });

  it('reste idempotente avec des URL', () => {
    const once = frenchTypography(`Voir https://exemple.fr/x_1 : c'est prêt !`);
    expect(frenchTypography(once)).toBe(once);
  });

  it('mathNotation seule convertit toujours la prose (non-régression du rendu)', () => {
    expect(mathNotation('v_0 et 3^5')).toBe('v₀ et 3⁵');
  });
});

describe('Message WhatsApp — le lien reçu est le lien signé', () => {
  it.each(ADVERSARIAL_SECRETS)('chaîne complète intacte pour le secret %s', (secret) => {
    const parentLink = `https://nexusreussite.academy/bilan/consultation/lnk1.${secret}`;
    const studentLink = `https://nexusreussite.academy/bilan/consultation/lnk2.${secret}X`;
    const message = buildBilanWhatsAppMessage({
      parentDisplayName: 'Alaeddine Ben Rhouma',
      studentFirstName: 'Kam',
      subjectLabel: 'Mathématiques',
      levelLabel: 'Seconde',
      parentLink,
      studentLink,
      validityDays: 30,
    });
    expect(message).toContain(parentLink);
    expect(message).toContain(studentLink);
  });

  it('le cas synthétique avec _5 survit au message', () => {
    const link = `https://example.test/bilan/consultation/${randomBytes(18).toString('hex')}.${ADVERSARIAL_SECRETS[0]}`;
    const message = buildBilanWhatsAppMessage({
      parentDisplayName: 'Parent',
      studentFirstName: 'Kam',
      subjectLabel: 'Mathématiques',
      levelLabel: 'Seconde',
      parentLink: link,
      studentLink: link,
      validityDays: 30,
    });
    expect(message).toContain(link);
    expect(message).not.toContain('₅');
  });
});

describe('Génération — alphabet strictement base64url', () => {
  it('10 000 secrets générés ne contiennent que [A-Za-z0-9_-]', () => {
    for (let i = 0; i < 10_000; i += 1) {
      expect(randomBytes(32).toString('base64url')).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});
