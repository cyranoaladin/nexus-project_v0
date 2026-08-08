import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  TOMBSTONE_REASON,
  isFileMissing,
  tombstoneDeadReferences,
} from '@/scripts/documents/tombstone-dead-references';

/**
 * Le tombstone est une écriture sur données de production : il doit être sûr
 * en simulation, et ne marquer que ce qui est réellement introuvable.
 *
 * Il juge sur le **même critère de résolution** que le téléchargement — sinon
 * il marquerait indisponible un fichier que la route sait servir, ou
 * l'inverse.
 */

const ORIGINAL_ROOT = process.env.DOCUMENT_STORAGE_ROOT;
let workspace: string;
let root: string;

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tombstone-'));
  root = path.join(workspace, 'documents');
  fs.mkdirSync(root, { recursive: true });
  process.env.DOCUMENT_STORAGE_ROOT = root;
});

afterEach(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
});

afterAll(() => {
  if (ORIGINAL_ROOT === undefined) delete process.env.DOCUMENT_STORAGE_ROOT;
  else process.env.DOCUMENT_STORAGE_ROOT = ORIGINAL_ROOT;
});

describe('isFileMissing', () => {
  it('voit un fichier présent, référencé en relatif', () => {
    fs.writeFileSync(path.join(root, 'present.pdf'), 'x');
    expect(isFileMissing('present.pdf', root)).toBe(false);
  });

  it('voit un fichier présent, référencé en absolu', () => {
    const absolute = path.join(root, 'present.pdf');
    fs.writeFileSync(absolute, 'x');
    expect(isFileMissing(absolute, root)).toBe(false);
  });

  it('résout le préfixe hérité /app/storage/documents/', () => {
    fs.writeFileSync(path.join(root, 'legacy.pdf'), 'x');
    expect(isFileMissing('/app/storage/documents/legacy.pdf', root)).toBe(false);
  });

  it.each([
    ['un chemin absent', 'absent.pdf'],
    ['un chemin Docker mort', '/app/data/invoices/facture_202604-0002.pdf'],
    ['un sous-dossier inexistant', 'storage/documents/dossier/fichier.pdf'],
    ['une chaîne vide', ''],
    ['une URL distante', 'https://example.test/facture.pdf'],
    ['null', null],
  ])('considère %s comme introuvable', (_label, value) => {
    expect(isFileMissing(value, root)).toBe(true);
  });
});

type Row = { id: string; localPath?: string | null; pdfPath?: string | null };

function fakePrisma(documents: Row[], invoices: Row[]) {
  const documentUpdates: string[] = [];
  const invoiceUpdates: string[] = [];
  return {
    client: {
      userDocument: {
        findMany: async () => documents,
        updateMany: async ({ where, data }: any) => {
          documentUpdates.push(...where.id.in);
          expect(data.unavailableReason).toBe(TOMBSTONE_REASON);
          return { count: where.id.in.length };
        },
      },
      invoice: {
        findMany: async () => invoices,
        updateMany: async ({ where, data }: any) => {
          invoiceUpdates.push(...where.id.in);
          expect(data.pdfPath).toBeNull();
          return { count: where.id.in.length };
        },
      },
    } as never,
    documentUpdates,
    invoiceUpdates,
  };
}

describe('tombstoneDeadReferences', () => {
  it('n’écrit rien en simulation', async () => {
    const fake = fakePrisma(
      [{ id: 'doc_dead', localPath: 'absent.pdf' }],
      [{ id: 'inv_dead', pdfPath: '/app/data/invoices/absent.pdf' }],
    );
    const report = await tombstoneDeadReferences(fake.client, { apply: false });

    expect(report.applied).toBe(false);
    expect(report.documentsTombstoned).toBe(1);
    expect(report.invoicesTombstoned).toBe(1);
    expect(fake.documentUpdates).toEqual([]);
    expect(fake.invoiceUpdates).toEqual([]);
  });

  it('ne marque que les références réellement introuvables', async () => {
    fs.writeFileSync(path.join(root, 'vivant.pdf'), 'x');
    const fake = fakePrisma(
      [
        { id: 'doc_vivant', localPath: 'vivant.pdf' },
        { id: 'doc_mort', localPath: 'disparu.pdf' },
      ],
      [{ id: 'inv_vivant', pdfPath: 'vivant.pdf' }],
    );

    const report = await tombstoneDeadReferences(fake.client, { apply: true });

    expect(fake.documentUpdates).toEqual(['doc_mort']);
    expect(fake.invoiceUpdates).toEqual([]);
    expect(report.documentsChecked).toBe(2);
    expect(report.documentsTombstoned).toBe(1);
  });

  it('ne touche à rien quand tous les fichiers sont présents', async () => {
    fs.writeFileSync(path.join(root, 'a.pdf'), 'x');
    const fake = fakePrisma([{ id: 'doc_a', localPath: 'a.pdf' }], []);

    const report = await tombstoneDeadReferences(fake.client, { apply: true });

    expect(report.documentsTombstoned).toBe(0);
    expect(fake.documentUpdates).toEqual([]);
  });

  it('reproduit le constat de production : aucune référence ne résout', async () => {
    // Les 19 fichiers présents ne portent pas les noms référencés en base.
    fs.writeFileSync(path.join(root, 'facture-202602-0001-cmlx.pdf'), 'x');
    const fake = fakePrisma(
      [{ id: 'doc_1', localPath: 'storage/documents/sous-dossier/fichier.pdf' }],
      [{ id: 'inv_1', pdfPath: '/app/data/invoices/facture_202604-0002.pdf' }],
    );

    const report = await tombstoneDeadReferences(fake.client, { apply: true });

    expect(report.documentsTombstoned).toBe(1);
    expect(report.invoicesTombstoned).toBe(1);
  });
});
