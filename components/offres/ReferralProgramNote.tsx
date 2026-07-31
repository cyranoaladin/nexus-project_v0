import { WhatsAppLogo, WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

interface ReferralProgramData {
  enabled: boolean;
  reward_type: 'aria_months_free';
  reward_months: number;
  trigger: string;
  cap_months_per_family_per_year: number;
  convertible_to_cash: boolean;
  deductible_from_price_or_reservation: boolean;
  note: string;
}

export function ReferralProgramNote({ referral }: { referral: ReferralProgramData }) {
  if (!referral.enabled) return null;

  return (
    <div
      data-testid="referral-program-note"
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-lux-line/60 bg-lux-paper/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <span className="lux-eyebrow">Parrainage</span>
        <p className="mt-1 text-sm text-lux-ink">
          {referral.reward_months} mois ARIA offert par filleul inscrit (jusqu&apos;à{' '}
          {referral.cap_months_per_family_per_year} mois&nbsp;/&nbsp;an)
        </p>
      </div>
      <a
        href={buildWhatsAppUrl('le parrainage')}
        target="_blank"
        rel="noopener noreferrer"
        className="lux-cta-whatsapp whitespace-nowrap"
      >
        <WhatsAppLogo className="h-4 w-4" style={{ color: WHATSAPP_BRAND_GREEN }} />
        WhatsApp
      </a>
    </div>
  );
}
