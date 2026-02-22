"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { motion } from "framer-motion";
import { CheckCircle, GraduationCap, Loader2, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { toast, Toaster } from "sonner";
import { track } from "@/lib/analytics";

// Simplified enum for testing
const Subject = {
  MATHEMATIQUES: 'MATHEMATIQUES',
  NSI: 'NSI',
  FRANCAIS: 'FRANCAIS',
  PHILOSOPHIE: 'PHILOSOPHIE',
  HISTOIRE_GEO: 'HISTOIRE_GEO',
  ANGLAIS: 'ANGLAIS',
  ESPAGNOL: 'ESPAGNOL',
  PHYSIQUE_CHIMIE: 'PHYSIQUE_CHIMIE',
  SVT: 'SVT',
  SES: 'SES'
} as const;

const SUBJECTS_OPTIONS = [
  { value: Subject.MATHEMATIQUES, label: "Mathématiques" },
  { value: Subject.NSI, label: "NSI (Numérique et Sciences Informatiques)" },
  { value: Subject.FRANCAIS, label: "Français" },
  { value: Subject.PHILOSOPHIE, label: "Philosophie" },
  { value: Subject.HISTOIRE_GEO, label: "Histoire-Géographie" },
  { value: Subject.ANGLAIS, label: "Anglais" },
  { value: Subject.ESPAGNOL, label: "Espagnol" },
  { value: Subject.PHYSIQUE_CHIMIE, label: "Physique-Chimie" },
  { value: Subject.SVT, label: "SVT" },
  { value: Subject.SES, label: "SES" }
];

const GRADES_OPTIONS = [
  { value: "seconde", label: "Seconde" },
  { value: "premiere", label: "Première" },
  { value: "terminale", label: "Terminale" }
];

const LEVELS_OPTIONS = [
  { value: "difficultes", label: "En difficulté" },
  { value: "moyen", label: "Niveau moyen" },
  { value: "bon", label: "Bon niveau" },
  { value: "excellent", label: "Excellent niveau" }
];

const MODALITY_OPTIONS = [
  { value: "online", label: "Cours en ligne uniquement" },
  { value: "presentiel", label: "Cours en présentiel uniquement" },
  { value: "hybride", label: "Cours en ligne et présentiel" }
];

function BilanGratuitForm() {
  const searchParams = useSearchParams();
  const programme = searchParams.get('programme');
  const programmeLabels: Record<string, string> = {
    plateforme: 'Accès Plateforme (150 TND/mois)',
    hybride: 'Hybride (450 TND/mois)',
    immersion: 'Immersion (750 TND/mois)',
    'pack-specialise': 'Pack Spécialisé',
  };
  const programmeLabel = programme ? programmeLabels[programme] || programme : null;

  // Track bilan funnel start on mount
  useEffect(() => {
    track.bilanStart(programme ?? undefined, document.referrer || undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    parentPhone: '',
    parentPassword: '',
    studentFirstName: '',
    studentLastName: '',
    studentGrade: '',
    studentSchool: '',
    currentLevel: '',
    objectives: '',
    preferredModality: '',
    availability: '',
    acceptTerms: false,
    acceptNewsletter: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const router = useRouter();

  const totalSteps = 2;

  const getStepErrors = (step: number): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\d\s+()-]{8,20}$/;

    if (step === 1) {
      if (!formData.parentFirstName) newErrors.parentFirstName = 'Prénom requis';
      else if (formData.parentFirstName.length < 2) newErrors.parentFirstName = 'Prénom trop court (min 2 caractères)';
      if (!formData.parentLastName) newErrors.parentLastName = 'Nom requis';
      else if (formData.parentLastName.length < 2) newErrors.parentLastName = 'Nom trop court (min 2 caractères)';
      if (!formData.parentEmail) newErrors.parentEmail = 'Email requis';
      else if (!emailRegex.test(formData.parentEmail)) newErrors.parentEmail = 'Format email invalide';
      if (!formData.parentPhone) newErrors.parentPhone = 'Téléphone requis';
      else if (!phoneRegex.test(formData.parentPhone)) newErrors.parentPhone = 'Format téléphone invalide';
      if (!formData.parentPassword) newErrors.parentPassword = 'Mot de passe requis';
      else if (formData.parentPassword.length < 8) newErrors.parentPassword = 'Mot de passe trop court (min 8 caractères)';
    } else {
      if (!formData.studentFirstName) newErrors.studentFirstName = 'Prénom de l\'élève requis';
      else if (formData.studentFirstName.length < 2) newErrors.studentFirstName = 'Prénom trop court (min 2 caractères)';
      if (!formData.studentLastName) newErrors.studentLastName = 'Nom de l\'élève requis';
      else if (formData.studentLastName.length < 2) newErrors.studentLastName = 'Nom trop court (min 2 caractères)';
      if (!formData.studentGrade) newErrors.studentGrade = 'Classe requise';
      if (!formData.currentLevel) newErrors.currentLevel = 'Niveau requis';
      if (!formData.preferredModality) newErrors.preferredModality = 'Modalité requise';
    }

    return newErrors;
  };

  const validateStep = (step: number) => {
    const newErrors = getStepErrors(step);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (currentStep < totalSteps && validateStep(currentStep)) {
      const next = currentStep + 1;
      track.bilanStep(next, next === 2 ? 'informations_eleve' : 'unknown');
      setCurrentStep(next);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleSubject = (subject: string) => {
    const newSubjects = selectedSubjects.includes(subject)
      ? selectedSubjects.filter(s => s !== subject)
      : [...selectedSubjects, subject];
    setSelectedSubjects(newSubjects);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const onSubmit = async () => {
    // Validate all fields — merge errors from both steps
    const step1Errors = getStepErrors(1);
    const step2Errors = getStepErrors(2);
    const allErrors = { ...step1Errors, ...step2Errors };
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      if (Object.keys(step1Errors).length > 0) {
        setCurrentStep(1);
      }
      toast.error('Veuillez corriger les erreurs avant de soumettre.');
      return;
    }

    if (selectedSubjects.length === 0) {
      toast.error('Veuillez sélectionner au moins une matière.');
      return;
    }

    if (!formData.acceptTerms) {
      toast.error('Veuillez accepter les conditions générales d\'utilisation.');
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = {
        ...formData,
        subjects: selectedSubjects,
        // Honeypot field — bots fill this, humans don't see it
        website: honeypot
      };

      const response = await fetch('/api/bilan-gratuit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (response.ok) {
        track.bilanSuccess(result.parentId);
        // Redirect to assessment questionnaire with student context
        // Pick the first selected subject — MATHS/NSI get their dedicated assessment,
        // all other subjects get the GENERAL cross-curricular diagnostic
        const firstSubject = selectedSubjects[0] || 'GENERAL';
        const assessmentSubject = (firstSubject === 'MATHEMATIQUES' || firstSubject === 'NSI')
          ? firstSubject
          : 'GENERAL';
        const params = new URLSearchParams({
          subject: assessmentSubject,
          grade: formData.studentGrade,
          name: `${formData.studentFirstName} ${formData.studentLastName}`,
          email: formData.parentEmail,
          originalSubject: firstSubject,
        });
        router.push(`/bilan-gratuit/assessment?${params.toString()}`);
      } else {
        const errorMessage = result.error || result.details || 'Une erreur est survenue';
        track.bilanError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Erreur:', error);
      }
      toast.error('Une erreur est survenue lors de l\'inscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-darker">
      <Toaster position="top-right" richColors theme="dark" />
      <CorporateNavbar />

      <main className="py-8 md:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Breadcrumb */}
          <Breadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Services", href: "/accompagnement-scolaire" },
              { label: "Bilan Gratuit" }
            ]}
            className="mb-6 breadcrumb-on-dark"
          />

          {/* En-tête */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 md:mb-12"
          >
            <Badge variant="outline" className="mb-4 border-white/20 bg-white/5 text-neutral-100">
              <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Bilan Stratégique Gratuit
            </Badge>
            {programmeLabel && (
              <Badge variant="outline" className="mb-2 border-brand-accent/40 text-brand-accent">
                Programme sélectionné : {programmeLabel}
              </Badge>
            )}
            <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 md:mb-4">
              Créez Votre Compte Parent et Élève
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto px-4">
              En 2 étapes simples, créez vos comptes et accédez immédiatement à votre tableau de bord personnalisé pour commencer le parcours vers la <span className="text-brand-accent font-semibold">réussite au Baccalauréat</span>.
            </p>
          </motion.div>

          {/* Indicateur de progression */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-200">
                Étape {currentStep} sur {totalSteps}
              </span>
              <span className="text-xs md:text-sm text-slate-300">
                {Math.round((currentStep / totalSteps) * 100)}% complété
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-brand-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Étape 1: Informations Parent */}
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border border-white/10 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center text-base md:text-lg">
                    <User className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" aria-hidden="true" />
                    Étape 1 : Informations Parent
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <Label htmlFor="parentFirstName" className="text-sm md:text-base">Prénom *</Label>
                      <Input
                        id="parentFirstName"
                        data-testid="input-parent-firstname"
                        type="text"
                        value={formData.parentFirstName}
                        onChange={(e) => handleInputChange('parentFirstName', e.target.value)}
                        className={`mt-1 ${errors.parentFirstName ? 'border-error' : ''}`}
                        placeholder="Votre prénom"
                      />
                      {errors.parentFirstName && (
                        <p data-testid="error-parent-firstname" className="text-error text-xs md:text-sm mt-1">{errors.parentFirstName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="parentLastName" className="text-sm md:text-base">Nom *</Label>
                      <Input
                        id="parentLastName"
                        data-testid="input-parent-lastname"
                        type="text"
                        value={formData.parentLastName}
                        onChange={(e) => handleInputChange('parentLastName', e.target.value)}
                        className={`mt-1 ${errors.parentLastName ? 'border-error' : ''}`}
                        placeholder="Votre nom"
                      />
                      {errors.parentLastName && (
                        <p data-testid="error-parent-lastname" className="text-error text-xs md:text-sm mt-1">{errors.parentLastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <Label htmlFor="parentEmail" className="text-sm md:text-base">Email *</Label>
                      <Input
                        id="parentEmail"
                        data-testid="input-parent-email"
                        type="email"
                        value={formData.parentEmail}
                        onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                        className={`mt-1 ${errors.parentEmail ? 'border-error' : ''}`}
                        placeholder="votre@email.com"
                      />
                      {errors.parentEmail && (
                        <p data-testid="error-parent-email" className="text-error text-xs md:text-sm mt-1">{errors.parentEmail}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="parentPhone" className="text-sm md:text-base">Téléphone *</Label>
                      <Input
                        id="parentPhone"
                        data-testid="input-parent-tel"
                        type="tel"
                        value={formData.parentPhone}
                        onChange={(e) => handleInputChange('parentPhone', e.target.value)}
                        className={`mt-1 ${errors.parentPhone ? 'border-error' : ''}`}
                        placeholder="+216 99 19 28 29"
                      />
                      {errors.parentPhone && (
                        <p data-testid="error-parent-tel" className="text-error text-xs md:text-sm mt-1">{errors.parentPhone}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="parentPassword" className="text-sm md:text-base">Mot de passe *</Label>
                    <Input
                      id="parentPassword"
                      data-testid="input-parent-password"
                      type="password"
                      value={formData.parentPassword}
                      onChange={(e) => handleInputChange('parentPassword', e.target.value)}
                      className={`mt-1 ${errors.parentPassword ? 'border-error' : ''}`}
                      placeholder="Minimum 8 caractères"
                    />
                    {errors.parentPassword && (
                      <p data-testid="error-parent-password" className="text-error text-xs md:text-sm mt-1">{errors.parentPassword}</p>
                    )}
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={nextStep}
                      data-testid="btn-next-step"
                      disabled={Object.keys(errors).length > 0}
                      className="px-6 md:px-8 py-2 md:py-3 text-sm md:text-base"
                    >
                      Suivant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Étape 2: Informations Élève */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border border-white/10 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center text-base md:text-lg">
                    <GraduationCap className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" aria-hidden="true" />
                    Étape 2 : Informations Élève
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <Label htmlFor="studentFirstName" className="text-sm md:text-base">Prénom de l'élève *</Label>
                      <Input
                        id="studentFirstName"
                        data-testid="input-child-firstname"
                        type="text"
                        value={formData.studentFirstName}
                        onChange={(e) => handleInputChange('studentFirstName', e.target.value)}
                        className={`mt-1 ${errors.studentFirstName ? 'border-error' : ''}`}
                        placeholder="Prénom de l'élève"
                      />
                      {errors.studentFirstName && (
                        <p data-testid="error-child-firstname" className="text-error text-xs md:text-sm mt-1">{errors.studentFirstName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="studentLastName" className="text-sm md:text-base">Nom de l'élève *</Label>
                      <Input
                        id="studentLastName"
                        type="text"
                        value={formData.studentLastName}
                        onChange={(e) => handleInputChange('studentLastName', e.target.value)}
                        className={`mt-1 ${errors.studentLastName ? 'border-error' : ''}`}
                        placeholder="Nom de l'élève"
                      />
                      {errors.studentLastName && (
                        <p className="text-error text-xs md:text-sm mt-1">{errors.studentLastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <Label id="studentGradeLabel" htmlFor="studentGrade" className="text-sm md:text-base">Niveau *</Label>
                      <Select aria-label="Niveau" aria-labelledby="studentGradeLabel" value={formData.studentGrade} onValueChange={(value) => handleInputChange('studentGrade', value)}>
                        <SelectTrigger data-testid="select-child-level" className={`mt-1 ${errors.studentGrade ? 'border-error' : ''}`}>
                          <SelectValue placeholder="Sélectionnez le niveau" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADES_OPTIONS.map((grade) => (
                            <SelectItem key={grade.value} value={grade.value}>
                              {grade.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.studentGrade && (
                        <p data-testid="error-child-level" className="text-error text-xs md:text-sm mt-1">{errors.studentGrade}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="studentSchool" className="text-sm md:text-base">Établissement</Label>
                      <Input
                        id="studentSchool"
                        type="text"
                        value={formData.studentSchool}
                        onChange={(e) => handleInputChange('studentSchool', e.target.value)}
                        className="mt-1"
                        placeholder="Nom de l'établissement"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <Label id="currentLevelLabel" htmlFor="currentLevel" className="text-sm md:text-base">Niveau actuel *</Label>
                      <Select aria-label="Niveau actuel" aria-labelledby="currentLevelLabel" value={formData.currentLevel} onValueChange={(value) => handleInputChange('currentLevel', value)}>
                        <SelectTrigger data-testid="select-current-level" className={`mt-1 ${errors.currentLevel ? 'border-error' : ''}`}>
                          <SelectValue placeholder="Sélectionnez le niveau" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEVELS_OPTIONS.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.currentLevel && (
                        <p className="text-error text-xs md:text-sm mt-1">{errors.currentLevel}</p>
                      )}
                    </div>
                    <div>
                      <Label id="preferredModalityLabel" htmlFor="preferredModality" className="text-sm md:text-base">Modalité préférée</Label>
                      <Select aria-label="Modalité préférée" aria-labelledby="preferredModalityLabel" value={formData.preferredModality} onValueChange={(value) => handleInputChange('preferredModality', value)}>
                        <SelectTrigger data-testid="select-preferred-modality" className="mt-1">
                          <SelectValue placeholder="Sélectionnez la modalité" />
                        </SelectTrigger>
                        <SelectContent>
                          {MODALITY_OPTIONS.map((modality) => (
                            <SelectItem key={modality.value} value={modality.value}>
                              {modality.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="objectives" className="text-sm md:text-base">Objectifs et motivations</Label>
                    <Textarea
                      id="objectives"
                      value={formData.objectives}
                      onChange={(e) => handleInputChange('objectives', e.target.value)}
                      className="mt-1"
                      placeholder="Décrivez les objectifs de votre enfant et vos motivations..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="availability" className="text-sm md:text-base">Disponibilités</Label>
                    <Textarea
                      id="availability"
                      value={formData.availability}
                      onChange={(e) => handleInputChange('availability', e.target.value)}
                      className="mt-1"
                      placeholder="Jours et horaires préférés pour les sessions..."
                      rows={2}
                    />
                  </div>

                  {/* Sélection des matières */}
                  <div>
                    <Label className="text-sm md:text-base block mb-3">Matières d'intérêt *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                      {SUBJECTS_OPTIONS.map((subject) => (
                        <div key={subject.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={subject.value}
                            data-testid={`checkbox-subject-${subject.value}`}
                            checked={selectedSubjects.includes(subject.value)}
                            onCheckedChange={() => toggleSubject(subject.value)}
                          />
                          <Label htmlFor={subject.value} className="text-xs md:text-sm cursor-pointer">
                            {subject.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {selectedSubjects.length === 0 && (
                      <p data-testid="error-child-subjects" className="text-error text-xs md:text-sm mt-1">Veuillez sélectionner au moins une matière</p>
                    )}
                  </div>

                  {/* Conditions */}
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="acceptTerms"
                        data-testid="checkbox-accept-terms"
                        checked={formData.acceptTerms}
                        onCheckedChange={(checked) => handleInputChange('acceptTerms', checked)}
                      />
                      <Label htmlFor="acceptTerms" className="text-xs md:text-sm leading-relaxed cursor-pointer">
                        J'accepte les <a href="/conditions" target="_blank" className="text-brand-accent hover:underline">conditions générales d'utilisation</a> *
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="acceptNewsletter"
                        checked={formData.acceptNewsletter}
                        onCheckedChange={(checked) => handleInputChange('acceptNewsletter', checked)}
                      />
                      <Label htmlFor="acceptNewsletter" className="text-xs md:text-sm leading-relaxed cursor-pointer">
                        J'accepte de recevoir des informations et offres de Nexus Réussite
                      </Label>
                    </div>
                  </div>

                  {/* Honeypot — hidden from humans, bots fill it */}
                  <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}>
                    <label htmlFor="website">Website</label>
                    <input
                      type="text"
                      id="website"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-4">
                    <Button
                      variant="outline"
                      onClick={prevStep}
                      className="px-6 md:px-8 py-2 md:py-3 text-sm md:text-base"
                    >
                      Précédent
                    </Button>
                    <Button
                      onClick={onSubmit}
                      data-testid="btn-submit-bilan"
                      disabled={isSubmitting || Object.keys(errors).length > 0 || selectedSubjects.length === 0 || !formData.acceptTerms}
                      className="px-6 md:px-8 py-2 md:py-3 text-sm md:text-base"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 md:w-5 md:h-5 mr-2 animate-spin" aria-label="Chargement" />
                          Création en cours...
                        </>
                      ) : (
                        'Créer mon compte et commencer'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}

export default function BilanGratuitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-darker" />}>
      <BilanGratuitForm />
    </Suspense>
  );
}
