"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Copy, Loader2, Plus, User } from "lucide-react";

interface AddChildDialogProps {
  onChildAdded: () => void;
  /** Controlled open state -- lets a parent (e.g. BilanGratuitBanner's CTA) open this dialog directly instead of just switching to the tab it lives on. Falls back to internal state when omitted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const GRADES = [
  "Seconde", "Première", "Terminale"
];

export default function AddChildDialog({ onChildAdded, open: controlledOpen, onOpenChange: setControlledOpen }: AddChildDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    grade: "",
    school: ""
  });
  /**
   * Enfant qui vient d'être ajouté. Tant qu'il est là, on affiche son lien
   * d'activation plutôt que le formulaire : le parent doit pouvoir le lire,
   * le copier et comprendre à quoi il sert — une URL jetée dans une alerte
   * navigateur ne remplissait aucune de ces trois conditions.
   */
  const [justAdded, setJustAdded] = useState<{ firstName: string; activationUrl: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.grade) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/parent/children', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const responseData = await response.json().catch(() => null);

      if (response.ok) {
        // La boîte reste ouverte : le parent doit voir le lien, et peut
        // enchaîner sur un autre enfant sans rouvrir quoi que ce soit.
        setJustAdded({
          firstName: formData.firstName,
          activationUrl: responseData?.activation?.activationUrl ?? null,
        });
        setCopied(false);
        setFormData({
          firstName: "",
          lastName: "",
          grade: "",
          school: ""
        });
        onChildAdded();
      } else {
        setError(responseData?.error ?? "Impossible d'ajouter l'enfant.");
      }
    } catch {
      setError("Une erreur est survenue lors de l'ajout de l'enfant. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 text-neutral-200 hover:text-white">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Ajouter un Enfant</span>
          <span className="sm:hidden">Ajouter</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Ajouter un Enfant
          </DialogTitle>
          <p className="text-sm text-neutral-400 mt-2">
            L'email sera automatiquement généré au format : prénom.nom@nexus-student.local
          </p>
          <p className="text-sm text-neutral-400">
            Un lien d'activation élève sera généré après la création.
          </p>
        </DialogHeader>
        {justAdded ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="font-medium text-emerald-200">
                {`${justAdded.firstName} peut maintenant passer son bilan.`}
              </p>
              <p className="mt-1 text-sm text-neutral-300">
                Remettez ce lien à votre enfant pour qu'il passe son bilan.
              </p>
              <p className="mt-1 text-sm text-neutral-300">
                Il choisira son mot de passe avant d’accéder au diagnostic. Ce lien est personnel et ne doit être
                communiqué qu’à lui.
              </p>
            </div>

            {justAdded.activationUrl ? (
              <div className="space-y-2">
                <Label className="text-neutral-200">{`Lien d'activation de ${justAdded.firstName}`}</Label>
                <div className="flex gap-2">
                  <Input readOnly value={justAdded.activationUrl} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard?.writeText(justAdded.activationUrl ?? '');
                      setCopied(true);
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span className="ml-2">{copied ? 'Copié' : 'Copier'}</span>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                Le lien d'activation sera disponible depuis la fiche de l'enfant.
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setJustAdded(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un autre enfant
              </Button>
              <Button type="button" className="flex-1" onClick={() => { setJustAdded(null); setOpen(false); }}>
                Terminer
              </Button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName" className="text-neutral-200">Prénom *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Prénom"
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-neutral-200">Nom *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Nom"
                required
              />
            </div>
          </div>
          


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="grade" className="text-neutral-200">Niveau *</Label>
              <Select value={formData.grade} onValueChange={(value) => setFormData({ ...formData, grade: value })}>
                <SelectTrigger className="bg-surface-elevated">
                  <SelectValue placeholder="Sélectionner le niveau" />
                </SelectTrigger>
                <SelectContent className="text-neutral-100">
                  {GRADES.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="school" className="text-neutral-200">Établissement</Label>
              <Input
                id="school"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                placeholder="Nom de l'établissement"
              />
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
                  Ajout en cours...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter l'Enfant
                </>
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="flex-1 text-neutral-200 hover:text-white"
              disabled={loading}
            >
              Annuler
            </Button>
          </div>
          {error !== null && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </p>
          )}
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
} 
