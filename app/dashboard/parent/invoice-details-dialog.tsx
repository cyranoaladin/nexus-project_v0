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
    startDate: string;
    endDate: string;
  } | null;
  studentName: string;
}

export default function InvoiceDetailsDialog({ subscriptionDetails, studentName }: InvoiceDetailsDialogProps) {
  const [open, setOpen] = useState(false);

  if (!subscriptionDetails) {
    return (
      <Button variant="outline" size="sm" className="text-xs sm:text-sm" disabled>
        Voir Détails
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
        <Button variant="outline" size="sm" className="text-xs sm:text-sm">
          Voir Détails
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Détails de Facturation
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Informations de facturation pour {studentName}
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">Formule Actuelle</h3>
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
            <p className="text-lg font-bold text-blue-600">
              {subscriptionDetails.planName}
            </p>
            <p className="text-sm text-gray-600">
              {subscriptionDetails.monthlyPrice} TND/mois
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Date de début</p>
                <p className="text-sm text-gray-600">
                  {formatDate(subscriptionDetails.startDate)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <CreditCard className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Prochaine facturation</p>
                <p className="text-sm text-gray-600">
                  {formatDate(subscriptionDetails.endDate)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <Receipt className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Information :</p>
                <p>La facturation est automatique à la date indiquée. Vous recevrez un email de confirmation.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
