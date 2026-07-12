import { buildWhatsAppUrl } from '@/lib/whatsapp';

export function FinalCampaignCTA() {
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
            href="#configurateur"
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
            className="inline-flex items-center justify-center rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 px-6 py-3 text-sm font-semibold text-[#25D366] hover:bg-[#25D366]/20 transition-colors min-h-[44px]"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
