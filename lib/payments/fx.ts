let FX_CACHE: { ts: number; tnd_eur: number; } | null = null;

export async function tndToCurrencyMinor(amountTnd: number, currency: string) {
  if (currency.toUpperCase() === 'TND') return Math.round(amountTnd * 100);
  const rate = await getTndToEur();
  const eurAmount = amountTnd * rate;
  if (currency.toUpperCase() === 'EUR') return Math.round(eurAmount * 100);
  throw new Error(`Devise non supportée: ${currency}`);
}

export async function getTndToEur() {
  const ttl = Number(process.env.FX_CACHE_TTL_SEC || 10800);
  const now = Date.now();
  if (FX_CACHE && (now - FX_CACHE.ts) / 1000 < ttl) return FX_CACHE.tnd_eur;
  try {
    const base = process.env.FX_PROVIDER_URL || 'https://api.exchangerate.host/latest';
    const r = await fetch(`${base}?base=TND&symbols=EUR`, { cache: 'no-store' });
    if (r.ok) {
      const js = await r.json();
      const rate = Number(js?.rates?.EUR);
      if (rate > 0) { FX_CACHE = { ts: now, tnd_eur: rate }; return rate; }
    }
    throw new Error('FX provider down');
  } catch {
    const fallback = Number(process.env.FALLBACK_TND_EUR || 0.30);
    FX_CACHE = { ts: now, tnd_eur: fallback };
    return fallback;
  }
}
