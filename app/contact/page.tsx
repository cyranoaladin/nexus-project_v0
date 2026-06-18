'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { MessageCircle, Phone, Mail, ArrowRight } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const WHATSAPP_URL = 'https://wa.me/21699192829';
const ADMIN_ADDRESS = 'Centre Urbain Nord, Immeuble VENUS, Apt. C13, 1082 Tunis';
const PEDA_ADDRESS = 'Mutuelleville, Tunis';

type FormState = {
  profile: string;
  name: string;
  email: string;
  phone: string;
  interest: string;
  urgency: string;
  message: string;
};

const initialFormState: FormState = {
  profile: 'family',
  name: '',
  email: '',
  phone: '',
  interest: '',
  urgency: '',
  message: '',
};

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
      <Toaster position="top-right" richColors theme="dark" />
      <CorporateNavbar />

      <section className="bg-lux-ink py-16 px-4 md:px-6 pt-28">
        <div className="mx-auto max-w-5xl text-center">
          <Badge className="mb-4 border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            Contact
          </Badge>
          <h1 className="font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">
            Une question claire mérite une réponse claire
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-lux-ivory/75">
            Les rendez-vous pédagogiques et cours en présentiel se déroulent à Mutuelleville, sur confirmation.
          </p>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-lux-line bg-lux-white lux-shadow">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="profile" className="text-lux-ink">Votre profil</Label>
                  <select
                    id="profile"
                    value={form.profile}
                    onChange={(e) => handleChange('profile', e.target.value)}
                    className="h-11 w-full rounded-lg border border-lux-line bg-lux-paper px-3 text-sm text-lux-ink outline-none focus-visible:ring-2 focus-visible:ring-lux-gold"
                  >
                    <option value="family">Famille / Parent</option>
                    <option value="school">Établissement</option>
                    <option value="pro">Professionnel</option>
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-lux-ink">{form.profile === 'family' ? 'Nom du parent' : 'Nom complet'}</Label>
                    <Input
                      id="name"
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
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interest" className="text-lux-ink">Objet</Label>
                    <Input
                      id="interest"
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
                    value={form.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    placeholder="Décrivez votre besoin."
                    className="border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold"
                  />
                </div>

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
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-lux-line bg-lux-white lux-shadow">
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
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10">
                    <MessageCircle className="h-4 w-4 text-lux-evergreen" />
                    WhatsApp : +216 99 19 28 29
                  </a>
                  <a href="tel:+21699192829" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10">
                    <Phone className="h-4 w-4 text-lux-gold-wash" />
                    Appeler
                  </a>
                  <a href="mailto:contact@nexusreussite.academy" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-lux-ivory transition-colors hover:border-lux-gold/40 hover:bg-white/10">
                    <Mail className="h-4 w-4 text-lux-gold-wash" />
                    contact@nexusreussite.academy
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-lux-paper py-14 px-4 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-lux-line bg-lux-white lux-shadow">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-2xl font-fraunces text-lux-ink">Venir au centre</h2>
              <p className="mt-2 text-sm text-lux-slate">
                Les cours et rendez-vous pédagogiques sont confirmés à Mutuelleville.
              </p>
              <p className="mt-2 text-sm text-lux-slate">{PEDA_ADDRESS}</p>
              <a href={`https://www.google.com/maps?q=${encodeURIComponent(PEDA_ADDRESS)}&output=embed`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center text-sm font-semibold text-lux-gold-deep hover:text-lux-ink transition-colors">
                Ouvrir l’itinéraire
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-2xl border border-lux-line bg-lux-white lux-shadow">
            <iframe
              title="Centre d’accompagnement pédagogique - Mutuelleville"
              src={`https://www.google.com/maps?q=${encodeURIComponent(PEDA_ADDRESS)}&output=embed`}
              className="h-[320px] w-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
