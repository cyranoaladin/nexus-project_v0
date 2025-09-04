export type Pricing = Partial<{
  pack_50_credits: number; pack_100_credits: number; pack_250_credits: number;
  prix_grand_oral: number; prix_parcoursup: number; prix_pack_libres: number;
  ARIA_tarif_matiere: number; ARIA_pack_complet: number;
  prix_individuel: number; prix_groupe4: number; prix_stage_groupe8: number;
  Odysee_Premiere: number; Odysee_Terminale: number; Odysee_Libres: number;
  prix_sos_15: number; prix_sos_30: number; prix_sos_60: number;
}>;

const FALLBACK: Pricing = {
  pack_50_credits: 500,
  pack_100_credits: 1000,
  pack_250_credits: 2500,
};

export async function getPricing(baseUrl?: string): Promise<Pricing> {
  try {
    const url = baseUrl
      ? `${baseUrl}/api/pricing`
      : (process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/pricing` : '/api/pricing');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`pricing ${res.status}`);
    const data = await res.json();
    // Server returns an array of { variable, valeur } → normalize to map
    const map = Array.isArray(data)
      ? Object.fromEntries(data.map((i: any) => [i.variable, i.valeur]))
      : data;
    return { ...FALLBACK, ...map };
  } catch {
    return FALLBACK;
  }
}

