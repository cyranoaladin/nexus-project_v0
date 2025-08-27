"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import QCMSeconde from "./QCMSeconde";
import PedagoSurvey from "./PedagoSurvey";
import ResultsPanel from "./ResultsPanel";
import { scoreQCM } from "@/lib/scoring/qcm";
import { analyzePedago, synthesize } from "@/lib/scoring/pedago";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function BilanWizard() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [qcmAnswers, setQcmAnswers] = useState<Record<string, any>>({});
  const [pedagoAnswers, setPedagoAnswers] = useState<any>({});
  const [result, setResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const studentId = (session?.user as any)?.studentId as string | undefined;
  const [children, setChildren] = useState<{ id: string; firstName?: string; lastName?: string }[]>([]);
  const [targetStudentId, setTargetStudentId] = useState<string | undefined>(studentId);
  const isE2E = process.env.NEXT_PUBLIC_E2E === '1';

  useEffect(() => {
    // For parent or when studentId is missing, fetch children list
    if (!studentId && role === 'PARENT') {
      (async () => {
        try {
          const res = await fetch('/api/parent/children', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            setChildren(data || []);
            if (data?.length) setTargetStudentId(data[0].id);
          }
        } catch (e) {
          // noop
        }
      })();
    }
  }, [studentId, role]);

  // E2E-only client fallback: if no targetStudentId, attempt to resolve from auth session
  useEffect(() => {
    if (!isE2E) return;
    if (targetStudentId) return;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const sid = (json?.user as any)?.studentId as string | undefined;
          if (sid) setTargetStudentId(sid);
        }
      } catch {/* noop */}
    })();
  }, [isE2E, targetStudentId]);

  const next = () => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  const prev = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  const compute = () => {
    const qcmScores = scoreQCM(qcmAnswers);
    const pedagoProfile = analyzePedago(pedagoAnswers || {});
    const domains = Object.entries(qcmScores.byDomain).map(([domain, ds]: any) => ({ domain, percent: ds.percent }));
    const synthesis = synthesize(domains as any, pedagoProfile);
    const offers = synthesis.offers;
    setResult({ qcmScores, pedagoProfile, synthesis, offers });
    setStep(3);
  };

  const submit = async (opts: { emailStudent?: boolean; emailParent?: boolean }) => {
    if (!result) return;
    const sid = targetStudentId;
    if (!sid && !isE2E) {
      alert("Veuillez sélectionner l’enfant/élève cible avant d’enregistrer.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bilan/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: sid || 'E2E_FAKE_STUDENT_ID',
          qcmRaw: qcmAnswers,
          pedagoRaw: pedagoAnswers,
          qcmScores: result.qcmScores,
          pedagoProfile: result.pedagoProfile,
          synthesis: result.synthesis,
          offers: result.offers,
          sendEmailToStudent: !!opts.emailStudent,
          sendEmailToParent: !!opts.emailParent,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erreur serveur");
      setResult((r: any) => ({ ...(r || {}), savedBilanId: json.bilanId }));
      alert("Bilan enregistré. Vous pouvez télécharger le PDF.");
    } catch (e: any) {
      alert(e?.message || "Erreur inconnue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Test-only step indicator */}
      <div data-testid="wizard-step-indicator" className="sr-only">{step}</div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bilan gratuit — Entrée en Première</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Parent/selector banner */}
          {(!studentId || role === 'PARENT') && (
            <div className="mb-4 p-4 border rounded bg-yellow-50">
              <Label className="mb-2 block">Sélectionner l’élève</Label>
              {children.length > 0 ? (
                <Select value={targetStudentId} onValueChange={setTargetStudentId}>
                  <SelectTrigger className="w-full" data-testid="wizard-child-select-trigger">
                    <SelectValue placeholder="Choisir un enfant" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-yellow-800">
                  Aucun enfant détecté. Veuillez en ajouter depuis votre espace parent.
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <QCMSeconde answers={qcmAnswers} onChange={setQcmAnswers} onNext={() => next()} />
          )}
          {step === 2 && (
            <PedagoSurvey answers={pedagoAnswers} onChange={setPedagoAnswers} onPrev={() => prev()} onNext={() => compute()} />
          )}
          {step === 3 && (
            <ResultsPanel
              result={result}
              onPrev={() => prev()}
              onSubmit={submit}
            />
          )}
          <div className="flex justify-between mt-4">
            {step > 1 ? <Button variant="outline" onClick={prev}>Précédent</Button> : <span />}
            {step < 2 ? <Button onClick={next}>Suivant</Button> : null}
          </div>
          {isSubmitting && <p className="text-sm text-gray-500 mt-2">Enregistrement…</p>}

          {isE2E && (
            <div className="fixed bottom-4 right-4 z-50">
              <Button
                data-testid="wizard-primary-next"
                onClick={() => (step === 1 ? next() : step === 2 ? compute() : undefined)}
              >
                E2E Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
