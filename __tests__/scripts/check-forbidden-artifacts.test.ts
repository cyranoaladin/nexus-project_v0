/**
 * Garde-fou des artefacts interdits.
 *
 * Deux propriétés comptent autant que la détection elle-même :
 *
 *  · le rapport d'échec ne doit RIEN révéler du fichier trouvé — l'un des
 *    artefacts visés porte l'identité d'un tiers dans son nom, et un journal de
 *    CI affichant ce nom recréerait l'exposition au moment même où le contrôle
 *    se déclenche ;
 *
 *  · une racine inexploitable doit échouer, jamais passer. Un contrôle mal
 *    ciblé qui répond « 0 candidat, PASS » est pire qu'absent : il rassure.
 *
 * Les fixtures sont synthétiques : ce test n'a besoin d'aucun document réel.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SCANNER = path.join(process.cwd(), 'scripts/security/check-forbidden-artifacts.mjs');

const EXIT_OK = 0;
const EXIT_FORBIDDEN_PRESENT = 1;
const EXIT_SCAN_FAILED = 2;

/** Nom volontairement porteur d'une identité : il ne doit jamais ressortir. */
const SENSITIVE_FILENAME = 'qcm-2025-nom-de-personne-0612345678.pdf';
const FORBIDDEN_CONTENT = 'contenu interdit de fixture';

function gitBlobSha1(content: string): string {
  return createHash('sha1')
    .update(`blob ${Buffer.byteLength(content)}\0`)
    .update(content)
    .digest('hex');
}

let workspace: string;
let manifestPath: string;

beforeEach(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'forbidden-gate-'));
  manifestPath = path.join(workspace, 'manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify({
      version: 'test',
      artifacts: [
        {
          id: 'ART-TEST',
          gitBlobSha1: gitBlobSha1(FORBIDDEN_CONTENT),
          bytes: Buffer.byteLength(FORBIDDEN_CONTENT),
          classification: 'FIXTURE_CLASSIFICATION',
        },
      ],
    }),
  );
});

afterEach(() => {
  try {
    rmSync(workspace, { recursive: true, force: true });
  } catch {
    /* nettoyage best-effort */
  }
});

