import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';

export function FinalCampaignCTA({ campaignPath }: { campaignPath: string }) {
  const whatsappUrl = buildWhatsAppUrl('les stages de pré-rentrée 2026');

  return (
    <section className="bg-lux-ink py-14 md:py-20 px-4" aria-labelledby="final-cta-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="final-cta-heading" className="font-fraunces text-2xl md:text-3xl text-lux-on-dark mb-4">
          Prêt à préparer la rentrée ?
        </h2>
        <p className="text-lux-on-dark-muted mb-8">
          Composez le stage de votre enfant ou contactez-nous pour un conseil personnalisé.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`${campaignPath}#configurateur`}
            className="inline-flex items-center justify-center rounded-lg bg-lux-gold px-6 py-3 text-sm font-semibold text-lux-ink hover:bg-lux-gold-bright transition-colors min-h-[44px]"
          >
            Composer le stage
          </a>
          <a
            href="/bilan-gratuit?programme=pre-rentree-2026"
            className="inline-flex items-center justify-center rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-lux-on-dark hover:bg-white/5 transition-colors min-h-[44px]"
          >
            Bilan gratuit
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border bg-white/5 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
            style={{ borderColor: WHATSAPP_BRAND_GREEN, color: WHATSAPP_BRAND_GREEN }}
          >
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
