'use client';

import { PassOption } from '@/lib/types';
import { Zap, TrendingUp } from 'lucide-react';

interface PassCardProps {
  pass: PassOption;
  highlighted?: boolean;
  onCta?: (passId: string) => void;
}

export function PassCard({
  pass,
  highlighted = false,
  onCta,
}: PassCardProps) {
  const handleCta = () => {
    if (onCta) onCta(pass.id);
  };

  const pricePerSession = Math.round(pass.price / pass.sessions);

  return (
    <div
      className={`relative flex flex-col rounded-xl transition-smooth ${
        highlighted
          ? 'ring-2 ring-secondary border border-secondary bg-gradient-to-br from-secondary/10 to-transparent'
          : 'border border-border bg-card shadow-card hover:shadow-card-hover'
      } overflow-hidden`}
    >
      {/* Header */}
      <div className="p-5 border-b border-border/50">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-h3 text-primary">{pass.title}</h3>
          {highlighted && (
            <div className="flex items-center gap-1 text-secondary text-xs font-bold">
              <TrendingUp className="w-4 h-4" />
              Meilleure valeur
            </div>
          )}
        </div>
        <p className="text-body-sm text-muted-foreground">
          {pass.description}
        </p>
      </div>

      {/* Stats */}
      <div className="px-5 py-4 grid grid-cols-3 gap-3 bg-muted/20 border-b border-border/30">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Sessions</p>
          <p className="text-2xl font-heading font-bold text-primary">
            {pass.sessions}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Durée</p>
          <p className="text-body-md font-bold text-primary">{pass.validity}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Par session</p>
          <p className="text-body-md font-bold text-accent">{pricePerSession}€</p>
        </div>
      </div>

      {/* Pricing */}
      <div className="px-5 py-5">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-4xl font-heading font-bold text-primary">
            {pass.price}€
          </span>
          <span className="text-sm font-bold text-secondary bg-secondary/10 px-2 py-1 rounded">
            -{pass.discount}%
          </span>
        </div>
        <p className="text-body-sm text-muted-foreground">
          {pricePerSession}€ par session
        </p>
      </div>

      {/* Benefits */}
      <div className="px-5 py-4 flex-grow border-t border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-accent" />
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Avantages
          </p>
        </div>
        <ul className="space-y-2 text-body-sm text-foreground">
          <li>✓ Flexible: réservez vos créneaux</li>
          <li>✓ Accès plateforme premium</li>
          <li>✓ Groupes réduits (max 8)</li>
          <li>✓ Support par email</li>
        </ul>
      </div>

      {/* CTA */}
      <div className="p-5 border-t border-border/30">
        <button
          onClick={handleCta}
          className={`w-full py-3 px-4 rounded-lg font-bold transition-smooth focus-ring ${
            highlighted
              ? 'bg-secondary text-card hover:bg-secondary/90 shadow-md'
              : 'bg-primary text-card hover:bg-primary/90'
          }`}
        >
          Choisir ce pass
        </button>
      </div>
    </div>
  );
}
