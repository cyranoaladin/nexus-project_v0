/**
 * readInvoicePDF — confinement canonique (realpath + path.relative).
 *
 * Tests sur système de fichiers réel : le guard précédent comparait des
 * préfixes de chaînes sans realpath ni séparateur final, ce qui laissait
 * passer un répertoire voisin (data/invoices-evil) et les symlinks
 * sortants. Ces tests verrouillent la fermeture des deux brèches.
 */
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let testDir: string;
let storageDir: string;

async function loadStorage() {
  let mod: typeof import('@/lib/invoice/storage');
  jest.isolateModules(() => {
    mod = require('@/lib/invoice/storage');
  });
  return mod!;
}

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'nexus-invoice-containment-'));
  storageDir = join(testDir, 'invoices');
  await mkdir(storageDir, { recursive: true });
  await writeFile(join(storageDir, 'facture_ok.pdf'), '%PDF-1.4 ok');

  // Répertoire voisin partageant le préfixe : /…/invoices-evil
  await mkdir(`${storageDir}-evil`, { recursive: true });
  await writeFile(join(`${storageDir}-evil`, 'trick.pdf'), 'tricked');

  // Fichier hors racine + symlink interne pointant dessus
  await writeFile(join(testDir, 'outside.pdf'), 'outside');
  await symlink(join(testDir, 'outside.pdf'), join(storageDir, 'escape-link.pdf'));

  process.env.INVOICE_STORAGE_DIR = storageDir;
});

afterAll(async () => {
  delete process.env.INVOICE_STORAGE_DIR;
  await rm(testDir, { recursive: true, force: true });
});

describe('readInvoicePDF containment', () => {
  it('lit un PDF légitime sous la racine', async () => {
    const { readInvoicePDF } = await loadStorage();
    const buffer = await readInvoicePDF(join(storageDir, 'facture_ok.pdf'));
    expect(buffer.toString()).toContain('%PDF');
  });

  it('rejette un répertoire voisin partageant le préfixe (invoices-evil)', async () => {
    const { readInvoicePDF } = await loadStorage();
    await expect(readInvoicePDF(join(`${storageDir}-evil`, 'trick.pdf')))
      .rejects.toThrow('outside storage directory');
  });

  it('rejette un symlink interne qui sort de la racine', async () => {
    const { readInvoicePDF } = await loadStorage();
    await expect(readInvoicePDF(join(storageDir, 'escape-link.pdf')))
      .rejects.toThrow('outside storage directory');
  });

  it('rejette une traversée ../', async () => {
    const { readInvoicePDF } = await loadStorage();
    await expect(readInvoicePDF(join(storageDir, '..', 'outside.pdf')))
      .rejects.toThrow('outside storage directory');
  });

  it('rejette un chemin absolu hors racine', async () => {
    const { readInvoicePDF } = await loadStorage();
    await expect(readInvoicePDF('/etc/passwd')).rejects.toThrow();
  });

  it('rejette la racine elle-même comme cible', async () => {
    const { readInvoicePDF } = await loadStorage();
    await expect(readInvoicePDF(storageDir)).rejects.toThrow('outside storage directory');
  });
});
