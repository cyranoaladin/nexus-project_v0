"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { Award, Sparkles } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface BadgeData {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string | null;
  earnedAt: Date;
  isRecent: boolean;
}

interface BadgeDisplayProps {
  badges: BadgeData[];
}

const BADGE_CATEGORIES = {
  ASSIDUITE: "Assiduité",
  PROGRESSION: "Progression",
  CURIOSITE: "Curiosité"
} as const;

const categoryColors = {
  ASSIDUITE: "bg-blue-50 border-blue-200 text-blue-700",
  PROGRESSION: "bg-green-50 border-green-200 text-green-700",
  CURIOSITE: "bg-purple-50 border-purple-200 text-purple-700"
} as const;

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");

  const filteredBadges = React.useMemo(() => {
    if (selectedCategory === "all") return badges;
    return badges.filter(badge => badge.category === selectedCategory);
  }, [badges, selectedCategory]);

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: badges.length,
      ASSIDUITE: 0,
      PROGRESSION: 0,
      CURIOSITE: 0
    };
    badges.forEach(badge => {
      if (badge.category in counts) {
        counts[badge.category]++;
      }
    });
    return counts;
  }, [badges]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-brand-primary" />
          Badges Obtenus
        </CardTitle>
        <CardDescription>
          Les récompenses gagnées par votre enfant
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6" aria-label="Filtrer les badges par catégorie">
            <TabsTrigger value="all" className="text-xs sm:text-sm" aria-label={`Tous les badges, ${categoryCounts.all} badges`}>
              Tous ({categoryCounts.all})
            </TabsTrigger>
            <TabsTrigger value="ASSIDUITE" className="text-xs sm:text-sm" aria-label={`Badges d'assiduité, ${categoryCounts.ASSIDUITE} badges`}>
              {BADGE_CATEGORIES.ASSIDUITE} ({categoryCounts.ASSIDUITE})
            </TabsTrigger>
            <TabsTrigger value="PROGRESSION" className="text-xs sm:text-sm" aria-label={`Badges de progression, ${categoryCounts.PROGRESSION} badges`}>
              {BADGE_CATEGORIES.PROGRESSION} ({categoryCounts.PROGRESSION})
            </TabsTrigger>
            <TabsTrigger value="CURIOSITE" className="text-xs sm:text-sm" aria-label={`Badges de curiosité, ${categoryCounts.CURIOSITE} badges`}>
              {BADGE_CATEGORIES.CURIOSITE} ({categoryCounts.CURIOSITE})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-0">
            {filteredBadges.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
                  <Award className="w-8 h-8 text-neutral-400" />
                </div>
                <p className="text-neutral-600 font-medium mb-1">
                  Aucun badge gagné pour le moment
                </p>
                <p className="text-sm text-neutral-500">
                  Les badges apparaîtront au fur et à mesure des progrès
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredBadges.map((badge, index) => (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ 
                        duration: 0.3,
                        delay: index * 0.05,
                        ease: "easeOut"
                      }}
                    >
                      <div
                        className={`relative p-4 rounded-lg border-2 transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                          categoryColors[badge.category as keyof typeof categoryColors] || "bg-neutral-50 border-neutral-200"
                        }`}
                      >
                        {badge.isRecent && (
                          <div className="absolute -top-2 -right-2 z-10">
                            <Badge className="bg-brand-primary text-white text-xs px-2 py-0.5 flex items-center gap-1 shadow-md">
                              <Sparkles className="w-3 h-3" />
                              Nouveau
                            </Badge>
                          </div>
                        )}
                        
                        <div className="text-center">
                          <div className="text-4xl mb-3" role="img" aria-label={badge.name}>
                            {badge.icon || "🏆"}
                          </div>
                          <h4 className="font-semibold text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                            {badge.name}
                          </h4>
                          <p className="text-xs text-neutral-600 mb-2 line-clamp-2">
                            {badge.description}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {formatDate(new Date(badge.earnedAt))}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
