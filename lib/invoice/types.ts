/**
 * Invoice Engine — Type definitions.
 *
 * Shared types for invoice creation, PDF rendering, and API contracts.
 * No business logic here — pure data shapes.
 *
 * MONETARY CONVENTION:
 * All amounts are stored and computed in MILLIMES (integer).
 * 1 TND = 1000 millimes. This eliminates JS float precision issues.
 * Conversion to display format (TND) happens only at the rendering boundary.
 *
 * ⚠️ DO NOT USE FLOATS FOR MONETARY VALUES.
 * All monetary fields MUST be integers (millimes).
 * Use assertMillimes() to validate at runtime boundaries (API input).
 */

// ─── Millimes type (branded alias) ─────────────────────────────────────────

/**
 * Branded type alias for monetary amounts in millimes.
 * Always an integer. 1 TND = 1000 millimes.
 * DO NOT assign float values to this type.
 */
export type Millimes = number;

/**
 * Runtime assertion: throws if value is not a finite integer.
 * Use at API boundaries to reject float inputs before they enter the system.
 *
 * @param value - The value to check
 * @param fieldName - Field name for error message
 * @throws Error with descriptive message if not integer
 */
export function assertMillimes(value: unknown, fieldName: string): asserts value is Millimes {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MillimesValidationError(
      `${fieldName} doit être un entier (millimes). Reçu: ${String(value)}`
    );
  }
}

/**
 * Typed error for millimes validation failures.
 * Caught by API routes to return 422.
 */
export class MillimesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MillimesValidationError';
  }
}

// ─── Enums (mirror Prisma but usable without Prisma import) ─────────────────

export type InvoiceStatusType = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED';

/**
 * Canonical payment method enum — source of truth.
 * UI must reflect these values and labels only.
 */
export type InvoicePaymentMethodType =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CARD'
  | 'CLICTOPAY';

/** Label mapping for UI display. */
export const PAYMENT_METHOD_LABELS: Record<InvoicePaymentMethodType, string> = {
  CASH: 'Espèces',
  BANK_TRANSFER: 'Virement bancaire',
  CHEQUE: 'Chèque',
  CARD: 'Carte bancaire',
  CLICTOPAY: 'ClicToPay',
};

export type TaxRegime = 'TVA_INCLUSE' | 'TVA_NON_APPLICABLE' | 'EXONERATION';

// ─── Invoice Item ───────────────────────────────────────────────────────────

export interface InvoiceItemData {
  /** Line label — e.g. "Stage Intensif Maths — Palier 2" */
  label: string;
  /** Optional description (clamped to 3 lines in PDF) */
  description?: string | null;
  /** Quantity (integer, default 1) */
  qty: number;
  /** Unit price in millimes (1 TND = 1000 millimes) */
  unitPrice: number;
  /** Computed total: qty × unitPrice, in millimes */
  total: number;
}

// ─── Issuer ─────────────────────────────────────────────────────────────────

export interface IssuerData {
  /** Raison sociale */
  name: string;
  /** Full address */
  address: string;
  /** Matricule fiscal */
  mf: string;
  /** Registre national des entreprises (optional) */
  rne?: string | null;
  /** Absolute path to logo image (optional — fallback to text if absent or missing) */
  logoPath?: string | null;
  /** Absolute path to stamp/cachet image (optional — rendered near totals) */
  stampPath?: string | null;
}

// ─── Customer ───────────────────────────────────────────────────────────────

export interface CustomerData {
  /** Customer full name */
  name: string;
  /** Email (optional) */
  email?: string | null;
  /** Address — clamped to 2 lines in PDF (optional) */
  address?: string | null;
  /** Fiscal ID if professional client (optional) */
  customerId?: string | null;
}

// ─── Payment Details ────────────────────────────────────────────────────────

export interface PaymentDetailsData {
  /** Payment reference (e.g. transfer ref, check number) */
  reference?: string | null;
  /** Date payment received */
  receivedAt?: string | null;
  /** Additional notes */
  notes?: string | null;
}

// ─── Full Invoice Data (for PDF rendering) ──────────────────────────────────

export interface InvoiceData {
  /** Invoice number — e.g. "202602-0001" */
  number: string;
  /** Invoice status */
  status: InvoiceStatusType;
  /** Issue date (ISO string) */
  issuedAt: string;
  /** Due date (ISO string, optional) */
  dueAt?: string | null;

  /** Issuer information */
  issuer: IssuerData;
  /** Customer information */
  customer: CustomerData;

  /** Line items */
  items: InvoiceItemData[];

  /** Currency code */
  currency: string;
  /** Subtotal before discounts (millimes) */
  subtotal: number;
  /** Total discount amount (millimes) */
  discountTotal: number;
  /** Tax amount (millimes) */
  taxTotal: number;
  /** Final total (millimes) */
  total: number;

  /** Tax regime label */
  taxRegime: TaxRegime;

  /** Payment method */
  paymentMethod?: InvoicePaymentMethodType | null;
  /** Payment details */
  paymentDetails?: PaymentDetailsData | null;

  /** Internal notes (not printed on PDF) */
  notes?: string | null;
}

// ─── API Request / Response ─────────────────────────────────────────────────

