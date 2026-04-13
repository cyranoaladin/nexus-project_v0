"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Bank details (single source of truth) ──────────────────
export const BANK_DETAILS = {
  identifiant: "871456",
  titulaire: "STE M&M ACADEMY SUARL",
  nature: "COMPTES CHEQUES ENTREPRISES",
  rib: "RIB25079000000156908404",
  iban: "TN5925079000000156908404",
  bic: "BZITTNTT",
} as const;

// ── Copy-to-clipboard helper row ────────────────────────────
function DetailRow({
  label,
  value,
  mono = false,
  copiable = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copiable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may not be available on http */
    }
  }, [value]);

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 text-sm text-white break-all",
            mono && "font-mono"
          )}
        >
          {value}
        </p>
      </div>
      {copiable && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 mt-3 inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.08] hover:text-white/80"
          aria-label={`Copier ${label}`}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" /> Copié
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copier
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────
export default function BankTransferInstructions({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/8",
        className
      )}
    >
      {/* Header instruction */}
      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-white/70">
          Ajoutez l&apos;email du compte ou l&apos;identifiant utilisateur dans
          le motif du virement.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-white/70">
          La formule sera activée après vérification manuelle du règlement.
        </p>
      </div>

      {/* Bank details */}
      <div className="px-5 py-4 space-y-0 divide-y divide-white/6">
        <DetailRow label="Identifiant" value={BANK_DETAILS.identifiant} mono copiable />
        <DetailRow label="Titulaire" value={BANK_DETAILS.titulaire} />
        <DetailRow label="Nature du compte" value={BANK_DETAILS.nature} />
        <DetailRow label="RIB" value={BANK_DETAILS.rib} mono copiable />
        <DetailRow label="IBAN" value={BANK_DETAILS.iban} mono copiable />
        <DetailRow label="BIC" value={BANK_DETAILS.bic} mono copiable />
      </div>
    </div>
  );
}
