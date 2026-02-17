/**
 * Invoice Storage — Local file storage for generated PDF invoices.
 *
 * Stores PDFs in a configurable directory (default: data/invoices/).
 * In production, this can be swapped for S3/R2 without changing the API layer.
 */

import { writeFile, mkdir, readFile, access } from 'fs/promises';
import path from 'path';

/** Base directory for invoice PDF storage */
const STORAGE_DIR = process.env.INVOICE_STORAGE_DIR || path.join(process.cwd(), 'data', 'invoices');

/**
 * Ensure the storage directory exists.
 */
async function ensureDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
}

/**
 * Verify that the invoice storage directory exists and is writable.
 * Call at startup or before first write to fail fast if storage is misconfigured.
 *
 * @throws Error if directory cannot be created or is not writable
 */
export async function ensureInvoiceStorageReady(): Promise<void> {
  await ensureDir();
  const testFile = path.join(STORAGE_DIR, '.write-test');
  try {
    await writeFile(testFile, 'ok');
    const { unlink } = await import('fs/promises');
    await unlink(testFile);
  } catch (err) {
    throw new Error(
      `Invoice storage directory is not writable: ${STORAGE_DIR}. ` +
      `Ensure the path exists and the process has write permissions. ` +
      `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Build the file path for an invoice PDF.
 *
 * @param invoiceNumber - e.g. "202602-0001"
 * @returns Absolute file path
 */
export function getInvoicePath(invoiceNumber: string): string {
  const sanitized = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  return path.join(STORAGE_DIR, `facture_${sanitized}.pdf`);
}

/**
 * Build the download URL for an invoice PDF.
 *
 * @param invoiceId - Database invoice ID
 * @returns Relative URL for the API endpoint
 */
export function getInvoiceUrl(invoiceId: string): string {
  return `/api/invoices/${invoiceId}/pdf`;
}

/**
 * Store a PDF buffer to disk.
 *
 * @param invoiceNumber - Invoice number for filename
 * @param buffer - PDF content
 * @returns Absolute file path where stored
 */
export async function storeInvoicePDF(invoiceNumber: string, buffer: Buffer): Promise<string> {
  await ensureDir();
  const filePath = getInvoicePath(invoiceNumber);
  await writeFile(filePath, buffer);
  return filePath;
}

/**
 * Read a stored invoice PDF from disk.
 *
 * @param filePath - Absolute path to the PDF
 * @returns PDF buffer
 * @throws Error if file doesn't exist
 */
export async function readInvoicePDF(filePath: string): Promise<Buffer> {
  // Security: ensure the path is within the storage directory
  const resolved = path.resolve(filePath);
  const storageResolved = path.resolve(STORAGE_DIR);
  if (!resolved.startsWith(storageResolved)) {
    throw new Error('Invalid invoice path: outside storage directory');
  }

  await access(resolved);
  return readFile(resolved);
}
