"use client";

import { useRef } from "react";
import { ArrowRight, Check, ChevronDown, Clock, User } from "lucide-react";

import type { Emphasis, Offer } from "../_data/offers";
import OfferPriceBlock from "./OfferPriceBlock";

type OfferAccordionCardProps = {
  offer: Offer;
  isOpen: boolean;
  onToggle: () => void;
  onReserve?: (offer: Offer) => void;
};

function emphasisBorder(emphasis: Emphasis): string {
  switch (emphasis) {
    case "maximale":
      return "border-nexus-amber/35 shadow-[0_0_0_1px_rgba(245,158,11,0.06)]";
    case "premium":
      return "border-nexus-purple/30 shadow-[0_0_0_1px_rgba(167,139,250,0.06)]";
    case "forte":
      return "border-nexus-green/25";
    default:
      return "border-white/8";
  }
}

function ctaVariant(emphasis: Emphasis): "green" | "purple" | "outline" {
  switch (emphasis) {
    case "maximale":
      return "green";
    case "premium":
      return "purple";
    default:
      return "outline";
  }
}

const isSecondary = (e: Emphasis) => e === "standard" || e === "secondaire";

const PRICING_NOTE =
  "Le tarif affiché correspond au palier standard de la formule. Un ajustement à la baisse peut s\u2019appliquer si le groupe se complète avant son lancement.";

export default function OfferAccordionCard({
  offer,
  isOpen,
  onToggle,
  onReserve,
}: OfferAccordionCardProps) {
  const cardId = `offer-${offer.id}`;
  const panelId = `panel-${offer.id}`;
  const panelRef = useRef<HTMLDivElement>(null);
  const hasSaving = !!(offer.priceReference && offer.saving);
  const muted = isSecondary(offer.emphasis);

  return (
    <article
      className={`overflow-hidden rounded-[24px] border transition-colors duration-200 ${emphasisBorder(
        offer.emphasis
      )} ${
        muted
          ? "bg-white/[0.015] hover:bg-white/[0.025]"
          : "bg-white/[0.025] hover:bg-white/[0.035]"
      } ${offer.emphasis === "maximale" ? "ring-1 ring-nexus-amber/15" : ""}`}
    >
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        id={cardId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full min-h-[3rem] items-start gap-3 px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nexus-green/50 sm:items-center sm:gap-4 sm:px-6"
      >
        {/* Badge */}
        <span
          className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] sm:mt-0 ${
            muted ? "opacity-70" : ""
          }`}
          style={{
            borderColor: `${offer.badgeColor}55`,
            backgroundColor: `${offer.badgeColor}14`,
            color: offer.badgeColor,
          }}
        >
          {offer.badge}
        </span>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <h3
            className={`font-display text-base font-bold leading-snug sm:text-lg ${
              muted ? "text-white/75" : "text-white"
            }`}
          >
            {offer.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {offer.hours}h
            </span>
            {offer.category !== "mono" && offer.category !== "complement" ? (
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">
                {offer.category}
              </span>
            ) : null}
          </div>
        </div>

        {/* Price (compact, desktop only) + chevron */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden sm:block">
            <OfferPriceBlock offer={offer} compact />
          </div>
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 ${
              isOpen
                ? "rotate-180 border-nexus-green/35 bg-nexus-green/10"
                : "border-white/12 bg-white/[0.04]"
            }`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-colors ${
                isOpen ? "text-nexus-green" : "text-white/40"
              }`}
              aria-hidden="true"
            />
          </span>
        </div>
      </button>

      {/* ── Collapsed footer (mobile price + accroche on mobile only) ── */}
      {!isOpen ? (
        <div className="border-t border-white/5 px-5 py-3 sm:hidden">
          <div className="flex items-center gap-2">
            <OfferPriceBlock offer={offer} compact />
            {hasSaving ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-nexus-green/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-nexus-green/90">
                −{offer.saving}&nbsp;TND
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs leading-5 text-white/40">
            {offer.accrocheCourte}
          </p>
          <p className="mt-1.5 text-[10px] leading-4 text-white/28">
            {PRICING_NOTE}
          </p>
        </div>
      ) : null}

      {/* ── Expandable panel (CSS grid transition) ── */}
      <div
        id={panelId}
        ref={panelRef}
        role="region"
        aria-labelledby={cardId}
        className="grid transition-[grid-template-rows] duration-250 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/6 px-5 pb-6 pt-4 sm:px-6">
            {/* Intro */}
            <p className="text-sm leading-7 text-white/60">{offer.intro}</p>

            {/* Points */}
            <ul className="mt-4 space-y-2 text-sm leading-6 text-white/65">
              {offer.points.map((point) => (
                <li key={point} className="flex gap-2.5">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-nexus-green"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {/* Pour qui */}
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-white/35" aria-hidden="true" />
              <p className="text-xs leading-5 text-white/50">{offer.pourQui}</p>
            </div>

            {/* Avantage pack */}
            {offer.avantagePack ? (
              <p className="mt-3 text-xs font-medium italic leading-5 text-nexus-green/75">
                {offer.avantagePack}
              </p>
            ) : null}

            {/* Full price block */}
            <div className="mt-5">
              <OfferPriceBlock offer={offer} />
            </div>

            {/* Pricing note */}
            <p className="mt-2.5 max-w-md text-[11px] leading-[1.45] text-white/30">
              {PRICING_NOTE}
            </p>

            {/* CTA (open state) */}
            <div className="mt-5">
              <button
                type="button"
                onClick={() => onReserve?.(offer)}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-display font-bold tracking-[0.02em] transition-all duration-200 hover:-translate-y-0.5 w-full sm:w-auto ${
                  ctaVariant(offer.emphasis) === "green"
                    ? "bg-gradient-to-r from-nexus-green to-nexus-green-dark text-white shadow-[0_18px_55px_rgba(16,185,129,0.25)] hover:brightness-110"
                    : ctaVariant(offer.emphasis) === "purple"
                    ? "bg-gradient-to-r from-nexus-purple to-nexus-purple-dark text-white shadow-[0_18px_55px_rgba(167,139,250,0.25)] hover:brightness-110"
                    : "border border-white/18 text-white/82 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {offer.ctaOpen}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
