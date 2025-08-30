// app/dashboard/eleve/bilan/[bilanId]/profil/page.tsx
'use client';
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function BilanProfilPage() {
  const params = useParams() as { bilanId: string };
  const router = useRouter();
  const [form, setForm] = useState({
    style: '', organisation: '', rythme: '', motivation: '', difficultes: '', attentes: '', objectif: ''
  });
  const [loading, setLoading] = useState(false);

  function setVal(k: string, v: string) { setForm(prev=>({ ...prev, [k]: v })); }

  async function onSubmit() {
    try {
      setLoading(true);
      const res = await fetch(`/api/bilan/${params.bilanId}/profil`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur sauvegarde profil');
      // Générer rapport IA, puis aller aux résultats
      await fetch(`/api/bilan/${params.bilanId}/report`, { method: 'POST' });
      router.push(`/dashboard/eleve/bilan/${params.bilanId}`);
    } catch (e: any) {
      alert(e?.message || 'Erreur');
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Questionnaire pédagogique & personnel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label htmlFor="learningStyle">Style d’apprentissage (VAK/Kolb)</Label>
            <Textarea id="learningStyle" value={form.style} onChange={e=>setVal('style', e.target.value)} placeholder="Ex: visuel, auditif, kinesthésique..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="organisation">Organisation / Rythme</Label>
              <Textarea id="organisation" value={form.organisation} onChange={e=>setVal('organisation', e.target.value)} placeholder="Ex: régulier/irrégulier; matin/soir" />
            </div>
            <div>
              <Label htmlFor="motivation">Motivation</Label>
              <Textarea id="motivation" value={form.motivation} onChange={e=>setVal('motivation', e.target.value)} placeholder="Ex: élevée, variable, à renforcer" />
            </div>
          </div>
          <div>
            <Label htmlFor="difficultes">Difficultés éventuelles (DYS, TDAH...)</Label>
            <Textarea id="difficultes" value={form.difficultes} onChange={e=>setVal('difficultes', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="objectif">Attentes / Objectif (mention, Parcoursup...)</Label>
            <Textarea id="objectif" value={form.objectif} onChange={e=>setVal('objectif', e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button data-testid="profil-submit" onClick={onSubmit} disabled={loading}>{loading?'Envoi...':'Générer le rapport'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

