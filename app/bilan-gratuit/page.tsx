"use client";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { CheckCircle, GraduationCap, Loader2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

export default function BilanGratuitPage() {
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
  const router = useRouter();

  const totalSteps = 2;

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.parentFirstName) newErrors.parentFirstName = 'Prénom requis';
      if (!formData.parentLastName) newErrors.parentLastName = 'Nom requis';
      if (!formData.parentEmail) newErrors.parentEmail = 'Email requis';
      if (!formData.parentPhone) newErrors.parentPhone = 'Téléphone requis';
      if (!formData.parentPassword) newErrors.parentPassword = 'Mot de passe requis';
    } else {
      if (!formData.studentFirstName) newErrors.studentFirstName = 'Prénom de l\'élève requis';
      if (!formData.studentLastName) newErrors.studentLastName = 'Nom de l\'élève requis';
      if (!formData.studentGrade) newErrors.studentGrade = 'Classe requise';
      if (!formData.currentLevel) newErrors.currentLevel = 'Niveau requis';
      if (!formData.objectives) newErrors.objectives = 'Objectifs requis';
      if (!formData.preferredModality) newErrors.preferredModality = 'Modalité requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (currentStep < totalSteps && validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
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
    // Validate all fields
    if (!validateStep(1) || !validateStep(2)) {
      alert('Veuillez corriger les erreurs avant de soumettre.');
      return;
    }

    if (selectedSubjects.length === 0) {
      alert('Veuillez sélectionner au moins une matière.');
      return;
    }

    if (!formData.acceptTerms) {
      alert('Veuillez accepter les conditions générales d\'utilisation.');
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = {
        ...formData,
        subjects: selectedSubjects
      };

      console.log('Submitting form data:', submitData);

      const response = await fetch('/api/bilan-gratuit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();
      console.log('Response:', result);

      if (response.ok) {
        router.push('/bilan-gratuit/confirmation');
      } else {
        const errorMessage = result.error || result.details || 'Une erreur est survenue';
        console.error('Form submission error:', errorMessage);
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue lors de l\'inscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="py-8 md:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* En-tête */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 md:mb-12"
          >
            <Badge variant="outline" className="mb-4">
              <CheckCircle className="w-4 h-4 mr-2" />
              Bilan Stratégique Gratuit
            </Badge>
            <h1 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 md:mb-4">
              Créez Votre Compte Parent et Élève
            </h1>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
              En 2 étapes simples, créez vos comptes et accédez immédiatement à votre tableau de bord personnalisé pour commencer le parcours vers la <span className="text-blue-600 font-semibold">réussite au Baccalauréat</span>.
            </p>
          </motion.div>

          {/* Indicateur de progression */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-gray-700">
                Étape {currentStep} sur {totalSteps}
              </span>
              <span className="text-xs md:text-sm text-gray-500">
                {Math.round((currentStep / totalSteps) * 100)}% complété
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
              <Card className="border border-slate-200 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center text-base md:text-lg">
                    <User className="w-4 h-4 md:w-5 md:h-5 mr-2 text-blue-600" />
                    Étape 1 : Informations Parent
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <Label htmlFor="parentFirstName" className="text-sm md:text-base">Prénom *</Label>
                      <Input
                        id="parentFirstName"
                        type="text"
                        value={formData.parentFirstName}
                        onChange={(e) => handleInputChange('parentFirstName', e.target.value)}
                        className={`mt-1 ${errors.parentFirstName ? 'border-red-500' : ''}`}
                        placeholder="Votre prénom"
                      />
                      {errors.parentFirstName && (
                        <p className="text-red-500 text-xs md:text-sm mt-1">{errors.parentFirstName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="parentLastName" className="text-sm md:text-base">Nom *</Label>
                      <Input
                        id="parentLastName"
                        type="text"
                        value={formData.parentLastName}
                        onChange={(e) => handleInputChange('parentLastName', e.target.value)}
                        className={`mt-1 ${errors.parentLastName ? 'border-red-500' : ''}`}
                        placeholder="Votre nom"
                      />
                      {errors.parentLastName && (
                        <p className="text-red-500 text-xs md:text-sm mt-1">{errors.parentLastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <Label htmlFor="parentEmail" className="text-sm md:text-base">Email *</Label>
                      <Input
                        id="parentEmail"
                        type="email"
                        value={formData.parentEmail}
                        onChange={(e) => handleInputChange('parentEmail', e.target.value)}
                        className={`mt-1 ${errors.parentEmail ? 'border-red-500' : ''}`}
                        placeholder="votre@email.com"
                      />
                      {errors.parentEmail && (
                        <p className="text-red-500 text-xs md:text-sm mt-1">{errors.parentEmail}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="parentPhone" className="text-sm md:text-base">Téléphone *</Label>
                      <Input
                        id="parentPhone"
                        type="tel"
                        value={formData.parentPhone}
                        onChange={(e) => handleInputChange('parentPhone', e.target.value)}
                        className={`mt-1 ${errors.parentPhone ? 'border-red-500' : ''}`}
                        placeholder="+216 XX XXX XXX"
                      />
                      {errors.parentPhone && (
                        <p className="text-red-500 text-xs md:text-sm mt-1">{errors.parentPhone}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="parentPassword" className="text-sm md:text-base">Mot de passe *</Label>
                    <Input
                      id="parentPassword"
                      type="password"
                      value={formData.parentPassword}
                      onChange={(e) => handleInputChange('parentPassword', e.target.value)}
                      className={`mt-1 ${errors.parentPassword ? 'border-red-500' : ''}`}
                      placeholder="Minimum 8 caractères"
                    />
                    {errors.parentPassword && (
                      <p className="text-red-500 text-xs md:text-sm mt-1">{errors.parentPassword}</p>
                    )}
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={nextStep}
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
              <Card className="border border-slate-200 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center text-base md:text-lg">
                    <GraduationCap className="w-4 h-4 md:w-5 md:h-5 mr-2 text-blue-600" />
                    Étape 2 : Informations Élève
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <Label htmlFor="studentFirstName" className="text-sm md:text-base">Prénom de l'élève *</Label>
                      <Input
                        id="studentFirstName"
                        type="text"
                        value={formData.studentFirstName}
                        onChange={(e) => handleInputChange('studentFirstName', e.target.value)}
                        className={`mt-1 ${errors.studentFirstName ? 'border-red-500' : ''}`}
                        placeholder="Prénom de l'élève"
                      />
                      {errors.studentFirstName && (
                        <p className="text-red-500 text-xs md:text-sm mt-1">{errors.studentFirstName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="studentLastName" className="text-sm md:text-base">Nom de l'élève *</Label>
                      <Input
                        id="studentLastName"
                        type="text"
                        value={formData.studentLastName}
                        onChange={(e) => handleInputChange('studentLastName', e.target.value)}
                        className={`mt-1 ${errors.studentLastName ? 'border-red-500' : ''}`}
                        placeholder="Nom de l'élève"
                      />
                      {errors.studentLastName && (
                        <p className="text-red-500 text-xs md:text-sm mt-1">{errors.studentLastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <Label id="studentGradeLabel" htmlFor="studentGrade" className="text-sm md:text-base">Niveau *</Label>
                      <Select aria-label="Niveau" aria-labelledby="studentGradeLabel" value={formData.studentGrade} onValueChange={(value) => handleInputChange('studentGrade', value)}>
                        <SelectTrigger className={`mt-1 ${errors.studentGrade ? 'border-red-500' : ''}`}>
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
                        <p className="text-red-500 text-xs md:text-sm mt-1">{errors.studentGrade}</p>
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
                        <SelectTrigger className={`mt-1 ${errors.currentLevel ? 'border-red-500' : ''}`}>
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
                        <p className="text-red-500 text-xs md:text-sm mt-1">{errors.currentLevel}</p>
                      )}
                    </div>
                    <div>
                      <Label id="preferredModalityLabel" htmlFor="preferredModality" className="text-sm md:text-base">Modalité préférée</Label>
                      <Select aria-label="Modalité préférée" aria-labelledby="preferredModalityLabel" value={formData.preferredModality} onValueChange={(value) => handleInputChange('preferredModality', value)}>
                        <SelectTrigger className="mt-1">
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
                      <p className="text-red-500 text-xs md:text-sm mt-1">Veuillez sélectionner au moins une matière</p>
                    )}
                  </div>

                  {/* Conditions */}
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="acceptTerms"
                        checked={formData.acceptTerms}
                        onCheckedChange={(checked) => handleInputChange('acceptTerms', checked)}
                      />
                      <Label htmlFor="acceptTerms" className="text-xs md:text-sm leading-relaxed cursor-pointer">
                        J'accepte les <a href="#" className="text-blue-600 hover:underline">conditions générales d'utilisation</a> *
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
                      disabled={isSubmitting || Object.keys(errors).length > 0 || selectedSubjects.length === 0 || !formData.acceptTerms}
                      className="px-6 md:px-8 py-2 md:py-3 text-sm md:text-base"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 md:w-5 md:h-5 mr-2 animate-spin" />
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

      <Footer />
    </div>
  );
}
