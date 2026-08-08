import fs from 'node:fs';
import path from 'node:path';

/**
 * Chemin public vers le bilan diagnostic.
 *
 * Constat à l'origine : la plomberie était complète — le formulaire crée le
 * compte parent, le compte élève et envoie un lien d'activation qui ouvre le
 * diagnostic — mais le discours disait d'attendre. Le parent était invité à
 * patienter « sous 24h » alors que tout était déjà en place pour commencer.
 *
 * Ces tests portent sur ce que la page **promet**, parce que c'est là qu'était
 * le défaut. Ils ne vérifient pas une mise en forme : ils vérifient qu'on ne
 * redit pas au parent d'attendre, et qu'on ne casse pas la reprise de contact
 * qui alimente les leads.
 */

const ROOT = process.cwd();
const CONFIRMATION = fs.readFileSync(
  path.join(ROOT, 'app/bilan-gratuit/confirmation/page.tsx'), 'utf8',
);
const FORM = fs.readFileSync(
  path.join(ROOT, 'app/bilan-gratuit/BilanStrategiqueClient.tsx'), 'utf8',
);
const API = fs.readFileSync(path.join(ROOT, 'app/api/bilan-gratuit/route.ts'), 'utf8');

describe('le formulaire ouvre réellement le diagnostic', () => {
  /** Si cela cessait d'être vrai, tout le discours ci-dessous deviendrait mensonger. */
  it('crée bien le compte parent, le compte élève et l’activation', () => {
    expect(API).toMatch(/user\.create/);
    expect(API).toMatch(/student\.create/);
    expect(API).toMatch(/activationToken/);
  });

  it('annonce ce qu’il fait, plutôt qu’une demande de rappel', () => {
    expect(FORM).toContain('lancer le bilan diagnostic');
    expect(FORM).not.toContain('Demander mon bilan stratégique gratuit');
  });
});

describe('la confirmation dit au parent qu’il peut commencer', () => {
  it('n’annonce plus une attente de 24 h avant analyse', () => {
    expect(CONFIRMATION).not.toMatch(/Sous 24h/);
    expect(CONFIRMATION).not.toMatch(/prépare votre bilan personnalisé/);
  });

  it('explique à quoi sert le lien reçu', () => {
    expect(CONFIRMATION).toMatch(/lien d’activation/);
    expect(CONFIRMATION).toMatch(/mot de passe/);
    expect(CONFIRMATION).toMatch(/bilan diagnostic en ligne/);
  });

  it('indique que l’enfant peut passer son bilan sans attendre', () => {
    expect(CONFIRMATION).toMatch(/sans attendre/);
  });
});

describe('non-régression du lead-gen', () => {
  /** Le formulaire alimente aussi les leads : le rappel conseiller doit subsister. */
  it('conserve la création de lead', () => {
    expect(API).toMatch(/contactLead\.create/);
  });

  it('continue d’annoncer une reprise de contact par un conseiller', () => {
    expect(CONFIRMATION).toMatch(/conseiller/i);
  });

  it('conserve le point d’entrée public du formulaire', () => {
    expect(fs.existsSync(path.join(ROOT, 'app/bilan-gratuit/page.tsx'))).toBe(true);
  });
});
