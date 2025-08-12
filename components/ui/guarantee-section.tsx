'use client';

import { motion } from 'framer-motion';
import { Award, CheckCircle, Clock, Shield, Users } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent } from './card';

const guarantees = [
  {
    icon: Shield,
    title: "Garantie de Réussite",
    description: "Si vous n'obtenez pas votre Bac, nous vous remboursons 100% de votre investissement.",
    color: "from-green-600 to-emerald-500"
  },
  {
    icon: Award,
    title: "Mention Garantie",
    description: "Avec nos programmes Odyssée, nous garantissons une mention ou nous vous accompagnons gratuitement l'année suivante.",
    color: "from-amber-600 to-yellow-500"
  },
  {
    icon: Clock,
    title: "Support 24/7",
    description: "Notre équipe est disponible 24h/24 et 7j/7 pour répondre à toutes vos questions.",
    color: "from-blue-600 to-cyan-500"
  },
  {
    icon: Users,
    title: "Suivi Personnalisé",
    description: "Chaque élève bénéficie d'un coach dédié qui l'accompagne tout au long de son parcours.",
    color: "from-purple-600 to-pink-500"
  }
];

const stats = [
  { value: "98%", label: "Taux de réussite" },
  { value: "500+", label: "Élèves accompagnés" },
  { value: "4.9/5", label: "Note moyenne" },
  { value: "100%", label: "Satisfaction client" }
];

export function GuaranteeSection() {
  return (
    <section className="py-20 bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <Badge variant="outline" className="mb-4 bg-amber-50 text-amber-700 border-amber-200">
            <Shield className="w-4 h-4 mr-2" />
            Nos Garanties
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
            Votre Réussite, Notre Engagement
          </h2>
          <p className="text-lg text-gris-noble max-w-3xl mx-auto">
            Nous ne nous contentons pas de promesses, nous vous donnons des garanties concrètes. Votre réussite est notre priorité absolue.
          </p>
        </motion.div>

        {/* Statistiques */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="text-4xl font-black text-bleu-nuit mb-2">
                {stat.value}
              </div>
              <div className="text-gris-noble">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Garanties */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {guarantees.map((guarantee, index) => (
            <motion.div
              key={guarantee.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-0 shadow-strong hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${guarantee.color} flex items-center justify-center flex-shrink-0`}>
                      <guarantee.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-bleu-nuit mb-2">
                        {guarantee.title}
                      </h3>
                      <p className="text-gris-noble leading-relaxed">
                        {guarantee.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Sceau de Garantie */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-4 bg-white rounded-full px-8 py-4 shadow-lg border border-or-stellaire">
            <div className="w-24 h-24 flex items-center justify-center">
              <img
                src="/images/BlasonConfiance_SceauGarantie.png"
                alt="Sceau de Garantie Nexus"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-bleu-nuit">
                Sceau de Garantie Nexus
              </h3>
              <p className="text-gris-noble">
                Notre engagement total pour votre réussite
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <p className="text-lg text-gris-noble mb-6">
            Prêt à transformer votre potentiel en excellence avec nos garanties ?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-200 hover:scale-105">
              <CheckCircle className="w-5 h-5 mr-2" />
              Commencer Maintenant
            </Button>
            <Button variant="outline" className="border-bleu-nuit text-bleu-nuit hover:bg-bleu-nuit hover:text-white transition-all duration-200 hover:scale-105">
              En savoir plus
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
