"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";

interface CreditPurchaseDialogProps {
  studentId: string;
  studentName: string;
  onPurchaseComplete: () => void;
}

export default function CreditPurchaseDialog({ studentId, studentName, onPurchaseComplete }: CreditPurchaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    creditAmount: "",
    reason: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.creditAmount || isNaN(Number(formData.creditAmount))) {
      alert("Veuillez entrer un nombre valide de crédits");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/parent/credit-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: studentId,
          creditAmount: parseInt(formData.creditAmount),
          reason: formData.reason
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setOpen(false);
        setFormData({ creditAmount: "", reason: "" });
        onPurchaseComplete();
      } else {
        const errorData = await response.json();
        alert(`Erreur: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error requesting credits:', error);
      alert('Une erreur est survenue lors de la demande de crédits');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm border-white/10 text-neutral-200 hover:text-white">
          <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          Acheter des Crédits
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-surface-card border border-white/10 text-neutral-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <CreditCard className="w-5 h-5" />
            Acheter des Crédits
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-2">
            Demande d'achat de crédits pour {studentName}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="creditAmount" className="text-neutral-200">Nombre de crédits *</Label>
            <Input
              id="creditAmount"
              type="number"
              min="1"
              value={formData.creditAmount}
              onChange={(e) => setFormData({ ...formData, creditAmount: e.target.value })}
              placeholder="Ex: 10"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="reason" className="text-neutral-200">Raison de l'achat (optionnel)</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Ex: Préparation aux examens, cours supplémentaires..."
              rows={3}
            />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-200 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-200">
                <p className="font-medium mb-1">Information importante :</p>
                <p>Votre demande sera envoyée à l'assistant pour approbation. Les crédits seront ajoutés à votre compte une fois approuvés.</p>
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
