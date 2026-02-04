"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sessionReportSchema, SessionReportFormData, EngagementLevel } from "@/lib/validation/session-report";
import { cn } from "@/lib/utils";

interface SessionReportFormProps {
  sessionId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const STORAGE_KEY_PREFIX = "session-report-draft-";

export function SessionReportForm({ sessionId, onSuccess, onCancel }: SessionReportFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const storageKey = `${STORAGE_KEY_PREFIX}${sessionId}`;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<SessionReportFormData>({
    resolver: zodResolver(sessionReportSchema),
    defaultValues: {
      summary: "",
      topicsCovered: "",
      performanceRating: 3,
      progressNotes: "",
      recommendations: "",
      attendance: true,
      engagementLevel: undefined,
      homeworkAssigned: "",
      nextSessionFocus: "",
    },
  });

  const watchedFields = watch();
  const performanceRating = watch("performanceRating");
  const attendance = watch("attendance");

  useEffect(() => {
    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        Object.keys(draft).forEach((key) => {
          setValue(key as keyof SessionReportFormData, draft[key]);
        });
      } catch (error) {
        console.error("Failed to load draft:", error);
      }
    }
  }, [storageKey, setValue]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(watchedFields));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [watchedFields, storageKey]);

  const onSubmit = async (data: SessionReportFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/coach/sessions/${sessionId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Échec de la soumission du rapport");
      }

      localStorage.removeItem(storageKey);
      
      toast.success("Rapport envoyé", {
        description: "Le rapport de session a été soumis avec succès. Le parent a été notifié.",
      });

      reset();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Erreur", {
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la soumission",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Label htmlFor="summary" className="required">
          Résumé de la session *
        </Label>
        <Textarea
          id="summary"
          {...register("summary")}
          placeholder="Décrivez brièvement le déroulement de la session..."
          rows={3}
          aria-required="true"
          aria-invalid={!!errors.summary}
          aria-describedby={errors.summary ? "summary-error" : undefined}
        />
        {errors.summary && (
          <p id="summary-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">
            {errors.summary.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="topicsCovered" className="required">
          Sujets abordés *
        </Label>
        <Textarea
          id="topicsCovered"
          {...register("topicsCovered")}
          placeholder="Listez les principaux sujets et thèmes couverts..."
          rows={3}
          aria-required="true"
          aria-invalid={!!errors.topicsCovered}
          aria-describedby={errors.topicsCovered ? "topics-error" : undefined}
        />
        {errors.topicsCovered && (
          <p id="topics-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">
            {errors.topicsCovered.message}
          </p>
        )}
      </div>

      <div>
        <Label className="required">Note de performance (1-5 étoiles) *</Label>
        <RadioGroup
          value={String(performanceRating)}
          onValueChange={(value) => setValue("performanceRating", parseInt(value))}
          className="flex gap-2 mt-2"
          aria-required="true"
          aria-invalid={!!errors.performanceRating}
          aria-describedby={errors.performanceRating ? "rating-error" : undefined}
        >
          {[1, 2, 3, 4, 5].map((rating) => (
            <label
              key={rating}
              className={cn(
                "flex items-center justify-center cursor-pointer transition-all",
                "w-10 h-10 md:w-12 md:h-12 rounded-lg border-2",
                performanceRating >= rating
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-gray-300 bg-white hover:border-yellow-300"
              )}
            >
              <RadioGroupItem value={String(rating)} className="sr-only" />
              <Star
                className={cn(
                  "w-5 h-5 md:w-6 md:h-6 transition-colors",
                  performanceRating >= rating
                    ? "fill-yellow-500 text-yellow-500"
                    : "text-gray-300"
                )}
                aria-hidden="true"
              />
              <span className="sr-only">{rating} étoile{rating > 1 ? "s" : ""}</span>
            </label>
          ))}
        </RadioGroup>
        {errors.performanceRating && (
          <p id="rating-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">
            {errors.performanceRating.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="progressNotes" className="required">
          Notes de progression *
        </Label>
        <Textarea
          id="progressNotes"
          {...register("progressNotes")}
          placeholder="Décrivez les progrès de l'élève, points forts et axes d'amélioration..."
          rows={3}
          aria-required="true"
          aria-invalid={!!errors.progressNotes}
          aria-describedby={errors.progressNotes ? "progress-error" : undefined}
        />
        {errors.progressNotes && (
          <p id="progress-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">
            {errors.progressNotes.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="recommendations" className="required">
          Recommandations *
        </Label>
        <Textarea
          id="recommendations"
          {...register("recommendations")}
          placeholder="Vos recommandations pour la suite..."
          rows={3}
          aria-required="true"
          aria-invalid={!!errors.recommendations}
          aria-describedby={errors.recommendations ? "recommendations-error" : undefined}
        />
        {errors.recommendations && (
          <p id="recommendations-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">
            {errors.recommendations.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <Label htmlFor="attendance" className="font-medium cursor-pointer">
            Présence de l'élève *
          </Label>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            {attendance ? "L'élève était présent" : "L'élève était absent"}
          </p>
        </div>
        <Switch
          id="attendance"
          checked={attendance}
          onCheckedChange={(checked) => setValue("attendance", checked)}
          aria-required="true"
          aria-label="Présence de l'élève"
        />
      </div>

      <div>
        <Label htmlFor="engagementLevel">Niveau d'engagement (optionnel)</Label>
        <Select
          value={watch("engagementLevel") || ""}
          onValueChange={(value) => setValue("engagementLevel", value as EngagementLevel)}
        >
          <SelectTrigger id="engagementLevel" aria-label="Niveau d'engagement">
            <SelectValue placeholder="Sélectionnez un niveau" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">Faible</SelectItem>
            <SelectItem value="MEDIUM">Moyen</SelectItem>
            <SelectItem value="HIGH">Élevé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="homeworkAssigned">Devoirs assignés (optionnel)</Label>
        <Textarea
          id="homeworkAssigned"
          {...register("homeworkAssigned")}
          placeholder="Décrivez les devoirs ou exercices à faire..."
          rows={2}
        />
      </div>

      <div>
        <Label htmlFor="nextSessionFocus">Focus pour la prochaine session (optionnel)</Label>
        <Textarea
          id="nextSessionFocus"
          {...register("nextSessionFocus")}
          placeholder="Quels sujets aborder lors de la prochaine session..."
          rows={2}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            "Soumettre le rapport"
          )}
        </Button>
      </div>
    </form>
  );
}
