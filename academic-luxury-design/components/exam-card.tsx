'use client';

import { Offer } from '@/lib/types';
import { Check } from 'lucide-react';

interface ExamCardProps {
  offer: Offer;
  featured?: boolean;
  onCta?: (offerId: string) => void;
}

export function ExamCard({
  offer,
  featured = false,
  onCta,
}: ExamCardProps) {
  const handleCta = () => {
    if (onCta) onCta(offer.id);
  };

  return (
    <div
      className={`relative flex flex-col rounded-2xl transition-smooth ${
        featured
          ? 'ring-2 ring-accent border border-accent bg-gradient-to-br from-accent/5 to-transparent'
          : 'border border-border bg-card shadow-card hover:shadow-card-hover'
      } overflow-hidden`}
    >
      {/* Header with Eyebrow and Badge */}
      <div className="p-6 pb-4 border-b border-border/50 filet-gold">
        <div className="flex items-start justify-between mb-3">
          <span className="eyebrow">{offer.eyebrow}</span>
          {offer.badge && (
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                offer.badge_color === 'gold'
                  ? 'bg-accent text-primary'
                  : offer.badge_color === 'green'
                    ? 'bg-secondary text-card'
                    : 'bg-blue-100 text-blue-900'
              }`}
            >
              {offer.badge}
            </span>
          )}
        </div>

        <h3 className="text-h3 text-primary mb-2">{offer.title}</h3>
        <p className="text-body-md text-foreground/75">{offer.description}</p>
      </div>

      {/* Key Details */}
      <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-border/30">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Durée
          </p>
          <p className="font-heading text-primary font-bold">{offer.duration}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Groupe Max
          </p>
          <p className="font-heading text-primary font-bold">
            {offer.groupSize} élèves
          </p>
        </div>
        {offer.intensity && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Intensité
            </p>
            <p className="font-heading text-primary font-bold">
              {offer.intensity}
            </p>
          </div>
        )}
        {offer.startDate && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Début
            </p>
            <p className="font-heading text-primary font-bold">
              {offer.startDate}
            </p>
          </div>
        )}
      </div>

      {/* Pricing */}
      <div className="px-6 py-5 bg-muted/30">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-price text-accent">{offer.price}€</span>
          {offer.originalPrice && (
            <>
              <span className="text-body-sm line-through text-muted-foreground">
                {offer.originalPrice}€
              </span>
              <span className="text-xs font-bold text-secondary">
                -{offer.discount}%
              </span>
            </>
          )}
        </div>
        {offer.acompte && (
          <p className="text-body-sm text-muted-foreground">
            Acompte: <span className="font-bold text-primary">{offer.acompte}€</span>
            {offer.acompteDeductible && (
              <span className="ml-1">(déductible)</span>
            )}
          </p>
        )}
      </div>

      {/* Availability Indicator */}
      {offer.placesAvailable !== undefined && offer.placesLimit && (
        <div className="px-6 py-3 bg-background border-b border-border/30">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  offer.placesAvailable <= 2 ? 'bg-red-500' : 'bg-accent'
                }`}
                style={{
                  width: `${((offer.placesLimit - offer.placesAvailable) / offer.placesLimit) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs font-bold text-primary">
              {offer.placesAvailable} place{offer.placesAvailable !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Features */}
      <div className="px-6 py-5 flex-grow">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
          Inclus
        </h4>
        <ul className="space-y-2">
          {offer.features.slice(0, 5).map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <span className="text-body-sm text-foreground">{feature}</span>
            </li>
          ))}
          {offer.features.length > 5 && (
            <li className="text-body-sm text-muted-foreground italic">
              +{offer.features.length - 5} avantages
            </li>
          )}
        </ul>
      </div>

      {/* Echéanciers */}
      {offer.echeanciers && offer.echeanciers.length > 0 && (
        <div className="px-6 py-4 border-t border-border/30 bg-background/50">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
            Modalités de paiement
          </h4>
          <div className="space-y-1">
            {offer.echeanciers.map((ech, idx) => (
              <div key={idx} className="flex justify-between text-body-sm">
                <span className="text-muted-foreground">{ech.label}</span>
                <span className="font-bold text-primary">{ech.amount}€</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA Button */}
      <div className="p-6 pt-4 border-t border-border/30 bg-gradient-to-t from-background/50 to-transparent">
        <button
          onClick={handleCta}
          className={`w-full py-3 px-4 rounded-lg font-bold transition-smooth focus-ring ${
            featured
              ? 'bg-accent text-primary hover:bg-accent/90 shadow-md'
              : 'bg-primary text-card hover:bg-primary/90 border border-primary'
          }`}
        >
          {offer.cta}
        </button>
      </div>
    </div>
  );
}
