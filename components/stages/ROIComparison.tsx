'use client';

import React from 'react';
import { analytics } from '@/lib/analytics-stages';

interface ComparisonOption {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  priceDetail: string;
  features: {
    label: string;
    value: string;
    highlight?: boolean;
  }[];
  pros: string[];
  cons: string[];
  recommended?: boolean;
  ctaText: string;
  ctaLink: string;
}

export function ROIComparison() {
  const handleCTA = (optionId: string) => {
    analytics.ctaClick(`roi-comparison-${optionId}`, 'Sélectionner cette option');
  };

  const options: ComparisonOption[] = [
    {
      id: 'private',
      title: 'Cours Particulier',
      subtitle: 'Approche classique',
      price: '~1200 DT',
      priceDetail: '(20h à 60 DT/h)',
      features: [
        { label: 'Volume horaire', value: '20h' },
        { label: 'Format', value: 'Individuel (1-1)' },
        { label: 'Structuration', value: 'Variable' },
        { label: 'Bilan', value: 'Rare' },
        { label: 'Tests blancs', value: 'Non inclus' },
        { label: 'Méthode', value: 'Selon prof' }
      ],
      pros: [
        'Attention 100% individuelle',
        'Horaires flexibles'
      ],
      cons: [
        'Coût élevé (60 DT/h)',
        'Pas de cadre structuré',
        'Pas d\'émulation de groupe',
        'Qualité variable'
      ],
      ctaText: 'Alternative classique',
      ctaLink: '#contact'
    },
    {
      id: 'pallier1',
      title: 'Stage Essentiel',
      subtitle: 'Pallier 1',
      price: '490-590 DT',
      priceDetail: '(22h structurées)',
      features: [
        { label: 'Volume horaire', value: '22h', highlight: true },
        { label: 'Format', value: 'Groupe (6 max)', highlight: true },
        { label: 'Structuration', value: 'Programme fixé', highlight: true },
        { label: 'Bilan', value: 'Individualisé', highlight: true },
        { label: 'Tests blancs', value: 'Inclus', highlight: true },
        { label: 'Méthode', value: 'Rigoureuse', highlight: true }
      ],
      pros: [
        'Prix optimal (22-27 DT/h)',
        'Cadre exigeant et structuré',
        'Épreuves blanches + bilans',
        'Émulation de groupe',
        'Enseignants experts (agrégés et certifiés)'
      ],
      cons: [
        'Engagement d\'une semaine',
        'Horaires fixes'
      ],
      recommended: true,
      ctaText: 'Choisir Pallier 1',
      ctaLink: '#academies'
    },
    {
      id: 'pallier2',
      title: 'Stage Excellence',
      subtitle: 'Pallier 2',
      price: '842-990 DT',
      priceDetail: '(30h intensives)',
      features: [
        { label: 'Volume horaire', value: '30h', highlight: true },
        { label: 'Format', value: 'Groupe (6 max)', highlight: true },
        { label: 'Structuration', value: 'Programme avancé', highlight: true },
        { label: 'Bilan', value: 'Individualisé', highlight: true },
        { label: 'Tests blancs', value: 'Inclus', highlight: true },
        { label: 'Méthode', value: 'Excellence', highlight: true },
        { label: 'Exposé maîtrise', value: 'Inclus (NSI)', highlight: true }
      ],
      pros: [
        'ROI exceptionnel (28-33 DT/h)',
        'Approfondissement maximal',
        'Rédaction fine et tests de maîtrise',
        'Trajectoire prépa/ingénieur',
        'Exposé de maîtrise (NSI)'
      ],
      cons: [
        'Investissement plus élevé',
        'Engagement intensif requis'
      ],
      ctaText: 'Choisir Pallier 2',
      ctaLink: '#academies'
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4">
              Cours particulier ou stage ?
            </h2>
            <p className="text-lg md:text-xl text-slate-200 max-w-3xl mx-auto">
              Comparaison objective pour faire le bon choix
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {options.map((option) => (
              <div
                key={option.id}
                className={`rounded-3xl p-6 md:p-8 border-2 transition-all duration-300 hover:scale-105 ${
                  option.recommended
                    ? 'bg-gradient-to-br from-blue-700 to-slate-700 border-brand-secondary shadow-2xl scale-100 lg:scale-105'
                    : 'bg-white/5 backdrop-blur border-white/20 hover:border-blue-400'
                }`}
              >
                {option.recommended && (
                  <div className="bg-brand-secondary text-white text-xs font-black uppercase px-4 py-2 rounded-full inline-block mb-4">
                    ⭐ Meilleur rapport qualité/prix
                  </div>
                )}

                <h3 className="text-2xl font-black mb-1">{option.title}</h3>
                <p className={`text-sm mb-4 ${option.recommended ? 'text-slate-100' : 'text-slate-300'}`}>
                  {option.subtitle}
                </p>

                <div className="mb-6">
                  <div className="text-4xl font-black mb-1">{option.price}</div>
                  <div className={`text-sm ${option.recommended ? 'text-slate-200' : 'text-slate-300'}`}>
                    {option.priceDetail}
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {option.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className={`flex justify-between items-center text-sm pb-2 border-b ${
                        option.recommended
                          ? 'border-white/20'
                          : 'border-slate-700'
                      }`}
                    >
                      <span className={option.recommended ? 'text-slate-100' : 'text-slate-300'}>
                        {feature.label}
                      </span>
                      <span className={`font-semibold ${feature.highlight ? 'text-green-400' : ''}`}>
                        {feature.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mb-4">
                  <div className="text-xs font-bold uppercase tracking-wider mb-2 text-green-400">
                    ✓ Avantages
                  </div>
                  <ul className="space-y-1">
                    {option.pros.map((pro, idx) => (
                      <li key={idx} className="text-xs flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-6">
                  <div className="text-xs font-bold uppercase tracking-wider mb-2 text-slate-300">
                    ✗ Inconvénients
                  </div>
                  <ul className="space-y-1">
                    {option.cons.map((con, idx) => (
                      <li key={idx} className="text-xs flex items-start gap-2">
                        <span className="text-slate-300 mt-0.5">•</span>
                        <span className={option.recommended ? 'text-slate-100' : 'text-slate-300'}>
                          {con}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={option.ctaLink}
                  onClick={() => handleCTA(option.id)}
                  className={`${option.recommended ? 'btn-stage-outline' : 'btn-stage-sm'} w-full`}
                >
                  {option.ctaText}
                </a>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-white/10 backdrop-blur rounded-2xl border border-white/20 max-w-4xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="text-3xl">💡</div>
              <div>
                <h4 className="font-bold text-lg mb-2">Notre recommandation</h4>
                <p className="text-sm text-slate-200 leading-relaxed">
                  Pour un même budget, les stages offrent un meilleur ROI grâce à :
                  <strong> cadre structuré, émulation de groupe, épreuves blanches et bilans individualisés</strong>.
                  Le cours particulier reste pertinent pour du soutien très ciblé en complément.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
