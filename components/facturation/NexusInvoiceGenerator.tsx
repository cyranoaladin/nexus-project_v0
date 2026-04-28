'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Printer, Trash2 } from 'lucide-react';
import {
  MASTERIUM_MONTHLY_VALUE,
  NEXUS_INVOICE_PACKAGES,
  buildNexusInvoiceRequest,
  buildPaymentSummary,
  calculateNexusInvoiceTotals,
  formatTnd,
  millimesToTnd,
  tndToMillimes,
  type NexusInvoicePackageId,
  type NexusMixedPayment,
} from '@/lib/invoice/nexus-calculations';

const BRAND = {
  navy: '#0B1F4D',
  navyDeep: '#07142F',
  blue: '#005BBB',
  blueSoft: '#EAF2FF',
  red: '#E31E24',
  redSoft: '#FFF1F1',
  text: '#1E293B',
  textSoft: '#64748B',
  border: '#D9E2F2',
};

const COMPANY = {
  name: 'M&M ACADEMY (NEXUS RÉUSSITE)',
  address: 'Centre Urbain Nord, Immeuble VENUS, Appt C13, 1082 – Tunis',
  taxId: 'MF : 1948837 N/A/M/000',
  phone: '+216 99 19 28 29',
  email: 'contact@nexusreussite.academy',
  web: 'nexusreussite.academy',
  bankBeneficiary: 'STE M&M ACADEMY SUARL',
  bank: 'Banque Zitouna',
  rib: '25 079 000 0001569084 04',
  iban: 'TN59 25 079 000 0001569084 04',
  swift: 'BZITTNTTXXX',
};

type PaymentFormRow = NexusMixedPayment;

const EMPTY_PAYMENT: PaymentFormRow = { method: 'BANK_TRANSFER', amount: 0, reference: '' };

function numberToFrenchTnd(amount: number): string {
  const value = Math.round(millimesToTnd(amount));
  if (value === 0) return 'Zéro dinar tunisien';
  return `${value.toLocaleString('fr-FR')} dinars tunisiens`;
}

