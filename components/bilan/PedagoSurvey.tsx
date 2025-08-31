"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PedagoSurvey({ answers, onChange, onPrev, onNext }: { answers: any; onChange: (a: any) => void; onPrev: () => void; onNext: () => void; }) {
  const set = (k: string, v: any) => onChange({ ...answers, [k]: v });

  return (
    <div className="space-y-4" data-testid="wizard-pedago">
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Volet 2 — Profil pédagogique (démo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="pedago-motivation">Motivation principale</Label>
            <Input id="pedago-motivation" placeholder="examens / comprendre / logique / attentes" value={answers.motivation || ""} onChange={(e) => set("motivation", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pedago-style">Style d’apprentissage</Label>
            <Input id="pedago-style" placeholder="visuel / auditif / kinesthesique" value={answers.style || ""} onChange={(e) => set("style", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pedago-rhythm">Rythme</Label>
            <Input id="pedago-rhythm" placeholder="regulier / intensif" value={answers.rhythm || ""} onChange={(e) => set("rhythm", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pedago-confidence">Confiance (1 à 5)</Label>
            <Input id="pedago-confidence" type="number" min={1} max={5} value={answers.confidence ?? 3} onChange={(e) => set("confidence", Number(e.target.value))} />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onPrev}>Précédent</Button>
            <Button onClick={onNext} data-testid="wizard-results">Voir les résultats</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
