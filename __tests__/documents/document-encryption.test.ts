import {
  DOCUMENT_ENCRYPTION_KEY_VERSION,
  decryptDocument,
  encryptDocument,
  isEncryptedDocument,
} from '@/lib/documents/encryption';

/**
 * Chiffrement au repos des documents déposés.
 *
 * Prérequis à l'ouverture du candidat libre : le dossier impose le dépôt d'une
 * pièce d'identité, d'un relevé Cyclades et de bulletins d'un mineur. Ces
 * fichiers ne doivent pas reposer en clair sur le disque.
 *
 * Le chiffrement lie l'identifiant du document aux données authentifiées : un
 * fichier ne peut pas être substitué à un autre sans que le déchiffrement
 * échoue.
 */

const ORIGINAL_KEY = process.env.DOCUMENT_ENCRYPTION_KEY;
const KEY = 'x'.repeat(48);

beforeEach(() => {
  process.env.DOCUMENT_ENCRYPTION_KEY = KEY;
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.DOCUMENT_ENCRYPTION_KEY;
  else process.env.DOCUMENT_ENCRYPTION_KEY = ORIGINAL_KEY;
});

const AAD = Object.freeze({ documentId: 'doc_1' });

describe('encryptDocument / decryptDocument', () => {
  it('restitue exactement le contenu original', () => {
    const plaintext = Buffer.from('%PDF-1.7 contenu confidentiel du mineur');
    const restored = decryptDocument(encryptDocument(plaintext, AAD), AAD);
    expect(restored.equals(plaintext)).toBe(true);
  });

  it('restitue un binaire quelconque sans altération', () => {
    const plaintext = Buffer.from(Array.from({ length: 4096 }, (_, index) => index % 256));
    const restored = decryptDocument(encryptDocument(plaintext, AAD), AAD);
    expect(restored.equals(plaintext)).toBe(true);
  });

  it('ne laisse pas le contenu en clair dans l’enveloppe', () => {
    const secret = 'NUMERO-DE-PIECE-IDENTITE-12345';
    const envelope = encryptDocument(Buffer.from(`x${secret}x`), AAD);
    expect(envelope.includes(Buffer.from(secret))).toBe(false);
  });

  it('produit une enveloppe différente à chaque appel (IV aléatoire)', () => {
    const plaintext = Buffer.from('meme contenu');
    const a = encryptDocument(plaintext, AAD);
    const b = encryptDocument(plaintext, AAD);
    expect(a.equals(b)).toBe(false);
    expect(decryptDocument(b, AAD).equals(plaintext)).toBe(true);
  });

  it('refuse le déchiffrement sous un autre documentId', () => {
    const envelope = encryptDocument(Buffer.from('contenu'), AAD);
    expect(() => decryptDocument(envelope, { documentId: 'doc_2' })).toThrow();
  });

  it('refuse une enveloppe altérée', () => {
    const envelope = encryptDocument(Buffer.from('contenu'), AAD);
    const tampered = Buffer.from(envelope);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptDocument(tampered, AAD)).toThrow();
  });

  it('refuse une enveloppe tronquée', () => {
    const envelope = encryptDocument(Buffer.from('contenu'), AAD);
    expect(() => decryptDocument(envelope.subarray(0, 8), AAD)).toThrow();
  });

  it('échoue fermé si la clé est absente', () => {
    delete process.env.DOCUMENT_ENCRYPTION_KEY;
    expect(() => encryptDocument(Buffer.from('x'), AAD)).toThrow(/DOCUMENT_ENCRYPTION_KEY/);
  });

  it('échoue fermé si la clé est trop courte', () => {
    process.env.DOCUMENT_ENCRYPTION_KEY = 'court';
    expect(() => encryptDocument(Buffer.from('x'), AAD)).toThrow(/DOCUMENT_ENCRYPTION_KEY/);
  });

  it('ne déchiffre pas avec une autre clé', () => {
    const envelope = encryptDocument(Buffer.from('contenu'), AAD);
    process.env.DOCUMENT_ENCRYPTION_KEY = 'y'.repeat(48);
    expect(() => decryptDocument(envelope, AAD)).toThrow();
  });

  it('porte la version de clé, pour permettre une rotation', () => {
    const envelope = encryptDocument(Buffer.from('contenu'), AAD);
    expect(envelope.subarray(0, 8).toString()).toContain('NXDOC');
    expect(DOCUMENT_ENCRYPTION_KEY_VERSION).toMatch(/^v\d+$/);
  });
});

describe('isEncryptedDocument', () => {
  it('reconnaît une enveloppe produite par ce module', () => {
    expect(isEncryptedDocument(encryptDocument(Buffer.from('x'), AAD))).toBe(true);
  });

  it.each([
    ['un PDF en clair', Buffer.from('%PDF-1.7 ...')],
    ['un buffer vide', Buffer.alloc(0)],
    ['du bruit', Buffer.from([1, 2, 3, 4])],
  ])('rejette %s', (_label, buffer) => {
    expect(isEncryptedDocument(buffer)).toBe(false);
  });
});
