"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, User, BookOpen, CreditCard, CheckCircle, AlertCircle, Loader2, Info, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  coachSubjects: string[];
}

interface AvailableSlot {
  coachId: string;
  coachName: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number;
  modality?: 'ONLINE' | 'IN_PERSON';
}

interface SessionBookingProps {
  studentId: string;
  parentId?: string;
  userCredits: number;
  onBookingComplete?: (sessionId: string) => void;
}

const SUBJECTS = [
  { value: 'MATHEMATIQUES', label: 'Mathématiques' },
  { value: 'NSI', label: 'NSI (Numérique et Sciences Informatiques)' },
  { value: 'FRANCAIS', label: 'Français' },
  { value: 'PHILOSOPHIE', label: 'Philosophie' },
  { value: 'HISTOIRE_GEO', label: 'Histoire-Géographie' },
  { value: 'ANGLAIS', label: 'Anglais' },
  { value: 'ESPAGNOL', label: 'Espagnol' },
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-Chimie' },
  { value: 'SVT', label: 'SVT' },
  { value: 'SES', label: 'SES' }
];

const SESSION_TYPES = [
  { value: 'INDIVIDUAL', label: 'Session individuelle' },
  { value: 'GROUP', label: 'Session de groupe' },
  { value: 'MASTERCLASS', label: 'Masterclass' }
];

const MODALITIES = [
  { value: 'ONLINE', label: 'En ligne' },
  { value: 'IN_PERSON', label: 'En présentiel' },
  { value: 'HYBRID', label: 'Hybride' }
];

