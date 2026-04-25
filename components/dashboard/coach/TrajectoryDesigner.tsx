"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Target, Save, Plus, Loader2 } from "lucide-react";
import { useState } from "react";

interface TrajectoryDesignerProps {
  studentId: string;
  onSave: (data: any) => void;
}

export function TrajectoryDesigner({ studentId, onSave }: TrajectoryDesignerProps) {
  const [title, setTitle] = useState("");
  const [targetScore, setTargetScore] = useState(80);
  const [horizon, setHorizon] = useState("6_MONTHS");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const response = await fetch('/api/coach/trajectory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, title, targetScore, horizon }),
      });
      
      if (response.ok) {
        setSuccess(true);
        const data = await response.json();
        onSave(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-surface-card border-white/10 shadow-premium">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-brand-accent" />
          Conception de Trajectoire
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-[10px] uppercase text-neutral-500 font-bold mb-1.5 block">Objectif Stratégique</label>
          <Input 
            placeholder="Ex: Maîtrise de l'Analyse pour le Bac" 
            className="bg-white/5 border-white/10 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase text-neutral-500 font-bold mb-1.5 block">Cible NexusIndex</label>
            <Input 
              type="number"
              className="bg-white/5 border-white/10 text-sm"
              value={targetScore}
              onChange={(e) => setTargetScore(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-neutral-500 font-bold mb-1.5 block">Horizon</label>
            <select 
              className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-sm text-white outline-none focus:ring-1 focus:ring-brand-accent"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
            >
              <option value="3_MONTHS">3 Mois</option>
              <option value="6_MONTHS">6 Mois</option>
              <option value="12_MONTHS">12 Mois</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase text-neutral-500 font-bold mb-1.5 block">Jalons (Milestones)</label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input placeholder="Titre du jalon" className="bg-white/5 border-white/10 text-xs h-8" />
              <Button size="sm" variant="outline" className="h-8 border-white/10">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        <Button 
          className="w-full bg-brand-accent hover:bg-brand-accent/90 mt-2" 
          onClick={handleSave}
          disabled={loading || !title}
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {success ? "Enregistré !" : "Enregistrer la Trajectoire"}
        </Button>
        {success && <p className="text-[10px] text-emerald-400 text-center mt-2">Trajectoire mise à jour avec succès.</p>}
      </CardContent>
    </Card>
  );
}

