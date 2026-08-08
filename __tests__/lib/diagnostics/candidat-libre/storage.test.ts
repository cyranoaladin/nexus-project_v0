jest.mock('server-only', () => ({}));

const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
jest.mock('fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

jest.mock('@/lib/documents/storage-root', () => ({
  getDocumentStorageRoot: () => '/tmp/candidate-diagnostics-test-root',
}));

import { persistDiagnosticFile } from '@/lib/diagnostics/candidat-libre/storage.server';
import { isEncryptedDocument } from '@/lib/documents/encryption';

// Les dépôts sont désormais chiffrés au repos : sans clé, `persistDiagnosticFile`
// échoue fermé plutôt que d'écrire en clair. Les tests doivent donc en fournir une.
const ORIGINAL_DOCUMENT_KEY = process.env.DOCUMENT_ENCRYPTION_KEY;
beforeAll(() => {
  process.env.DOCUMENT_ENCRYPTION_KEY = 'test-document-encryption-key-0123456789abcd';
});
afterAll(() => {
  if (ORIGINAL_DOCUMENT_KEY === undefined) delete process.env.DOCUMENT_ENCRYPTION_KEY;
  else process.env.DOCUMENT_ENCRYPTION_KEY = ORIGINAL_DOCUMENT_KEY;
});

function fakeFile(bytes: number[], type: string, name = 'upload.bin'): File {
  const buffer = Buffer.from(bytes);
  return {
    type,
    size: buffer.byteLength,
    name,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as unknown as File;
}

const WAV_HEADER = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, ...new Array(8).fill(0)];
const WEBM_HEADER = [0x1a, 0x45, 0xdf, 0xa3, ...new Array(8).fill(0)];
const MP3_ID3_HEADER = [0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0];
const MP4_HEADER = [0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, ...new Array(8).fill(0)];

describe('persistDiagnosticFile — audio signature validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts a WAV file whose bytes match the RIFF/WAVE signature', async () => {
    await expect(
      persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'ORAL_RECORDING', file: fakeFile(WAV_HEADER, 'audio/wav') }),
    ).resolves.toMatchObject({ mimeType: 'audio/wav' });
  });

  it('accepts a WebM file whose bytes match the EBML signature', async () => {
    await expect(
      persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'ORAL_RECORDING', file: fakeFile(WEBM_HEADER, 'audio/webm') }),
    ).resolves.toMatchObject({ mimeType: 'audio/webm' });
  });

  it('accepts an MP3 file with an ID3 header', async () => {
    await expect(
      persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'ORAL_RECORDING', file: fakeFile(MP3_ID3_HEADER, 'audio/mpeg') }),
    ).resolves.toMatchObject({ mimeType: 'audio/mpeg' });
  });

  it('accepts an MP4/M4A file with an ftyp box', async () => {
    await expect(
      persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'ORAL_RECORDING', file: fakeFile(MP4_HEADER, 'audio/mp4') }),
    ).resolves.toMatchObject({ mimeType: 'audio/mp4' });
  });

  it('rejects a file declared as audio/wav whose bytes do not match the WAV signature', async () => {
    const spoofed = fakeFile([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'audio/wav');
    await expect(
      persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'ORAL_RECORDING', file: spoofed }),
    ).rejects.toThrow('MIME_SIGNATURE_MISMATCH');
  });

  it('rejects a file declared as audio/webm whose bytes do not match the EBML signature', async () => {
    const spoofed = fakeFile(WAV_HEADER, 'audio/webm');
    await expect(
      persistDiagnosticFile({ diagnosticId: 'diag-1', category: 'ORAL_RECORDING', file: spoofed }),
    ).rejects.toThrow('MIME_SIGNATURE_MISMATCH');
  });
});

describe('persistDiagnosticFile — chiffrement au repos', () => {
  /**
   * Le mock `fs/promises` de ce fichier n'intercepte pas réellement les
   * écritures : les fichiers atterrissent sur le disque. On s'en sert plutôt
   * que de lutter contre — lire les octets réellement écrits est une preuve
   * plus forte qu'une assertion sur un mock.
   */
  const realFs = jest.requireActual('fs') as typeof import('fs');
  const ROOT = '/tmp/candidate-diagnostics-test-root';

  afterAll(() => {
    realFs.rmSync(`${ROOT}/candidate-diagnostics`, { recursive: true, force: true });
  });

  it('écrit une enveloppe chiffrée, jamais le contenu en clair', async () => {
    const marker = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
    const result = await persistDiagnosticFile({
      diagnosticId: 'diag-crypto',
      category: 'IDENTITY',
      file: fakeFile(marker, 'application/pdf', 'piece-identite.pdf'),
    });

    const written = realFs.readFileSync(`${ROOT}/${result.storageKey}`);
    expect(isEncryptedDocument(written)).toBe(true);
    expect(written.includes(Buffer.from(marker))).toBe(false);
  });

  it('n’inscrit pas le nom du fichier d’origine dans le chemin', async () => {
    const result = await persistDiagnosticFile({
      diagnosticId: 'diag-crypto',
      category: 'SCHOOL_REPORT',
      file: fakeFile([0x25, 0x50, 0x44, 0x46, 0x2d], 'application/pdf', 'bulletin_Dupont.pdf'),
    });

    expect(result.storageKey).not.toContain('Dupont');
    expect(result.storageKey).not.toContain('bulletin');
    // Le nom d'origine reste disponible pour l'affichage, en base seulement.
    expect(result.safeName).toBe('bulletin_Dupont.pdf');
  });
});
