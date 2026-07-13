'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, GraduationCap, Phone } from 'lucide-react';
import { WhatsAppLogo, WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';
import { toast } from 'sonner';
import { track } from '@/lib/analytics';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConseillerCard, ProcessSteps } from '@/components/marketing/acadomia-inspired';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { LEGAL } from '@/lib/legal';
import type { SelectedOfferContext } from './selected-offer';
import {
  synchronizePreRentreeCampaignContext,
  type PreRentreeBilanPrefill,
} from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';

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


type BilanStrategiqueClientProps = {
  programme?: string | null;
  selectedOffer?: SelectedOfferContext | null;
  prefill?: {
    studentGrade: string;
    subjects: string[];
    contextLabel: string;
    entryLevelLabel: string;
    profileLabel: string;
    campaignContext: PreRentreeBilanPrefill;
  } | null;
};

export function BilanStrategiqueClient({
  programme = null,
  selectedOffer = null,
  prefill = null,
}: BilanStrategiqueClientProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>(() => ({
    ...initialFormData,
    studentGrade: prefill?.studentGrade ?? '',
  }));
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() => prefill?.subjects ?? []);
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
    if (formData.studentFirstName.trim().length < 2) nextErrors.studentFirstName = `Prénom de l\u2019élève requis`;
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
      const campaignContext = synchronizePreRentreeCampaignContext({
        campaignContext: prefill?.campaignContext,
        studentGrade: formData.studentGrade,
        subjects: selectedSubjects,
      });
      const payload = {
        ...formData,
        subjects: selectedSubjects,
        website: honeypot,
        offerId: selectedOffer?.id,
        ...(campaignContext ? { campaignContext } : {}),
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
    <>
      {/* Toaster is provided globally by components/providers.tsx */}

      <section className="bg-lux-paper px-4 py-14 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={onSubmit} noValidate className="space-y-8">
                {prefill && (
                  <div className="rounded-2xl border border-lux-gold/30 bg-lux-gold/10 p-4 text-sm text-lux-ink">
                    <p>Préremplissage modifiable · {prefill.contextLabel} · {selectedOffer?.title}</p>
                    <p className="mt-1">Classe de rentrée : {prefill.entryLevelLabel}</p>
                    <p className="mt-1">Profil pédagogique : {prefill.profileLabel}</p>
                    <Link className="mt-2 inline-flex min-h-11 items-center font-semibold underline" href="/stages/pre-rentree-2026#configurateur">
                      Modifier la configuration complète
                    </Link>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="parentFirstName" className="text-lux-ink">Prénom du parent</Label>
                    <Input
                      id="parentFirstName"
                      value={formData.parentFirstName}
                      onChange={(e) => handleChange('parentFirstName', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.parentFirstName && <p className="text-sm text-red-500">{errors.parentFirstName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentLastName" className="text-lux-ink">Nom du parent</Label>
                    <Input
                      id="parentLastName"
                      value={formData.parentLastName}
                      onChange={(e) => handleChange('parentLastName', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.parentLastName && <p className="text-sm text-red-500">{errors.parentLastName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentEmail" className="text-lux-ink">Email</Label>
                    <Input
                      id="parentEmail"
                      type="email"
                      value={formData.parentEmail}
                      onChange={(e) => handleChange('parentEmail', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.parentEmail && <p className="text-sm text-red-500">{errors.parentEmail}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentPhone" className="text-lux-ink">Téléphone</Label>
                    <Input
                      id="parentPhone"
                      type="tel"
                      value={formData.parentPhone}
                      onChange={(e) => handleChange('parentPhone', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.parentPhone && <p className="text-sm text-red-500">{errors.parentPhone}</p>}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="studentFirstName" className="text-lux-ink">Prénom de l’élève</Label>
                    <Input
                      id="studentFirstName"
                      value={formData.studentFirstName}
                      onChange={(e) => handleChange('studentFirstName', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.studentFirstName && <p className="text-sm text-red-500">{errors.studentFirstName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="studentGrade" className="text-lux-ink">{prefill ? 'Classe de rentrée' : 'Classe'}</Label>
                    <select
                      id="studentGrade"
                      value={formData.studentGrade}
                      onChange={(e) => handleChange('studentGrade', e.target.value)}
                      className="h-11 w-full rounded-lg border border-lux-line bg-lux-paper px-3 text-sm text-lux-ink outline-none focus-visible:ring-2 focus-visible:ring-lux-gold"
                    >
                      <option value="">Choisir une classe</option>
                      {GRADES.map((grade) => (
                        <option key={grade.value} value={grade.value}>
                          {prefill && grade.value !== 'troisieme' ? `Entrée en ${grade.label}` : grade.label}
                        </option>
                      ))}
                    </select>
                    {errors.studentGrade && <p className="text-sm text-red-500">{errors.studentGrade}</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="studentSchool" className="text-lux-ink">Établissement</Label>
                    <Input
                      id="studentSchool"
                      value={formData.studentSchool}
                      onChange={(e) => handleChange('studentSchool', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.studentSchool && <p className="text-sm text-red-500">{errors.studentSchool}</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-lux-ink">Matières concernées</Label>
                    <p className="mt-1 text-sm text-lux-slate">Choisissez une ou plusieurs matières pour cadrer l’échange.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SUBJECTS.map((subject) => (
                      <label
                        key={subject.value}
                        className="flex items-center gap-3 rounded-2xl border border-lux-line/60 bg-lux-paper/70 p-3 transition-colors hover:border-lux-gold/40"
                      >
                        <Checkbox checked={selectedSubjects.includes(subject.value)} onCheckedChange={() => toggleSubject(subject.value)} />
                        <span className="text-sm text-lux-ink">{subject.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.subjects && <p className="text-sm text-red-500">{errors.subjects}</p>}
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="objectives" className="text-lux-ink">Besoin principal</Label>
                    <Textarea
                      id="objectives"
                      value={formData.objectives}
                      onChange={(e) => handleChange('objectives', e.target.value)}
                      rows={4}
                      placeholder="Ex. reprendre le rythme, consolider les bases, préparer le bac ou clarifier les priorités."
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.objectives && <p className="text-sm text-red-500">{errors.objectives}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="difficulties" className="text-lux-ink">Message libre</Label>
                    <Textarea
                      id="difficulties"
                      value={formData.difficulties}
                      onChange={(e) => handleChange('difficulties', e.target.value)}
                      rows={4}
                      placeholder="Ajoutez les précisions utiles pour notre équipe."
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.difficulties && <p className="text-sm text-red-500">{errors.difficulties}</p>}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-lux-line/60 bg-lux-paper/80 p-4">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={formData.acceptTerms}
                      onCheckedChange={(checked) => handleChange('acceptTerms', checked === true)}
                    />
                    <span className="text-sm text-lux-slate">
                      J’accepte d’être contacté par Nexus Réussite au sujet de ma demande et la politique de traitement des données.
                    </span>
                  </label>
                  {errors.acceptTerms && <p className="text-sm text-red-500">{errors.acceptTerms}</p>}
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
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {isSubmitting ? 'Envoi...' : 'Demander mon bilan stratégique gratuit'}
                  </button>
                  <Link
                    href="/contact"
                    className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold"
                  >
                    Poser une question
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <ConseillerCard />

            <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-lux-gold" />
                  <h2 className="text-lg font-fraunces text-lux-ink">Ce que vous obtenez</h2>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-lux-slate">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-lux-evergreen" />
                    Analyse des priorités scolaires
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-lux-evergreen" />
                    Orientation vers la bonne formule
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-lux-evergreen" />
                    Échange humain avec notre équipe
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-lux-evergreen" />
                    Réponse claire, sans engagement de résultat
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
              <CardContent className="p-6">
                <h2 className="text-lg font-fraunces text-lux-ivory">Contact direct</h2>
                <div className="mt-4 space-y-3">
                  <a
                    href={buildWhatsAppUrl('le bilan gratuit')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10"
                  >
                    <WhatsAppLogo className="h-4 w-4" style={{ color: WHATSAPP_BRAND_GREEN }} />
                    WhatsApp&nbsp;: {LEGAL.contact.phone}
                  </a>
                  <a
                    href={`tel:${LEGAL.contact.phoneRaw}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10"
                  >
                    <Phone className="h-4 w-4 text-lux-gold-wash" />
                    Appeler le centre
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
              <CardContent className="p-6">
                <h2 className="text-lg font-fraunces text-lux-ink">Sans JavaScript</h2>
                <p className="mt-3 text-sm text-lux-slate">
                  JavaScript est désactivé. Vous pouvez nous écrire directement sur WhatsApp ou appeler le centre.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <a
                    className="lux-cta-secondary rounded-lg px-4 py-3 text-sm font-semibold text-lux-ink border-lux-line/40"
                    href={buildWhatsAppUrl('le bilan gratuit')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                  <a className="lux-cta-reserve rounded-lg px-4 py-3 text-sm font-semibold" href={`tel:${LEGAL.contact.phoneRaw}`}>
                    {LEGAL.contact.phone}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <ProcessSteps />

      <CorporateFooter />
    </>
  );
}
