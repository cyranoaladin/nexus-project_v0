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
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <Toaster position="top-right" richColors theme="dark" />
      <CorporateNavbar />

      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
              Contact
            </Badge>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Une question claire mérite une réponse claire
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-300">
              Les rendez-vous pédagogiques et cours en présentiel se déroulent à Mutuelleville, sur confirmation.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="profile">Votre profil</Label>
                    <select
                      id="profile"
                      value={form.profile}
                      onChange={(e) => handleChange('profile', e.target.value)}
                      className="h-11 w-full rounded-md border border-white/10 bg-surface-dark px-3 text-sm text-white outline-none"
                    >
                      <option value="family">Famille / Parent</option>
                      <option value="school">Établissement</option>
                      <option value="pro">Professionnel</option>
                    </select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">{form.profile === 'family' ? 'Nom du parent' : 'Nom complet'}</Label>
                      <Input id="name" value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Téléphone</Label>
                      <Input id="phone" type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interest">Objet</Label>
                      <Input id="interest" value={form.interest} onChange={(e) => handleChange('interest', e.target.value)} placeholder="Bilan, stage, accompagnement..." />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="urgency">Priorité / échéance</Label>
                    <Input id="urgency" value={form.urgency} onChange={(e) => handleChange('urgency', e.target.value)} placeholder="Cette semaine, rentrée, vacances..." />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" rows={5} value={form.message} onChange={(e) => handleChange('message', e.target.value)} placeholder="Décrivez votre besoin." />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="submit" size="lg" disabled={isSubmitting} className="min-h-[44px]">
                      {isSubmitting ? 'Envoi...' : 'Envoyer ma demande'}
                    </Button>
                    <Link href="/bilan-gratuit" className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-white/15 px-4 py-3 text-sm font-medium text-white">
                      Demander un bilan
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-white/10 bg-white/5 backdrop-blur">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-white">Nos deux adresses</h2>
                  <div className="mt-4 space-y-4 text-sm text-neutral-300">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="font-semibold text-white">Siège social administratif</p>
                      <p className="mt-1">{ADMIN_ADDRESS}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <p className="font-semibold text-white">Centre d’accompagnement pédagogique</p>
                      <p className="mt-1">{PEDA_ADDRESS}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-brand-accent" />
                    <h2 className="text-lg font-semibold text-white">Contact direct</h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                      <MessageCircle className="h-4 w-4 text-emerald-300" />
                      WhatsApp : +216 99 19 28 29
                    </a>
                    <a href="tel:+21699192829" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                      <Phone className="h-4 w-4 text-brand-accent" />
                      Appeler
                    </a>
                    <a href="mailto:contact@nexusreussite.academy" className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                      <Mail className="h-4 w-4 text-brand-accent" />
                      contact@nexusreussite.academy
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white">Venir au centre</h2>
                <p className="mt-2 text-sm text-neutral-300">
                  Les cours et rendez-vous pédagogiques sont confirmés à Mutuelleville.
                </p>
                <p className="mt-2 text-sm text-neutral-400">{PEDA_ADDRESS}</p>
                <a href={`https://www.google.com/maps?q=${encodeURIComponent(PEDA_ADDRESS)}&output=embed`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center text-sm font-semibold text-brand-accent hover:text-white">
                  Ouvrir l’itinéraire
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </CardContent>
            </Card>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <iframe
                title="Centre d’accompagnement pédagogique - Mutuelleville"
                src={`https://www.google.com/maps?q=${encodeURIComponent(PEDA_ADDRESS)}&output=embed`}
                className="h-[320px] w-full border-0"
                loading="lazy"
              />
            </div>
          </section>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
