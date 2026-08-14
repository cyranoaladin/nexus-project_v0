import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Le dossier enseignant est un document interne (vrais noms, profils
 * pédagogiques) : la contrainte SQL anti-NEXUS sur `ReportShareLink` (CHECK
 * en base) reste opposable, mais elle n'est même pas le rempart ici — le
 * document n'est censé être servi QUE par une route staff dédiée, jamais par
 * la chaîne des liens signés destinée aux familles. Ce test le vérifie
 * statiquement : aucun fichier du module dossier enseignant ne référence
 * `ReportShareLink`, et la route qui le sert vérifie le staff avant tout accès.
 */

function readModuleSource(): string {
  // --others --exclude-standard : ce module peut être testé avant d'être commité (branche en cours).
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((file) => (
      file.startsWith('lib/bilans/teacher-dossier/')
      || file === 'lib/bilans/staff/teacher-dossier-service.ts'
      || file === 'app/dashboard/assistante/bilans/teacher-dossier/route.ts'
    ))
    .filter((file) => !/\.test\.[jt]sx?$/.test(file))
    .filter((file) => fs.existsSync(path.join(process.cwd(), file)));
  expect(files.length).toBeGreaterThanOrEqual(4);
  return files.map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')).join('\n');
}

describe('Dossier enseignant — confidentialité et garde-fous', () => {
  it('ne référence jamais la chaîne des liens signés (ReportShareLink)', () => {
    const source = readModuleSource();
    expect(source).not.toMatch(/ReportShareLink/);
    expect(source).not.toMatch(/shareLink/i);
  });

  it('ne rend jamais le document pour une audience ELEVE/PARENTS', () => {
    const source = readModuleSource();
    expect(source).not.toMatch(/'ELEVE'|"ELEVE"/);
    expect(source).not.toMatch(/'PARENTS'|"PARENTS"/);
  });

  it('la route vérifie une session authentifiée avant tout accès aux données', () => {
    const route = fs.readFileSync(
      path.join(process.cwd(), 'app/dashboard/assistante/bilans/teacher-dossier/route.ts'),
      'utf8',
    );
    const authIndex = route.indexOf('await auth()');
    const buildIndex = route.indexOf('buildStaffTeacherDossierDocument(');
    expect(authIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(authIndex);
  });

  it('le service refuse un rôle non-staff avant toute requête Prisma', () => {
    const service = fs.readFileSync(
      path.join(process.cwd(), 'lib/bilans/staff/teacher-dossier-service.ts'),
      'utf8',
    );
    expect(service).toMatch(/isStaffRole/);
    const assertIndex = service.indexOf('assertStaff(input)');
    const findIndex = service.indexOf('await dependencies.findCandidates(');
    expect(assertIndex).toBeGreaterThan(-1);
    expect(findIndex).toBeGreaterThan(assertIndex);
  });

  it('un élève exclu porte toujours une raison explicite, jamais un simple booléen', () => {
    const service = fs.readFileSync(
      path.join(process.cwd(), 'lib/bilans/staff/teacher-dossier-service.ts'),
      'utf8',
    );
    // Chaque site de `excluded.push(...)` doit construire un objet {displayName, reason}.
    const pushSites = service.match(/excluded\.push\(Object\.freeze\(\{[^}]*reason:/g) ?? [];
    expect(pushSites.length).toBeGreaterThanOrEqual(4);
  });
});
