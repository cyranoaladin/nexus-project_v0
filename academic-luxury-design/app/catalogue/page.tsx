'use client';

import { useState, useMemo } from 'react';
import { CatalogueFilters } from '@/components/catalogue-filters';
import { ExamCard } from '@/components/exam-card';
import { pricingData } from '@/lib/pricing-data';
import { ArrowRight } from 'lucide-react';

interface Filters {
  type?: string;
  subject?: string;
  difficulty?: string;
}

export default function CataloguePage() {
  const [filters, setFilters] = useState<Filters>({});
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
  };

  const handleOfferSelect = (offerId: string) => {
    setSelectedOffer(offerId);
    console.log('Selected offer:', offerId);
  };

  // Filter offers based on selected filters
  const filteredOffers = useMemo(() => {
    return pricingData.offers.filter((offer) => {
      if (filters.type && offer.type !== filters.type) {
        return false;
      }
      return true;
    });
  }, [filters]);

  // Group offers by type
  const groupedOffers = useMemo(() => {
    const groups: Record<string, typeof pricingData.offers> = {};
    filteredOffers.forEach((offer) => {
      if (!groups[offer.type]) {
        groups[offer.type] = [];
      }
      groups[offer.type].push(offer);
    });
    return groups;
  }, [filteredOffers]);

  const sectionTitles: Record<string, { title: string; description: string }> = {
    intensive: {
      title: 'Sessions Intensives',
      description: 'Préparation concentrée sur des périodes courtes',
    },
    annual: {
      title: 'Passes Annuels',
      description: 'Accompagnement complet tout au long de l\'année scolaire',
    },
    pass: {
      title: 'Packs Flexibles',
      description: 'Flexibilité maximale avec sessions à la carte',
    },
  };

  return (
    <main className="bg-background min-h-screen">
      {/* Header */}
      <section className="bg-primary text-card py-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-display mb-4">Catalogue complet</h1>
          <p className="text-body-lg text-card/90">
            Découvrez toutes nos offres de préparation au baccalauréat.
            Filtrez par type d\'offre et trouvez la solution qui vous convient.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Filters Sidebar */}
            <div className="md:col-span-1">
              <CatalogueFilters onFilterChange={handleFilterChange} />
            </div>

            {/* Offers Grid */}
            <div className="md:col-span-3">
              {filteredOffers.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-body-lg text-muted-foreground mb-4">
                    Aucune offre ne correspond à vos critères.
                  </p>
                  <button
                    onClick={() => setFilters({})}
                    className="text-accent font-bold hover:text-accent/80"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <div className="space-y-12">
                  {Object.entries(groupedOffers)
                    .sort(([typeA], [typeB]) => {
                      const order: Record<string, number> = {
                        intensive: 1,
                        annual: 2,
                        pass: 3,
                      };
                      return (order[typeA] || 999) - (order[typeB] || 999);
                    })
                    .map(([type, offers]) => (
                      <div key={type}>
                        <div className="mb-8">
                          <h2 className="text-h2 mb-2">
                            {sectionTitles[type]?.title || type}
                          </h2>
                          <p className="text-body-md text-muted-foreground">
                            {sectionTitles[type]?.description}
                          </p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {offers.map((offer) => (
                            <ExamCard
                              key={offer.id}
                              offer={offer}
                              onCta={handleOfferSelect}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Results Count */}
              <div className="mt-12 pt-8 border-t border-border">
                <p className="text-body-sm text-muted-foreground">
                  Affichage de <span className="font-bold">{filteredOffers.length}</span> offre{filteredOffers.length > 1 ? 's' : ''} sur {pricingData.offers.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-card py-12 px-4 md:px-6 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-h2 mb-4">Vous avez besoin d\'aide?</h2>
          <p className="text-body-md text-muted-foreground mb-6">
            Un conseiller peut vous aider à choisir l\'offre la plus adaptée à
            votre profil.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-3 bg-primary text-card font-bold rounded-lg hover:bg-primary/90 transition-smooth focus-ring">
              Contacter un conseiller
            </button>
            <a
              href="/recommandation"
              className="flex items-center justify-center gap-2 px-8 py-3 border-2 border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-smooth focus-ring"
            >
              Faire un diagnostic
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
