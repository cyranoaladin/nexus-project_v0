"use client";

import React from 'react';
import Link from 'next/link';
import { ExternalLink, ShieldCheck } from 'lucide-react';

/** Current CGV version — must match the version exported from /conditions-generales page. */
export const CGV_VERSION = 'CGV v1.0 – 2026-03-01';

interface LegalAcceptanceProps {
  /** Whether the user has accepted the CGV. */
  accepted: boolean;
  /** Callback when the checkbox is toggled. */
  onAcceptedChange: (accepted: boolean) => void;
  /** Whether to show the optional "immediate execution" checkbox. */
  showImmediateExecution?: boolean;
  /** State of the optional immediate-execution checkbox. */
  immediateExecution?: boolean;
  /** Callback for immediate-execution checkbox. */
  onImmediateExecutionChange?: (checked: boolean) => void;
  /** Price displayed to the user (for summary). */
  price?: number;
  /** Currency code. */
  currency?: string;
}

/**
 * LegalAcceptance — Checkout legal block (ClicToPay compliance).
 *
 * Displays:
 * - Summary of payment conditions
 * - Link to Conditions Générales (new tab)
 * - Mandatory acceptance checkbox
 * - Optional immediate-execution checkbox
 */
export function LegalAcceptance({
  accepted,
  onAcceptedChange,
  showImmediateExecution = false,
  immediateExecution = false,
  onImmediateExecutionChange,
  price,
  currency = 'TND',
}: LegalAcceptanceProps) {
  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-white font-semibold">
        <ShieldCheck className="w-5 h-5 text-cyan-400" />
        <span>À lire avant paiement</span>
      </div>

      {/* Summary */}
      <ul className="text-sm text-neutral-300 space-y-1.5 pl-1">
        <li className="flex items-start gap-2">
          <span className="text-cyan-400 mt-0.5">•</span>
          <span>
            Les{' '}
            <Link
              href="/conditions-generales"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-accent underline inline-flex items-center gap-1"
            >
              Conditions Générales (CGU + CGV)
              <ExternalLink className="w-3 h-3" />
            </Link>{' '}
            sont accessibles avant paiement.
          </span>
        </li>
        {price !== undefined && (
          <li className="flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">•</span>
            <span>
              Prix : <strong className="text-white">{price} {currency}</strong>
            </span>
          </li>
        )}
        <li className="flex items-start gap-2">
          <span className="text-cyan-400 mt-0.5">•</span>
          <span>Paiement via <strong className="text-white">ClicToPay</strong> (Banque Zitouna) ou virement bancaire.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-cyan-400 mt-0.5">•</span>
          <span>Cartes bancaires <strong className="text-white">nationales et internationales</strong> acceptées.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-cyan-400 mt-0.5">•</span>
          <span>Sécurité : <strong className="text-white">CVV2 + 3D Secure</strong> requis.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-cyan-400 mt-0.5">•</span>
          <span><strong className="text-white">Aucun frais additionnel</strong> lié au paiement par carte.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-cyan-400 mt-0.5">•</span>
          <span>Le cryptogramme visuel (CVV) <strong className="text-white">n&apos;est jamais stocké</strong>.</span>
        </li>
      </ul>

      {/* Mandatory checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
          data-testid="checkbox-accept-cgv"
        />
        <span className="text-sm text-neutral-200 group-hover:text-white transition-colors">
          J&apos;ai lu et j&apos;accepte les{' '}
          <Link
            href="/conditions-generales"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent underline"
          >
            Conditions Générales (CGU + CGV)
          </Link>.
        </span>
      </label>

      {/* Optional: immediate execution waiver */}
      {showImmediateExecution && (
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={immediateExecution}
            onChange={(e) => onImmediateExecutionChange?.(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
            data-testid="checkbox-immediate-execution"
          />
          <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">
            Je demande l&apos;exécution immédiate du service / accès numérique après paiement.
          </span>
        </label>
      )}
    </div>
  );
}
