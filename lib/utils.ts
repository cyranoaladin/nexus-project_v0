import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Custom background tokens — all conflict with each other
      'bg-color': [
        { bg: ['surface-card', 'surface-dark', 'surface-darker',
               'lux-white', 'lux-paper', 'lux-ivory', 'lux-ink',
               'lux-gold', 'lux-gold-deep', 'lux-gold-bright', 'lux-gold-wash',
               'lux-evergreen', 'lux-line'] },
      ],
      // Custom text tokens
      'text-color': [
        { text: ['lux-ink', 'lux-ivory', 'lux-slate', 'lux-gold', 'lux-gold-deep',
                 'lux-gold-wash', 'lux-gold-bright', 'lux-evergreen',
                 'lux-on-dark', 'lux-on-dark-muted', 'lux-on-dark-subtle',
                 'neutral-100', 'neutral-200', 'neutral-300', 'neutral-400', 'neutral-500'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