function runScanner(root: string): { status: number; stdout: string; stderr: string } {
  const result = spawnSync('node', [SCANNER, root, '--manifest', manifestPath], {
    encoding: 'utf-8',
  });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

describe('détection', () => {
  it('signale un artefact interdit, quel que soit son nom de fichier', () => {
    const scanned = path.join(workspace, 'tree');
    mkdirSync(scanned);
    writeFileSync(path.join(scanned, 'renomme-innocemment.pdf'), FORBIDDEN_CONTENT);

    const { status, stdout } = runScanner(scanned);
    expect(status).toBe(EXIT_FORBIDDEN_PRESENT);

    const report = JSON.parse(stdout.split('\n').slice(0, -1).join('\n'));
    expect(report.pass).toBe(false);
    expect(report.matches).toHaveLength(1);
    expect(report.matches[0].artifactId).toBe('ART-TEST');
  });

  it('laisse passer un arbre propre', () => {
    const scanned = path.join(workspace, 'tree');
    mkdirSync(scanned);
    writeFileSync(path.join(scanned, 'document-legitime.pdf'), 'contenu autorisé');

    const { status, stdout } = runScanner(scanned);
    expect(status).toBe(EXIT_OK);
    expect(stdout).toContain('FORBIDDEN_ARTIFACT_GATE=PASS');
  });
});

describe('FORBIDDEN_GATE_PII_IN_STDOUT=0', () => {
  it("ne révèle ni le nom de fichier ni le chemin de l'artefact trouvé", () => {
    const scanned = path.join(workspace, 'tree', 'sous-dossier');
    mkdirSync(scanned, { recursive: true });
    writeFileSync(path.join(scanned, SENSITIVE_FILENAME), FORBIDDEN_CONTENT);

    const { status, stdout, stderr } = runScanner(path.join(workspace, 'tree'));
    expect(status).toBe(EXIT_FORBIDDEN_PRESENT);

    const combined = `${stdout}\n${stderr}`;
    // Ni le nom complet, ni aucun de ses fragments identifiants.
    expect(combined).not.toContain(SENSITIVE_FILENAME);
    expect(combined).not.toContain('nom-de-personne');
    expect(combined).not.toContain('0612345678');
    expect(combined).not.toContain('sous-dossier');
    expect(combined).not.toContain(scanned);

    // Le rapport reste exploitable : identifiant, classification, localisateur.
    const report = JSON.parse(stdout.split('\n').slice(0, -1).join('\n'));
    expect(report.matches[0]).toEqual({
      artifactId: 'ART-TEST',
      classification: 'FIXTURE_CLASSIFICATION',
      locatorDigest: expect.stringMatching(/^[a-f0-9]{16}$/),
    });
    expect(Object.keys(report.matches[0])).not.toContain('path');
  });

  it('produit un localisateur stable entre deux exécutions', () => {
    const scanned = path.join(workspace, 'tree');
    mkdirSync(scanned);
    writeFileSync(path.join(scanned, SENSITIVE_FILENAME), FORBIDDEN_CONTENT);

    const first = JSON.parse(runScanner(scanned).stdout.split('\n').slice(0, -1).join('\n'));
    const second = JSON.parse(runScanner(scanned).stdout.split('\n').slice(0, -1).join('\n'));
    expect(first.matches[0].locatorDigest).toBe(second.matches[0].locatorDigest);
  });
});

describe('SCAN_ROOT_FAIL_CLOSED', () => {
  it('échoue si la racine demandée est absente', () => {
    const { status, stdout } = runScanner(path.join(workspace, 'inexistant'));
    expect(status).toBe(EXIT_SCAN_FAILED);
    expect(stdout).toContain('SCAN_ROOT_MISSING');
  });

  it("échoue si la racine n'est pas un répertoire", () => {
    const file = path.join(workspace, 'fichier.txt');
    writeFileSync(file, 'x');
    const { status, stdout } = runScanner(file);
    expect(status).toBe(EXIT_SCAN_FAILED);
    expect(stdout).toContain('SCAN_ROOT_NOT_A_DIRECTORY');
  });

  it('échoue si un emplacement devient illisible pendant le parcours', () => {
    const scanned = path.join(workspace, 'tree');
    const locked = path.join(scanned, 'verrouille');
    mkdirSync(locked, { recursive: true });
    chmodSync(locked, 0o000);

    const { status, stdout } = runScanner(scanned);
    // Sous un utilisateur qui ignore les permissions (root), le répertoire reste
    // lisible : l'invariant testé est alors trivialement satisfait.
    if (status === EXIT_OK) {
      chmodSync(locked, 0o755);
      expect(stdout).toContain('FORBIDDEN_ARTIFACT_GATE=PASS');
      return;
    }
    chmodSync(locked, 0o755);
    expect(status).toBe(EXIT_SCAN_FAILED);
    expect(stdout).toContain('SCAN_TRAVERSAL_FAILED');
  });

  it('échoue si le manifeste de politique est illisible', () => {
    const scanned = path.join(workspace, 'tree');
    mkdirSync(scanned);
    const result = spawnSync(
      'node',
      [SCANNER, scanned, '--manifest', path.join(workspace, 'absent.json')],
      { encoding: 'utf-8' },
    );
    expect(result.status).toBe(EXIT_SCAN_FAILED);
    expect(result.stdout).toContain('POLICY_MANIFEST_UNREADABLE');
  });

  it('ne confond jamais « rien trouvé » et « rien vérifié »', () => {
    // Le cœur du finding : une racine mal ciblée ne doit pas ressembler à un
    // artefact propre.
    const missing = runScanner(path.join(workspace, 'mal-cible'));
    expect(missing.status).not.toBe(EXIT_OK);
    expect(missing.stdout).not.toContain('FORBIDDEN_ARTIFACT_GATE=PASS');
  });


  it('échoue fermé sur une racine vide plutôt que de rendre un PASS convaincant', () => {
    // Un répertoire vide et un arbre propre produisent tous deux zéro
    // correspondance. Les distinguer est le seul moyen de repérer un contrôle
    // pointé au mauvais endroit — un build qui n'a jamais produit .next, par
    // exemple, dont le PASS serait sinon indiscernable.
    const emptyRoot = path.join(workspace, 'racine-vide');
    mkdirSync(emptyRoot);

    const { status, stdout } = runScanner(emptyRoot);

    expect(status).toBe(EXIT_SCAN_FAILED);
    expect(stdout).toContain('SCAN_ROOT_EMPTY');
    expect(stdout).toContain('"pass": false');
  });

  it('rapporte le nombre de fichiers parcourus, pour que le PASS soit vérifiable', () => {
    const scanned = path.join(workspace, 'tree');
    mkdirSync(scanned);
    writeFileSync(path.join(scanned, 'a.txt'), 'a');
    writeFileSync(path.join(scanned, 'b.txt'), 'bb');

    const { status, stdout } = runScanner(scanned);
    expect(status).toBe(EXIT_OK);

    // Le rapport JSON est suivi d'une ligne de synthèse : on ne garde que
    // l'objet, jusqu'à son accolade fermante en début de ligne.
    const report = JSON.parse(stdout.slice(0, stdout.indexOf('\n}') + 2));
    expect(report.pass).toBe(true);
    expect(report.filesScanned).toBe(2);
  });
});
