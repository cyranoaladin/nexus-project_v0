"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  MessageCircle,
  User,
  Users,
} from "lucide-react";

import type { Emphasis, IncludedBonus, Offer } from "../_data/offers";
import OfferPriceBlock from "./OfferPriceBlock";
import { getOfferIcon } from "../_lib/offer-icons";
import { WHATSAPP_URL } from "../_lib/constants";

type OfferAccordionCardProps = {
  offer: Offer;
  isOpen: boolean;
  onToggle: () => void;
  onReserve?: (offer: Offer) => void;
};

function emphasisBorder(emphasis: Emphasis): string {
  switch (emphasis) {
    case "maximale":
      return "border-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]";
    case "premium":
      return "border-purple-500/35 shadow-[0_0_0_1px_rgba(167,139,250,0.08)]";
    case "forte":
      return "border-emerald-500/30";
    default:
      return "border-white/10";
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
  "Tarif standard — un ajustement à la baisse peut s'appliquer si le groupe se complète.";

function BonusIcon({ kind }: { kind: IncludedBonus["kind"] }) {
  return (
    <span className="text-lg">{kind === "masterium" ? "📖" : "🎓"}</span>
  );
}

function OpenBonusBlock({ bonus }: { bonus: IncludedBonus }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-black/20">
          <BonusIcon kind={bonus.kind} />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-400">
            Bonus inclus
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-200">
            {bonus.detailedText}
          </p>
          <p className="mt-1 text-xs text-slate-400">{bonus.valueLabel}</p>
        </div>
      </div>
    </div>
  );
}

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
  const Icon = getOfferIcon(offer.icon);

  const whatsappText = encodeURIComponent(
    `Bonjour, je souhaite réserver la formule « ${offer.title} » (${offer.price} TND). Pouvez-vous me confirmer les disponibilités ?`
  );

  return (
    <article
      className={`overflow-hidden rounded-3xl border transition-all duration-300 ${emphasisBorder(
        offer.emphasis
      )} ${
        muted
          ? "bg-[#111826] hover:bg-[#161f30]"
          : "bg-[#141d2e] hover:bg-[#1a2436]"
      } ${offer.emphasis === "maximale" ? "ring-1 ring-amber-500/15" : ""}`}
    >
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        id={cardId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full min-h-[3rem] items-start gap-4 px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/50 sm:items-center sm:px-6"
      >
        {/* Icon */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${offer.color} shadow-lg transition-transform duration-300 ${
            isOpen ? "scale-110" : "group-hover:scale-105"
          }`}
        >
          <Icon className="h-6 w-6 text-white" aria-hidden="true" />
        </div>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`font-display text-base font-bold leading-snug sm:text-lg ${
                muted ? "text-slate-100" : "text-white"
              }`}
            >
              {offer.title}
            </h3>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                muted ? "opacity-80" : ""
              }`}
              style={{
                borderColor: `${offer.badgeColor}66`,
                backgroundColor: `${offer.badgeColor}1A`,
                color: offer.badgeColor,
              }}
            >
              {offer.badge}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {offer.hours}h
            </span>
            {offer.category !== "mono" && offer.category !== "complement" ? (
              <span className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-300">
                {offer.category}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Users className="h-3 w-3" />
              Max {offer.maxStudents}
            </span>
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
                ? "rotate-180 border-emerald-500/40 bg-emerald-500/15"
                : "border-white/12 bg-white/[0.05]"
            }`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-colors ${
                isOpen ? "text-emerald-400" : "text-white/50"
              }`}
              aria-hidden="true"
            />
          </span>
        </div>
      </button>

      {!isOpen && offer.includedBonus ? (
        <div className="hidden border-t border-white/8 px-6 py-3 sm:block">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <BonusIcon kind={offer.includedBonus.kind} />
            <span>{offer.includedBonus.shortLabel}</span>
          </div>
        </div>
      ) : null}

      {/* ── Collapsed footer (mobile price + accroche on mobile only) ── */}
      {!isOpen ? (
        <div className="border-t border-white/8 px-5 py-3 sm:hidden">
          <div className="flex items-center gap-2">
            <OfferPriceBlock offer={offer} compact />
            {hasSaving ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                −{offer.saving}&nbsp;TND
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-400">{offer.accrocheCourte}</p>
          {offer.includedBonus ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <BonusIcon kind={offer.includedBonus.kind} />
              <span>{offer.includedBonus.shortLabel}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Expandable panel ── */}
      <div
        id={panelId}
        ref={panelRef}
        role="region"
        aria-labelledby={cardId}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/8 px-5 pb-6 pt-5 sm:px-6">
            {/* Intro */}
            <p className="text-sm leading-7 text-slate-300">{offer.intro}</p>

            {/* Points */}
            <ul className="mt-4 space-y-2.5">
              {offer.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-6 text-slate-200">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${offer.color}`}
                  >
                    <Check className="h-3 w-3 text-white" aria-hidden="true" />
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {/* Pour qui */}
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-300">{offer.pourQui}</p>
            </div>

            {/* Planning */}
            <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                <Clock className="h-4 w-4" />
                Planning détaillé
              </h4>
              <div className="space-y-2">
                {offer.planning.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-3 rounded-lg bg-white/[0.03] p-2.5 text-sm"
                  >
                    <div
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r ${offer.color}`}
                    />
                    <span className="text-slate-200">{line}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Follow-up */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  Réservation
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  50% à l&apos;inscription, solde avant le démarrage.
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Check className="h-4 w-4 text-slate-400" />
                  Suivi
                </div>
                <div className="mt-2 space-y-1">
                  {offer.followUp.slice(0, 2).map((item) => (
                    <div key={item} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Avantage pack */}
            {offer.avantagePack ? (
              <p className="mt-4 text-sm font-medium italic text-emerald-400">
                {offer.avantagePack}
              </p>
            ) : null}

            {/* Full price block */}
            <div className="mt-5">
              <OfferPriceBlock offer={offer} />
            </div>

            {/* Pricing note */}
            <p className="mt-3 max-w-md text-xs leading-relaxed text-slate-500">
              {PRICING_NOTE}
            </p>

            {offer.includedBonus ? (
              <div className="mt-4">
                <OpenBonusBlock bonus={offer.includedBonus} />
              </div>
            ) : null}

            {/* CTAs */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => onReserve?.(offer)}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 sm:flex-none ${
                  ctaVariant(offer.emphasis) === "green"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:brightness-110"
                    : ctaVariant(offer.emphasis) === "purple"
                    ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:brightness-110"
                    : "border border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.08]"
                }`}
              >
                {offer.ctaOpen}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <a
                href={`${WHATSAPP_URL}&text=${whatsappText}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08] sm:flex-none"
              >
                <MessageCircle className="h-4 w-4" />
                Discuter sur WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
