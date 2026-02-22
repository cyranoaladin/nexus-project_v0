'use client';

import { motion } from 'framer-motion';
import { Award, Quote, Star, TrendingUp, Users } from 'lucide-react';
import { Badge } from './badge';
import { Card, CardContent } from './card';

const testimonials = [
  {
    name: "Sarah Ben Ali",
    role: "Élève de Terminale",
    program: "Odyssée Terminale",
    content: "Grâce à Nexus Réussite, j'ai obtenu une mention Très Bien avec 18/20 en Maths et 17/20 en Physique. Le suivi personnalisé et l'IA ARIA ont fait toute la différence.",
    rating: 5,
    achievement: "Mention Très Bien"
  },
  {
    name: "Ahmed Mansouri",
    role: "Candidat Libre",
    program: "Odyssée Individuel",
    content: "En tant que candidat libre, j'étais perdu. Nexus Réussite m'a accompagné à chaque étape, de l'inscription jusqu'aux épreuves. Résultat : Bac obtenu avec mention Bien !",
    rating: 5,
    achievement: "Bac Mention Bien"
  },
  {
    name: "Léa Dubois",
    role: "Élève de Première",
    program: "Académie de la Toussaint",
    content: "L'Académie de la Toussaint m'a permis de maîtriser les méthodes de dissertation. Mes notes ont progressé de 3 points en moyenne. Je recommande !",
    rating: 5,
    achievement: "+3 points en moyenne"
  },
  {
    name: "Youssef Khelifi",
    role: "Parent d'élève",
    program: "ARIA+ Premium",
    content: "L'IA ARIA est révolutionnaire. Mon fils peut réviser 24/7 et obtenir des explications instantanées. Son niveau en Maths a considérablement progressé.",
    rating: 5,
    achievement: "Progression significative"
  }
];

const stats = [
  { icon: Users, value: "500+", label: "Élèves accompagnés" },
  { icon: Award, value: "98%", label: "Taux de réussite" },
  { icon: Star, value: "4.9/5", label: "Note moyenne" },
  { icon: TrendingUp, value: "+15%", label: "Progression moyenne" }
];

export function TestimonialsSection() {
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
          <Badge variant="outline" className="mb-4 bg-green-50 text-green-700 border-green-200">
            <Star className="w-4 h-4 mr-2" />
            Témoignages de Réussite
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
            Ils Ont Transformé Leur Potentiel en Excellence
          </h2>
          <p className="text-lg text-gris-noble max-w-3xl mx-auto">
            Découvrez les parcours inspirants de nos élèves qui ont atteint leurs objectifs grâce à nos programmes personnalisés.
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
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-or-stellaire to-or-stellaire-dark flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-8 h-8 text-bleu-nuit" />
              </div>
              <div className="text-3xl font-black text-bleu-nuit mb-2">
                {stat.value}
              </div>
              <div className="text-gris-noble">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Témoignages */}
        <div className="grid md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-0 shadow-strong hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <Quote className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 text-blue-300 fill-current" />
                          ))}
                        </div>
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          {testimonial.achievement}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-bleu-nuit">
                        {testimonial.name}
                      </h4>
                      <p className="text-sm text-gris-noble">
                        {testimonial.role} • {testimonial.program}
                      </p>
                    </div>
                  </div>
                  <blockquote className="text-gris-noble leading-relaxed">
                    "{testimonial.content}"
                  </blockquote>
                </CardContent>
              </Card>
            </motion.div>
          ))}
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
            Rejoignez nos élèves qui ont déjà transformé leur potentiel en excellence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Badge className="bg-or-stellaire text-bleu-nuit font-bold text-lg px-6 py-3">
              <Award className="w-5 h-5 mr-2" />
              98% de Taux de Réussite
            </Badge>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
