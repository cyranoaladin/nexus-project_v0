import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

/**
 * Chiffrement au repos des documents déposés.
 *
 * Motivation directe : le diagnostic candidat libre impose le dépôt d'une pièce
 * d'identité, d'un relevé Cyclades et de bulletins scolaires **d'un mineur**.
 * Ces fichiers ne doivent pas reposer en clair sur le disque du serveur.
 *
 * Reprend la construction déjà éprouvée par la file d'e-mails
 * (`lib/email/outbox.ts`) : AES-256-GCM, clé dérivée par HMAC d'un secret
 * d'environnement et d'une version de clé, données authentifiées liées au
 * contenu. Deux différences assumées : le contenu est binaire plutôt que JSON,
 * et l'enveloppe est un fichier, donc sa mise en forme est binaire et non
 * base64 — inutile de payer 33 % de volume sur des fichiers de 12 à 30 Mo.
 *
 * Les données authentifiées incluent l'identifiant du document : un fichier
 * chiffré ne peut pas être substitué à un autre sans faire échouer le
 * déchiffrement.
 *
 * Ce module ne gère pas la rotation de clé au-delà d'en porter la version dans
 * l'enveloppe. Une rotation effective supposera de relire et réécrire les
 * fichiers existants.
 */

const MAGIC = Buffer.from('NXDOC\0');
export const DOCUMENT_ENCRYPTION_KEY_VERSION = 'v1' as const;

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION_LENGTH = 4;
const HEADER_LENGTH = MAGIC.length + VERSION_LENGTH + IV_LENGTH + TAG_LENGTH;

export type DocumentEncryptionContext = Readonly<{
  /** Identifiant du document, lié cryptographiquement à l'enveloppe. */
  documentId: string;
}>;

function documentSecret(): Buffer {
  const value = process.env.DOCUMENT_ENCRYPTION_KEY?.trim();
  if (!value || value.length < 32) {
    throw new Error('DOCUMENT_ENCRYPTION_KEY_INVALID');
  }
  return createHmac('sha256', value).update(DOCUMENT_ENCRYPTION_KEY_VERSION).digest();
}

function additionalData(context: DocumentEncryptionContext): Buffer {
  return Buffer.from(`${DOCUMENT_ENCRYPTION_KEY_VERSION}\0${context.documentId}`);
}

function versionField(): Buffer {
  const field = Buffer.alloc(VERSION_LENGTH);
  field.write(DOCUMENT_ENCRYPTION_KEY_VERSION);
  return field;
}

/**
 * Chiffre un document.
 *
 * Disposition de l'enveloppe : `MAGIC | version | iv | tag | ciphertext`.
 * Le tag précède le chiffré pour que l'en-tête reste de taille fixe, ce qui
 * permet de reconnaître une enveloppe sans la lire entièrement.
 */
export function encryptDocument(
  plaintext: Buffer,
  context: DocumentEncryptionContext,
): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', documentSecret(), iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(additionalData(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, versionField(), iv, cipher.getAuthTag(), ciphertext]);
}

/**
 * Déchiffre une enveloppe. Lève si la clé, le contexte ou l'intégrité ne
 * correspondent pas — jamais de retour partiel ni de contenu non authentifié.
 */
export function decryptDocument(
  envelope: Buffer,
  context: DocumentEncryptionContext,
): Buffer {
  if (!isEncryptedDocument(envelope)) {
    throw new Error('DOCUMENT_ENVELOPE_INVALID');
  }

  let offset = MAGIC.length + VERSION_LENGTH;
  const iv = envelope.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const tag = envelope.subarray(offset, offset + TAG_LENGTH);
  offset += TAG_LENGTH;
  const ciphertext = envelope.subarray(offset);

  const decipher = createDecipheriv('aes-256-gcm', documentSecret(), iv, { authTagLength: TAG_LENGTH });
  decipher.setAAD(additionalData(context));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Indique si un buffer est une enveloppe produite par ce module.
 *
 * Sert à traiter sans casse les fichiers déposés avant l'introduction du
 * chiffrement : ils restent lisibles tels quels, et seront réécrits chiffrés
 * lors de leur prochaine écriture.
 */
export function isEncryptedDocument(buffer: Buffer): boolean {
  return buffer.length >= HEADER_LENGTH && buffer.subarray(0, MAGIC.length).equals(MAGIC);
}
