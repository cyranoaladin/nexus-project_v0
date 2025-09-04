"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import nsiSurveyPremiere from "@/data/pedago_survey_nsi_premiere.json";
import nsiSurveyTerminale from "@/data/pedago_survey_nsi_terminale.json";
import { buildPedagoPayloadNSIPremiere } from "@/lib/scoring/adapter_nsi_pedago";
import { buildPdfPayloadNSIPremiere } from "@/lib/scoring/adapter_nsi_premiere";
import { buildPdfPayloadNSITerminale } from "@/lib/scoring/adapter_nsi_terminale";
import { analyzePedago, synthesize } from "@/lib/scoring/pedago";
import { computeQcmScores } from "@/lib/scoring/qcm_scorer";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import BilanQCMVolet1 from "./BilanQCMVolet1";
import PedagoSurvey from "./PedagoSurvey";
import PedagoSurveyNSI from "./PedagoSurveyNSI";
import ResultsPanel from "./ResultsPanel";

export default function BilanWizard() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [qcmAnswers, setQcmAnswers] = useState<Record<string, any>>({});
  const [pedagoAnswers, setPedagoAnswers] = useState<any>({});
  const [result, setResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subject, setSubject] = useState<string>('MATHEMATIQUES');
  const [niveau, setNiveau] = useState<string>('Premiere');
  const [statut, setStatut] = useState<string>('scolarise_fr');
  const studentId = (session?.user as any)?.studentId as string | undefined;
  const [children, setChildren] = useState<{ id: string; firstName?: string; lastName?: string; }[]>([]);
  const [targetStudentId, setTargetStudentId] = useState<string | undefined>(studentId);
  const isE2E = process.env.NEXT_PUBLIC_E2E === '1' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2e') === '1');
  const isQA = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('qa') === '1');
  const isPlaywright = typeof process !== 'undefined' && (process.env as any)?.PLAYWRIGHT === '1';
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Verrouiller le niveau selon le grade connu de l'élève (issue de l'inscription)
  useEffect(() => {
    const g = ((session?.user as any)?.grade || (session as any)?.user?.classe || '').toString().toLowerCase();
    if (g.includes('term')) setNiveau('Terminale');
    else if (g.includes('prem')) setNiveau('Premiere');
  }, [session?.user]);

  useEffect(() => {
    // E2E: permettre de forcer l'étape par query param
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const s = sp.get('step');
      if (s === '2') setStep(2);
      if (s === '3') setStep(3);
    }
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
      } catch {/* noop */ }
    })();
  }, [isE2E, targetStudentId]);

  const next = () => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  const prev = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  // Charger dynamiquement le Volet 1 depuis l'API (respect des mappings sujet/niveau)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const base = '/api/bilan/questionnaire-structure';
        const params = new URLSearchParams();
        params.set('matiere', subject);
        params.set('niveau', (niveau || '').toLowerCase());
        params.set('studentId', targetStudentId || 'e2e-student-id');
        const res = await fetch(`${base}?${params.toString()}`, { cache: 'no-store' });
        if (res.ok) {
          const js = await res.json();
          const v1 = Array.isArray(js?.volet1?.questions) ? js.volet1.questions : (Array.isArray(js?.volet1) ? js.volet1 : (Array.isArray(js?.questions) ? js.questions : []));
          if (Array.isArray(v1) && v1.length > 0) {
            setQuestions(v1);
          } else {
            setQuestions([]);
          }
        } else {
          setQuestions([]);
        }
      } catch {
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [subject, niveau, targetStudentId, isE2E]);

  const compute = () => {
    // Scoring générique basé sur Volet 1 chargé dynamiquement
    const qcmScores = computeQcmScores((questions as any[]) || [], qcmAnswers || {});
    // Pédago spécifique pour NSI si disponible, sinon générique
    if (subject === 'NSI') {
      const survey = (niveau === 'Premiere') ? (nsiSurveyPremiere as any) : (nsiSurveyTerminale as any);
      const pedago = buildPedagoPayloadNSIPremiere(survey, pedagoAnswers || {});
      const qcmPayload = (niveau === 'Premiere') ? buildPdfPayloadNSIPremiere(qcmScores as any) : buildPdfPayloadNSITerminale(qcmScores as any);
      const synthesis = {
        forces: qcmPayload.forces,
        faiblesses: qcmPayload.faiblesses,
        feuilleDeRoute: qcmPayload.feuilleDeRoute,
        risques: pedago.pedagoProfile?.flags || [],
        offers: qcmPayload.offers,
      };
      const offers = qcmPayload.offers;
      setResult({ qcmScores, pedagoProfile: pedago.pedagoProfile, pedagoScores: pedago.pedagoScores, pedagoModality: pedago.pedagoModality, synthesis, offers, meta: { subject, niveau, statut } });
      setStep(3);
      return;
    }
    const pedagoProfile = analyzePedago(pedagoAnswers || {});
    const domains = Object.entries(qcmScores.byDomain).map(([domain, ds]: any) => ({ domain, percent: ds.percent }));
    const synthesis = synthesize(domains as any, pedagoProfile, { statut });
    const offers = synthesis.offers;
    setResult({ qcmScores, pedagoProfile, synthesis, offers, meta: { subject, niveau, statut } });
    setStep(3);
  };

  const qaGeneratePremiumPdf = async (variant: 'eleve' | 'parent') => {
    try {
      const res = await fetch(`/api/bilan/generate?variant=${encodeURIComponent(variant)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: targetStudentId || undefined, rag: { snippets: [] } }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        alert(`Échec génération PDF (${res.status}). ${txt}`);
        return;
      }
      const ct = res.headers.get('Content-Type') || '';
      if (ct.includes('application/pdf')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        // JSON fallback preview
        const js = await res.json().catch(() => ({}));
        alert(`Génération JSON OK (aperçu). Variant=${variant}.`);
        console.log('Bilan Premium JSON', js);
      }
    } catch (e: any) {
      alert(`Erreur: ${String(e?.message || e)}`);
    }
  };

  const submit = async (opts: { emailStudent?: boolean; emailParent?: boolean; }) => {
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
          subject,
          niveau,
          statut,
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
      // Déclencher la génération PDF (variant élève et parent) côté API existante
      try {
        await fetch(`/api/bilan/generate?variant=eleve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: sid, rag: { snippets: [] } }),
        });
        await fetch(`/api/bilan/generate?variant=parent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: sid, rag: { snippets: [] } }),
        });
      } catch {}
      alert("Bilan enregistré. Les PDF sont en cours de préparation.");
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
          <CardTitle className="text-lg">Bilan gratuit — Entrée en {niveau}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Métadonnées sujet/niveau/statut */}
          <div className="mb-4 p-4 border rounded bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Matière</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="w-full" data-testid="wizard-subject" aria-label="Sélection de la matière"><SelectValue placeholder="Matière" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATHEMATIQUES">Mathématiques</SelectItem>
                    <SelectItem value="NSI">NSI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Niveau</Label>
                <div className="w-full h-10 flex items-center px-3 rounded border bg-gray-50 text-gray-700">
                  {niveau === 'Terminale' ? 'Terminale' : 'Première'}
                </div>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={statut} onValueChange={setStatut}>
                  <SelectTrigger className="w-full" aria-label="Sélection du statut"><SelectValue placeholder="Statut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scolarise_fr">Scolarisé (enseignement FR)</SelectItem>
                    <SelectItem value="candidat_libre">Candidat libre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Parent/selector banner */}
          {(!studentId || role === 'PARENT') && (
            <div className="mb-4 p-4 border rounded bg-yellow-50">
              <Label className="mb-2 block">Sélectionner l’élève</Label>
              {children.length > 0 ? (
                <Select value={targetStudentId} onValueChange={setTargetStudentId}>
                  <SelectTrigger className="w-full" data-testid="wizard-child-select-trigger" aria-label="Sélection de l'élève">
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
            <div>
              <BilanQCMVolet1 answers={qcmAnswers} onChange={setQcmAnswers} onNext={() => next()} questions={questions as any} />
            </div>
          )}
          {step === 2 && (
            subject === 'NSI' ? (
              <PedagoSurveyNSI
                answers={pedagoAnswers}
                survey={niveau === 'Premiere' ? (nsiSurveyPremiere as any) : (nsiSurveyTerminale as any)}
                onChange={setPedagoAnswers}
                onPrev={() => prev()}
                onNext={() => compute()}
              />
            ) : (
              <PedagoSurvey answers={pedagoAnswers} onChange={setPedagoAnswers} onPrev={() => prev()} onNext={() => compute()} />
            )
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

          {(isE2E || isPlaywright || isQA) && (
            <>
              <div className="fixed bottom-4 right-4 z-50">
                <Button
                  data-testid="wizard-primary-next"
                  onClick={() => (step === 1 ? next() : step === 2 ? compute() : undefined)}
                >
                  E2E Next
                </Button>
              </div>
              <div className="fixed bottom-4 left-4 z-50 flex gap-2">
                <Button size="sm" variant="outline" data-testid="e2e-set-nsi" onClick={() => setSubject('NSI')}>NSI</Button>
                <Button size="sm" variant="outline" data-testid="e2e-set-maths" onClick={() => setSubject('MATHEMATIQUES')}>Maths</Button>
                <Button size="sm" variant="outline" data-testid="e2e-set-premiere" onClick={() => setNiveau('Premiere')}>Première</Button>
                <Button size="sm" variant="outline" data-testid="e2e-set-terminale" onClick={() => setNiveau('Terminale')}>Terminale</Button>
                <Button size="sm" variant="secondary" data-testid="e2e-goto-pedago" onClick={() => setStep(2)}>Goto Pedago</Button>
                <Button size="sm" variant="secondary" data-testid="e2e-compute" onClick={() => compute()}>Compute</Button>
                {/* QA shortcuts for Premium PDF generation */}
                <Button size="sm" variant="default" onClick={() => qaGeneratePremiumPdf('eleve')}>QA PDF Élève</Button>
                <Button size="sm" variant="default" onClick={() => qaGeneratePremiumPdf('parent')}>QA PDF Parent</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
