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
export function parsePaymentMetadata(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, any>;
  return {};
}

export function mergePaymentMetadata(
  existing: unknown,
  additions: Record<string, any>
): { value: any; shouldStringify: boolean; } {
  const parsed = parsePaymentMetadata(existing);
  const merged = { ...parsed, ...additions };
  const shouldStringify = typeof existing === 'string';
  return { value: shouldStringify ? JSON.stringify(merged) : merged, shouldStringify };
}
