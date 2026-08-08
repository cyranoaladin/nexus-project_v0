import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  assertDocumentStorageReady,
  checkDocumentStorageHealth,
  ensureDocumentStorageReady,
} from '@/lib/documents/storage-health';

/**
 * Garde-fou de cohérence du stockage.
 *
 * Incident à l'origine : `DOCUMENT_STORAGE_ROOT` pointait vers un répertoire
 * vide pendant que dix-neuf fichiers réels — dont des factures nominatives —
 * vivaient à un chemin hérité. Rien ne le signalait ; le téléchargement était
 * cassé en silence pour les familles.
 *
 * Le garde-fou détecte les deux défauts de cette classe : une racine
 * inutilisable, et une racine saine mais **doublée** par des données hors
 * périmètre — le cas exact qui est passé inaperçu.
 */

const ORIGINAL_ROOT = process.env.DOCUMENT_STORAGE_ROOT;
let workspace: string;

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-health-'));
});

afterEach(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
});

afterAll(() => {
  if (ORIGINAL_ROOT === undefined) delete process.env.DOCUMENT_STORAGE_ROOT;
  else process.env.DOCUMENT_STORAGE_ROOT = ORIGINAL_ROOT;
});

function useRoot(relative: string): string {
  const root = path.join(workspace, relative);
  process.env.DOCUMENT_STORAGE_ROOT = root;
  return root;
}

describe('checkDocumentStorageHealth', () => {
  it('est saine quand la racine existe et est accessible en écriture', () => {
    const root = useRoot('documents');
    fs.mkdirSync(root, { recursive: true });

    const health = checkDocumentStorageHealth();
    expect(health.healthy).toBe(true);
    expect(health.problems).toEqual([]);
    expect(health.root).toBe(root);
  });

  it('signale une racine absente', () => {
    useRoot('absent');
    const health = checkDocumentStorageHealth();
    expect(health.healthy).toBe(false);
    expect(health.problems).toContain('ROOT_MISSING');
  });

  it('signale une racine qui est un fichier et non un répertoire', () => {
    const root = useRoot('documents');
    fs.writeFileSync(root, 'x');
    const health = checkDocumentStorageHealth();
    expect(health.healthy).toBe(false);
    expect(health.problems).toContain('ROOT_NOT_A_DIRECTORY');
  });

  it('signale une racine non accessible en écriture', () => {
    const root = useRoot('documents');
    fs.mkdirSync(root, { recursive: true });
    fs.chmodSync(root, 0o500);
    try {
      const health = checkDocumentStorageHealth();
      expect(health.healthy).toBe(false);
      expect(health.problems).toContain('ROOT_NOT_WRITABLE');
    } finally {
      fs.chmodSync(root, 0o700);
    }
  });

  /**
   * Le cœur de l'incident : la racine configurée est saine mais vide, tandis
   * que des fichiers réels dorment à un chemin voisin hérité.
   */
  it('détecte des données hors de la racine canonique', () => {
    const root = useRoot('documents');
    fs.mkdirSync(root, { recursive: true });
    const legacy = path.join(workspace, 'storage', 'documents');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, 'facture-202602-0001.pdf'), 'x');

    const health = checkDocumentStorageHealth();
    expect(health.problems).toContain('DATA_OUTSIDE_ROOT');
    expect(health.dataOutsideRoot[0]).toEqual(
      expect.objectContaining({ path: legacy, fileCount: 1 }),
    );
  });

  it('ne signale pas un chemin hérité vide', () => {
    const root = useRoot('documents');
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(path.join(workspace, 'storage', 'documents'), { recursive: true });

    expect(checkDocumentStorageHealth().problems).not.toContain('DATA_OUTSIDE_ROOT');
  });

  it('ne confond pas la racine avec elle-même quand elle contient des fichiers', () => {
    const root = useRoot('documents');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'legitime.pdf'), 'x');

    const health = checkDocumentStorageHealth();
    expect(health.healthy).toBe(true);
    expect(health.problems).not.toContain('DATA_OUTSIDE_ROOT');
  });
});

describe('assertDocumentStorageReady', () => {
  it('passe silencieusement quand le stockage est sain', () => {
    const root = useRoot('documents');
    fs.mkdirSync(root, { recursive: true });
    expect(() => assertDocumentStorageReady()).not.toThrow();
  });

  it('lève, en nommant le défaut, quand la racine est inutilisable', () => {
    useRoot('absent');
    expect(() => assertDocumentStorageReady()).toThrow(/ROOT_MISSING/);
  });

  /**
   * Des données hors racine sont une alerte, pas une panne : le service doit
   * démarrer et servir les nouveaux dépôts, pendant qu'un humain traite
   * l'héritage.
   */
  it('ne lève pas pour des données hors racine', () => {
    const root = useRoot('documents');
    fs.mkdirSync(root, { recursive: true });
    const legacy = path.join(workspace, 'storage', 'documents');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, 'orphelin.pdf'), 'x');

    expect(() => assertDocumentStorageReady()).not.toThrow();
  });
});

describe('ensureDocumentStorageReady', () => {
  /**
   * Une racine absente n'est pas une panne : c'est le cas normal d'un
   * environnement neuf — checkout de CI, nouvelle machine, premier
   * déploiement. La refuser faisait échouer le démarrage partout sauf en
   * production, ce qui a bloqué Production Build et E2E sur la PR #104.
   */
  it('crée une racine absente au lieu d’échouer', () => {
    const root = useRoot(path.join('creee', 'documents'));
    expect(fs.existsSync(root)).toBe(false);

    const health = ensureDocumentStorageReady();

    expect(fs.existsSync(root)).toBe(true);
    expect(health.healthy).toBe(true);
  });

  it('reste silencieux si la racine existe déjà', () => {
    const root = useRoot('documents');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'garde.pdf'), 'x');

    expect(() => ensureDocumentStorageReady()).not.toThrow();
    // Ne détruit rien de ce qui existe.
    expect(fs.existsSync(path.join(root, 'garde.pdf'))).toBe(true);
  });

  it('échoue quand la racine est occupée par un fichier', () => {
    const root = useRoot('documents');
    fs.writeFileSync(root, 'x');
    expect(() => ensureDocumentStorageReady()).toThrow(/ROOT_NOT_A_DIRECTORY/);
  });

  it('échoue quand la racine ne peut pas être créée', () => {
    const blocker = path.join(workspace, 'bloqueur');
    fs.writeFileSync(blocker, 'x');
    // Un fichier sur le chemin parent rend la création impossible.
    process.env.DOCUMENT_STORAGE_ROOT = path.join(blocker, 'documents');
    expect(() => ensureDocumentStorageReady()).toThrow(/DOCUMENT_STORAGE_UNAVAILABLE/);
  });
});
