"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Clock,
  GraduationCap,
  Monitor,
  Users,
  Calendar,
  BookOpen,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { BackToTop } from "@/components/ui/back-to-top";
import { track } from "@/lib/analytics";
import {
  getOffersByLevel,
  getOffersByTrack,
  getStageFormats,
  getStageEditions,
  getReperes,
  getRules,
  getCampaign,
  type AnnualOffer,
  type StageFormat,
  type StageEdition,
} from "@/lib/pricing";

// ── Helpers ──

const WHATSAPP_URL = "https://wa.me/21699192829";

function fmtPrice(amount: number): string {
  return amount.toLocaleString("fr-FR").replace(/\u202F/g, " ");
}

function fmtTND(amount: number): string {
  return `${fmtPrice(amount)} TND`;
}

// ── Reusable components ──

function SectionTitle({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="mb-10 text-center">
      {Icon && (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10">
          <Icon className="h-7 w-7 text-brand-400" />
        </div>
      )}
      <h2 className="text-3xl font-bold text-neutral-100">{title}</h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-2xl text-neutral-400">{subtitle}</p>
      )}
    </div>
  );
}

function OfferCard({ offer }: { offer: AnnualOffer }) {
  const campaign = getCampaign();
  const hasCampaignDiscount =
    offer.price_annual_campaign != null &&
    offer.price_annual_public != null &&
    offer.price_annual_campaign < offer.price_annual_public;

  const effectivePrice =
    offer.price_annual_campaign ?? offer.price_annual_public;

  return (
    <div className="relative flex flex-col rounded-2xl border border-neutral-700/50 bg-surface-dark p-6 transition-all hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5">
      {offer.badge === "campagne" && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
          {campaign.campaign_label}
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold text-neutral-100">{offer.title}</h3>
        <p className="mt-1 text-sm text-neutral-400">{offer.subjects}</p>
      </div>

      {offer.hours_per_week != null && (
        <div className="mb-4 flex items-center gap-2 text-sm text-neutral-400">
          <Clock className="h-4 w-4" />
          <span>{offer.hours_per_week} h / semaine</span>
        </div>
      )}

      <div className="mb-4">
        {hasCampaignDiscount && offer.price_annual_public != null && (
          <p className="text-sm text-neutral-500 line-through">
            {campaign.public_label} : {fmtTND(offer.price_annual_public)}
          </p>
        )}
        {effectivePrice != null ? (
          <>
            <p className="text-2xl font-bold text-brand-400">
              {fmtTND(effectivePrice)}
              <span className="text-sm font-normal text-neutral-400">
                {" "}
                / an
              </span>
            </p>
            {offer.monthly_display != null && (
              <p className="mt-1 text-sm text-neutral-400">
                soit {fmtTND(offer.monthly_display)} / mois
              </p>
            )}
          </>
        ) : offer.display ? (
          <p className="text-2xl font-bold text-brand-400">{offer.display}</p>
        ) : null}
      </div>

      {offer.deposit != null && offer.n_installments != null && (
        <p className="mb-4 text-xs text-neutral-500">
          Acompte {fmtTND(offer.deposit)} + {offer.n_installments} mensualites
        </p>
      )}

      <ul className="mt-auto space-y-2">
        {offer.included.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OfferGrid({
  offers,
  columns = 3,
}: {
  offers: AnnualOffer[];
  columns?: number;
}) {
  const gridCols =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 4
        ? "md:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid gap-6 ${gridCols}`}>
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </div>
  );
}

function StageFormatCard({ format }: { format: StageFormat }) {
  return (
    <div className="rounded-xl border border-neutral-700/50 bg-surface-dark p-5">
      <h4 className="font-semibold text-neutral-100">{format.title}</h4>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl font-bold text-brand-400">
          {fmtTND(format.price_per_student)}
        </span>
        <span className="text-sm text-neutral-500">
          / {format.hours} h
        </span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {fmtTND(format.price_per_student_hour)} / h / eleve
      </p>
      <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
        <Users className="h-4 w-4" />
        <span>{format.group_max} max</span>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Acompte {fmtTND(format.payment.deposit)} — solde{" "}
        {fmtTND(format.payment.solde)}
      </p>
    </div>
  );
}

function StageEditionRow({ edition }: { edition: StageEdition }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-700/30 bg-surface-darker px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span className="font-medium text-neutral-200">{edition.title}</span>
        <span className="ml-2 text-sm text-neutral-500">{edition.period}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {edition.formats.map((fid) => (
          <span
            key={fid}
            className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-400"
          >
            {fid}
          </span>
        ))}
      </div>
    </div>
  );
}

function RepereCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-700/30 bg-surface-dark p-4 text-center">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-1 font-semibold text-brand-400">{value}</p>
    </div>
  );
}

// ── Label mapping for reperes ──

const repereLabels: Record<string, string> = {
  brevetMois: "Brevet",
  secondeMois: "Seconde",
  premiereSimpleMois: "Premiere (1 matiere)",
  premiereDuoMois: "Premiere (duo)",
  terminaleSimpleMois: "Terminale (1 spe)",
  terminaleDuoMois: "Terminale (duo)",
  plateformeAn: "Plateforme",
  stagesBase: "Stages",
  parrainage: "Parrainage",
};

// ── Page ──

