"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type ConsentStatus =
  | "LOADING"
  | "IDLE"
  | "SUBMITTING"
  | "VERIFIED"
  | "LOAD_ERROR"
  | "SUBMIT_ERROR";

type CanonicalConsentCardProps = {
  studentId: string;
  onVerified?: () => void;
};

export function CanonicalConsentCard({ studentId, onVerified }: CanonicalConsentCardProps) {
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<ConsentStatus>("LOADING");

  useEffect(() => {
    let active = true;

    async function loadConsentState() {
      setStatus("LOADING");
      setConsent(false);

      try {
        const response = await fetch(
          `/api/parent/children/${encodeURIComponent(studentId)}/canonical-consent`,
          { method: "GET" },
        );

        if (!response.ok) {
          throw new Error("CANONICAL_CONSENT_LOAD_FAILED");
        }

        const payload = await response.json();
        if (!active) return;

        if (payload.state === "VERIFIED") {
          setStatus("VERIFIED");
        } else if (
          payload.state === "PENDING_PARENT_CONSENT" ||
          payload.state === "REVOKED" ||
          payload.state === "EXPIRED" ||
          payload.state === "MISSING"
        ) {
          setStatus("IDLE");
        } else {
          setStatus("LOAD_ERROR");
        }
      } catch {
        if (active) setStatus("LOAD_ERROR");
      }
    }

    void loadConsentState();

    return () => {
      active = false;
    };
  }, [studentId]);

  async function confirmConsent() {
    if (!consent || status === "SUBMITTING" || status === "VERIFIED") {
      return;
    }

    setStatus("SUBMITTING");

    try {
      const response = await fetch(
        `/api/parent/children/${encodeURIComponent(studentId)}/canonical-consent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent: true }),
        },
      );
      if (!response.ok) {
        throw new Error("CANONICAL_CONSENT_NOT_VERIFIED");
      }

      const payload = await response.json();
      if (payload.state !== "VERIFIED") throw new Error("CANONICAL_CONSENT_NOT_VERIFIED");

      setStatus("VERIFIED");
      onVerified?.();
    } catch {
      setStatus("SUBMIT_ERROR");
    }
  }

  if (status === "LOADING") {
    return (
      <Card
        role="status"
        aria-live="polite"
        className="border border-white/10 bg-surface-card shadow-premium"
      >
        <CardContent className="pt-6">
          <p className="text-sm text-neutral-300">Vérification du rattachement…</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "LOAD_ERROR") {
    return (
      <Card className="border border-white/10 bg-surface-card shadow-premium">
        <CardContent className="pt-6">
          <p role="alert" className="text-sm text-red-300">
            Le rattachement ne peut pas être vérifié pour le moment. Veuillez réessayer plus tard.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "VERIFIED") {
    return (
      <Card
        role="status"
        aria-live="polite"
        className="border border-emerald-500/30 bg-surface-card shadow-premium"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Rattachement vérifié
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-300">
            Votre consentement est enregistré. Vous pourrez consulter les bilans publiés de votre enfant.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/10 bg-surface-card shadow-premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <ShieldCheck className="h-4 w-4 text-brand-accent" aria-hidden="true" />
          Consentement parent-enfant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-300">
          Ce consentement explicite est nécessaire pour rattacher le dossier de votre enfant et consulter ses bilans publiés.
        </p>

        <div className="flex items-start gap-3">
          <Checkbox
            id={`canonical-consent-${studentId}`}
            checked={consent}
            onCheckedChange={(checked) => {
              setConsent(checked === true);
              if (status === "SUBMIT_ERROR") setStatus("IDLE");
            }}
            disabled={status === "SUBMITTING"}
            aria-label="J’atteste avoir donné mon consentement explicite au rattachement de mon enfant"
          />
          <label
            htmlFor={`canonical-consent-${studentId}`}
            className="text-sm leading-5 text-neutral-300"
          >
            J’atteste avoir donné mon consentement explicite au rattachement de mon enfant.
          </label>
        </div>

        {status === "SUBMITTING" && (
          <p role="status" aria-live="polite" className="text-sm text-neutral-300">
            Enregistrement du consentement…
          </p>
        )}

        {status === "SUBMIT_ERROR" && (
          <p role="alert" className="text-sm text-red-300">
            Le rattachement n’a pas pu être vérifié. Veuillez réessayer.
          </p>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={!consent}
          loading={status === "SUBMITTING"}
          onClick={confirmConsent}
        >
          Confirmer le rattachement
        </Button>
      </CardContent>
    </Card>
  );
}
