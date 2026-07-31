import Link from 'next/link';
import { Check } from 'lucide-react';
import { WhatsAppLogo, WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

interface CustomQuoteLibreData {
  enabled: boolean;
  title: string;
  description: string;
  reservation: number;
  installments_default: number;
  min_price_per_student_hour: number;
  cta: {
    bilan_label: string;
    bilan_href: string;
    whatsapp_label: string;
  };
  includes: string[];
}

export function CustomQuoteLibre({ quote }: { quote: CustomQuoteLibreData }) {
  if (!quote.enabled) return null;

  return (
    <div
      data-testid="custom-quote-libre"
      className="@container relative flex flex-col overflow-hidden rounded-2xl border border-dashed border-lux-gold/60 bg-lux-white shadow-md shadow-lux-ink/5"
    >
      <div className="border-b border-lux-line/40 px-6 pb-4 pt-5">
        <span className="lux-eyebrow">Candidat libre</span>
        <h3 className="mt-2 text-xl font-fraunces">{quote.title}</h3>
        <div className="lux-filet-gold mt-3 w-16" />
      </div>

      <div className="px-6 py-4">
        <p className="text-sm text-lux-slate">{quote.description}</p>
      </div>

      <div className="flex-grow border-t border-lux-line/50 px-6 py-4">
        <ul data-testid="custom-quote-libre-includes" className="space-y-2">
          {quote.includes.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-lux-gold" />
              <span className="text-sm text-lux-slate">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-lux-line/50 px-6 py-4">
        <p data-testid="custom-quote-price-note" className="text-sm font-medium text-lux-ink">
          Tarif établi après le bilan gratuit
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-lux-line/50 px-6 py-4">
        <Link href={quote.cta.bilan_href} className="lux-cta-primary">
          {quote.cta.bilan_label}
        </Link>
        <a
          href={buildWhatsAppUrl(quote.title)}
          target="_blank"
          rel="noopener noreferrer"
          className="lux-cta-whatsapp"
        >
          <WhatsAppLogo className="h-4 w-4" style={{ color: WHATSAPP_BRAND_GREEN }} />
          {quote.cta.whatsapp_label}
        </a>
      </div>
    </div>
  );
}
