/**
 * Invoice Engine — Public API.
 *
 * Re-exports all invoice utilities for clean imports:
 *   import { renderInvoicePDF, generateInvoiceNumber } from '@/lib/invoice';
 */

export { renderInvoicePDF, InvoiceOverflowError } from './pdf';
export { generateInvoiceNumber, formatYearMonth } from './sequence';
export { storeInvoicePDF, readInvoicePDF, getInvoicePath, getInvoiceUrl, ensureInvoiceStorageReady } from './storage';
export type {
  InvoiceData,
  InvoiceItemData,
  IssuerData,
  CustomerData,
  PaymentDetailsData,
  InvoiceStatusType,
  InvoicePaymentMethodType,
  TaxRegime,
  CreateInvoiceRequest,
  CreateInvoiceResponse,
  InvoiceEventType,
  InvoiceEvent,
} from './types';
export { createInvoiceEvent, appendInvoiceEvent, assertMillimes, MillimesValidationError, PAYMENT_METHOD_LABELS } from './types';
export type { InvoiceEventDetails } from './types';
export { sanitizeEventDetails, MAX_EVENT_DETAILS_SIZE } from './types';
export { notFoundResponse, buildInvoiceScopeWhere } from './not-found';
export {
  validateTransition,
  canPerformStatusAction,
  getTargetStatus,
  isTerminalStatus,
  getAvailableActions,
} from './transitions';
export type {
  InvoiceAction,
  InvoiceActionRequest,
  MarkSentMeta,
  MarkPaidMeta,
  CancelMeta,
  ActionMeta,
  TransitionResult,
} from './transitions';
export {
  generateRawToken,
  hashToken,
  computeExpiresAt,
  createAccessToken,
  verifyAccessToken,
  revokeTokensForInvoice,
  TOKEN_EXPIRY_HOURS,
} from './access-token';
export type { CreateTokenResult, VerifyTokenResult } from './access-token';
export { renderReceiptPDF } from './receipt-pdf';
export type { ReceiptData } from './receipt-pdf';
export {
  CLAMP_ADDRESS_LINES,
  CLAMP_DESCRIPTION_LINES,
  CLAMP_CHARS_PER_LINE,
  MAX_INVOICE_ITEMS,
  MILLIMES_PER_TND,
  millimesToDisplay,
  tndToMillimes,
  millimesToTnd,
} from './types';
