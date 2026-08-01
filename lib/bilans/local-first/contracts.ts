import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';

import {
  bindPiiScanResultToPayload,
  piiScanResultMatchesPayload,
  scanPiiFields,
  type PiiScanResult,
} from './pii';

export type PseudonymizedFactSheet = Readonly<{
  value: FactSheet;
  piiScanResult: PiiScanResult;
}>;

function collectStrings(value: unknown, path = '$'): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((child, index) => collectStrings(child, `${path}[${index}]`));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, child]) => collectStrings(child, `${path}.${key}`));
  }
  return [];
}

export function createPseudonymizedFactSheet(value: FactSheet): PseudonymizedFactSheet {
  const scan = scanPiiFields(collectStrings(value).map((field) => ({
    ...field,
    source: 'CONTROLLED_TEMPLATE' as const,
  })));
  if (scan.result.status !== 'CLEAN') {
    throw new Error('FactSheet failed the local PII boundary');
  }
  return Object.freeze({
    value,
    piiScanResult: bindPiiScanResultToPayload(scan.result, value),
  });
}

export function isBoundPseudonymizedFactSheet(input: PseudonymizedFactSheet): boolean {
  return input.piiScanResult.status === 'CLEAN'
    && piiScanResultMatchesPayload(input.piiScanResult, input.value);
}
