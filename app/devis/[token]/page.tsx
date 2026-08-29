import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { fmtTND } from '@/components/premium/format';
import { getFamilyQuoteView } from '@/lib/quotes/public-view.server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre devis Nexus Réussite',
  robots: { index: false, follow: false },
};

export default async function DevisTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { quote } = await getFamilyQuoteView(token);
  if (!quote) notFound();

  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 py-14 pt-28 md:px-6">
        <div className="mx-auto max-w-3xl">
          <span className="lux-eyebrow text-lux-gold-wash">{quote.statusLabel}</span>
          <h1 className="mt-3 text-3xl font-light text-lux-ivory md:text-4xl">Votre devis Nexus Réussite</h1>
          <p className="mt-3 text-sm text-lux-on-dark-muted">
            Session {quote.examSession} · Valable jusqu'au{' '}
            {new Date(quote.validUntil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-12 md:px-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-lux-line bg-lux-white p-6 shadow-md shadow-lux-ink/5 md:p-10">
          <div className="grid gap-4 border-b border-lux-line/50 pb-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-lux-slate">Responsable</p>
              <p className="mt-1 font-semibold text-lux-ink">{quote.responsable?.name ?? 'Non renseigné'}</p>
              {quote.responsable?.email && <p className="text-sm text-lux-slate">{quote.responsable.email}</p>}
              {quote.responsable?.phone && <p className="text-sm text-lux-slate">{quote.responsable.phone}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-lux-slate">Élève</p>
              <p className="mt-1 font-semibold text-lux-ink">{quote.eleve?.displayName ?? 'Non renseigné'}</p>
              {quote.profil && (
                <p className="text-sm text-lux-slate">
                  {quote.profil.level} · {quote.profil.specialites.join(' · ')}
                </p>
              )}
              {quote.profil?.parcours && <p className="text-sm text-lux-slate">{quote.profil.parcours}</p>}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-lux-slate">Total annuel</p>
              <p className="lux-price mt-1 text-2xl font-bold text-lux-ink">{fmtTND(quote.totalAnnuel)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-lux-slate">Acompte</p>
              <p className="mt-1 text-lg font-semibold text-lux-ink">
                {quote.acompte == null ? 'Échéancier historique' : fmtTND(quote.acompte)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-lux-slate">Mensualité</p>
              <p className="mt-1 text-lg font-semibold text-lux-ink">{fmtTND(quote.mensualite)}</p>
              <p className="text-xs text-lux-slate">{quote.nombreMensualites} mensualités</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-lux-line/50 pt-6">
            {quote.lines.map((line, index) => (
                <div key={`${line.subject}-${index}`} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-lux-gold" />
                  <div>
                    <p className="text-sm font-semibold text-lux-ink">
                      {line.subject}
                    </p>
                    <p className="text-xs text-lux-slate">
                      {line.format}
                      {line.hoursPerMonth != null && line.hoursPerMonth > 0 ? ` · ${line.hoursPerMonth} h / mois` : ''}
                      {` · ${fmtTND(line.unitPrice)} / mois`}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-8 border-t border-lux-line/50 pt-6">
            <h2 className="text-lg font-semibold text-lux-ink">Échéancier</h2>
            <div className="mt-3 divide-y divide-lux-line/50 rounded-xl border border-lux-line/60">
              {quote.echeancier.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-lux-slate">{item.label}</span>
                  <span className="font-semibold text-lux-ink">{fmtTND(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {quote.warnings.length > 0 && (
            <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              {quote.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}

          <a
            href={`/api/quotes/public/${encodeURIComponent(token)}/pdf`}
            className="lux-cta-reserve mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold"
          >
            Télécharger le PDF
          </a>

          <p className="mt-6 text-xs text-lux-slate">
            Ce devis engage Nexus Réussite selon les modalités habituelles (constitution des groupes, seuils
            d'ouverture). Il n'engage pas de règlement avant votre confirmation.
          </p>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
