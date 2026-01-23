import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(price: number, currency: string = "TND"): string {
  return `${price} ${currency}`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

// --- Payment metadata helpers (handle JSON vs string storage) ---
import type { Prisma } from '@prisma/client';

type PaymentMetadata = Prisma.JsonObject;

export function parsePaymentMetadata(raw: unknown): PaymentMetadata {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as PaymentMetadata)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as PaymentMetadata;
  }
  return {};
}

export function mergePaymentMetadata(
  existing: unknown,
  additions: PaymentMetadata
): { value: Prisma.InputJsonValue; shouldStringify: boolean; } {
  const parsed = parsePaymentMetadata(existing);
  const merged = { ...parsed, ...additions };
  const shouldStringify = typeof existing === 'string';
  return { value: shouldStringify ? JSON.stringify(merged) : merged, shouldStringify };
}
