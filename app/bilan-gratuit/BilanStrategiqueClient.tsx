'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, GraduationCap, MessageCircle, Phone } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { track } from '@/lib/analytics';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const SUBJECTS = [
  { value: 'MATHEMATIQUES', label: 'Mathématiques' },
  { value: 'FRANCAIS', label: 'Français' },
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-Chimie' },
  { value: 'NSI', label: 'NSI' },
  { value: 'SES', label: 'SES' },
  { value: 'PHILOSOPHIE', label: 'Philosophie' },
  { value: 'HISTOIRE_GEO', label: 'Histoire-Géographie' },
  { value: 'ANGLAIS', label: 'Anglais' },
  { value: 'SVT', label: 'SVT' },
  { value: 'ESPAGNOL', label: 'Espagnol' },
];

const GRADES = [
  { value: 'seconde', label: 'Seconde' },
  { value: 'premiere', label: 'Première' },
  { value: 'terminale', label: 'Terminale' },
  { value: 'troisieme', label: 'Troisième' },
];

type FormData = {
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  studentFirstName: string;
  studentGrade: string;
  studentSchool: string;
  objectives: string;
  difficulties: string;
  acceptTerms: boolean;
};

const initialFormData: FormData = {
  parentFirstName: '',
  parentLastName: '',
  parentEmail: '',
  parentPhone: '',
  studentFirstName: '',
  studentGrade: '',
  studentSchool: '',
  objectives: '',
  difficulties: '',
  acceptTerms: false,
};

const WHATSAPP_URL = 'https://wa.me/21699192829';

