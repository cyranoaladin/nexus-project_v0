'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Award, Medal, Star, Trophy, Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { toast } from 'sonner';

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
  defaultShowAll?: boolean;
  filterCategory?: string; // 'ALL' | 'ASSIDUITE' | 'PROGRESSION' | 'ARIA' | 'CURIOSITE'
  initialBadges?: any[]; // optional, to avoid fetching when badges are already available
}

const canonicalCategory = (category: string) => {
  const c = String(category || '').toUpperCase();
  if (c === 'CURIOSITE') return 'ARIA';
  return c;
};

const formatCategoryLabel = (category: string) => {
  const c = canonicalCategory(category);
  switch (c) {
    case 'ASSIDUITE':
      return 'Assiduité';
    case 'PROGRESSION':
      return 'Progression';
    case 'ARIA':
      return 'Curiosité';
    default:
      return c.charAt(0) + c.slice(1).toLowerCase();
  }
};

// Icônes par catégorie de badge
const getCategoryIcon = (category: string) => {
  switch (canonicalCategory(category)) {
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
  switch (canonicalCategory(category)) {
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

export function BadgeWidget({ studentId, className = '', defaultShowAll = false, filterCategory, initialBadges }: BadgeWidgetProps) {
  const normalizeBadges = (input: any): UserBadge[] => {
    const arr = Array.isArray(input) ? input : input?.badges;
    if (!Array.isArray(arr)) return [];
    return arr.map((b: any) => ({
      id: String(b.id ?? b.badgeId ?? Math.random()),
      name: String(b.name ?? b.badge?.name ?? ''),
      description: String(b.description ?? b.badge?.description ?? ''),
      category: String(b.category ?? b.badge?.category ?? 'ASSIDUITE'),
      icon: String(b.icon ?? b.badge?.icon ?? '🏅'),
      unlockedAt: b.unlockedAt ? new Date(b.unlockedAt) : (b.earnedAt ? new Date(b.earnedAt) : new Date()),
      isNew: !!b.isNew,
    }));
  };
  const initialNormalized = Array.isArray(initialBadges) ? normalizeBadges(initialBadges) : [];
  const [badges, setBadges] = useState<UserBadge[]>(initialNormalized);
  const [loading, setLoading] = useState(!Array.isArray(initialBadges));
  const [showAll, setShowAll] = useState(!!defaultShowAll);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(Array.isArray(initialBadges) ? new Date() : null);
  const lastClickRef = useRef<number>(0);


  const loadBadges = useCallback(async (manual: boolean = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/students/${studentId}/badges`);
      if (response.ok) {
        const data = await response.json();
        setBadges(normalizeBadges(data));
        setUpdatedAt(new Date());
        if (manual) toast.success('Badges mis à jour', { duration: 1200, icon: <CheckCircle className="w-4 h-4 text-green-600" /> });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des badges:', error);
      if (manual) toast.error('Échec de l’actualisation des badges', { description: 'Réessayez dans un instant.', duration: 2500, icon: <AlertCircle className="w-4 h-4 text-red-600" /> });
      // Données de démonstration en cas d'erreur
      setBadges([
        {
          id: '1',
          name: 'Premiers Pas',
          description: 'Première connexion à la plateforme',
          category: 'ASSIDUITE',
          icon: '👋',
          unlockedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          id: '2',
          name: 'Dialogue avec le Futur',
          description: 'Première question posée à ARIA',
          category: 'ARIA',
          icon: '🤖',
          unlockedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: '3',
          name: 'Série en Cours',
          description: "Connexion 3 jours d'affilée",
          category: 'ASSIDUITE',
          icon: '📈',
          unlockedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          isNew: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (!Array.isArray(initialBadges)) {
      loadBadges(false);
    }
  }, [loadBadges, initialBadges]);

  const filterNorm = (filterCategory ? canonicalCategory(filterCategory) : 'ALL') as string;
  const baseBadges = filterNorm === 'ALL' ? badges : badges.filter((b) => canonicalCategory(b.category) === filterNorm);
  const recentBadges = baseBadges.slice(0, 3);
  const displayBadges = showAll ? baseBadges : recentBadges;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span>Mes Badges</span>
            </div>
            <Loader2 aria-hidden className="w-4 h-4 animate-spin text-gray-400" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4" />
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
          <div className="flex items-center gap-2">
            {updatedAt && (
              <span
                className="text-[10px] md:text-xs text-gray-400"
                title={`Dernière mise à jour le ${updatedAt.toLocaleDateString('fr-FR')} à ${updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
              >
                MAJ {updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { const now = Date.now(); if (now - lastClickRef.current < 600) return; lastClickRef.current = now; loadBadges(true); }}
              disabled={loading}
              className="text-xs"
            >
              Actualiser
            </Button>
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
            <Link href="/dashboard/eleve/badges" className="text-xs text-blue-600 hover:underline">
              Page complète
            </Link>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {badges.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Medal className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun badge débloqué pour le moment</p>
            <p className="text-xs mt-1">
              Continuez vos efforts pour débloquer vos premiers badges !
            </p>
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
                      <Link href={`/dashboard/eleve/badges?cat=${canonicalCategory(badge.category)}`}>
                        <Badge
                          variant="outline"
                          className={
                            canonicalCategory(badge.category) === 'ASSIDUITE'
                              ? 'border-blue-600 text-blue-600 uppercase tracking-wide'
                              : canonicalCategory(badge.category) === 'PROGRESSION'
                              ? 'border-green-600 text-green-600 uppercase tracking-wide'
                              : canonicalCategory(badge.category) === 'ARIA'
                              ? 'border-purple-600 text-purple-600 uppercase tracking-wide'
                              : 'border-gray-600 text-gray-600 uppercase tracking-wide'
                          }
                        >
                          {formatCategoryLabel(badge.category)}
                        </Badge>
                      </Link>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{badge.description}</p>
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
