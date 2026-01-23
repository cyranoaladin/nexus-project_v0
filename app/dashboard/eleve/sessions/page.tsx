"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { sessionBookingSchema } from "@/lib/validations";
import { ServiceType, Subject } from "@/types/enums";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Calendar, Clock, CreditCard, Loader2, User } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const SUBJECTS_OPTIONS = [
  { value: Subject.MATHEMATIQUES, label: "Mathématiques" },
  { value: Subject.NSI, label: "NSI" },
  { value: Subject.FRANCAIS, label: "Français" },
  { value: Subject.PHILOSOPHIE, label: "Philosophie" },
  { value: Subject.HISTOIRE_GEO, label: "Histoire-Géographie" },
  { value: Subject.ANGLAIS, label: "Anglais" },
  { value: Subject.ESPAGNOL, label: "Espagnol" },
  { value: Subject.PHYSIQUE_CHIMIE, label: "Physique-Chimie" },
  { value: Subject.SVT, label: "SVT" },
  { value: Subject.SES, label: "SES" }
];

const SERVICE_TYPES = [
  { value: ServiceType.COURS_ONLINE, label: "Cours en ligne", cost: 1, description: "1 crédit" },
  { value: ServiceType.COURS_PRESENTIEL, label: "Cours en présentiel", cost: 1.25, description: "1,25 crédit" },
  { value: ServiceType.ATELIER_GROUPE, label: "Atelier de groupe", cost: 1.5, description: "1,5 crédit" }
];

export default function SessionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm({
    resolver: zodResolver(sessionBookingSchema)
  });

  const selectedType = watch('type');
  const selectedDuration = watch('duration') || 60;
  
  // Calculate credit cost based on type and duration
  const getCreditCost = () => {
    const baseCost = SERVICE_TYPES.find(t => t.value === selectedType)?.cost || 1;
    const durationMultiplier = selectedDuration / 60; // 60min = 1 session, 90min = 1.5 sessions, 120min = 2 sessions
    return baseCost * durationMultiplier;
  };
  
  const selectedCost = getCreditCost();

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ELEVE') {
      router.push("/auth/signin");
      return;
    }

    const fetchStudentData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/student/credits');
        
        if (!response.ok) {
          throw new Error('Failed to fetch student data');
        }
        
        const data = await response.json();
        setAvailableCredits(data.balance);
      } catch (err) {
        console.error('Error fetching student data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [session, status, router]);

  const onSubmit = async (data: z.infer<typeof sessionBookingSchema>) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/sessions/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        alert('Session réservée avec succès !');
        router.push('/dashboard/eleve');
      } else {
        alert(result.error || 'Erreur lors de la réservation');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 text-red-600">⚠️</div>
          <p className="text-red-600 mb-4">Erreur lors du chargement</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/dashboard/eleve">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour au Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold text-gray-900">Réserver une Session</h1>
              <p className="text-sm text-gray-500">Choisissez votre cours ou atelier</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Formulaire de réservation */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                  Nouvelle Réservation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Matière */}
                  <div>
                    <Label htmlFor="subject">Matière *</Label>
                    <Select onValueChange={(value) => setValue('subject', value as Subject)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir une matière" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECTS_OPTIONS.map((subject) => (
                          <SelectItem key={subject.value} value={subject.value}>
                            {subject.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.subject && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.subject.message as string}
                      </p>
                    )}
                  </div>

                  {/* Type de session */}
                  <div>
                    <Label htmlFor="type">Type de session *</Label>
                    <Select onValueChange={(value) => setValue('type', value as ServiceType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir le type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex justify-between items-center w-full">
                              <span>{type.label}</span>
                              <Badge variant="outline" className="ml-2">
                                {type.description}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.type && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.type.message as string}
                      </p>
                    )}
                  </div>

                  {/* Date et heure */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="scheduledAt">Date et heure *</Label>
                      <Input
                        id="scheduledAt"
                        type="datetime-local"
                        {...register('scheduledAt')}
                        min={new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                        placeholder="Sélectionnez une date et heure"
                      />
                      {errors.scheduledAt && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.scheduledAt.message as string}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        La session doit être programmée au minimum 2 heures à l'avance
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="duration">Durée (minutes) *</Label>
                      <Select onValueChange={(value) => setValue('duration', parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Durée" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60">60 minutes</SelectItem>
                          <SelectItem value="90">90 minutes</SelectItem>
                          <SelectItem value="120">120 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.duration && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.duration.message as string}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Titre */}
                  <div>
                    <Label htmlFor="title">Titre de la session *</Label>
                    <Input
                      id="title"
                      {...register('title')}
                      placeholder="Ex: Révision chapitre dérivées"
                    />
                    {errors.title && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.title.message as string}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="description">Description (optionnel)</Label>
                    <Textarea
                      id="description"
                      {...register('description')}
                      placeholder="Précisez vos besoins, difficultés ou objectifs..."
                      rows={3}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || selectedCost > availableCredits}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Réservation en cours...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Réserver cette Session
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Informations */}
          <div className="space-y-6">
            {/* Solde de crédits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                  Mon Solde
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {availableCredits} crédits
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Disponibles pour vos sessions
                  </p>
                  {selectedCost && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        <strong>Coût de cette session :</strong><br />
                        {selectedCost.toFixed(1)} crédit{selectedCost > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {selectedDuration} minutes = {selectedDuration / 60} session{selectedDuration / 60 > 1 ? 's' : ''}
                      </p>
                      {selectedCost > availableCredits && (
                        <p className="text-red-600 text-xs mt-2 font-medium">
                          ⚠️ Solde insuffisant
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Coachs disponibles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <User className="w-5 h-5 mr-2 text-green-600" />
                  Coachs Disponibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">H</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Axiom</p>
                      <p className="text-xs text-gray-600">Mathématiques</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">T</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Recursiv</p>
                      <p className="text-xs text-gray-600">NSI</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-semibold text-sm">A</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Scriptor</p>
                      <p className="text-xs text-gray-600">Français</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Politique d'annulation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Politique d'Annulation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Cours : annulation gratuite &gt; 24h</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span>Ateliers : annulation gratuite &gt; 48h</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