export default function OffresPage() {
  useEffect(() => {
    track.offerView();
  }, []);

  const rules = getRules();
  const campaign = getCampaign();

  const terminaleOffers = getOffersByLevel("terminale").filter(
    (o) => o.track === "scolarise"
  );
  const premiereOffers = getOffersByLevel("premiere").filter(
    (o) => o.track === "scolarise"
  );
  const secondeOffers = getOffersByLevel("seconde").filter(
    (o) => o.track === "scolarise"
  );
  const troisiemeOffers = getOffersByLevel("troisieme").filter(
    (o) => o.track === "scolarise"
  );
  const libreOffers = getOffersByTrack("libre");
  const plateformeOffers = getOffersByTrack("plateforme");
  const stageFormats = getStageFormats();
  const stageEditions = getStageEditions();
  const reperes = getReperes();

  return (
    <>
      <CorporateNavbar />
      <main className="min-h-screen bg-surface-darker">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pb-16 pt-32">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-transparent" />
          <div className="relative mx-auto max-w-5xl px-4 text-center">
            <h1 className="text-4xl font-extrabold leading-tight text-neutral-100 sm:text-5xl">
              Nos Offres & Tarifs 2026/2027
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-neutral-400">
              Parcours annuels en groupes de {rules.group_max} eleves maximum,
              enseignants agreges et certifies. Tarif campagne{" "}
              {campaign.availability}.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-600"
              >
                <MessageCircle className="h-5 w-5" />
                Etre conseille sur WhatsApp
              </a>
              <Link
                href="/bilan-gratuit"
                className="inline-flex items-center gap-2 rounded-xl border border-brand-500/30 px-6 py-3 font-semibold text-brand-400 transition-colors hover:bg-brand-500/10"
              >
                Bilan gratuit
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Terminale ── */}
        <section className="mx-auto max-w-7xl px-4 py-16">
          <SectionTitle
            title="Parcours annuels — Terminale"
            subtitle="Preparation au Bac en groupe de 5 maximum"
            icon={GraduationCap}
          />
          <OfferGrid offers={terminaleOffers} />
        </section>

        {/* ── Premiere ── */}
        <section className="mx-auto max-w-7xl px-4 py-16">
          <SectionTitle
            title="Parcours annuels — Premiere"
            subtitle="EAF, mathematiques et renforcement scientifique"
            icon={BookOpen}
          />
          <OfferGrid offers={premiereOffers} />
        </section>

        {/* ── Seconde ── */}
        <section className="mx-auto max-w-7xl px-4 py-16">
          <SectionTitle
            title="Parcours annuels — Seconde"
            subtitle="Construction des bases et choix des specialites"
            icon={BookOpen}
          />
          <OfferGrid offers={secondeOffers} />
        </section>

        {/* ── Troisieme (Brevet) ── */}
        {troisiemeOffers.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-16">
            <SectionTitle
              title="Parcours annuels — Troisieme (Brevet)"
              subtitle="Preparation au Diplome National du Brevet"
              icon={BookOpen}
            />
            <OfferGrid offers={troisiemeOffers} columns={2} />
          </section>
        )}

        {/* ── Candidats libres ── */}
        {libreOffers.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-16">
            <SectionTitle
              title="Candidats libres"
              subtitle="Accompagnement sur mesure pour les candidats qui passent le Bac en candidat libre"
              icon={GraduationCap}
            />
            <OfferGrid offers={libreOffers} />
          </section>
        )}

        {/* ── Plateforme ── */}
        {plateformeOffers.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-16">
            <SectionTitle
              title="Plateforme Nexus"
              subtitle="Acces en ligne, en autonomie ou avec suivi"
              icon={Monitor}
            />
            <OfferGrid offers={plateformeOffers} />
          </section>
        )}

        {/* ── Stages intensifs ── */}
        <section className="mx-auto max-w-7xl px-4 py-16">
          <SectionTitle
            title="Stages intensifs"
            subtitle="Pendant les vacances scolaires, en groupe de 5 maximum"
            icon={Calendar}
          />

          <h3 className="mb-6 text-xl font-semibold text-neutral-200">
            Formats disponibles
          </h3>
          <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stageFormats.map((fmt) => (
              <StageFormatCard key={fmt.format_id} format={fmt} />
            ))}
          </div>

          <h3 className="mb-4 text-xl font-semibold text-neutral-200">
            Editions {campaign.label.replace("Campagne ", "")}
          </h3>
          <div className="space-y-3">
            {stageEditions.map((ed) => (
              <StageEditionRow key={ed.edition_id} edition={ed} />
            ))}
          </div>
        </section>

        {/* ── Reperes tarifaires ── */}
        <section className="mx-auto max-w-7xl px-4 py-16">
          <SectionTitle
            title="Reperes tarifaires"
            subtitle="Fourchettes indicatives pour situer nos tarifs"
          />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Object.entries(reperes).map(([key, value]) => (
              <RepereCard
                key={key}
                label={repereLabels[key] ?? key}
                value={value}
              />
            ))}
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="mx-auto max-w-4xl px-4 pb-24 pt-8">
          <div className="rounded-2xl border border-brand-500/20 bg-surface-dark p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-neutral-100 sm:text-3xl">
              Pret a construire le parcours de votre enfant ?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-neutral-400">
              Echangez avec notre equipe pour definir la formule la plus adaptee
              au profil et aux objectifs de votre enfant.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-600"
              >
                <MessageCircle className="h-5 w-5" />
                Etre conseille sur WhatsApp
              </a>
              <Link
                href="/bilan-gratuit"
                className="inline-flex items-center gap-2 rounded-xl border border-brand-500/30 px-6 py-3 font-semibold text-brand-400 transition-colors hover:bg-brand-500/10"
              >
                Bilan gratuit
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <CorporateFooter />
      <BackToTop />
    </>
  );
}
