"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Brain, AlertCircle } from "lucide-react";

interface AriaAddonDialogProps {
  studentId: string;
  studentName: string;
  onRequestComplete: () => void;
}

const ARIA_ADDONS = [
  {
    name: "ARIA_MATH",
    price: 50,
    description: "Assistant IA spécialisé en mathématiques"
  },
  {
    name: "ARIA_PHYSICS",
    price: 50,
    description: "Assistant IA spécialisé en physique-chimie"
  },
  {
    name: "ARIA_FRENCH",
    price: 50,
    description: "Assistant IA spécialisé en français"
  },
  {
    name: "ARIA_ENGLISH",
    price: 50,
    description: "Assistant IA spécialisé en anglais"
  }
];

export default function AriaAddonDialog({ studentId, studentName, onRequestComplete }: AriaAddonDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    addonType: "",
    reason: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.addonType) {
      alert("Veuillez sélectionner un service ARIA+");
      return;
    }

    const selectedAddon = ARIA_ADDONS.find(addon => addon.name === formData.addonType);
    if (!selectedAddon) {
      alert("Service invalide");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/parent/subscription-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: studentId,
          requestType: 'ARIA_ADDON',
          planName: selectedAddon.name,
          monthlyPrice: selectedAddon.price,
          reason: formData.reason
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setOpen(false);
        setFormData({ addonType: "", reason: "" });
        onRequestComplete();
      } else {
        const errorData = await response.json();
        alert(`Erreur: ${errorData.error}`);
      }
    } catch (error) {
      alert('Une erreur est survenue lors de la demande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm border-white/10 text-neutral-200 hover:text-white">
          <Brain className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          Ajouter ARIA+
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-surface-card border border-white/10 text-neutral-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Brain className="w-5 h-5" />
            Ajouter un Service ARIA+
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-2">
            Demande d'ajout de service ARIA+ pour {studentName}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="addonType" className="text-neutral-200">Service ARIA+ *</Label>
            <Select value={formData.addonType} onValueChange={(value) => setFormData({ ...formData, addonType: value })}>
              <SelectTrigger className="border-white/10 bg-surface-elevated text-neutral-100">
                <SelectValue placeholder="Sélectionner un service" />
              </SelectTrigger>
              <SelectContent className="bg-surface-card border border-white/10 text-neutral-100">
                {ARIA_ADDONS.map((addon) => (
                  <SelectItem key={addon.name} value={addon.name}>
                    <div className="flex flex-col">
                      <span className="font-medium">{addon.description}</span>
                      <span className="text-xs text-neutral-400">{addon.price} TND/mois</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="reason" className="text-neutral-200">Raison de l'ajout (optionnel)</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Ex: Besoin d'aide supplémentaire en mathématiques, préparation aux examens..."
              rows={3}
            />
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Brain className="w-4 h-4 text-purple-200 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-purple-200">
                <p className="font-medium mb-1">Service ARIA+ :</p>
                <p>Assistant IA intelligent disponible 24h/24 pour aider votre enfant dans ses études.</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-200 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-200">
                <p className="font-medium mb-1">Information importante :</p>
                <p>Votre demande sera envoyée à l'assistant pour approbation. Le service sera activé après validation.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button 
              type="submit" 
              className="flex-1 btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Envoyer la Demande
                </>
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="flex-1 border-white/10 text-neutral-200 hover:text-white"
              disabled={loading}
            >
              Annuler
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 
