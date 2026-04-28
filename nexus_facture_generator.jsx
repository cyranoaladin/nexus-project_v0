import React, { useMemo, useState } from "react";

const VAT_RATE = 0.06;

const BRAND = {
  navy: "#0B1F4D",
  navyDeep: "#07142F",
  blue: "#005BBB",
  blueSoft: "#EAF2FF",
  red: "#E31E24",
  redSoft: "#FFF1F1",
  white: "#FFFFFF",
  text: "#1E293B",
  textSoft: "#64748B",
  border: "#D9E2F2",
};

const COMPANY = {
  name: "M&M ACADEMY (NEXUS RÉUSSITE)",
  legal: "SOCIÉTÉ M&M ACADEMY SUARL",
  address1: "Centre Urbain Nord, Immeuble VENUS, Appt C13",
  address2: "1082 – Tunis",
  taxId: "MF : 1948837 N/A/M/000",
  phone: "+216 99 19 28 29",
  email: "contact@nexusreussite.academy",
  web: "nexusreussite.academy",
  bankBeneficiary: "STE M&M ACADEMY SUARL",
  bank: "Banque Zitouna",
  rib: "25 079 000 0001569084 04",
  iban: "TN59 25 079 000 0001569084 04",
  swift: "BZITTNTTXXX",
  manager: "Molka MEZZEZ",
  slogan: "Viser. Atteindre. Dépasser.",
};

const DEFAULT_PACKAGES = [
  {
    id: "duo-premiere",
    label: "Duo Première — Français + Maths",
    subtitle: "Les deux épreuves anticipées dans une seule formule cohérente.",
    totalHours: 30,
    frenchHours: 16,
    mathHours: 14,
    priceTtc: 1149,
    normalPriceTtc: 1188,
    reductionLabel: "Remise formule Duo",
  },
  {
    id: "francais-sprint-eaf",
    label: "Français Première — Sprint EAF",
    subtitle: "Préparation ciblée à l’écrit et à l’oral du Français.",
    totalHours: 16,
    frenchHours: 16,
    mathHours: 0,
    priceTtc: 649,
    normalPriceTtc: 649,
    reductionLabel: "",
  },
  {
    id: "custom",
    label: "Forfait personnalisé",
    subtitle: "Configuration libre selon le volume horaire retenu.",
    totalHours: 0,
    frenchHours: 0,
    mathHours: 0,
    priceTtc: 0,
    normalPriceTtc: 0,
    reductionLabel: "Ajustement personnalisé",
  },
];

