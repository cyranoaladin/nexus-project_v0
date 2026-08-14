import fs from 'node:fs';
import path from 'node:path';

/**
 * Après une réinitialisation de mot de passe réussie, aucune session
 * préexistante ne doit subsister.
 *
 * Incident du 14/08/2026 : une personne réinitialise le mot de passe du compte
 * assistante depuis un navigateur où la session d'un compte PARENT était restée
 * ouverte. La réinitialisation visait bien le bon compte (vérifié en base), mais
 * l'écran de succès laissait la session étrangère active : la personne s'est
 * retrouvée sur l'autre compte et a cru à une fuite entre comptes.
 *
 * Sur un poste partagé, c'en serait une.
 */
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('réinitialisation de mot de passe — pas de session étrangère résiduelle', () => {
  const source = read('app/auth/reset-password/page.tsx');

  it('déconnecte la session en cours quand la réinitialisation réussit', () => {
    expect(source).toContain('signOut');
    const successBranch = source.slice(
      source.indexOf('if (response.ok && data.success)'),
      source.indexOf('setIsSuccess(true)'),
    );
    expect(successBranch).toContain('signOut');
  });

  it('renvoie vers la connexion plutôt que vers un tableau de bord', () => {
    expect(source).toContain('/auth/signin');
  });
});
