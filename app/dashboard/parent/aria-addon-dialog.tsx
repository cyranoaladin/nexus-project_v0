"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";

interface AriaAddonDialogProps {
  studentId: string;
  studentName: string;
  onSuccess: () => void;
}

const ARIA_SUBJECTS = [
  { name: "NSI", value: "NSI" },
  { name: "Mathématiques", value: "MATH" },
  { name: "Physique Chimie", value: "PHYSICS" },
  { name: "Français", value: "FRENCH" },
];

export function AriaAddonDialog({ studentId, studentName, onSuccess }: AriaAddonDialogProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm();

  const selectedSubject = watch("subject");

  const onSubmit = async (formData: any) => {
    if (!session?.user) {
      alert("Vous devez être connecté pour faire une demande.");
      return;
    }
    if (!formData.subject) {
      alert("Veuillez sélectionner une matière pour ARIA+");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/parent/subscription-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          requestType: 'ARIA_ADDON',
          details: {
            subject: formData.subject,
            message: formData.message || `Demande d'ajout du service ARIA+ pour la matière ${formData.subject}.`
          }
        }),
      });

      if (!response.ok) {
        throw new Error('La requête a échoué');
      }
      onSuccess();
      setIsOpen(false);
    } catch (error) {
      console.error('Error requesting ARIA addon:', error);
      alert("Une erreur est survenue lors de la demande d'ajout.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Ajouter ARIA+</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un Service ARIA+</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Demande d'ajout de service ARIA+ pour {studentName}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="subject">Service ARIA+ *</Label>
            <Select onValueChange={(value) => setValue("subject", value)} value={selectedSubject}>
              <SelectTrigger id="subject">
                <SelectValue placeholder="Sélectionnez une matière" />
              </SelectTrigger>
              <SelectContent>
                {ARIA_SUBJECTS.map((subject) => (
                  <SelectItem key={subject.value} value={subject.value}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.subject && <p className="text-red-500 text-sm mt-1">Veuillez sélectionner une matière.</p>}
          </div>
          <div>
            <Label htmlFor="message">Message (Optionnel)</Label>
            <Input id="message" {...register("message")} placeholder="Un message pour l'administration..." />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Envoi en cours..." : "Envoyer la Demande"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
