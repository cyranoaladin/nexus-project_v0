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
import { ConseillerCard, ProcessSteps } from '@/components/marketing/acadomia-inspired';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { LEGAL } from '@/lib/legal';
import type { SelectedOfferContext } from './selected-offer';
import {
  synchronizePreRentreeCampaignContext,
  type PreRentreeBilanPrefill,
} from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';

const GRADES = [
  { value: 'quatrieme', label: 'Quatrième' },
  { value: 'troisieme', label: 'Troisième' },
  { value: 'seconde', label: 'Seconde' },
  { value: 'premiere', label: 'Première' },
  { value: 'terminale', label: 'Terminale' },
];

/** Indicatif tunisien pré-rempli : le parent ne saisit que son numéro. */
const PHONE_PREFIX = '+216';

type FormData = {
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  studentFirstName: string;
  studentGrade: string;
  acceptTerms: boolean;
};

const initialFormData: FormData = {
  parentFirstName: '',
  parentLastName: '',
  parentEmail: '',
  parentPhone: '',
  studentFirstName: '',
  studentGrade: '',
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

  /** Champs encore vides, nommés — un bouton inactif doit dire pourquoi. */
  const missingFields = (): string[] => {
    const missing: string[] = [];
    if (formData.parentFirstName.trim().length < 2) missing.push('votre prénom');
    if (formData.parentLastName.trim().length < 2) missing.push('votre nom');
    if (formData.parentPhone.trim().length < 8) missing.push('votre téléphone');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.parentEmail)) missing.push('votre e-mail');
    if (formData.studentFirstName.trim().length < 2) missing.push('le prénom de votre enfant');
    if (!formData.studentGrade) missing.push('sa classe');
    if (!formData.acceptTerms) missing.push('votre consentement');
    return missing;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const campaignContext = synchronizePreRentreeCampaignContext({
        campaignContext: prefill?.campaignContext,
        studentGrade: formData.studentGrade,
        subjects: [],
      });
      const payload = {
        ...formData,
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

      track.bilanSuccess();
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
          <Card id="demande-bilan" className="scroll-mt-24 border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={onSubmit} noValidate className="space-y-8" aria-busy={isSubmitting}>
                {prefill && (
                  <div className="rounded-2xl border border-lux-gold/30 bg-lux-gold/10 p-4 text-sm text-lux-ink">
                    <p>Préremplissage modifiable · {prefill.contextLabel} · {selectedOffer?.title}</p>
                    <p className="mt-1">Classe de rentrée : {prefill.entryLevelLabel}</p>
                    <p className="mt-1">Profil pédagogique : {prefill.profileLabel}</p>
                    <Link className="mt-2 inline-flex min-h-11 items-center font-semibold underline" href="/stages/pre-rentree-2026#offres-pre-rentree">
                      Modifier la configuration complète
                    </Link>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="parentFirstName" className="text-lux-ink">Prénom du parent</Label>
                    <Input
                      id="parentFirstName"
                      name="parentFirstName"
                      aria-invalid={Boolean(errors.parentFirstName)}
                      aria-describedby={errors.parentFirstName ? 'parentFirstName-error' : undefined}
                      value={formData.parentFirstName}
                      onChange={(e) => handleChange('parentFirstName', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.parentFirstName && <p id="parentFirstName-error" role="alert" className="text-sm text-red-500">{errors.parentFirstName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentLastName" className="text-lux-ink">Nom du parent</Label>
                    <Input
                      id="parentLastName"
                      name="parentLastName"
                      aria-invalid={Boolean(errors.parentLastName)}
                      aria-describedby={errors.parentLastName ? 'parentLastName-error' : undefined}
                      value={formData.parentLastName}
                      onChange={(e) => handleChange('parentLastName', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.parentLastName && <p id="parentLastName-error" role="alert" className="text-sm text-red-500">{errors.parentLastName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentEmail" className="text-lux-ink">Email</Label>
                    <Input
                      id="parentEmail"
                      name="parentEmail"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      aria-invalid={Boolean(errors.parentEmail)}
                      aria-describedby={errors.parentEmail ? 'parentEmail-error' : undefined}
                      value={formData.parentEmail}
                      onChange={(e) => handleChange('parentEmail', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.parentEmail && <p id="parentEmail-error" role="alert" className="text-sm text-red-500">{errors.parentEmail}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentPhone" className="text-lux-ink">Téléphone</Label>
                    <div className="relative">
                    <Input
                      id="parentPhone"
                      name="parentPhone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="55 123 456"
                      aria-invalid={Boolean(errors.parentPhone)}
                      aria-describedby={errors.parentPhone ? 'parentPhone-error' : undefined}
                      value={formData.parentPhone}
                      onChange={(e) => handleChange('parentPhone', e.target.value)}
                      className="border-lux-line bg-lux-paper pl-14 text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-lux-slate">
                      {PHONE_PREFIX}
                    </span>
                    </div>
                    {errors.parentPhone && <p id="parentPhone-error" role="alert" className="text-sm text-red-500">{errors.parentPhone}</p>}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="studentFirstName" className="text-lux-ink">Prénom de l’élève</Label>
                    <Input
                      id="studentFirstName"
                      name="studentFirstName"
                      aria-invalid={Boolean(errors.studentFirstName)}
                      aria-describedby={errors.studentFirstName ? 'studentFirstName-error' : undefined}
                      value={formData.studentFirstName}
                      onChange={(e) => handleChange('studentFirstName', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                    {errors.studentFirstName && <p id="studentFirstName-error" role="alert" className="text-sm text-red-500">{errors.studentFirstName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="studentGrade" className="text-lux-ink">{prefill ? 'Classe de rentrée' : 'Classe'}</Label>
                    <select
                      id="studentGrade"
                      name="studentGrade"
                      aria-invalid={Boolean(errors.studentGrade)}
                      aria-describedby={errors.studentGrade ? 'studentGrade-error' : undefined}
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
                    {errors.studentGrade && <p id="studentGrade-error" role="alert" className="text-sm text-red-500">{errors.studentGrade}</p>}
                  </div>
                </div>



                <div className="space-y-3 rounded-2xl border border-lux-line/60 bg-lux-paper/80 p-4">
                  <label htmlFor="acceptTerms" className="flex items-start gap-3">
                    <Checkbox
                      id="acceptTerms"
                      name="acceptTerms"
                      aria-invalid={Boolean(errors.acceptTerms)}
                      checked={formData.acceptTerms}
                      onCheckedChange={(checked) => handleChange('acceptTerms', checked === true)}
                    />
                    <span className="text-sm text-lux-slate">
                      J’accepte d’être contacté par Nexus Réussite au sujet de ma demande et la politique de traitement des données.
                    </span>
                  </label>
                  {errors.acceptTerms && <p role="alert" className="text-sm text-red-500">{errors.acceptTerms}</p>}
                </div>

                <input
                  type="text"
                  name="website"
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
                    aria-describedby="bilan-submit-status"
                    className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {isSubmitting ? 'Création de votre espace…' : 'Créer mon espace'}
                  </button>
                  <span id="bilan-submit-status" role="status" aria-live="polite" className="text-sm text-lux-slate">
                    {isSubmitting
                      ? 'Envoi de la demande en cours'
                      : missingFields().length > 0
                        ? `Il manque encore : ${missingFields().join(', ')}.`
                        : ''}
                  </span>
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
            <div id="rappel-conseiller" className="scroll-mt-24">
              <ConseillerCard />
            </div>

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