export interface CreateInvoiceRequest {
  /** Customer info */
  customer: CustomerData;
  /** Line items (total will be computed server-side in millimes) */
  items: Array<{
    label: string;
    description?: string | null;
    qty: number;
    /** Unit price in millimes (1 TND = 1000) */
    unitPrice: number;
  }>;
  /** Optional discount total (millimes) */
  discountTotal?: number;
  /** Tax regime */
  taxRegime?: TaxRegime;
  /** Payment method */
  paymentMethod?: InvoicePaymentMethodType | null;
  /** Due date (ISO string) */
  dueAt?: string | null;
  /** Internal notes */
  notes?: string | null;
  /** Issuer overrides (optional — defaults used if omitted) */
  issuer?: Partial<IssuerData>;
}

export interface CreateInvoiceResponse {
  /** Created invoice ID */
  invoiceId: string;
  /** Invoice number */
  number: string;
  /** PDF download URL */
  pdfUrl: string;
}

// ─── Audit Events ───────────────────────────────────────────────────────────

export type InvoiceEventType =
  | 'INVOICE_CREATED'
  | 'PDF_RENDERED'
  | 'INVOICE_SENT'
  | 'INVOICE_SENT_EMAIL'
  | 'INVOICE_PAID'
  | 'INVOICE_CANCELLED'
  | 'STATUS_CHANGED'
  | 'TOKEN_CREATED'
  | 'TOKENS_REVOKED'
  | 'ENTITLEMENTS_ACTIVATED'
  | 'ENTITLEMENTS_SUSPENDED'
  | 'ENTITLEMENTS_SKIPPED'
  | 'RECEIPT_RENDERED';

/** Flat key-value details for audit events. No nested objects. */
export type InvoiceEventDetails = Record<string, string | number | boolean | null>;

/** Max serialized size for event details (bytes). */
export const MAX_EVENT_DETAILS_SIZE = 2048;

/**
 * Sanitize event details to ensure JSON-safe, flat, bounded output.
 * - Removes undefined/function values
 * - Coerces non-primitive values to string
 * - Truncates if serialized size > MAX_EVENT_DETAILS_SIZE
 * - Returns null for empty/invalid input
 */
export function sanitizeEventDetails(
  raw: unknown
): InvoiceEventDetails | string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    return raw.length > MAX_EVENT_DETAILS_SIZE
      ? raw.slice(0, MAX_EVENT_DETAILS_SIZE)
      : raw;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;

  const result: InvoiceEventDetails = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === undefined || typeof value === 'function') continue;
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else {
      result[key] = String(value);
    }
  }

  const serialized = JSON.stringify(result);
  if (serialized.length > MAX_EVENT_DETAILS_SIZE) {
    return serialized.slice(0, MAX_EVENT_DETAILS_SIZE);
  }
  return Object.keys(result).length > 0 ? result : null;
}

export interface InvoiceEvent {
  /** Event type */
  type: InvoiceEventType;
  /** ISO timestamp */
  at: string;
  /** User ID who triggered the event */
  by: string;
  /** Optional details (sanitized flat object or string) */
  details?: InvoiceEventDetails | string | null;
}

/**
 * Create an audit event entry.
 *
 * @param type - Event type
 * @param userId - Who triggered it
 * @param details - Optional context
 * @returns InvoiceEvent ready to append to events[]
 */
export function createInvoiceEvent(
  type: InvoiceEventType,
  userId: string,
  details?: string | Record<string, unknown> | null
): InvoiceEvent {
  return {
    type,
    at: new Date().toISOString(),
    by: userId,
    details: sanitizeEventDetails(details),
  };
}

/**
 * Append-only event accumulator. Never overwrites existing events.
 * Returns a new array sorted by `at` ASC (chronological).
 *
 * @param existing - Current events array (from DB Json field)
 * @param newEvent - Event to append
 * @returns New array with event appended, sorted by timestamp ASC
 */
export function appendInvoiceEvent(
  existing: unknown,
  newEvent: InvoiceEvent
): InvoiceEvent[] {
  const events: InvoiceEvent[] = Array.isArray(existing)
    ? (existing as InvoiceEvent[])
    : [];
  const updated = [...events, newEvent];
  updated.sort((a, b) => a.at.localeCompare(b.at));
  return updated;
}

// ─── Clamp constants ────────────────────────────────────────────────────────

/** Max lines for customer address in PDF */
export const CLAMP_ADDRESS_LINES = 2;
/** Max lines for item description in PDF */
export const CLAMP_DESCRIPTION_LINES = 3;
/** Max characters per line (approximate, for clamp calculation) */
export const CLAMP_CHARS_PER_LINE = 60;
/** Max items before overflow error */
export const MAX_INVOICE_ITEMS = 12;

// ─── Monetary helpers (millimes ↔ TND) ──────────────────────────────────────

/** 1 TND = 1000 millimes */
export const MILLIMES_PER_TND = 1000;

/**
 * Convert millimes (int) to TND display string.
 * @param millimes - Amount in millimes (integer)
 * @param currency - Currency label (default "TND")
 * @returns Formatted string, e.g. "350.000 TND"
 */
export function millimesToDisplay(millimes: number, currency: string = 'TND'): string {
  const tnd = millimes / MILLIMES_PER_TND;
  return `${tnd.toFixed(3)} ${currency}`;
}

/**
 * Convert a TND amount (user input) to millimes (int).
 * Rounds to nearest integer to eliminate float residue.
 * @param tnd - Amount in TND (e.g. 350.5)
 * @returns Integer millimes
 */
export function tndToMillimes(tnd: number): number {
  return Math.round(tnd * MILLIMES_PER_TND);
}

/**
 * Convert millimes (int) to TND number.
 * @param millimes - Amount in millimes
 * @returns TND as number (e.g. 350.000)
 */
export function millimesToTnd(millimes: number): number {
  return millimes / MILLIMES_PER_TND;
}
