'use client';

export function BilanPrintButton() {
  return <button type="button" onClick={() => window.print()} className="print:hidden rounded-lg bg-brand-accent px-5 py-3 font-medium text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Imprimer / enregistrer en PDF</button>;
}
