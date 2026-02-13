"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";

interface SubscriptionPlan {
  name: string;
  price: number;
  description: string;
}

interface SubscriptionChangeDialogProps {
  studentId: string;
  studentName: string;
  currentPlan: string;
  onRequestComplete: () => void;
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    name: "HYBRIDE",
    price: 450,
    description: "Formule hybride avec sessions en ligne et en présentiel"
  },
  {
    name: "IMMERSION",
    price: 650,
    description: "Formule immersion complète avec suivi personnalisé"
  },
  {
    name: "PREMIUM",
    price: 850,
    description: "Formule premium avec coach dédié et ressources exclusives"
  }
];

export default function SubscriptionChangeDialog({ studentId, studentName, currentPlan, onRequestComplete }: SubscriptionChangeDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    newPlan: "",
    reason: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.newPlan) {
      alert("Veuillez sélectionner un nouveau plan");
      return;
    }

    const selectedPlan = SUBSCRIPTION_PLANS.find(plan => plan.name === formData.newPlan);
    if (!selectedPlan) {
      alert("Plan invalide");
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
          requestType: 'PLAN_CHANGE',
          planName: selectedPlan.name,
          monthlyPrice: selectedPlan.price,
          reason: formData.reason
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setOpen(false);
        setFormData({ newPlan: "", reason: "" });
        onRequestComplete();
      } else {
        const errorData = await response.json();
        alert(`Erreur: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error requesting subscription change:', error);
      alert('Une erreur est survenue lors de la demande de changement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs sm:text-sm border-white/10 text-neutral-200 hover:text-white">
          <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-surface-card border border-white/10 text-neutral-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <CreditCard className="w-5 h-5" />
            Changer de Formule
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-2">
            Demande de changement de formule pour {studentName}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-neutral-200">Formule Actuelle</Label>
            <p className="text-sm text-neutral-300 bg-white/5 border border-white/10 p-2 rounded-lg">
              {currentPlan}
            </p>
          </div>
          
          <div>
            <Label htmlFor="newPlan" className="text-neutral-200">Nouvelle Formule *</Label>
            <Select value={formData.newPlan} onValueChange={(value) => setFormData({ ...formData, newPlan: value })}>
              <SelectTrigger className="border-white/10 bg-surface-elevated text-neutral-100">
                <SelectValue placeholder="Sélectionner une formule" />
              </SelectTrigger>
              <SelectContent className="bg-surface-card border border-white/10 text-neutral-100">
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <SelectItem key={plan.name} value={plan.name}>
                    <div className="flex flex-col">
                      <span className="font-medium">{plan.name} - {plan.price} TND/mois</span>
                      <span className="text-xs text-neutral-400">{plan.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="reason" className="text-neutral-200">Raison du changement (optionnel)</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Ex: Besoin de plus de sessions, changement de niveau..."
              rows={3}
            />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-200 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-200">
                <p className="font-medium mb-1">Information importante :</p>
                <p>Votre demande sera envoyée à l'assistant pour approbation. Le changement sera effectif après validation.</p>
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
                  <CreditCard className="w-4 h-4 mr-2" />
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