export default function SessionBooking({ 
  studentId, 
  parentId, 
  userCredits,
  onBookingComplete 
}: SessionBookingProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [subject, setSubject] = useState('');
  const [selectedCoach, setSelectedCoach] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [sessionType, setSessionType] = useState('INDIVIDUAL');
  const [modality, setModality] = useState('ONLINE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creditsToUse, setCreditsToUse] = useState(1);
  
  // Data
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday;
  });

  // Validation states
  const [titleError, setTitleError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');


  const loadCoaches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/coaches/available?subject=${subject}`);
      const data = await response.json();
      
      if (data.success) {
        setCoaches(data.coaches);
      } else {
        setError('Erreur lors du chargement des coachs');
      }
    } catch (err) {
      setError('Erreur lors du chargement des coachs');
    } finally {
      setLoading(false);
    }
  }, [subject]);

  const loadAvailableSlots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const endDate = new Date(selectedWeek);
      endDate.setDate(selectedWeek.getDate() + 6);
      
      const response = await fetch(
        `/api/coaches/availability?coachId=${selectedCoach}&startDate=${selectedWeek.toISOString()}&endDate=${endDate.toISOString()}`
      );
      const data = await response.json();
      
      if (data.success) {
        // Use the enhanced available slots from the API
        const slots = data.availableSlots.map((slot: any) => ({
          coachId: selectedCoach,
          coachName: coaches.find(c => c.id === selectedCoach)?.firstName + ' ' + coaches.find(c => c.id === selectedCoach)?.lastName,
          date: new Date(slot.date),
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: slot.duration,
          modality: slot.modality as 'ONLINE' | 'IN_PERSON' | undefined,
        }));
        setAvailableSlots(slots);
      } else {
        setError('Erreur lors du chargement des créneaux');
      }
    } catch (err) {
      setError('Erreur lors du chargement des créneaux');
    } finally {
      setLoading(false);
    }
  }, [selectedCoach, selectedWeek, coaches]);

  // Load coaches when subject changes
  useEffect(() => {
    if (subject) {
      loadCoaches();
    } else {
      setCoaches([]);
      setSelectedCoach('');
    }
  }, [subject, loadCoaches]);

  // Load available slots when coach and week change
  useEffect(() => {
    if (selectedCoach && selectedWeek) {
      loadAvailableSlots();
    } else {
      setAvailableSlots([]);
    }
  }, [selectedCoach, selectedWeek, modality, loadAvailableSlots]);

  const calculateDuration = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    return (endHour * 60 + endMin) - (startHour * 60 + startMin);
  };

  const formatTime = (time: string): string => {
    return time.substring(0, 5);
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const isDateInPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateTooFar = (date: Date): boolean => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return date > maxDate;
  };

  const validateBooking = (): string | null => {
    if (!selectedSlot) {
      return 'Veuillez sélectionner un créneau';
    }

    if (!title.trim()) {
      return 'Veuillez saisir un titre pour la session';
    }

    if (titleError || descriptionError) {
      return 'Veuillez corriger les erreurs de saisie';
    }

    if (creditsToUse > userCredits) {
      return 'Crédits insuffisants';
    }

    if (isDateInPast(selectedSlot.date)) {
      return 'Impossible de réserver une session dans le passé';
    }

    if (isDateTooFar(selectedSlot.date)) {
      return 'Impossible de réserver une session plus de 3 mois à l\'avance';
    }

    const dayOfWeek = selectedSlot.date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'Les sessions ne peuvent pas être réservées le weekend';
    }

    const startHour = parseInt(selectedSlot.startTime.split(':')[0]);
    const endHour = parseInt(selectedSlot.endTime.split(':')[0]);
    if (startHour < 8 || endHour > 20) {
      return 'Les sessions doivent être entre 8h00 et 20h00';
    }

    return null;
  };

  const handleBookSession = async () => {
    const validationError = validateBooking();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formatLocalDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${da}`;
      };

      const bookingData = {
        coachId: selectedSlot!.coachId,
        studentId: studentId,
        parentId: parentId,
        subject: subject,
        scheduledDate: formatLocalDate(selectedSlot!.date),
        startTime: selectedSlot!.startTime,
        endTime: selectedSlot!.endTime,
        duration: selectedSlot!.duration,
        type: sessionType,
        modality: modality,
        title: title,
        description: description,
        creditsToUse: creditsToUse
      } as const;

      const response = await fetch('/api/sessions/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData)
      });

      const data = await response.json();

      if (data.success) {
        setStep(4); // Success step
        if (onBookingComplete) {
          onBookingComplete(data.sessionId);
        }
      } else {
        setError(data.error || 'Erreur lors de la réservation');
      }
    } catch (err) {
      setError('Erreur lors de la réservation');
    } finally {
      setLoading(false);
    }
  };

  const handleGotoPurchaseCredits = () => {
    // Rediriger vers le dashboard parent où l'achat de crédits est disponible
    try {
      router.push('/dashboard/parent?open=purchase-credits');
    } catch {
      window.location.href = '/dashboard/parent?open=purchase-credits';
    }
  };

  const nextWeek = () => {
    const next = new Date(selectedWeek);
    next.setDate(selectedWeek.getDate() + 7);
    setSelectedWeek(next);
  };

  const prevWeek = () => {
    const prev = new Date(selectedWeek);
    prev.setDate(selectedWeek.getDate() - 7);
    setSelectedWeek(prev);
  };

  const resetBooking = () => {
    setStep(1);
    setSubject('');
    setSelectedCoach('');
    setSelectedSlot(null);
    setTitle('');
    setDescription('');
    setError(null);
    setTitleError('');
    setDescriptionError('');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg md:text-xl">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6 mr-2 text-blue-600" />
            Réserver une Session
          </CardTitle>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CreditCard className="w-4 h-4" />
            <span>Crédits disponibles: {userCredits}</span>
          </div>
        </CardHeader>

        <CardContent>
          {/* Progress indicator */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3].map((stepNum) => (
                <div
                  key={stepNum}
                  className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-sm md:text-base font-medium ${
                    step >= stepNum
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {stepNum}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs md:text-sm text-gray-600">
              <span>Matière & Coach</span>
              <span>Créneaux</span>
              <span>Détails</span>
            </div>
          </div>

          {/* Business rules info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Règles de réservation :</p>
                <ul className="space-y-1 text-xs">
                  <li>• Sessions uniquement en semaine (lundi à vendredi)</li>
                  <li>• Horaires : 8h00 - 20h00</li>
                  <li>• Réservation possible jusqu'à 3 mois à l'avance</li>
                  <li>• Durée : 30 minutes à 3 heures</li>
                </ul>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
              {error === 'Crédits insuffisants' && (
                <Button size="sm" onClick={handleGotoPurchaseCredits} className="ml-3">
                  Acheter des crédits
                </Button>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1: Subject and Coach Selection */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 md:space-y-6"
              >
                <div>
                  <Label htmlFor="subject" className="text-sm md:text-base">Matière *</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sélectionnez une matière" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((subj) => (
                        <SelectItem key={subj.value} value={subj.value}>
                          {subj.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {subject && (
                  <div>
                    <Label htmlFor="coach" className="text-sm md:text-base">Coach *</Label>
                    {loading ? (
                      <div className="mt-1 p-3 border rounded-lg flex items-center">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        <span className="text-sm">Chargement des coachs...</span>
                      </div>
                    ) : coaches.length > 0 ? (
                      <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionnez un coach" />
                        </SelectTrigger>
                        <SelectContent>
                          {coaches.map((coach) => (
                            <SelectItem key={coach.id} value={coach.id}>
                              {coach.firstName} {coach.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1 p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-800">Aucun coach disponible pour cette matière</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!subject || !selectedCoach}
                    className="px-6 md:px-8"
                  >
                    Suivant
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Time Slot Selection */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 md:space-y-6"
              >
                {/* Week navigation */}
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={prevWeek} size="sm">
                    ← Semaine précédente
                  </Button>
                  <span className="text-sm md:text-base font-medium">
                    Semaine du {selectedWeek.toLocaleDateString('fr-FR')}
                  </span>
                  <Button variant="outline" onClick={nextWeek} size="sm">
                    Semaine suivante →
                  </Button>
                </div>

                {/* Available slots */}
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Chargement des créneaux...</p>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* En ligne */}
                    <div>
                      <div className="mb-2 text-sm font-medium text-blue-700">En ligne</div>
                      <div className="grid gap-3 md:gap-4">
                        {availableSlots.filter((s: any) => s.modality === 'ONLINE').map((slot, index) => {
                          const isPast = isDateInPast(slot.date);
                          const isTooFar = isDateTooFar(slot.date);
                          const isWeekend = slot.date.getDay() === 0 || slot.date.getDay() === 6;
                          const isInvalidTime = parseInt(slot.startTime.split(':')[0]) < 8 || parseInt(slot.endTime.split(':')[0]) > 20;
                          return (
                            <Card
                              key={`on-${index}`}
                              className={`cursor-pointer transition-all duration-200 ${
                                selectedSlot === slot
                                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600'
                                  : isPast || isTooFar || isWeekend || isInvalidTime
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:border-blue-300'
                              }`}
                              onClick={() => {
                                if (!isPast && !isTooFar && !isWeekend && !isInvalidTime) {
                                  setSelectedSlot(slot);
                                }
                              }}
                            >
                              <CardContent className="p-3 md:p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    <div>
                                      <p className="font-medium text-sm md:text-base">{formatDate(slot.date)}</p>
                                      <p className="text-xs md:text-sm text-gray-600">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="outline" className="text-xs">{slot.duration} min</Badge>
                                    <Badge variant="default" className="text-xs ml-1 bg-blue-600 text-white">En ligne</Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    {/* Présentiel */}
                    <div>
                      <div className="mb-2 text-sm font-medium text-green-700">Présentiel</div>
                      <div className="grid gap-3 md:gap-4">
                        {availableSlots.filter((s: any) => s.modality === 'IN_PERSON').map((slot, index) => {
                          const isPast = isDateInPast(slot.date);
                          const isTooFar = isDateTooFar(slot.date);
                          const isWeekend = slot.date.getDay() === 0 || slot.date.getDay() === 6;
                          const isInvalidTime = parseInt(slot.startTime.split(':')[0]) < 8 || parseInt(slot.endTime.split(':')[0]) > 20;
                          return (
                            <Card
                              key={`ip-${index}`}
                              className={`cursor-pointer transition-all duration-200 ${
                                selectedSlot === slot
                                  ? 'border-green-600 bg-green-50 ring-2 ring-green-600'
                                  : isPast || isTooFar || isWeekend || isInvalidTime
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:border-green-300'
                              }`}
                              onClick={() => {
                                if (!isPast && !isTooFar && !isWeekend && !isInvalidTime) {
                                  setSelectedSlot(slot);
                                }
                              }}
                            >
                              <CardContent className="p-3 md:p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <Calendar className="w-4 h-4 text-green-600" />
                                    <div>
                                      <p className="font-medium text-sm md:text-base">{formatDate(slot.date)}</p>
                                      <p className="text-xs md:text-sm text-gray-600">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="outline" className="text-xs">{slot.duration} min</Badge>
                                    <Badge variant="outline" className="text-xs ml-1">Présentiel</Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucun créneau disponible cette semaine</p>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Précédent
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!selectedSlot}
                    className="px-6 md:px-8"
                  >
                    Suivant
                  </Button>
                </div>

                {selectedSlot && (
                  <div className="sticky bottom-2 mt-4 bg-white border rounded-lg shadow p-3 flex items-center justify-between">
                    <div className="text-sm text-gray-800">
                      Créneau sélectionné: {formatDate(selectedSlot.date)} • {formatTime(selectedSlot.startTime)}-{formatTime(selectedSlot.endTime)} • {selectedSlot.modality === 'ONLINE' ? 'En ligne' : 'Présentiel'}
                    </div>
                    <div className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedSlot(null)}>Changer</Button>
                      <Button size="sm" onClick={() => setStep(3)}>Valider</Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Session Details */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 md:space-y-6"
              >
                {selectedSlot && (
                  <div className="p-4 bg-blue-50 rounded-lg mb-6">
                    <h3 className="font-medium text-blue-900 mb-2">Récapitulatif</h3>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>Coach: {selectedSlot.coachName}</p>
                      <p>Date: {formatDate(selectedSlot.date)}</p>
                      <p>Heure: {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</p>
                      <p>Durée: {selectedSlot.duration} minutes</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <div>
                    <Label htmlFor="sessionType" className="text-sm md:text-base">Type de session</Label>
                    <Select value={sessionType} onValueChange={setSessionType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SESSION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="modality" className="text-sm md:text-base">Modalité</Label>
                    <Select value={modality} onValueChange={setModality}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ONLINE">En ligne</SelectItem>
                        <SelectItem value="IN_PERSON">Présentiel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm md:text-base">Filtre</Label>
                    <div className="mt-2 text-xs text-gray-600">
                      Créneaux affichés: 1h, {modality === 'ONLINE' ? 'en ligne' : 'en présentiel'}
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="title" className="text-sm md:text-base">
                    Titre de la session * 
                    <span className="text-xs text-gray-500 ml-2">({title.length}/100)</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Révision des équations du second degré"
                    className={`mt-1 ${titleError ? 'border-red-300' : ''}`}
                    maxLength={100}
                  />
                  {titleError && (
                    <p className="text-xs text-red-600 mt-1">{titleError}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm md:text-base">
                    Description (optionnel)
                    <span className="text-xs text-gray-500 ml-2">({description.length}/500)</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Objectifs de la session, points spécifiques à travailler..."
                    className={`mt-1 ${descriptionError ? 'border-red-300' : ''}`}
                    rows={3}
                    maxLength={500}
                  />
                  {descriptionError && (
                    <p className="text-xs text-red-600 mt-1">{descriptionError}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="credits" className="text-sm md:text-base">Crédits à utiliser</Label>
                  <Select value={creditsToUse.toString()} onValueChange={(value) => setCreditsToUse(parseInt(value))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].filter(num => num <= userCredits).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} crédit{num > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-600 mt-1">
                    Crédits restants après réservation: {userCredits - creditsToUse}
                  </p>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Précédent
                  </Button>
                  <Button
                    onClick={handleBookSession}
                    disabled={loading || !title.trim() || !!titleError || !!descriptionError}
                    className="px-6 md:px-8"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Réservation...
                      </>
                    ) : (
                      'Réserver la session'
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Success */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                  Session réservée avec succès !
                </h3>
                <p className="text-gray-600 mb-6">
                  Votre session a été programmée. Vous recevrez une confirmation par email.
                </p>
                <div className="space-y-3">
                  <Button onClick={resetBooking} variant="outline">
                    Réserver une autre session
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
} 