"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Calendar, Receipt } from "lucide-react";

interface InvoiceDetailsDialogProps {
  subscriptionDetails: {
    planName: string;
    monthlyPrice: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  studentName: string;
}

export default function InvoiceDetailsDialog({ subscriptionDetails, studentName }: InvoiceDetailsDialogProps) {
  const [open, setOpen] = useState(false);

  if (!subscriptionDetails) {
    return (
      <Button variant="outline" size="sm" className="text-xs sm:text-sm text-neutral-400" disabled>
        Voir les détails
      </Button>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Actif';
      case 'INACTIVE': return 'Inactif';
      case 'REJECTED': return 'Rejeté';
      default: return status;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs sm:text-sm text-neutral-200 hover:text-white">
          Voir les détails
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Détails de l'abonnement
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-2">
            Informations d'abonnement pour {studentName}
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-white/5 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Formule Actuelle</h3>
              <Badge
                variant={
                  subscriptionDetails.status === 'ACTIVE'
                    ? 'default'
                    : subscriptionDetails.status === 'INACTIVE'
                    ? 'outline'
                    : subscriptionDetails.status === 'REJECTED'
                    ? 'destructive'
                    : 'outline'
                }
              >
                {getStatusText(subscriptionDetails.status)}
              </Badge>
            </div>
            <p className="text-lg font-bold text-brand-primary">
              {subscriptionDetails.planName}
            </p>
            <p className="text-sm text-neutral-400">
              {subscriptionDetails.monthlyPrice} TND/mois
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
              <Calendar className="w-5 h-5 text-brand-accent" />
              <div>
                <p className="text-sm font-medium">Date de début</p>
                <p className="text-sm text-neutral-400">
                  {subscriptionDetails.startDate ? formatDate(subscriptionDetails.startDate) : 'Non renseignée'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
              <CreditCard className="w-5 h-5 text-emerald-300" />
              <div>
                <p className="text-sm font-medium">Fin de période prévue</p>
                <p className="text-sm text-neutral-400">
                  {subscriptionDetails.endDate ? formatDate(subscriptionDetails.endDate) : 'Non renseignée'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <Receipt className="w-4 h-4 text-slate-200 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-200">
                <p className="font-medium mb-1">Information :</p>
                <p>Ces informations résument l'abonnement enregistré. Toute modification reste soumise au suivi administratif Nexus.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="text-neutral-200 hover:text-white"
            >
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
