import fs from 'node:fs';
import path from 'node:path';

/**
 * Chemin public vers le bilan diagnostic.
 *
 * Constat à l'origine : la plomberie était complète — le formulaire créait le
 * compte parent, le compte élève et envoyait un lien d'activation qui ouvrait
 * le diagnostic — mais le discours disait d'attendre. Le parent était invité
 * à patienter « sous 24h » alors que tout était déjà en place pour commencer.
 *
 * Amendement 7 (core-family-academic-planning, Task 4) : la soumission
 * publique ne crée plus jamais de compte directement -- elle capture une
 * FamilyRequest qu'un membre du staff qualifie puis convertit. Le discours de
 * la page a été ajusté en conséquence (validation par l'équipe avant l'envoi
 * du lien), sans réintroduire l'attente artificielle d'origine : rien ne
 * promet plus à tort une activation immédiate.
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
  /**
   * Amendement 7 : la soumission publique ne crée plus de compte
   * directement -- elle capture une FamilyRequest, que le staff qualifie et
   * convertit. Si cela cessait d'être vrai, l'invariant central de ce
   * chantier (aucun compte créé sans revue humaine) serait rompu.
   */
  it('capture la demande dans une FamilyRequest, sans créer de compte avant validation staff', () => {
    expect(API).toMatch(/createFamilyRequest/);
    expect(API).not.toMatch(/tx\.user\.create/);
    expect(API).not.toMatch(/tx\.student\.create/);
  });

  // Le bouton promettait « lancer le bilan diagnostic » alors qu'il crée l'espace
  // parent : le bilan démarre après activation de l'enfant. Le libellé dit
  // désormais ce qu'il fait réellement.
  it('annonce ce qu’il fait, plutôt qu’une demande de rappel', () => {
    expect(FORM).toContain('Créer mon espace');
    expect(FORM).not.toContain('Demander mon bilan stratégique gratuit');
  });

  it('n’exige plus les matières : elles se choisissent après activation', () => {
    expect(FORM).not.toContain('Matières concernées');
    expect(FORM).not.toContain('Besoin principal');
  });
});

describe('la confirmation dit au parent qu’il peut commencer', () => {
  it('n’annonce plus une attente de 24 h avant analyse', () => {
    expect(CONFIRMATION).not.toMatch(/Sous 24h/);
    expect(CONFIRMATION).not.toMatch(/prépare votre bilan personnalisé/);
  });

  // La confirmation annonçait que le parent ajouterait son enfant depuis son
  // espace — alors qu'il vient de le déclarer. Elle décrit maintenant l'étape
  // réelle, sans promettre de raccourci : le lien d'activation part à l'enfant.
  it('explique à quoi sert le lien reçu', () => {
    expect(CONFIRMATION).toMatch(/lien d’activation/);
    expect(CONFIRMATION).toMatch(/choisit ses matières/);
    expect(CONFIRMATION).not.toMatch(/ajouter votre enfant depuis votre espace/);
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
