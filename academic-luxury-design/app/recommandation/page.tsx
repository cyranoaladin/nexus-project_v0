'use client';

import { useState } from 'react';
import { RecommendationWizard } from '@/components/recommendation-wizard';
import { ExamCard } from '@/components/exam-card';
import { pricingData } from '@/lib/pricing-data';
import { ArrowRight } from 'lucide-react';

interface WizardAnswers {
  step1?: string;
  step2?: string;
  step3?: string;
}

export default function RecommandationPage() {
  const [showResults, setShowResults] = useState(false);
  const [answers, setAnswers] = useState<WizardAnswers>({});

  const handleWizardComplete = (wizardAnswers: Record<string, string>) => {
    setAnswers(wizardAnswers);
    setShowResults(true);
  };

  // Get recommended offers based on answers
  const getRecommendedOffers = () => {
    const status = answers.step1;
    const level = answers.step2;
    const subject = answers.step3;

    let recommended = [...pricingData.offers];

    // Filter by status
    if (status === 'free' || status === 'repeat') {
      // Prioritize intensive and pass options
      recommended = recommended.filter((o) => o.type !== 'annual' || o.type === 'annual');
    }

    // Filter by level
    if (level === 'under10') {
      // Recommend intensive sessions
      recommended = recommended.filter((o) => o.type === 'intensive' || o.type === 'annual');
    }

    // Prioritize by subject
    if (subject === 'math') {
      const math = recommended.find((o) => o.id.includes('math'));
      if (math) {
        recommended = [math, ...recommended.filter((o) => o.id !== math.id)];
      }
    } else if (subject === 'french') {
      const french = recommended.find((o) => o.id.includes('french'));
      if (french) {
        recommended = [french, ...recommended.filter((o) => o.id !== french.id)];
      }
    }

    return recommended.slice(0, 3);
  };

  const recommendedOffers = showResults ? getRecommendedOffers() : [];

  return (
    <main className="bg-background min-h-screen">
      {/* Header */}
      <section className="bg-primary text-card py-12 px-4 md:px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-display mb-4">Diagnostic personnalisé</h1>
          <p className="text-body-lg text-card/90">
            Répondez à 3 questions pour découvrir les offres les plus adaptées à
            votre profil et vos objectifs.
          </p>
        </div>
      </section>

      {/* Wizard Section */}
      <section className="py-16 px-4 md:px-6">
        <div className="max-w-2xl mx-auto">
          {!showResults ? (
            <div className="bg-card p-8 md:p-12 rounded-2xl shadow-card">
              <RecommendationWizard onComplete={handleWizardComplete} />
            </div>
          ) : (
            <>
              {/* Results Header */}
              <div className="bg-card p-8 md:p-12 rounded-2xl shadow-card mb-12">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-full mb-4">
                    <span className="text-xs font-bold uppercase">
                      ✓ Diagnostic complété
                    </span>
                  </div>
                </div>

                <h2 className="text-h1 mb-4">Vos offres recommandées</h2>
                <p className="text-body-lg text-muted-foreground">
                  Basées sur vos réponses, voici les solutions que nous vous
                  recommandons pour réussir votre préparation.
                </p>

                <button
                  onClick={() => {
                    setShowResults(false);
                    setAnswers({});
                  }}
                  className="mt-6 text-accent font-bold hover:text-accent/80 transition-smooth text-body-md"
                >
                  ← Recommencer le diagnostic
                </button>
              </div>

              {/* Recommended Offers */}
              <div className="mb-12">
                <h3 className="text-h2 mb-8">Les meilleures options pour vous</h3>

                <div className="grid md:grid-cols-3 gap-6 mb-12">
                  {recommendedOffers.map((offer, idx) => (
                    <div key={offer.id} className="relative">
                      {idx === 0 && (
                        <div className="absolute -top-4 left-4 right-4 z-10">
                          <span className="inline-block px-3 py-1 bg-accent text-primary text-xs font-bold rounded-full">
                            Recommandation #1
                          </span>
                        </div>
                      )}
                      <ExamCard
                        offer={offer}
                        featured={idx === 0}
                        onCta={() => console.log('Selected:', offer.id)}
                      />
                    </div>
                  ))}
                </div>

                <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-6">
                  <h4 className="font-bold text-secondary mb-3">
                    Pourquoi ces offres?
                  </h4>
                  <ul className="space-y-2 text-body-sm text-foreground">
                    {answers.step1 === 'free' && (
                      <li>✓ Comme candidat libre, nous recommandons la flexibilité</li>
                    )}
                    {answers.step2 === 'under10' && (
                      <li>✓ Avec votre niveau actuel, un renforcement intensif est prioritaire</li>
                    )}
                    {answers.step3 && (
                      <li>✓ Focus spécial sur votre matière prioritaire</li>
                    )}
                    <li>✓ Toutes ces offres incluent un suivi personnalisé</li>
                  </ul>
                </div>
              </div>

              {/* Next Steps */}
              <div className="bg-primary text-card rounded-xl p-8 text-center">
                <h3 className="text-h2 mb-4">Prêt à commencer?</h3>
                <p className="text-body-lg mb-6 text-card/90">
                  Un conseiller peut répondre à toutes vos questions et vous aider
                  à finaliser votre inscription.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="flex items-center justify-center gap-2 px-8 py-3 bg-accent text-primary font-bold rounded-lg hover:bg-accent/90 transition-smooth">
                    Contacter un conseiller
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href="/catalogue"
                    className="px-8 py-3 border-2 border-card/40 text-card font-bold rounded-lg hover:border-card/60 transition-smooth"
                  >
                    Explorer tous les offres
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Info Section */}
      {!showResults && (
        <section className="bg-card py-12 px-4 md:px-6 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-h2 text-center mb-12">
              Pourquoi ce diagnostic?
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Profil Unique',
                  description:
                    'Chaque élève a des besoins différents. Nous les identifions pour vous proposer la meilleure solution.',
                },
                {
                  title: 'Gain de Temps',
                  description:
                    'Pas besoin de parcourir toutes les offres. Découvrez immédiatement les options qui vous conviennent.',
                },
                {
                  title: 'Résultats Garantis',
                  description:
                    'En choisissant l\'offre adaptée, vous maximisez vos chances de réussite et de progression.',
                },
              ].map((item, idx) => (
                <div key={idx} className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-heading font-bold text-accent">
                      {idx + 1}
                    </span>
                  </div>
                  <h3 className="text-h3 mb-2">{item.title}</h3>
                  <p className="text-body-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
