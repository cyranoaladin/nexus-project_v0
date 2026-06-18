'use client';

import { useState } from 'react';
import { HeroSection } from '@/components/hero-section';
import { MethodSection } from '@/components/method-section';
import { ForWhoSection } from '@/components/for-who-section';
import { ExamCard } from '@/components/exam-card';
import { PassCard } from '@/components/pass-card';
import { ComparisonTable } from '@/components/comparison-table';
import { FAQSection } from '@/components/faq-section';
import { pricingData } from '@/lib/pricing-data';
import { ArrowRight, MapPin, Mail, Phone } from 'lucide-react';

export default function Page() {
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);

  const handleOfferSelect = (offerId: string) => {
    setSelectedOffer(offerId);
    // In a real app, this would open a modal or navigate to booking
    console.log('Selected offer:', offerId);
  };

  // Get featured intensive offers
  const featuredOffer = pricingData.offers.find(
    (o) => o.id === 'intensive-math-spring'
  );

  // Get annual offers
  const annualOffers = pricingData.offers.filter((o) => o.type === 'annual');
  const intensiveOffers = pricingData.offers.filter(
    (o) => o.type === 'intensive'
  );

  return (
    <main className="bg-background">
      {/* Hero Section */}
      <HeroSection
        featuredOffer={featuredOffer}
        onCta={handleOfferSelect}
      />

      {/* Method Section */}
      <MethodSection />

      {/* Pour Qui Section */}
      <ForWhoSection />

      {/* Sessions Intensives */}
      <section className="py-20 px-4 md:px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="eyebrow">Sessions Intensives</span>
            <h2 className="text-h1 mt-4 mb-6 text-balance">
              Préparation concentrée pour les examens
            </h2>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
              Des sessions courtes et intensives pour cibler les points faibles
              avant le bac.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {intensiveOffers.map((offer) => (
              <ExamCard
                key={offer.id}
                offer={offer}
                onCta={handleOfferSelect}
              />
            ))}
          </div>

          <div className="text-center">
            <a
              href="/catalogue"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-card font-bold rounded-lg hover:bg-primary/90 transition-smooth focus-ring"
            >
              Voir toutes les offres
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Annual Passes */}
      <section className="py-20 px-4 md:px-6 bg-card">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="eyebrow">Passes Annuels</span>
            <h2 className="text-h1 mt-4 mb-6 text-balance">
              Un accompagnement complet tout au long de l\'année
            </h2>
            <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
              Suivi régulier, mentorat personnel et accès illimité à la
              plateforme.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {annualOffers.map((offer, idx) => (
              <PassCard
                key={offer.id}
                pass={{
                  id: offer.id,
                  title: offer.title,
                  description: offer.description,
                  value: offer.badge || 'Option',
                  discount: offer.discount || 0,
                  price: offer.price,
                  sessions: 40,
                  validity: offer.duration,
                }}
                highlighted={idx === 0}
                onCta={handleOfferSelect}
              />
            ))}
          </div>

          <div className="text-center">
            <a
              href="/catalogue"
              className="inline-flex items-center gap-2 px-6 py-3 border-2 border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-smooth focus-ring"
            >
              Explorer plus de passes
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 px-4 md:px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="eyebrow">Pourquoi Nexus?</span>
            <h2 className="text-h1 mt-4 mb-6 text-balance">
              Nexus vs Préparation Traditionnelle
            </h2>
          </div>

          <div className="bg-card p-8 rounded-2xl shadow-card">
            <ComparisonTable comparison={pricingData.comparison} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQSection items={pricingData.faq} />

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-6 bg-primary text-card">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-h1 mb-6">Prêt à transformer ta préparation?</h2>
          <p className="text-body-lg mb-8">
            Rejoins plus de 500 élèves qui ont amélioré leurs notes avec
            Académie Nexus.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-3 bg-accent text-primary font-bold rounded-lg hover:bg-accent/90 transition-smooth focus-ring">
              Commencer maintenant
            </button>
            <a
              href="#contact"
              className="px-8 py-3 border-2 border-card/40 text-card font-bold rounded-lg hover:border-card/60 transition-smooth focus-ring"
            >
              Contacter un conseiller
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border px-4 md:px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-heading font-bold text-primary mb-4">
                Académie Nexus
              </h3>
              <p className="text-body-sm text-muted-foreground">
                Préparation au baccalauréat français premium avec approche
                innovante.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-primary mb-4">Navigation</h4>
              <ul className="space-y-2 text-body-sm">
                <li>
                  <a href="/" className="text-muted-foreground hover:text-primary transition-smooth">
                    Accueil
                  </a>
                </li>
                <li>
                  <a href="/catalogue" className="text-muted-foreground hover:text-primary transition-smooth">
                    Catalogue
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                    À propos
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-primary mb-4">Support</h4>
              <ul className="space-y-2 text-body-sm">
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
                    Conditions d\'utilisation
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-primary mb-4">Contact</h4>
              <ul className="space-y-3 text-body-sm">
                <li className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">+33 1 23 45 67 89</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <a href="mailto:hello@nexus.fr" className="text-muted-foreground hover:text-primary transition-smooth">
                    hello@nexus.fr
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Paris, France
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 text-center text-body-sm text-muted-foreground">
            <p>
              © 2026 Académie Nexus. Tous les droits réservés. |{' '}
              <a href="#" className="hover:text-primary transition-smooth">
                Politique de confidentialité
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
