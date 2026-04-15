"use client";

import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  Landmark,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

import BankTransferInstructions from "./BankTransferInstructions";


// ── Types ──────────────────────────────────────────────────
type Step = "form" | "bank_details" | "success";
type PaymentMethod = "bank_transfer" | "whatsapp";

interface ReservationOffer {
  id: string;
  title: string;
  price: number;
  hours: number;
}

interface Props {
  offer: ReservationOffer | null;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

// ── Helpers ────────────────────────────────────────────────
const inputClass =
  "w-full rounded-lg border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-nexus-green/50 focus:outline-none focus:ring-1 focus:ring-nexus-green/30 transition";

// ── Component ──────────────────────────────────────────────
export default function StageReservationModal({
  offer,
  open,
  setOpen,
}: Props) {
  const [step, setStep] = useState<Step>("form");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    parent: "",
    studentName: "",
    email: "",
    phone: "",
    classe: "",
  });

  const reset = useCallback(() => {
    setStep("form");
    setPaymentMethod("bank_transfer");
    setForm({ parent: "", studentName: "", email: "", phone: "", classe: "" });
    setErrorMsg("");
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Defer reset so the closing animation can play
    setTimeout(reset, 250);
  }, [setOpen, reset]);

  const handleField = useCallback(
    (field: keyof typeof form) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value })),
    []
  );

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!offer) return;
      setErrorMsg("");

      // Client-side minimal validation
      if (!form.parent.trim() || !form.email.trim() || !form.phone.trim() || !form.classe) {
        setErrorMsg("Merci de compléter tous les champs obligatoires.");
        return;
      }

      // If WhatsApp, just redirect
      if (paymentMethod === "whatsapp") {
        const text = encodeURIComponent(
          `Bonjour, je souhaite réserver la formule « ${offer.title} » (${offer.price} TND) pour ${form.studentName || form.parent}. Email : ${form.email}. Tél : ${form.phone}. Classe : ${form.classe}.`
        );
        window.open(`https://wa.me/21699192829?text=${text}`, "_blank");
        handleClose();
        return;
      }

      // Bank transfer → POST to API
      setIsSubmitting(true);
      try {
        const res = await fetch("/api/reservation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parent: form.parent.trim(),
            studentName: form.studentName.trim() || undefined,
            email: form.email.trim(),
            phone: form.phone.trim(),
            classe: form.classe,
            academyId: offer.id,
            academyTitle: offer.title,
            price: offer.price,
            paymentMethod: "bank_transfer",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Erreur lors de l'enregistrement.");
        }

        setStep("bank_details");
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Erreur lors de l'envoi."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [offer, form, paymentMethod, handleClose]
  );

  if (!open || !offer) return null;

  // ── Overlay + Modal ───────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Réserver ${offer.title}`}
        className="relative z-10 mx-4 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-nexus-bg shadow-2xl"
      >
        {/* ─── Close button ─── */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          aria-label="Fermer"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ─── STEP: form ─── */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-nexus-green">
                Réservation
              </p>
              <h2 className="mt-1 text-lg font-bold text-white leading-snug">
                {offer.title}
              </h2>
              <p className="mt-1 text-sm text-white/50">
                {offer.hours}h · {offer.price} TND
              </p>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="sr-parent" className="block text-xs font-medium text-white/60 mb-1.5">
                  Nom du parent *
                </label>
                <input
                  id="sr-parent"
                  type="text"
                  required
                  value={form.parent}
                  onChange={handleField("parent")}
                  className={inputClass}
                  placeholder="Prénom et nom du parent"
                />
              </div>

              <div>
                <label htmlFor="sr-student" className="block text-xs font-medium text-white/60 mb-1.5">
                  Nom de l&apos;élève
                </label>
                <input
                  id="sr-student"
                  type="text"
                  value={form.studentName}
                  onChange={handleField("studentName")}
                  className={inputClass}
                  placeholder="Optionnel"
                />
              </div>

              <div>
                <label htmlFor="sr-email" className="block text-xs font-medium text-white/60 mb-1.5">
                  Email *
                </label>
                <input
                  id="sr-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleField("email")}
                  className={inputClass}
                  placeholder="parent@exemple.com"
                />
              </div>

              <div>
                <label htmlFor="sr-phone" className="block text-xs font-medium text-white/60 mb-1.5">
                  Téléphone *
                </label>
                <input
                  id="sr-phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={handleField("phone")}
                  className={inputClass}
                  placeholder="+216 99 19 28 29"
                />
              </div>

              <div>
                <label htmlFor="sr-classe" className="block text-xs font-medium text-white/60 mb-1.5">
                  Classe *
                </label>
                <select
                  id="sr-classe"
                  required
                  value={form.classe}
                  onChange={handleField("classe")}
                  className={cn(inputClass, !form.classe && "text-white/30")}
                >
                  <option value="" disabled>
                    Sélectionnez la classe
                  </option>
                  <option value="Première">Première</option>
                  <option value="Terminale">Terminale</option>
                </select>
              </div>
            </div>

            {/* ─── Payment method ─── */}
            <fieldset className="mt-6">
              <legend className="text-xs font-medium text-white/60 mb-3">
                Mode de paiement
              </legend>
              <div className="space-y-2.5">
                {/* Bank transfer */}
                <label
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition",
                    paymentMethod === "bank_transfer"
                      ? "border-nexus-green/40 bg-nexus-green/[0.06]"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                  )}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="bank_transfer"
                    checked={paymentMethod === "bank_transfer"}
                    onChange={() => setPaymentMethod("bank_transfer")}
                    className="mt-0.5 accent-nexus-green"
                  />
                  <div>
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <Landmark className="h-4 w-4 text-nexus-green" />
                      Virement bancaire
                    </span>
                    <p className="mt-0.5 text-xs text-white/45">
                      Place réservée immédiatement · Activation après vérification du règlement
                    </p>
                  </div>
                </label>

                {/* WhatsApp */}
                <label
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition",
                    paymentMethod === "whatsapp"
                      ? "border-nexus-green/40 bg-nexus-green/[0.06]"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                  )}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="whatsapp"
                    checked={paymentMethod === "whatsapp"}
                    onChange={() => setPaymentMethod("whatsapp")}
                    className="mt-0.5 accent-nexus-green"
                  />
                  <div>
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <MessageCircle className="h-4 w-4 text-nexus-green" />
                      Réserver via WhatsApp
                    </span>
                    <p className="mt-0.5 text-xs text-white/45">
                      Finalisez votre inscription par échange direct
                    </p>
                  </div>
                </label>
              </div>
            </fieldset>

            {/* Error */}
            {errorMsg && (
              <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
                {errorMsg}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-nexus-green to-nexus-green-dark px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement…
                </>
              ) : paymentMethod === "bank_transfer" ? (
                <>
                  Réserver par virement
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Continuer sur WhatsApp
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ─── STEP: bank_details ─── */}
        {step === "bank_details" && (
          <div className="p-6 sm:p-8">
            {/* Success badge */}
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-nexus-green/20 bg-nexus-green/[0.06] px-4 py-3.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-nexus-green" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Réservation enregistrée — en attente de réception du virement
                </p>
                <p className="mt-1 text-xs text-white/50">
                  Votre place est pré-réservée pour la formule{" "}
                  <strong className="text-white/70">{offer.title}</strong>.
                </p>
              </div>
            </div>

            {/* Amount */}
            <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center">
              <p className="text-xs text-white/40 uppercase tracking-wider">
                Montant à virer
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {offer.price} TND
              </p>
            </div>

            {/* Bank instructions */}
            <BankTransferInstructions />

            {/* Done */}
            <button
              type="button"
              onClick={handleClose}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
