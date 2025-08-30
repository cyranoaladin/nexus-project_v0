'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Clock, AlertCircle, CheckCircle, BookOpenCheck, Edit } from "lucide-react";
import { useRouter } from "next/navigation";

export type BilanCardProps = {
  id: string;
  variant: 'PARENT' | 'ELEVE';
  status: 'PENDING' | 'GENERATING' | 'COMPILING' | 'READY' | 'FAILED';
  createdAt: string;
  score?: number;
};

const statusConfig = {
  PENDING: { text: "En attente", icon: Clock, color: "bg-gray-500" },
  GENERATING: { text: "Génération...", icon: Clock, color: "bg-blue-500" },
  COMPILING: { text: "Compilation...", icon: Clock, color: "bg-yellow-500" },
  READY: { text: "Prêt", icon: CheckCircle, color: "bg-green-500" },
  FAILED: { text: "Échec", icon: AlertCircle, color: "bg-red-500" },
};

export function BilanCard({ bilan }: { bilan: BilanCardProps }) {
  const { id, variant, status, createdAt, score } = bilan;
  const config = statusConfig[status];
  const Icon = config.icon;
  const router = useRouter();

  const handleAction = () => {
    if (status === 'READY') {
      window.open(`/api/bilans/${id}/download`, '_blank');
    } else if (status === 'PENDING') {
      router.push(`/dashboard/student/bilan/${id}/volet2`);
    }
  };

  const getActionDetails = () => {
    switch(status) {
      case 'READY':
        return { text: 'Télécharger', icon: Download, disabled: false };
      case 'PENDING':
        return { text: 'Compléter Volet 2', icon: Edit, disabled: false };
      default:
        return { text: 'En cours...', icon: Clock, disabled: true };
    }
  };

  const action = getActionDetails();
  const ActionIcon = action.icon;

  return (
    <Card data-bilan-id={id}>
      <CardHeader>
        <CardTitle>Bilan Premium</CardTitle>
        <CardDescription>
          {new Date(createdAt).toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric'
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Variante</span>
          <Badge variant="outline">{variant === 'PARENT' ? 'Parent' : 'Élève'}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Statut</span>
          <Badge className={`${config.color} text-white`}>
            <Icon className="w-4 h-4 mr-2" />
            {config.text}
          </Badge>
        </div>
        {score && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Score global</span>
            <span className="font-semibold">{score}%</span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleAction} disabled={action.disabled} className="w-full">
          <ActionIcon className="w-4 h-4 mr-2" />
          {action.text}
        </Button>
      </CardFooter>
    </Card>
  );
}
