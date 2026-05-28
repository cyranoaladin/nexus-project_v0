import { ARIA_ADDONS, SPECIAL_PACKS, SUBSCRIPTION_PLANS } from '@/lib/constants';

export type PaymentCatalogType = 'subscription' | 'addon' | 'pack';

export type PaymentCatalogItem = {
  amount: number;
  description: string;
  displayName: string;
};

export function resolvePaymentCatalogItem(
  type: PaymentCatalogType,
  key: string,
): PaymentCatalogItem | null {
  if (type === 'subscription') {
    const plan = SUBSCRIPTION_PLANS[key as keyof typeof SUBSCRIPTION_PLANS];
    if (!plan) return null;
    return {
      amount: plan.price,
      description: `Abonnement ${plan.name}`,
      displayName: plan.name,
    };
  }

  if (type === 'addon') {
    const addon = ARIA_ADDONS[key as keyof typeof ARIA_ADDONS];
    if (!addon) return null;
    return {
      amount: addon.price,
      description: `Add-on ARIA ${addon.name}`,
      displayName: addon.name,
    };
  }

  const pack = SPECIAL_PACKS[key as keyof typeof SPECIAL_PACKS];
  if (!pack) return null;
  return {
    amount: pack.price,
    description: pack.name,
    displayName: pack.name,
  };
}