export function BilanStrategiqueClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const programme = searchParams?.get('programme');
  const programmeLabel = useMemo(() => {
    if (!programme) return null;
    const labels: Record<string, string> = {
      excellence: 'Excellence',
      'bac-garanti': 'Bac français',
      plateforme: 'Plateforme',
      hybride: 'Hybride',
      immersion: 'Immersion',
      'pack-specialise': 'Pack spécialisé',
    };
    return labels[programme] ?? programme;
  }, [programme]);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    track.bilanStart(programme ?? undefined, document.referrer || undefined);
  }, [programme]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\d\s+()-]{8,20}$/;

    if (formData.parentFirstName.trim().length < 2) nextErrors.parentFirstName = 'Prénom requis';
    if (formData.parentLastName.trim().length < 2) nextErrors.parentLastName = 'Nom requis';
    if (!emailRegex.test(formData.parentEmail)) nextErrors.parentEmail = 'Email invalide';
    if (!phoneRegex.test(formData.parentPhone)) nextErrors.parentPhone = 'Téléphone invalide';
    if (formData.studentFirstName.trim().length < 2) nextErrors.studentFirstName = 'Prénom de l\'élève requis';
    if (!formData.studentGrade) nextErrors.studentGrade = 'Classe requise';
    if (formData.studentSchool.trim().length < 2) nextErrors.studentSchool = 'Établissement requis';
    if (selectedSubjects.length === 0) nextErrors.subjects = 'Sélectionnez au moins une matière';
    if (formData.objectives.trim().length < 10) nextErrors.objectives = 'Décrivez le besoin principal';
    if (formData.difficulties.trim().length > 0 && formData.difficulties.trim().length < 10) {
      nextErrors.difficulties = 'Ajoutez un message libre plus détaillé';
    }
    if (!formData.acceptTerms) nextErrors.acceptTerms = 'Veuillez accepter le consentement';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const toggleSubject = (value: string) => {
    setSelectedSubjects((prev) => {
      const next = prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value];
      if (errors.subjects) {
        setErrors((current) => ({ ...current, subjects: '' }));
      }
      return next;
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        subjects: selectedSubjects,
        website: honeypot,
      };

      const response = await fetch('/api/bilan-gratuit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Une erreur est survenue');
      }

      track.bilanSuccess(result.parentId);
      router.push('/bilan-gratuit/confirmation');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue';
      track.bilanError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <Toaster position="top-right" richColors theme="dark" />
      <CorporateNavbar />

      <main className="py-20">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
              Bilan stratégique gratuit
            </Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Bilan stratégique gratuit
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-300">
              Identifier les priorités de votre enfant avant de choisir une formule. Réponse personnalisée, orientation vers la bonne formule et échange humain avec notre équipe pédagogique.
            </p>
            {programmeLabel && (
              <p className="mt-3 text-sm text-brand-accent">
                Contexte repéré : {programmeLabel}
              </p>
            )}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <MessageCircle className="mr-2 h-4 w-4" />
                Écrire sur WhatsApp
              </a>
              <a href="/offres" className="btn-primary">
                Voir les offres
              </a>
            </div>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={onSubmit} className="space-y-8">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="parentFirstName">Prénom du parent</Label>
                      <Input id="parentFirstName" value={formData.parentFirstName} onChange={(e) => handleChange('parentFirstName', e.target.value)} />
                      {errors.parentFirstName && <p className="text-sm text-red-300">{errors.parentFirstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentLastName">Nom du parent</Label>
                      <Input id="parentLastName" value={formData.parentLastName} onChange={(e) => handleChange('parentLastName', e.target.value)} />
                      {errors.parentLastName && <p className="text-sm text-red-300">{errors.parentLastName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentEmail">Email</Label>
                      <Input id="parentEmail" type="email" value={formData.parentEmail} onChange={(e) => handleChange('parentEmail', e.target.value)} />
                      {errors.parentEmail && <p className="text-sm text-red-300">{errors.parentEmail}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentPhone">Téléphone</Label>
                      <Input id="parentPhone" type="tel" value={formData.parentPhone} onChange={(e) => handleChange('parentPhone', e.target.value)} />
                      {errors.parentPhone && <p className="text-sm text-red-300">{errors.parentPhone}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="studentFirstName">Prénom de l’élève</Label>
                      <Input id="studentFirstName" value={formData.studentFirstName} onChange={(e) => handleChange('studentFirstName', e.target.value)} />
                      {errors.studentFirstName && <p className="text-sm text-red-300">{errors.studentFirstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="studentGrade">Classe</Label>
                      <select
                        id="studentGrade"
                        value={formData.studentGrade}
                        onChange={(e) => handleChange('studentGrade', e.target.value)}
                        className="h-11 w-full rounded-md border border-white/10 bg-surface-dark px-3 text-sm text-white outline-none ring-0"
                      >
                        <option value="">Choisir une classe</option>
                        {GRADES.map((grade) => (
                          <option key={grade.value} value={grade.value}>{grade.label}</option>
                        ))}
                      </select>
                      {errors.studentGrade && <p className="text-sm text-red-300">{errors.studentGrade}</p>}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="studentSchool">Établissement</Label>
                      <Input id="studentSchool" value={formData.studentSchool} onChange={(e) => handleChange('studentSchool', e.target.value)} />
                      {errors.studentSchool && <p className="text-sm text-red-300">{errors.studentSchool}</p>}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label>Matières concernées</Label>
                      <p className="mt-1 text-sm text-neutral-300">Choisissez une ou plusieurs matières pour cadrer l’échange.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {SUBJECTS.map((subject) => (
                        <label key={subject.value} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                          <Checkbox checked={selectedSubjects.includes(subject.value)} onCheckedChange={() => toggleSubject(subject.value)} />
                          <span className="text-sm text-white">{subject.label}</span>
                        </label>
                      ))}
                    </div>
                    {errors.subjects && <p className="text-sm text-red-300">{errors.subjects}</p>}
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="objectives">Besoin principal</Label>
                      <Textarea
                        id="objectives"
                        value={formData.objectives}
                        onChange={(e) => handleChange('objectives', e.target.value)}
                        rows={4}
                        placeholder="Ex. reprendre le rythme, consolider les bases, préparer le bac ou viser une mention."
                      />
                      {errors.objectives && <p className="text-sm text-red-300">{errors.objectives}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="difficulties">Message libre</Label>
                      <Textarea
                        id="difficulties"
                        value={formData.difficulties}
                        onChange={(e) => handleChange('difficulties', e.target.value)}
                        rows={4}
                        placeholder="Ajoutez les précisions utiles pour notre équipe."
                      />
                      {errors.difficulties && <p className="text-sm text-red-300">{errors.difficulties}</p>}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
                    <label className="flex items-start gap-3">
                      <Checkbox
                        checked={formData.acceptTerms}
                        onCheckedChange={(checked) => handleChange('acceptTerms', checked === true)}
                      />
                      <span className="text-sm text-neutral-300">
                        J’accepte d’être contacté par Nexus Réussite au sujet de ma demande et la politique de traitement des données.
                      </span>
                    </label>
                    {errors.acceptTerms && <p className="text-sm text-red-300">{errors.acceptTerms}</p>}
                  </div>

                  <input
                    type="text"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="submit" size="lg" disabled={isSubmitting} className="min-h-[44px]">
                      {isSubmitting ? 'Envoi...' : 'Demander mon bilan stratégique gratuit'}
                    </Button>
                    <Link href="/contact" className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-white/15 px-4 py-3 text-sm font-medium text-white">
                      Être conseillé
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-white/10 bg-white/5 backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-brand-accent" />
                    <h2 className="text-lg font-semibold text-white">Ce que vous obtenez</h2>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm text-neutral-300">
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />Analyse des priorités scolaires</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />Orientation vers la bonne formule</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />Échange humain avec notre équipe</li>
                    <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />Réponse claire, sans engagement de résultat</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 backdrop-blur">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-white">Besoin d’un contact direct ?</h2>
                  <div className="mt-4 space-y-3">
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                      <MessageCircle className="h-4 w-4 text-emerald-300" />
                      WhatsApp : +216 99 19 28 29
                    </a>
                    <a href="tel:+21699192829" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                      <Phone className="h-4 w-4 text-brand-accent" />
                      Appeler le centre
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <noscript>
            <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">
              JavaScript est désactivé. Vous pouvez nous écrire sur{' '}
              <a className="text-brand-accent underline" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">WhatsApp</a> ou appeler le{' '}
              <a className="text-brand-accent underline" href="tel:+21699192829">+216 99 19 28 29</a>.
            </div>
          </noscript>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
