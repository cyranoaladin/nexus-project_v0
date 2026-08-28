import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { fmtTND } from '@/components/premium/format';
import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { getLegacyRegulatoryDisclaimer } from '@/lib/quotes/regulatory-maturity';
import { AcceptQuoteButton } from '@/components/quotes/AcceptQuoteButton';
import { commercialWarningsFromLines } from '@/lib/quotes/pdf-adapter.server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Votre devis Nexus Réussite',
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  ESTIMATION: 'Estimation provisoire',
  BILAN_A_FAIRE: 'En attente de votre bilan',
  BILAN_TERMINE: 'Bilan terminé',
  DEVIS_ENVOYE: 'Devis envoyé',
  DEVIS_CONSULTE: 'Devis consulté',
  A_RAPPELER: 'À rappeler',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  INSCRIT: 'Inscription confirmée',
  EXPIRE: 'Expiré',
};

const MODALITY_LABELS: Record<string, string> = {
  PILOTAGE: 'Pilotage',
  GROUPE: 'Petit groupe',
  DUO: 'Duo',
  INDIVIDUEL: 'Individuel',
  PACK: 'Parcours combiné',
};

export default async function DevisTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { quote } = await getQuoteForFamilyView(token);
  if (!quote) notFound();

  const canAccept = quote.status === 'DEVIS_ENVOYE' || quote.status === 'DEVIS_CONSULTE' || quote.status === 'A_RAPPELER';
  const legacyDisclaimer = getLegacyRegulatoryDisclaimer(quote.regulatoryMaturity);
  // T5R5 §FINDING_13 — the beneficiary must be visible; falls back to
  // nothing (no placeholder/technical id) when the quote predates identity
  // attachment, rather than showing a raw internal reference.
  const studentUser = quote.student?.user;
  const studentName = studentUser ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(' ') : null;
  // T5R5 §FINDING_12 — the same safe extraction the PDF already uses;
  // QuoteLine.reason itself (staff pricing-engine reasoning) is never
  // rendered here.
  const warnings = commercialWarningsFromLines(quote.lines);

  return (
    <main className="luxury" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 py-14 pt-28 md:px-6">
        <div className="mx-auto max-w-3xl">
          <span className="lux-eyebrow text-lux-gold-wash">{STATUS_LABELS[quote.status] ?? quote.status}</span>
          <h1 className="mt-3 text-3xl font-light text-lux-ivory md:text-4xl">Votre devis Nexus Réussite</h1>
          {studentName && (
            <p className="mt-2 text-base text-lux-ivory/90">Proposition pour {studentName}</p>
          )}
          <p className="mt-3 text-sm text-lux-on-dark-muted">
            Session {quote.examSession} · Valable jusqu'au{' '}
            {new Date(quote.validUntil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-12 md:px-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-lux-line bg-lux-white p-6 shadow-md shadow-lux-ink/5 md:p-10">
          {legacyDisclaimer && (
            <div
              role="note"
              className="mb-6 rounded-lg border border-lux-gold/40 bg-lux-gold/10 p-4 text-sm text-lux-ink"
            >
              <p className="font-semibold">Estimation provisoire — vérification réglementaire requise</p>
              <p className="mt-1 text-lux-slate">{legacyDisclaimer}</p>
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <span className="lux-price text-3xl font-bold text-lux-ink">
              {fmtTND(quote.paymentPolicy === 'PAY_IN_FULL_AT_BOOKING' ? quote.grandTotal : quote.monthlyTotal)}
            </span>
            {quote.paymentPolicy !== 'PAY_IN_FULL_AT_BOOKING' && (
              <span className="text-sm font-medium text-lux-slate">/ mois</span>
            )}
          </div>
          <p className="mt-1 text-sm text-lux-slate">
            {quote.paymentPolicy === 'PAY_IN_FULL_AT_BOOKING'
              ? `Paiement intégral à la réservation — pas d'échéancier annuel · Total ${fmtTND(quote.grandTotal)}`
              : quote.deposit != null
                ? `Acompte ${fmtTND(quote.deposit)} (25%, non remboursable sauf non-ouverture du groupe) + 10 mensualités · Total annuel ${fmtTND(quote.grandTotal)}`
                : `10 mensualités · Total annuel ${fmtTND(quote.grandTotal)} · Échéancier historique (émis avant la mise à jour de l'échéancier)`}
          </p>

          <div className="mt-6 space-y-3 border-t border-lux-line/50 pt-6">
            {quote.lines
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((line) => (
                <div key={line.id} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-lux-gold" />
                  <div>
                    <p className="text-sm font-semibold text-lux-ink">
                      {line.subject}
                      {line.hoursPerMonth != null && line.hoursPerMonth > 0 && (
                        <span className="ml-1 font-normal text-lux-slate">— {line.hoursPerMonth} h/mois</span>
                      )}
                    </p>
                    <p className="text-xs text-lux-slate">
                      {MODALITY_LABELS[line.modality] ?? line.modality}
                      {line.modality !== 'PILOTAGE' && line.modality !== 'PACK' ? ` · ${fmtTND(line.unitPrice)}/mois` : ''}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          {warnings.length > 0 && (
            <div className="mt-6 space-y-2 border-t border-lux-line/50 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-lux-slate">Avertissements</p>
              {warnings.map((warning) => (
                <p key={warning} className="text-xs text-lux-slate">{warning}</p>
              ))}
            </div>
          )}

          {quote.profilId != null && (
            <div className="mt-6 border-t border-lux-line/50 pt-6">
              <a
                href={`/api/quotes/public/${token}/pdf`}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-lux-line px-4 py-2 text-sm font-semibold text-lux-ink transition-colors hover:border-lux-gold/40"
              >
                Télécharger le devis (PDF)
              </a>
            </div>
          )}

          {canAccept && (
            <div className="mt-8 border-t border-lux-line/50 pt-6">
              <AcceptQuoteButton quoteId={quote.id} token={token} />
            </div>
          )}

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