function formatMoney(value) {
  const number = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("fr-TN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(number);
}

function numberToFrenchTnd(amount) {
  const units = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

  function belowHundred(n) {
    if (n <= 16) return units[n];
    if (n < 20) return `dix-${units[n - 10]}`;
    if (n < 70) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (u === 0) return tens[t];
      if (u === 1) return `${tens[t]} et un`;
      return `${tens[t]}-${units[u]}`;
    }
    if (n < 80) return `soixante-${belowHundred(n - 60)}`;
    if (n === 80) return "quatre-vingts";
    return `quatre-vingt-${belowHundred(n - 80)}`;
  }

  function belowThousand(n) {
    if (n < 100) return belowHundred(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = h === 1 ? "cent" : `${units[h]} cent`;
    if (r === 0) return h > 1 ? `${hundred}s` : hundred;
    return `${hundred} ${belowHundred(r)}`;
  }

  function convert(n) {
    if (n === 0) return units[0];
    if (n < 1000) return belowThousand(n);
    if (n < 1000000) {
      const th = Math.floor(n / 1000);
      const r = n % 1000;
      const thousand = th === 1 ? "mille" : `${belowThousand(th)} mille`;
      return r === 0 ? thousand : `${thousand} ${belowThousand(r)}`;
    }
    return String(n);
  }

  const rounded = Math.round(Number(amount) || 0);
  return `${convert(rounded).charAt(0).toUpperCase()}${convert(rounded).slice(1)} dinars tunisiens`;
}

export default function NexusInvoiceGenerator() {
  const [packageId, setPackageId] = useState("duo-premiere");
  const selected = DEFAULT_PACKAGES.find((p) => p.id === packageId) || DEFAULT_PACKAGES[0];

  const [invoice, setInvoice] = useState({
    number: "2026-04-001",
    date: new Date().toISOString().slice(0, 10),
    clientName: "Nom du parent / responsable",
    clientInfo: "Client particulier",
    designation: selected.label,
    subtitle: selected.subtitle,
    frenchHours: selected.frenchHours,
    mathHours: selected.mathHours,
    totalHours: selected.totalHours,
    qty: 1,
    normalPriceTtc: selected.normalPriceTtc,
    priceTtc: selected.priceTtc,
    adjustmentTtc: 0,
    adjustmentLabel: "Ajustement séance non suivie",
    eafMonths: 1,
    eafMonthlyValue: 129,
    note: "Accès Masterium offert à titre commercial, non facturé."
  });

  const [payments, setPayments] = useState([
    { method: "Virement bancaire", amount: 0, reference: "" },
    { method: "Chèque", amount: 0, reference: "" },
    { method: "Espèces", amount: 0, reference: "" },
  ]);

  function applyPackage(nextId) {
    const pack = DEFAULT_PACKAGES.find((p) => p.id === nextId) || DEFAULT_PACKAGES[0];
    setPackageId(nextId);
    setInvoice((old) => ({
      ...old,
      designation: pack.label,
      subtitle: pack.subtitle,
      frenchHours: pack.frenchHours,
      mathHours: pack.mathHours,
      totalHours: pack.totalHours,
      normalPriceTtc: pack.normalPriceTtc,
      priceTtc: pack.priceTtc,
    }));
  }

  function updateInvoice(key, value) {
    setInvoice((old) => ({ ...old, [key]: value }));
  }

  function updatePayment(index, key, value) {
    setPayments((old) => old.map((payment, i) => (i === index ? { ...payment, [key]: value } : payment)));
  }

  const totals = useMemo(() => {
    const priceTtc = Number(invoice.priceTtc) || 0;
    const adjustmentTtc = Number(invoice.adjustmentTtc) || 0;
    const netTtc = Math.max(priceTtc - adjustmentTtc, 0);
    const netHt = netTtc / (1 + VAT_RATE);
    const vat = netTtc - netHt;
    const normalPriceTtc = Number(invoice.normalPriceTtc) || priceTtc;
    const packageDiscount = Math.max(normalPriceTtc - priceTtc, 0);
    const eafValue = (Number(invoice.eafMonths) || 0) * (Number(invoice.eafMonthlyValue) || 0);
    const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const due = netTtc - paid;
    return { priceTtc, adjustmentTtc, netTtc, netHt, vat, normalPriceTtc, packageDiscount, eafValue, paid, due };
  }, [invoice, payments]);

  const paymentSummary = payments
    .filter((p) => Number(p.amount) > 0)
    .map((p) => `${p.method} : ${formatMoney(p.amount)} TND${p.reference ? ` (${p.reference})` : ""}`);

  const inputClass = "rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2";
  const panelInputStyle = {
    borderColor: "rgba(191, 216, 255, 0.28)",
    background: "rgba(7, 20, 47, 0.88)",
    color: "white",
  };
  const sideSectionStyle = {
    border: "1px solid rgba(191, 216, 255, 0.18)",
    background: "rgba(7, 20, 47, 0.64)",
  };

  return (
    <div
      className="min-h-screen text-slate-100"
      style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.navyDeep} 58%, #020617 100%)` }}
    >
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; margin: 0 !important; width: 100% !important; max-width: none !important; border-radius: 0 !important; }
          .page-bg { background: white !important; padding: 0 !important; display: block !important; }
          .print-soft-header { background: white !important; }
          .invoice-content { min-height: calc(297mm - 150px) !important; }
        }
      `}</style>

      <div className="page-bg mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[430px_1fr]">
        <aside
          className="no-print rounded-3xl p-5 shadow-2xl"
          style={{
            border: `1px solid rgba(0, 91, 187, 0.65)`,
            background: "rgba(11, 31, 77, 0.92)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
          }}
        >
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: "#BFD8FF" }}>Nexus Réussite</p>
            <h1 className="mt-2 text-2xl font-bold">Générateur de facture</h1>
            <p className="mt-2 text-sm" style={{ color: "#BFD8FF" }}>Configuration du forfait, des heures, de la TVA à 6% et des paiements mixtes.</p>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl p-4" style={sideSectionStyle}>
              <h2 className="mb-3 font-semibold">Forfait</h2>
              <label className="text-xs" style={{ color: "#BFD8FF" }}>Choisir une formule</label>
              <select value={packageId} onChange={(e) => applyPackage(e.target.value)} className={`${inputClass} mt-1 w-full`} style={panelInputStyle}>
                {DEFAULT_PACKAGES.map((pack) => (
                  <option key={pack.id} value={pack.id}>{pack.label}</option>
                ))}
              </select>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs" style={{ color: "#BFD8FF" }}>Prix forfait TTC</label>
                <input type="number" value={invoice.priceTtc} onChange={(e) => updateInvoice("priceTtc", e.target.value)} className={`${inputClass} text-right`} style={panelInputStyle} />
                <label className="text-xs" style={{ color: "#BFD8FF" }}>Prix normal TTC</label>
                <input type="number" value={invoice.normalPriceTtc} onChange={(e) => updateInvoice("normalPriceTtc", e.target.value)} className={`${inputClass} text-right`} style={panelInputStyle} />
              </div>
            </section>

            <section className="rounded-2xl p-4" style={sideSectionStyle}>
              <h2 className="mb-3 font-semibold">Heures et ajustement</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs" style={{ color: "#BFD8FF" }}>Heures Français</label>
                <input type="number" value={invoice.frenchHours} onChange={(e) => updateInvoice("frenchHours", e.target.value)} className={`${inputClass} text-right`} style={panelInputStyle} />
                <label className="text-xs" style={{ color: "#BFD8FF" }}>Heures Maths</label>
                <input type="number" value={invoice.mathHours} onChange={(e) => updateInvoice("mathHours", e.target.value)} className={`${inputClass} text-right`} style={panelInputStyle} />
                <label className="text-xs" style={{ color: "#BFD8FF" }}>Ajustement TTC</label>
                <input type="number" value={invoice.adjustmentTtc} onChange={(e) => updateInvoice("adjustmentTtc", e.target.value)} className={`${inputClass} text-right`} style={panelInputStyle} />
              </div>
              <label className="mt-3 block text-xs" style={{ color: "#BFD8FF" }}>Libellé de l’ajustement</label>
              <input value={invoice.adjustmentLabel} onChange={(e) => updateInvoice("adjustmentLabel", e.target.value)} className={`${inputClass} mt-1 w-full`} style={panelInputStyle} />
            </section>

            <section className="rounded-2xl p-4" style={sideSectionStyle}>
              <h2 className="mb-3 font-semibold">Client et facture</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs" style={{ color: "#BFD8FF" }}>Numéro</label>
                <input value={invoice.number} onChange={(e) => updateInvoice("number", e.target.value)} className={inputClass} style={panelInputStyle} />
                <label className="text-xs" style={{ color: "#BFD8FF" }}>Date</label>
                <input type="date" value={invoice.date} onChange={(e) => updateInvoice("date", e.target.value)} className={inputClass} style={panelInputStyle} />
              </div>
              <label className="mt-3 block text-xs" style={{ color: "#BFD8FF" }}>Facturé à</label>
              <input value={invoice.clientName} onChange={(e) => updateInvoice("clientName", e.target.value)} className={`${inputClass} mt-1 w-full`} style={panelInputStyle} />
              <label className="mt-3 block text-xs" style={{ color: "#BFD8FF" }}>Information client</label>
              <input value={invoice.clientInfo} onChange={(e) => updateInvoice("clientInfo", e.target.value)} className={`${inputClass} mt-1 w-full`} style={panelInputStyle} />
            </section>

            <section className="rounded-2xl p-4" style={sideSectionStyle}>
              <h2 className="mb-3 font-semibold">Accès plateforme offert</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs" style={{ color: "#BFD8FF" }}>Durée Masterium</label>
                <input type="number" value={invoice.eafMonths} onChange={(e) => updateInvoice("eafMonths", e.target.value)} className={`${inputClass} text-right`} style={panelInputStyle} />
                <label className="text-xs" style={{ color: "#BFD8FF" }}>Valeur / mois TTC</label>
                <input type="number" value={invoice.eafMonthlyValue} onChange={(e) => updateInvoice("eafMonthlyValue", e.target.value)} className={`${inputClass} text-right`} style={panelInputStyle} />
              </div>
              <p className="mt-3 rounded-xl px-3 py-2 text-sm font-medium" style={{ border: `1px solid rgba(227, 30, 36, 0.38)`, background: "rgba(227, 30, 36, 0.12)", color: "#FFE0E0" }}>
                Valeur offerte affichée : {formatMoney(totals.eafValue)} TND TTC
              </p>
            </section>

            <section className="rounded-2xl p-4" style={sideSectionStyle}>
              <h2 className="mb-3 font-semibold">Paiements</h2>
              <div className="space-y-3">
                {payments.map((payment, index) => (
                  <div key={`${payment.method}-${index}`} className="grid grid-cols-[1fr_100px] gap-2 rounded-xl p-2" style={{ border: "1px solid rgba(191, 216, 255, 0.16)" }}>
                    <select value={payment.method} onChange={(e) => updatePayment(index, "method", e.target.value)} className="rounded-lg border px-2 py-2 text-xs outline-none" style={panelInputStyle}>
                      <option>Virement bancaire</option>
                      <option>Chèque</option>
                      <option>Espèces</option>
                    </select>
                    <input type="number" value={payment.amount} onChange={(e) => updatePayment(index, "amount", e.target.value)} className="rounded-lg border px-2 py-2 text-right text-xs outline-none" style={panelInputStyle} />
                    <input value={payment.reference} onChange={(e) => updatePayment(index, "reference", e.target.value)} placeholder="Référence, banque, n° chèque…" className="col-span-2 rounded-lg border px-2 py-2 text-xs outline-none placeholder:text-slate-400" style={panelInputStyle} />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl p-3" style={{ background: "rgba(7, 20, 47, 0.78)" }}><span style={{ color: "#BFD8FF" }}>Payé</span><br /><b>{formatMoney(totals.paid)} TND</b></div>
                <div className="rounded-xl p-3" style={{ background: "rgba(7, 20, 47, 0.78)" }}><span style={{ color: "#BFD8FF" }}>Reste</span><br /><b style={{ color: totals.due > 0 ? "#FFD166" : "#B7F7C8" }}>{formatMoney(totals.due)} TND</b></div>
              </div>
            </section>

            <button
              onClick={() => window.print()}
              className="w-full rounded-2xl px-5 py-3 font-bold text-white shadow-lg transition hover:opacity-95"
              style={{
                background: `linear-gradient(90deg, ${BRAND.blue} 0%, ${BRAND.red} 100%)`,
                boxShadow: "0 12px 30px rgba(0, 91, 187, 0.28)",
              }}
            >
              Imprimer / enregistrer en PDF
            </button>
          </div>
        </aside>

        <main
          className="print-area mx-auto flex min-h-[1120px] w-full max-w-[900px] flex-col overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl"
          style={{ border: `1px solid ${BRAND.border}` }}
        >
          <div
            className="print-soft-header border-b px-10 py-8"
            style={{
              borderColor: BRAND.border,
              background: `linear-gradient(90deg, ${BRAND.blueSoft} 0%, #FFFFFF 68%)`,
            }}
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-4">
                  <img
                    src="/images/logo_slogan_nexus.png"
                    alt="Logo Nexus Réussite"
                    className="h-24 w-auto object-contain"
                  />
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-tight" style={{ color: BRAND.navy }}>{COMPANY.name}</h2>
                <p className="mt-1 text-sm" style={{ color: BRAND.textSoft }}>{COMPANY.address1}<br />{COMPANY.address2}<br />{COMPANY.taxId}</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black tracking-tight" style={{ color: BRAND.navy }}>FACTURE</p>
                <p className="mt-3 text-sm" style={{ color: BRAND.textSoft }}>Numéro : <b style={{ color: BRAND.text }}>{invoice.number}</b></p>
                <p className="text-sm" style={{ color: BRAND.textSoft }}>Date : <b style={{ color: BRAND.text }}>{invoice.date}</b></p>
              </div>
            </div>
          </div>

          <div className="invoice-content flex flex-1 flex-col px-10 py-8">
            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-5" style={{ border: `1px solid ${BRAND.border}` }}>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.blue }}>Facturé à</h3>
                <p className="mt-3 text-lg font-bold" style={{ color: BRAND.navy }}>{invoice.clientName}</p>
                <p className="text-sm" style={{ color: BRAND.textSoft }}>{invoice.clientInfo}</p>
              </div>
              <div
                className="rounded-2xl p-5"
                style={{
                  border: `1px solid #BFD8FF`,
                  background: `linear-gradient(135deg, ${BRAND.blueSoft} 0%, ${BRAND.redSoft} 100%)`,
                }}
              >
                <h3 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.red }}>Avantage offert</h3>
                <p className="mt-3 font-bold" style={{ color: BRAND.navy }}>Accès EAF Masterium offert</p>
                <p className="text-sm" style={{ color: BRAND.text }}>Durée : {invoice.eafMonths} mois · Valeur réelle : {formatMoney(totals.eafValue)} TND TTC</p>
                <p className="mt-1 text-xs" style={{ color: BRAND.red }}>Cet avantage est offert et n’est pas inclus dans le total à payer.</p>
              </div>
            </section>

            <section className="mt-8">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.blue }}>Détail de la prestation</h3>
              <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${BRAND.border}` }}>
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
                        <p className="font-bold" style={{ color: BRAND.navy }}>{invoice.designation}</p>
                        <p className="mt-1" style={{ color: BRAND.textSoft }}>{invoice.subtitle}</p>
                        <p className="mt-2 text-xs" style={{ color: BRAND.textSoft }}>Français : {invoice.frenchHours || 0}h · Mathématiques : {invoice.mathHours || 0}h · Total : {(Number(invoice.frenchHours) || 0) + (Number(invoice.mathHours) || 0)}h</p>
                      </td>
                      <td className="px-4 py-4 text-center">{invoice.qty}</td>
                      <td className="px-4 py-4 text-right">{formatMoney(totals.priceTtc / 1.06)}</td>
                      <td className="px-4 py-4 text-right">{formatMoney(totals.priceTtc - totals.priceTtc / 1.06)}</td>
                      <td className="px-4 py-4 text-right font-semibold">{formatMoney(totals.priceTtc)}</td>
                    </tr>
                    {totals.packageDiscount > 0 && (
                      <tr style={{ borderBottom: `1px solid ${BRAND.border}`, color: BRAND.text }}>
                        <td className="px-4 py-3">Remise forfaitaire intégrée</td>
                        <td className="px-4 py-3 text-center">1</td>
                        <td className="px-4 py-3 text-right">− {formatMoney(totals.packageDiscount / 1.06)}</td>
                        <td className="px-4 py-3 text-right">− {formatMoney(totals.packageDiscount - totals.packageDiscount / 1.06)}</td>
                        <td className="px-4 py-3 text-right font-semibold">− {formatMoney(totals.packageDiscount)}</td>
                      </tr>
                    )}
                    {totals.adjustmentTtc > 0 && (
                      <tr style={{ borderBottom: `1px solid ${BRAND.border}`, color: BRAND.text }}>
                        <td className="px-4 py-3">{invoice.adjustmentLabel}</td>
                        <td className="px-4 py-3 text-center">1</td>
                        <td className="px-4 py-3 text-right">− {formatMoney(totals.adjustmentTtc / 1.06)}</td>
                        <td className="px-4 py-3 text-right">− {formatMoney(totals.adjustmentTtc - totals.adjustmentTtc / 1.06)}</td>
                        <td className="px-4 py-3 text-right font-semibold">− {formatMoney(totals.adjustmentTtc)}</td>
                      </tr>
                    )}
                    <tr style={{ background: BRAND.blueSoft, color: BRAND.navy }}>
                      <td className="px-4 py-3 font-medium">Accès plateforme EAF — Masterium offert</td>
                      <td className="px-4 py-3 text-center">{invoice.eafMonths}</td>
                      <td className="px-4 py-3 text-right">0,000</td>
                      <td className="px-4 py-3 text-right">0,000</td>
                      <td className="px-4 py-3 text-right font-semibold">Offert — valeur {formatMoney(totals.eafValue)} TTC</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 grid gap-6 md:grid-cols-[1fr_330px]">
              <div className="rounded-2xl p-5" style={{ border: `1px solid ${BRAND.border}` }}>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: BRAND.blue }}>Modalités de paiement</h3>
                {paymentSummary.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm" style={{ color: BRAND.text }}>
                    {paymentSummary.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm" style={{ color: BRAND.text }}>Paiement possible par virement bancaire, chèque et/ou espèces.</p>
                )}
                <div className="mt-4 rounded-xl p-4 text-sm" style={{ background: "#F8FBFF", color: BRAND.text }}>
                  <p><b>Bénéficiaire :</b> {COMPANY.bankBeneficiary}</p>
                  <p><b>Banque :</b> {COMPANY.bank}</p>
                  <p><b>RIB :</b> {COMPANY.rib}</p>
                  <p><b>IBAN :</b> {COMPANY.iban}</p>
                  <p><b>SWIFT :</b> {COMPANY.swift}</p>
                </div>
              </div>

              <div className="rounded-2xl p-5" style={{ border: `1px solid ${BRAND.border}`, background: "#F8FBFF" }}>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Total HT</span><b>{formatMoney(totals.netHt)} TND</b></div>
                  <div className="flex justify-between"><span>TVA 6%</span><b>{formatMoney(totals.vat)} TND</b></div>
                  <div className="h-px" style={{ background: BRAND.border }} />
                  <div className="flex justify-between text-lg"><span>Total TTC</span><b>{formatMoney(totals.netTtc)} TND</b></div>
                  <div className="flex justify-between" style={{ color: BRAND.textSoft }}><span>Déjà payé</span><b>{formatMoney(totals.paid)} TND</b></div>
                  <div
                    className="flex justify-between rounded-xl px-3 py-3 text-white"
                    style={{ background: `linear-gradient(90deg, ${BRAND.blue} 0%, ${BRAND.red} 100%)` }}
                  >
                    <span>Net à payer</span>
                    <b>{formatMoney(Math.max(totals.due, 0))} TND</b>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-2xl bg-white p-5" style={{ border: `1px solid ${BRAND.border}` }}>
              <p className="text-sm"><b>Arrêté la présente facture à la somme de :</b> {numberToFrenchTnd(totals.netTtc)}.</p>
              <p className="mt-2 text-xs" style={{ color: BRAND.textSoft }}>{invoice.note}</p>
            </section>

            <footer className="mt-auto border-t pt-6" style={{ borderColor: BRAND.border }}>
              <div className="text-center">
                <p
                  className="text-2xl font-black tracking-wide"
                  style={{
                    background: `linear-gradient(90deg, ${BRAND.blue} 0%, ${BRAND.navy} 48%, ${BRAND.red} 100%)`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {COMPANY.slogan}
                </p>

                <div
                  className="mx-auto mt-4 h-[3px] w-40 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${BRAND.blue} 0%, ${BRAND.red} 100%)` }}
                />

                <p className="mt-4 text-xs font-medium" style={{ color: BRAND.text }}>
                  {COMPANY.address1}, {COMPANY.address2}
                </p>
                <p className="mt-1 text-xs" style={{ color: BRAND.textSoft }}>
                  Tél : {COMPANY.phone} | Email : {COMPANY.email} | Web : {COMPANY.web}
                </p>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
