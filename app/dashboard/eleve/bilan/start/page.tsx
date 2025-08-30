// app/dashboard/eleve/bilan/start/page.tsx
'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

export default function BilanStartPage() {
  const router = useRouter();
  const [level, setLevel] = useState<'premiere'|'terminale'>('premiere');
  const [statut, setStatut] = useState<'scolarise_fr'|'candidat_libre'>('scolarise_fr');
  const [loading, setLoading] = useState(false);

  async function onStart() {
    try {
      setLoading(true);
      const res = await fetch('/api/bilan/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: 'MATHEMATIQUES', level, statut })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur démarrage bilan');
      router.push(`/dashboard/eleve/bilan/${data.bilanId}`);
    } catch (e: any) {
      alert(e?.message || 'Erreur');
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Démarrer le Bilan — Mathématiques (Entrée en Première)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Niveau</Label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2"><input type="radio" name="level" checked={level==='premiere'} onChange={()=>setLevel('premiere')} /> Première</label>
              <label className="flex items-center gap-2"><input type="radio" name="level" checked={level==='terminale'} onChange={()=>setLevel('terminale')} /> Terminale</label>
            </div>
          </div>
          <div>
            <Label>Statut</Label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2"><input type="radio" name="statut" checked={statut==='scolarise_fr'} onChange={()=>setStatut('scolarise_fr')} /> Scolarisé (FR)</label>
              <label className="flex items-center gap-2"><input type="radio" name="statut" checked={statut==='candidat_libre'} onChange={()=>setStatut('candidat_libre')} /> Candidat libre</label>
            </div>
          </div>
          <Button data-testid="start-bilan" onClick={onStart} disabled={loading}>{loading?'Démarrage...':'Démarrer le QCM'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

