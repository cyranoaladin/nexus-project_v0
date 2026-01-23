'use client';

import { motion } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { Badge } from './badge';
import { Button } from './button';

const faqs = [
  {
    question: "Quelle est la différence entre un élève scolarisé et un candidat libre ?",
    answer: "Un élève scolarisé suit les cours dans un lycée français et bénéficie du contrôle continu (40% de la note finale). Un candidat libre n'a pas d'établissement et passe uniquement les épreuves terminales (100% de la note finale). Nos programmes s'adaptent à ces deux profils."
  },
  {
    question: "L'IA ARIA peut-elle remplacer un professeur ?",
    answer: "Non, ARIA est un outil complémentaire qui aide à la révision 24/7, mais ne remplace pas l'expertise humaine. Nos professeurs agrégés et certifiés restent au cœur de notre pédagogie pour l'accompagnement personnalisé et les cours en présentiel."
  },
  {
    question: "Comment fonctionne la garantie de réussite ?",
    answer: "Si vous n'obtenez pas votre Bac avec nos programmes Odyssée, nous vous remboursons 100% de votre investissement. Cette garantie s'applique uniquement aux programmes annuels complets."
  },
  {
    question: "Puis-je changer de programme en cours d'année ?",
    answer: "Oui, nous proposons une flexibilité totale. Vous pouvez passer d'un programme à un autre selon vos besoins et votre progression. Notre équipe vous accompagne dans cette transition."
  },
  {
    question: "Les académies sont-elles obligatoires ?",
    answer: "Non, les académies sont des stages intensifs optionnels. Elles sont recommandées pour optimiser votre préparation, mais vous pouvez choisir celles qui correspondent à vos besoins."
  },
  {
    question: "Comment se déroule l'inscription ?",
    answer: "L'inscription se fait en 3 étapes : 1) Consultation gratuite pour évaluer vos besoins, 2) Choix du programme adapté, 3) Inscription et début de l'accompagnement. Notre équipe vous guide à chaque étape."
  },
  {
    question: "Proposez-vous des facilités de paiement ?",
    answer: "Oui, nous proposons des échéanciers personnalisés pour tous nos programmes. Vous pouvez payer en plusieurs fois sans frais supplémentaires. Contactez-nous pour un devis personnalisé."
  },
  {
    question: "Que se passe-t-il si je ne suis pas satisfait ?",
    answer: "Nous offrons une garantie de satisfaction de 30 jours. Si vous n'êtes pas satisfait de nos services, nous vous remboursons intégralement. Votre satisfaction est notre priorité."
  }
];

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <motion.div
      className="border-b border-gray-200 last:border-b-0"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <button
        className="w-full py-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
        onClick={onToggle}
      >
        <span className="font-medium text-bleu-nuit pr-4">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-gris-noble flex-shrink-0" />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="pb-6 pr-4">
          <p className="text-gris-noble leading-relaxed">
            {answer}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <Badge variant="outline" className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
            <HelpCircle className="w-4 h-4 mr-2" />
            Questions Fréquentes
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
            Tout Ce Que Vous Devez Savoir
          </h2>
          <p className="text-lg text-gris-noble max-w-3xl mx-auto">
            Trouvez rapidement les réponses à vos questions sur nos programmes, nos garanties et notre accompagnement.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-strong border border-gray-100 overflow-hidden">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === index}
                onToggle={() => handleToggle(index)}
              />
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <p className="text-lg text-gris-noble mb-6">
            Vous ne trouvez pas la réponse à votre question ?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-200 hover:scale-105">
              Nous Contacter
            </Button>
            <Button variant="outline" className="border-bleu-nuit text-bleu-nuit hover:bg-bleu-nuit hover:text-white transition-all duration-200 hover:scale-105">
              Consultation Gratuite
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
