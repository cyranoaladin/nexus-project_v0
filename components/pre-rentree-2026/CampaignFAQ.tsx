'use client';

import { useState } from 'react';

const FAQ_ITEMS = [
  { q: 'Mon enfant peut-il choisir plusieurs matières ?', a: 'Oui, de 1 à 4 matières au choix. Le tarif est dégressif : plus on choisit de matières, plus le prix par heure est avantageux.' },
  { q: 'Peut-il ne venir qu\'une seule semaine ?', a: 'Oui. Chaque matière est concentrée sur une seule semaine (semaine 1 ou semaine 2 selon la matière). Il est possible de ne choisir que des matières d\'une même semaine.' },
  { q: 'Quelle est la différence entre NSI et SNT en Seconde ?', a: 'En Seconde, le module s\'intitule « Initiation informatique, algorithmique et SNT ». Ce n\'est pas un enseignement de spécialité (EDS). Il s\'adresse à tous les élèves souhaitant découvrir la programmation.' },
  { q: 'Mon enfant entre en Première : Maths EDS ou hors EDS ?', a: 'Les deux profils sont accueillis dans le même créneau. Le groupe sera composé en fonction des profils déclarés, avec une différenciation pédagogique adaptée.' },
  { q: 'Première générale ou technologique pour le Français ?', a: 'Le module EAF prépare aux deux voies (commentaire/dissertation pour la générale, contraction/essai pour la technologique). La composition du groupe est validée par l\'équipe Nexus.' },
  { q: 'Mon enfant est en Terminale : quelle option de Maths ?', a: 'Trois profils sont possibles : Maths spécialité (EDS), Maths expertes (option) ou Maths complémentaires (option). Le module est adapté au profil déclaré.' },
  { q: 'Quel est le seuil d\'ouverture d\'un groupe ?', a: 'Un groupe ouvre à partir de 3 élèves inscrits (maximum 5). La décision d\'ouverture est prise le 10 août à 18 h.' },
  { q: 'L\'acompte est-il remboursable ?', a: 'Oui, intégralement, si Nexus décide de ne pas ouvrir le groupe (effectif insuffisant). En cas de désistement de votre part, les conditions de remboursement sont précisées avant confirmation.' },
  { q: 'Que se passe-t-il si le groupe n\'ouvre pas ?', a: 'L\'acompte est remboursé intégralement. Nexus peut proposer un report ou une alternative selon les disponibilités, sans obligation.' },
  { q: 'Y a-t-il une liste d\'attente si le groupe est complet ?', a: 'Oui. En cas de groupe complet (5 élèves), votre enfant est inscrit sur liste d\'attente et prioritaire si une place se libère.' },
  { q: 'Mon enfant peut-il rattraper une absence ?', a: 'Le rattrapage est possible selon les disponibilités, mais ne peut pas être garanti. Contactez l\'équipe le plus tôt possible en cas d\'absence prévue.' },
  { q: 'Quel matériel apporter ?', a: 'Un cahier, une trousse complète et une calculatrice si la matière le requiert. Aucun achat spécifique n\'est demandé.' },
  { q: 'Comment obtenir un conseil personnalisé ?', a: 'Utilisez le bouton « Poser une question » (WhatsApp) ou demandez un bilan stratégique gratuit. L\'équipe Nexus vous orientera vers la formule adaptée.' },
  { q: 'La pré-inscription engage-t-elle financièrement ?', a: 'Non. La pré-inscription transmet votre demande sans engagement. L\'inscription est confirmée uniquement après validation du profil et versement de l\'acompte.' },
  { q: 'Les tarifs sont-ils cumulables avec les remises Carte Nexus ?', a: 'Non. Les tarifs Pré-rentrée sont spécifiques et ne sont pas cumulables avec les remises automatiques (Carte Nexus, fratrie, ancien élève, parrainage).' },
  { q: 'Un report vers un autre stage est-il possible ?', a: 'Uniquement après accord écrit de la direction. Il n\'y a pas de conversion automatique vers un cours individuel ou un autre format.' },
];

export function CampaignFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-white py-14 md:py-20 px-4" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl">
        <h2 id="faq-heading" className="font-fraunces text-2xl md:text-3xl text-lux-ink mb-8">
          Questions fréquentes
        </h2>
        <div className="divide-y divide-lux-line">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            const panelId = `faq-panel-${idx}`;
            const buttonId = `faq-button-${idx}`;

            return (
              <div key={idx}>
                <button
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-lux-ink hover:text-lux-gold-deep transition-colors min-h-[44px]"
                >
                  <span>{item.q}</span>
                  <span className="ml-4 shrink-0" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="pb-4 text-sm text-lux-slate"
                >
                  {item.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
