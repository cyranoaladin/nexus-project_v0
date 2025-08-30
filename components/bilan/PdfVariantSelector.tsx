// components/bilan/PdfVariantSelector.tsx
"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

async function download(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function PdfVariantSelector({ bilanId }: { bilanId: string }) {
  const [variant, setVariant] = useState('standard');
  const [loading, setLoading] = useState(false);

  async function onDownload() {
    try {
      setLoading(true);
      await download(`/api/bilan/pdf/${bilanId}?variant=${variant}`, `bilan-${bilanId}-${variant}.pdf`);
    } catch (e: any) {
      alert(e?.message || 'Erreur de téléchargement');
    } finally { setLoading(false); }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="w-56">
        <Select value={variant} onValueChange={setVariant}>
          <SelectTrigger>
            <SelectValue placeholder="Choisir la variante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Rapport complet (Standard)</SelectItem>
            <SelectItem value="parent">Version Parent (ROI)</SelectItem>
            <SelectItem value="eleve">Version Élève (badges)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={onDownload} disabled={loading}>{loading?'Préparation...':'Télécharger le PDF'}</Button>
    </div>
  );
}

