'use client';

import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Badge } from './badge';

interface ExpertProfileProps {
  pseudonyme: string;
  titre: string;
  citation: string;
  specialites: string[];
  avatar?: string;
  className?: string;
}

export function ExpertProfile({
  pseudonyme,
  titre,
  citation,
  specialites,
  avatar,
  className = ""
}: ExpertProfileProps) {
  return (
    <motion.div
      className={`bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-200 p-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <div className="flex items-start space-x-3">
        <Avatar className="w-12 h-12 border-2 border-blue-200">
          <AvatarImage src={avatar} alt={pseudonyme} />
          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold">
            {pseudonyme.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h4 className="font-bold text-bleu-nuit text-sm">
              {pseudonyme}
            </h4>
            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
              Expert
            </Badge>
          </div>

          <p className="text-xs text-gris-noble mb-2">
            {titre}
          </p>

          <blockquote className="text-xs text-blue-800 italic mb-3 border-l-2 border-blue-300 pl-2">
            "{citation}"
          </blockquote>

          <div className="space-y-1">
            {specialites.map((specialite, index) => (
              <div key={index} className="flex items-center space-x-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                <span className="text-xs text-gris-noble">
                  {specialite}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
