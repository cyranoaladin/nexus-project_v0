"use client";

import { useRef } from "react";
import { ArrowRight, Check, ChevronDown, Clock } from "lucide-react";

import type { Offer } from "../_data/offers";
import OfferPriceBlock from "./OfferPriceBlock";
import CTAButton from "./CTAButton";
import { WHATSAPP_URL } from "../_lib/constants";

type OfferAccordionCardProps = {
  offer: Offer;
  isOpen: boolean;
  onToggle: () => void;
};

function emphasisBorder(emphasis: Offer["emphasis"]): string {
  switch (emphasis) {
    case "maximale":
      return "border-nexus-amber/35 shadow-[0_0_0_1px_rgba(245,158,11,0.06)]";
    case "premium":
      return "border-nexus-purple/30 shadow-[0_0_0_1px_rgba(167,139,250,0.06)]";
    case "forte":
      return "border-nexus-green/25";
    default:
      return "border-white/10";
  }
}

export default function OfferAccordionCard({
  offer,
  isOpen,
  onToggle,
}: OfferAccordionCardProps) {
  const cardId = `offer-${offer.id}`;
  const panelId = `panel-${offer.id}`;
  const panelRef = useRef<HTMLDivElement>(null);
  const isBestSeller = offer.emphasis === "maximale";
  const hasSaving = !!(offer.priceReference && offer.saving);

  return (
    <article
      className={`overflow-hidden rounded-[24px] border bg-white/[0.025] transition-colors duration-200 hover:bg-white/[0.035] ${emphasisBorder(
        offer.emphasis
      )} ${isBestSeller ? "ring-1 ring-nexus-amber/15" : ""}`}
    >
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        id={cardId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-5 py-5 text-left sm:items-center sm:gap-4 sm:px-6"
      >
        {/* Badge */}
        <span
          className="mt-0.5 shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] sm:mt-0"
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
          <h3 className="font-display text-base font-bold leading-snug text-white sm:text-lg">
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
            className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-200 ${
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

      {/* ── Mobile price (visible < sm, only when collapsed) ── */}
      {!isOpen ? (
        <div className="flex items-center gap-2 border-t border-white/5 px-5 py-3 sm:hidden">
          <OfferPriceBlock offer={offer} compact />
          {hasSaving ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-nexus-green/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-nexus-green">
              −{offer.saving}&nbsp;TND
            </span>
          ) : null}
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
            {/* Description */}
            <p className="text-sm leading-7 text-white/60">{offer.description}</p>

            {/* Arguments */}
            <ul className="mt-4 space-y-2 text-sm leading-6 text-white/65">
              {offer.arguments.map((arg) => (
                <li key={arg} className="flex gap-2.5">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-nexus-green"
                    aria-hidden="true"
                  />
                  <span>{arg}</span>
                </li>
              ))}
            </ul>

            {/* Full price block */}
            <div className="mt-5">
              <OfferPriceBlock offer={offer} />
            </div>

            {/* CTA */}
            <div className="mt-5">
              <CTAButton
                href={WHATSAPP_URL}
                external
                variant={isBestSeller ? "green" : "outline"}
                className="w-full sm:w-auto"
              >
                {offer.cta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </CTAButton>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
