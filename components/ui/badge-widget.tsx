"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Award, Medal, Star, Trophy, Zap } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

interface UserBadge {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  unlockedAt: Date;
  isNew?: boolean;
}

interface BadgeWidgetProps {
  studentId: string;
  className?: string;
}

// Icônes par catégorie de badge
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'ASSIDUITE':
      return <Zap className="w-4 h-4" />;
    case 'PROGRESSION':
      return <Trophy className="w-4 h-4" />;
    case 'ARIA':
      return <Star className="w-4 h-4" />;
    default:
      return <Award className="w-4 h-4" />;
  }
};

// Couleurs par catégorie
const getCategoryColor = (category: string) => {
  switch (category) {
    case 'ASSIDUITE':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'PROGRESSION':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'ARIA':
      return 'text-purple-600 bg-purple-50 border-purple-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export function BadgeWidget({ studentId, className = "" }: BadgeWidgetProps) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const loadBadges = useCallback(async () => {
    try {
      const response = await fetch(`/api/students/${studentId}/badges`);
      if (response.ok) {
        const data = await response.json();
        setBadges(data.badges || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des badges:', error);
      // Données de démonstration en cas d'erreur
      setBadges([
        {
          id: '1',
          name: 'Premiers Pas',
          description: 'Première connexion à la plateforme',
          category: 'ASSIDUITE',
          icon: '👋',
          unlockedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        },
        {
          id: '2',
          name: 'Dialogue avec le Futur',
          description: 'Première question posée à ARIA',
          category: 'ARIA',
          icon: '🤖',
          unlockedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          id: '3',
          name: 'Série en Cours',
          description: 'Connexion 3 jours d\'affilée',
          category: 'ASSIDUITE',
          icon: '📈',
          unlockedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          isNew: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  const recentBadges = badges.slice(0, 3);
  const displayBadges = showAll ? badges : recentBadges;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span>Mes Badges</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span>Mes Badges</span>
            <Badge variant="outline" className="ml-2">
              {badges.length}
            </Badge>
          </div>
          {badges.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-xs"
            >
              {showAll ? 'Réduire' : 'Voir tout'}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {badges.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Medal className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun badge débloqué pour le moment</p>
            <p className="text-xs mt-1">Continuez vos efforts pour débloquer vos premiers badges !</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {displayBadges.map((badge, index) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${getCategoryColor(badge.category)} relative`}
                >
                  {badge.isNew && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1"
                    >
                      <Badge className="bg-red-500 text-white text-xs px-1.5 py-0.5">
                        Nouveau !
                      </Badge>
                    </motion.div>
                  )}

                  <div className="text-2xl">{badge.icon}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-sm truncate">{badge.name}</h4>
                      {getCategoryIcon(badge.category)}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {badge.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Débloqué le {badge.unlockedAt.toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {badges.length > 3 && !showAll && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll(true)}
                  className="text-xs"
                >
                  Voir {badges.length - 3} badge(s) de plus
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