export function NexusInvoiceGenerator() {
  const [packageId, setPackageId] = useState<NexusInvoicePackageId>('duo-premiere');
  const selected = NEXUS_INVOICE_PACKAGES.find((pack) => pack.id === packageId) ?? NEXUS_INVOICE_PACKAGES[0];
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('Nom du parent / responsable');
  const [customerInfo, setCustomerInfo] = useState('Client particulier');
  const [designation, setDesignation] = useState(selected.label);
  const [subtitle, setSubtitle] = useState(selected.subtitle);
  const [frenchHours, setFrenchHours] = useState(selected.frenchHours);
  const [mathHours, setMathHours] = useState(selected.mathHours);
  const [priceTtc, setPriceTtc] = useState(selected.priceTtc);
  const [normalPriceTtc, setNormalPriceTtc] = useState(selected.normalPriceTtc);
  const [adjustmentTtc, setAdjustmentTtc] = useState(0);
  const [adjustmentLabel, setAdjustmentLabel] = useState('Ajustement séance non suivie');
  const [masteriumMonths, setMasteriumMonths] = useState(1);
  const [payments, setPayments] = useState<PaymentFormRow[]>([
    { method: 'BANK_TRANSFER', amount: 0, reference: '' },
    { method: 'CHEQUE', amount: 0, reference: '' },
    { method: 'CASH', amount: 0, reference: '' },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPdfUrl, setCreatedPdfUrl] = useState<string | null>(null);

  const totals = useMemo(
    () => calculateNexusInvoiceTotals({
      priceTtc,
      normalPriceTtc,
      adjustmentTtc,
      payments,
      masteriumMonths,
      masteriumMonthlyValue: MASTERIUM_MONTHLY_VALUE,
    }),
    [adjustmentTtc, masteriumMonths, normalPriceTtc, payments, priceTtc]
  );
  const paymentSummary = buildPaymentSummary(payments);

  function applyPackage(nextId: NexusInvoicePackageId) {
    const pack = NEXUS_INVOICE_PACKAGES.find((item) => item.id === nextId) ?? NEXUS_INVOICE_PACKAGES[0];
    setPackageId(nextId);
    setDesignation(pack.label);
    setSubtitle(pack.subtitle);
    setFrenchHours(pack.frenchHours);
    setMathHours(pack.mathHours);
    setPriceTtc(pack.priceTtc);
    setNormalPriceTtc(pack.normalPriceTtc);
  }

  function updatePayment(index: number, patch: Partial<PaymentFormRow>) {
    setPayments((current) => current.map((payment, i) => (i === index ? { ...payment, ...patch } : payment)));
  }

  function addPayment() {
    setPayments((current) => [...current, { ...EMPTY_PAYMENT }]);
  }

  function removePayment(index: number) {
    setPayments((current) => current.filter((_, i) => i !== index));
  }

  async function createInvoice() {
    if (!customerName.trim()) {
      setError('Le nom du client est requis.');
      return;
    }
    if (!designation.trim()) {
      setError('Le libellé du forfait est requis.');
      return;
    }

    setCreating(true);
    setError(null);
    setCreatedPdfUrl(null);
    try {
      const body = buildNexusInvoiceRequest({
        customerName,
        customerInfo,
        invoiceNumber,
        invoiceDate,
        packageLabel: designation,
        packageSubtitle: subtitle,
        frenchHours,
        mathHours,
        priceTtc,
        normalPriceTtc,
        adjustmentTtc,
        adjustmentLabel,
        payments,
        masteriumMonths,
        masteriumMonthlyValue: MASTERIUM_MONTHLY_VALUE,
        notes: 'Accès Masterium offert à titre commercial, non facturé.',
      });

      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? result.details ?? 'Erreur lors de la génération de la facture.');
        return;
      }
      setCreatedPdfUrl(result.pdfUrl ?? null);
      if (result.pdfUrl) window.open(result.pdfUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Erreur réseau lors de la génération de la facture.');
    } finally {
      setCreating(false);
    }
  }

  const inputClass = 'rounded-lg border border-white/15 bg-surface-elevated px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-brand-primary';
  const labelClass = 'text-xs font-medium text-blue-100';

  return (
    <div className="min-h-screen text-slate-100">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important; border-radius: 0 !important; }
        }
      `}</style>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <aside className="no-print rounded-xl border border-white/10 bg-surface-card p-5 shadow-xl">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">Nexus Réussite</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Générateur de facture</h1>
            <p className="mt-2 text-sm text-neutral-400">Création production via le moteur de factures Nexus.</p>
          </div>

          <div className="space-y-5">
            <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="font-semibold text-white">Forfait</h2>
              <label className={labelClass} htmlFor="invoice-package">Choisir une formule</label>
              <select
                id="invoice-package"
                value={packageId}
                onChange={(event) => applyPackage(event.target.value as NexusInvoicePackageId)}
                className={`${inputClass} w-full`}
              >
                {NEXUS_INVOICE_PACKAGES.map((pack) => (
                  <option key={pack.id} value={pack.id}>{pack.label}</option>
                ))}
              </select>

              <label className={labelClass} htmlFor="designation">Libellé</label>
              <input id="designation" value={designation} onChange={(event) => setDesignation(event.target.value)} className={`${inputClass} w-full`} />
              <label className={labelClass} htmlFor="subtitle">Description</label>
              <input id="subtitle" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} className={`${inputClass} w-full`} />

              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass} htmlFor="price-ttc">Prix TTC</label>
                <input id="price-ttc" type="number" value={millimesToTnd(priceTtc)} onChange={(event) => setPriceTtc(tndToMillimes(Number(event.target.value)))} className={`${inputClass} text-right`} />
                <label className={labelClass} htmlFor="normal-price-ttc">Prix normal TTC</label>
                <input id="normal-price-ttc" type="number" value={millimesToTnd(normalPriceTtc)} onChange={(event) => setNormalPriceTtc(tndToMillimes(Number(event.target.value)))} className={`${inputClass} text-right`} />
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="font-semibold text-white">Client et facture</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass} htmlFor="invoice-number">Numéro</label>
                <input id="invoice-number" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="auto si vide" className={inputClass} />
                <label className={labelClass} htmlFor="invoice-date">Date</label>
                <input id="invoice-date" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} className={inputClass} />
              </div>
              <label className={labelClass} htmlFor="customer-name">Facturé à</label>
              <input id="customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={`${inputClass} w-full`} />
              <label className={labelClass} htmlFor="customer-info">Information client</label>
              <input id="customer-info" value={customerInfo} onChange={(event) => setCustomerInfo(event.target.value)} className={`${inputClass} w-full`} />
            </section>

            <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="font-semibold text-white">Heures et ajustement</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass} htmlFor="french-hours">Heures Français</label>
                <input id="french-hours" type="number" value={frenchHours} onChange={(event) => setFrenchHours(Number(event.target.value))} className={`${inputClass} text-right`} />
                <label className={labelClass} htmlFor="math-hours">Heures Maths</label>
                <input id="math-hours" type="number" value={mathHours} onChange={(event) => setMathHours(Number(event.target.value))} className={`${inputClass} text-right`} />
                <label className={labelClass} htmlFor="adjustment">Ajustement TTC</label>
                <input id="adjustment" type="number" value={millimesToTnd(adjustmentTtc)} onChange={(event) => setAdjustmentTtc(tndToMillimes(Number(event.target.value)))} className={`${inputClass} text-right`} />
              </div>
              <label className={labelClass} htmlFor="adjustment-label">Libellé de l&apos;ajustement</label>
              <input id="adjustment-label" value={adjustmentLabel} onChange={(event) => setAdjustmentLabel(event.target.value)} className={`${inputClass} w-full`} />
            </section>

            <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="font-semibold text-white">Paiements mixtes</h2>
              {payments.map((payment, index) => (
                <div key={`${payment.method}-${index}`} className="grid grid-cols-[1fr_100px_32px] gap-2 rounded-lg border border-white/10 p-2">
                  <select value={payment.method} onChange={(event) => updatePayment(index, { method: event.target.value as PaymentFormRow['method'] })} className={inputClass}>
                    <option value="BANK_TRANSFER">Virement bancaire</option>
                    <option value="CHEQUE">Chèque</option>
                    <option value="CASH">Espèces</option>
                  </select>
                  <input type="number" value={millimesToTnd(payment.amount)} onChange={(event) => updatePayment(index, { amount: tndToMillimes(Number(event.target.value)) })} className={`${inputClass} text-right`} />
                  <button type="button" onClick={() => removePayment(index)} className="rounded-lg border border-white/10 text-neutral-400 hover:text-white" aria-label="Supprimer paiement">
                    <Trash2 className="mx-auto h-4 w-4" />
                  </button>
                  <input value={payment.reference} onChange={(event) => updatePayment(index, { reference: event.target.value })} placeholder="Référence, banque, n° chèque, remarque" className={`${inputClass} col-span-3 w-full`} />
                </div>
              ))}
              <button type="button" onClick={addPayment} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-200 hover:text-white">
                <Plus className="h-4 w-4" /> Ajouter un paiement
              </button>
            </section>

            <section className="rounded-lg border border-red-300/30 bg-red-500/10 p-4">
              <h2 className="font-semibold text-white">Accès plateforme offert</h2>
              <p className="mt-2 text-sm text-red-100">Accès plateforme EAF — Masterium offert</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className={labelClass} htmlFor="masterium-months">Durée Masterium</label>
                <input id="masterium-months" type="number" value={masteriumMonths} onChange={(event) => setMasteriumMonths(Number(event.target.value))} className={`${inputClass} text-right`} />
              </div>
              <p className="mt-3 text-sm font-medium text-red-100">Valeur offerte : {formatTnd(totals.masteriumOfferedValue)}</p>
            </section>

            {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            {createdPdfUrl && (
              <a href={createdPdfUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                Facture générée. Ouvrir le PDF
              </a>
            )}

            <button
              type="button"
              onClick={createInvoice}
              disabled={creating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-3 font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Générer la facture PDF
            </button>
          </div>
        </aside>

        <main className="print-area min-h-[1120px] overflow-hidden rounded-xl bg-white text-slate-950 shadow-2xl" style={{ border: `1px solid ${BRAND.border}` }}>
          <div className="border-b px-8 py-7" style={{ borderColor: BRAND.border, background: `linear-gradient(90deg, ${BRAND.blueSoft} 0%, #FFFFFF 68%)` }}>
            <div className="flex items-start justify-between gap-6">
              <div>
                <img src="/images/logo_slogan_nexus.png" alt="Logo Nexus Réussite" className="h-24 w-auto object-contain" />
                <h2 className="mt-4 text-2xl font-black tracking-tight" style={{ color: BRAND.navy }}>{COMPANY.name}</h2>
                <p className="mt-1 text-sm" style={{ color: BRAND.textSoft }}>{COMPANY.address}<br />{COMPANY.taxId}</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black tracking-tight" style={{ color: BRAND.navy }}>FACTURE</p>
                <p className="mt-3 text-sm" style={{ color: BRAND.textSoft }}>Numéro : <b style={{ color: BRAND.text }}>{invoiceNumber || 'Attribué à la génération'}</b></p>
                <p className="text-sm" style={{ color: BRAND.textSoft }}>Date : <b style={{ color: BRAND.text }}>{invoiceDate}</b></p>
              </div>
            </div>
          </div>

          <div className="flex min-h-[900px] flex-col px-8 py-7">
            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${BRAND.border}` }}>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.blue }}>Facturé à</h3>
                <p className="mt-3 text-lg font-bold" style={{ color: BRAND.navy }}>{customerName}</p>
                <p className="text-sm" style={{ color: BRAND.textSoft }}>{customerInfo}</p>
              </div>
              <div className="rounded-xl p-5" style={{ border: '1px solid #BFD8FF', background: `linear-gradient(135deg, ${BRAND.blueSoft} 0%, ${BRAND.redSoft} 100%)` }}>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.red }}>Avantage offert</h3>
                <p className="mt-3 font-bold" style={{ color: BRAND.navy }}>Accès plateforme EAF — Masterium offert</p>
                <p className="text-sm" style={{ color: BRAND.text }}>Durée : {masteriumMonths} mois · Valeur réelle : {formatTnd(totals.masteriumOfferedValue)}</p>
                <p className="mt-1 text-xs" style={{ color: BRAND.red }}>Cet avantage est offert et n&apos;est pas inclus dans le total à payer.</p>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.blue }}>Détail de la prestation</h3>
              <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${BRAND.border}` }}>
                <table className="w-full border-collapse text-sm">
                  <thead className="text-white" style={{ background: `linear-gradient(90deg, ${BRAND.navy} 0%, ${BRAND.blue} 100%)` }}>
                    <tr>
                      <th className="px-4 py-3 text-left">Désignation</th>
                      <th className="px-4 py-3 text-center">Qté</th>
                      <th className="px-4 py-3 text-right">Montant HT</th>
                      <th className="px-4 py-3 text-right">TVA 6%</th>
                      <th className="px-4 py-3 text-right">Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top" style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                      <td className="px-4 py-4">
                        <p className="font-bold" style={{ color: BRAND.navy }}>{designation}</p>
                        <p className="mt-1" style={{ color: BRAND.textSoft }}>{subtitle}</p>
                        <p className="mt-2 text-xs" style={{ color: BRAND.textSoft }}>Français : {frenchHours || 0}h · Mathématiques : {mathHours || 0}h · Total : {(frenchHours || 0) + (mathHours || 0)}h</p>
                      </td>
                      <td className="px-4 py-4 text-center">1</td>
                      <td className="px-4 py-4 text-right">{formatTnd(Math.round(priceTtc / 1.06))}</td>
                      <td className="px-4 py-4 text-right">{formatTnd(priceTtc - Math.round(priceTtc / 1.06))}</td>
                      <td className="px-4 py-4 text-right font-semibold">{formatTnd(priceTtc)}</td>
                    </tr>
                    {totals.packageDiscount > 0 && (
                      <tr style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                        <td className="px-4 py-3">Remise forfaitaire intégrée</td>
                        <td className="px-4 py-3 text-center">1</td>
                        <td className="px-4 py-3 text-right">- {formatTnd(Math.round(totals.packageDiscount / 1.06))}</td>
                        <td className="px-4 py-3 text-right">- {formatTnd(totals.packageDiscount - Math.round(totals.packageDiscount / 1.06))}</td>
                        <td className="px-4 py-3 text-right font-semibold">- {formatTnd(totals.packageDiscount)}</td>
                      </tr>
                    )}
                    {totals.adjustmentTtc > 0 && (
                      <tr style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                        <td className="px-4 py-3">{adjustmentLabel}</td>
                        <td className="px-4 py-3 text-center">1</td>
                        <td className="px-4 py-3 text-right">- {formatTnd(Math.round(totals.adjustmentTtc / 1.06))}</td>
                        <td className="px-4 py-3 text-right">- {formatTnd(totals.adjustmentTtc - Math.round(totals.adjustmentTtc / 1.06))}</td>
                        <td className="px-4 py-3 text-right font-semibold">- {formatTnd(totals.adjustmentTtc)}</td>
                      </tr>
                    )}
                    <tr style={{ background: BRAND.blueSoft, color: BRAND.navy }}>
                      <td className="px-4 py-3 font-medium">Accès plateforme EAF — Masterium offert</td>
                      <td className="px-4 py-3 text-center">{masteriumMonths}</td>
                      <td className="px-4 py-3 text-right">0,000 TND</td>
                      <td className="px-4 py-3 text-right">0,000 TND</td>
                      <td className="px-4 py-3 text-right font-semibold">Offert — valeur {formatTnd(totals.masteriumOfferedValue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 grid gap-6 md:grid-cols-[1fr_330px]">
              <div className="rounded-xl p-5" style={{ border: `1px solid ${BRAND.border}` }}>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.blue }}>Modalités de paiement</h3>
                {paymentSummary.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm" style={{ color: BRAND.text }}>
                    {paymentSummary.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm" style={{ color: BRAND.text }}>Paiement possible par virement bancaire, chèque et/ou espèces.</p>
                )}
                <div className="mt-4 rounded-xl p-4 text-sm" style={{ background: '#F8FBFF', color: BRAND.text }}>
                  <p><b>Bénéficiaire :</b> {COMPANY.bankBeneficiary}</p>
                  <p><b>Banque :</b> {COMPANY.bank}</p>
                  <p><b>RIB :</b> {COMPANY.rib}</p>
                  <p><b>IBAN :</b> {COMPANY.iban}</p>
                  <p><b>SWIFT :</b> {COMPANY.swift}</p>
                </div>
              </div>

              <div className="rounded-xl p-5" style={{ border: `1px solid ${BRAND.border}`, background: '#F8FBFF' }}>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Total HT</span><b>{formatTnd(totals.netHt)}</b></div>
                  <div className="flex justify-between"><span>TVA 6%</span><b>{formatTnd(totals.vat)}</b></div>
                  <div className="h-px" style={{ background: BRAND.border }} />
                  <div className="flex justify-between text-lg"><span>Total TTC</span><b>{formatTnd(totals.netTtc)}</b></div>
                  <div className="flex justify-between" style={{ color: BRAND.textSoft }}><span>Net payé</span><b>{formatTnd(totals.paid)}</b></div>
                  <div className="flex justify-between rounded-xl px-3 py-3 text-white" style={{ background: `linear-gradient(90deg, ${BRAND.blue} 0%, ${BRAND.red} 100%)` }}>
                    <span>Reste à payer</span>
                    <b>{formatTnd(totals.due)}</b>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-xl bg-white p-5" style={{ border: `1px solid ${BRAND.border}` }}>
              <p className="text-sm"><b>Arrêté la présente facture à la somme de :</b> {numberToFrenchTnd(totals.netTtc)}.</p>
              <p className="mt-2 text-xs" style={{ color: BRAND.textSoft }}>Accès Masterium offert à titre commercial, non facturé.</p>
            </section>

            <footer className="mt-auto border-t pt-6 text-center" style={{ borderColor: BRAND.border }}>
              <p className="text-2xl font-black tracking-wide" style={{ color: BRAND.navy }}>Viser. Atteindre. Dépasser.</p>
              <div className="mx-auto mt-4 h-[3px] w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${BRAND.blue} 0%, ${BRAND.red} 100%)` }} />
              <p className="mt-4 text-xs font-medium" style={{ color: BRAND.text }}>{COMPANY.address}</p>
              <p className="mt-1 text-xs" style={{ color: BRAND.textSoft }}>Tél : {COMPANY.phone} | Email : {COMPANY.email} | Web : {COMPANY.web}</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
