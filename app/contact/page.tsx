'use client';

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { MessageCircle, Phone, Mail, ArrowRight, MapPin } from 'lucide-react';
import { WhatsAppLogo, WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';
import { toast, Toaster } from 'sonner';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CallbackRequestForm } from '@/components/marketing/acadomia-inspired';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { LEGAL } from '@/lib/legal';
const ADMIN_ADDRESS = LEGAL.addresses.siege.full;
const PEDA_ADDRESS = LEGAL.addresses.pedagogique.full;

type FormState = {
  profile: string;
  name: string;
  email: string;
  phone: string;
  interest: string;
  urgency: string;
  message: string;
  consent: boolean;
};

const initialFormState: FormState = {
  profile: 'parent-prospect',
  name: '',
  email: '',
  phone: '',
  interest: 'Demande de bilan gratuit',
  urgency: '',
  message: '',
  consent: false,
};

const intentions = [
  { value: 'parent-prospect', label: 'Parent (prospect)', interest: 'Demande de bilan gratuit' },
  { value: 'famille-suivie', label: 'Famille déjà accompagnée', interest: 'Suivi famille déjà accompagnée' },
  { value: 'candidat-libre', label: 'Candidat libre', interest: 'Candidat libre bac français' },
  { value: 'enseignant', label: 'Enseignant (recrutement)', interest: 'Recrutement enseignant' },
];

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = intentions.findIndex((i) => i.value === form.profile);
    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % intentions.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + intentions.length) % intentions.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = intentions.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectIntention(intentions[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  }, [form.profile]);

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectIntention = (value: string) => {
    const intention = intentions.find((item) => item.value === value);
    setForm((prev) => ({
      ...prev,
      profile: value,
      interest: intention?.interest ?? prev.interest,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'contact-page', type: 'contact' }),
      });

      if (!response.ok) {
        throw new Error('Impossible d’envoyer votre demande.');
      }

      toast.success('Votre message a bien été envoyé.');
      setForm(initialFormState);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="luxury min-h-screen" id="main-content">
      {/* Toaster provided globally by components/providers.tsx */}
      <CorporateNavbar />

      <section className="bg-lux-ink py-16 px-4 md:px-6 pt-28">
        <div className="mx-auto max-w-5xl text-center">
          <Badge className="mb-4 border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            Contact
          </Badge>
          <h1 className="font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">
            Une question claire mérite une réponse claire
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-lux-on-dark-muted">
            Les rendez-vous pédagogiques et cours en présentiel se déroulent à Mutuelleville, sur confirmation.
          </p>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-lux-ink">Votre intention</Label>
                  <div className="grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Type de demande">
                    {intentions.map((intention, index) => {
                      const active = form.profile === intention.value;
                      return (
                        <button
                          key={intention.value}
                          ref={(el) => { tabRefs.current[index] = el; }}
                          type="button"
                          role="tab"
                          id={`tab-${intention.value}`}
                          aria-selected={active}
                          aria-controls={`tabpanel-${intention.value}`}
                          tabIndex={active ? 0 : -1}
                          onClick={() => selectIntention(intention.value)}
                          onKeyDown={handleTabKeyDown}
                          className={`min-h-[44px] rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                            active
                              ? 'border-lux-gold bg-lux-gold/12 text-lux-ink'
                              : 'border-lux-line bg-lux-paper text-lux-slate hover:border-lux-gold/60'
                          }`}
                        >
                          {intention.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  role="tabpanel"
                  id={`tabpanel-${form.profile}`}
                  aria-labelledby={`tab-${form.profile}`}
                  tabIndex={0}
                  className="space-y-6"
                >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-lux-ink">{form.profile === 'parent-prospect' ? 'Nom du parent' : 'Nom complet'}</Label>
                    <Input
                      id="name"
                      required
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-lux-ink">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-lux-ink">Téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interest" className="text-lux-ink">Objet</Label>
                    <Input
                      id="interest"
                      required
                      value={form.interest}
                      onChange={(e) => handleChange('interest', e.target.value)}
                      placeholder="Bilan, stage, accompagnement..."
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgency" className="text-lux-ink">Priorité / échéance</Label>
                  <Input
                    id="urgency"
                    value={form.urgency}
                    onChange={(e) => handleChange('urgency', e.target.value)}
                    placeholder="Cette semaine, rentrée, vacances..."
                    className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-lux-ink">Message</Label>
                  <Textarea
                    id="message"
                    rows={5}
                    required
                    value={form.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    placeholder="Décrivez votre besoin."
                    className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                  />
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-lux-line/60 bg-lux-paper/80 p-4 text-sm leading-6 text-lux-slate">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => handleChange('consent', e.target.checked)}
                    required
                    className="mt-1"
                  />
                  <span>
                    J’accepte d’être contacté par Nexus Réussite au sujet de ma demande et j’ai pris connaissance de la{' '}
                    <Link href="/politique-confidentialite" className="font-semibold text-lux-gold-deep underline">
                      politique de confidentialité
                    </Link>.
                  </span>
                </label>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold"
                  >
                    {isSubmitting ? 'Envoi...' : 'Envoyer ma demande'}
                  </Button>
                  <Link href="/bilan-gratuit" className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold">
                    Demander un bilan
                  </Link>
                </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <CallbackRequestForm source="contact-page" />

            <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
              <CardContent className="p-6">
                <h2 className="text-lg font-fraunces text-lux-ink">Nos deux adresses</h2>
                <div className="mt-4 space-y-4 text-sm text-lux-slate">
                  <div className="rounded-xl border border-lux-line/60 bg-lux-paper/60 p-4">
                    <p className="font-semibold text-lux-ink">Siège social administratif</p>
                    <p className="mt-1">{ADMIN_ADDRESS}</p>
                  </div>
                  <div className="rounded-xl border border-lux-line/60 bg-lux-paper/60 p-4">
                    <p className="font-semibold text-lux-ink">Centre d’accompagnement pédagogique</p>
                    <p className="mt-1">{PEDA_ADDRESS}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-lux-gold-wash" />
                  <h2 className="text-lg font-fraunces text-lux-ivory">Contact direct</h2>
                </div>
                <div className="mt-4 space-y-3">
                  <a href={buildWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10">
                    <WhatsAppLogo className="h-4 w-4" style={{ color: WHATSAPP_BRAND_GREEN }} />
                    WhatsApp&nbsp;: {LEGAL.contact.phone}
                  </a>
                  <a href={`tel:${LEGAL.contact.phoneRaw}`} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10">
                    <Phone className="h-4 w-4 text-lux-gold-wash" />
                    Appeler
                  </a>
                  <a href={`mailto:${LEGAL.contact.email}`} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10">
                    <Mail className="h-4 w-4 text-lux-gold-wash" />
                    {LEGAL.contact.email}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl font-fraunces text-lux-ink">Venir au centre</h2>
              <p className="mt-2 text-sm text-lux-slate">
                Les cours et rendez-vous pédagogiques sont confirmés à Mutuelleville.
              </p>
              <p className="mt-2 text-sm text-lux-slate">{PEDA_ADDRESS}</p>
              <a href={`https://www.google.com/maps?q=${encodeURIComponent(PEDA_ADDRESS)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center text-sm font-semibold text-lux-gold-deep hover:text-lux-ink transition-colors">
                Ouvrir l’itinéraire
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-white text-lux-ink lux-shadow">
            <CardContent className="flex h-full min-h-[320px] flex-col justify-between p-6 md:p-8">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-lux-gold/12">
                    <MapPin className="h-5 w-5 text-lux-gold" aria-hidden="true" />
                  </div>
                  <h2 className="text-2xl font-fraunces text-lux-ink">Plan d’accès</h2>
                </div>
                <p className="mt-4 text-sm text-lux-slate">
                  Les rendez-vous pédagogiques et cours en présentiel sont confirmés à Mutuelleville.
                </p>
                <p className="mt-3 text-lg font-medium text-lux-ink">{PEDA_ADDRESS}</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-lux-slate">
                  Centre d’accompagnement pédagogique&nbsp;: accès simple, cadre calme et rendez-vous sur confirmation.
                </p>
              </div>

              <div className="mt-8 grid gap-3 rounded-2xl border border-lux-line/60 bg-lux-paper/70 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-lux-gold-deep">Siège social</p>
                  <p className="mt-1 text-sm text-lux-ink">{ADMIN_ADDRESS}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-lux-gold-deep">Centre pédagogique</p>
                  <p className="mt-1 text-sm text-lux-ink">{PEDA_ADDRESS}</p>
                </div>
              </div>

              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(PEDA_ADDRESS)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center text-sm font-semibold text-lux-gold-deep transition-colors hover:text-lux-ink"
              >
                Ouvrir sur Google Maps
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </CardContent>
          </Card>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
