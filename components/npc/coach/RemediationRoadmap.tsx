// ═══════════════════════════════════════════════════════════════════════════════
// Remediation Roadmap Component
// Step-by-step learning path visualization
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Map,
  Clock,
  ChevronRight,
  BookOpen,
  Video,
  FileText,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';
import { useState } from 'react';

interface Resource {
  type: 'document' | 'exercise' | 'video' | 'external' | 'session';
  title: string;
  url?: string;
}

interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  order: number;
  type: 'knowledge_gap' | 'skill_practice' | 'method_learning' | 'deep_dive' | 'consolidation';
  estimatedDuration: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  resources: Resource[];
  targetCompetences: string[];
  completed?: boolean;
}

interface RemediationRoadmapProps {
  roadmap: {
    title: string;
    description: string;
    estimatedTotalDuration: string;
    recommendedPace: 'intensive' | 'regular' | 'relaxed';
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  };
  tasks: RoadmapTask[];
}

const typeConfig: Record<string, { label: string; color: string; icon: typeof BookOpen }> = {
  knowledge_gap: { label: 'Bases', color: 'bg-yellow-100 text-yellow-800', icon: BookOpen },
  skill_practice: { label: 'Pratique', color: 'bg-blue-100 text-blue-800', icon: FileText },
  method_learning: { label: 'Méthode', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
  deep_dive: { label: 'Approfondi', color: 'bg-indigo-100 text-indigo-800', icon: Map },
  consolidation: { label: 'Révision', color: 'bg-green-100 text-green-800', icon: CheckCircle },
};

const paceConfig: Record<string, string> = {
  intensive: 'Intensif',
  regular: 'Régulier',
  relaxed: 'Relaxé',
};

const difficultyConfig: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Débutant', color: 'bg-green-100 text-green-800' },
  intermediate: { label: 'Intermédiaire', color: 'bg-blue-100 text-blue-800' },
  advanced: { label: 'Avancé', color: 'bg-purple-100 text-purple-800' },
};

export function RemediationRoadmap({ roadmap, tasks }: RemediationRoadmapProps) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const handleToggleComplete = (taskId: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const completedCount = completedTasks.size;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'external': return <ExternalLink className="h-4 w-4" />;
      case 'session': return <Clock className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Roadmap Overview */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50">
        <CardContent className="py-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{roadmap.title}</h3>
              <p className="text-gray-600 mt-2 max-w-xl">{roadmap.description}</p>
              <div className="flex gap-2 mt-4">
                <Badge className={difficultyConfig[roadmap.difficultyLevel].color}>
                  {difficultyConfig[roadmap.difficultyLevel].label}
                </Badge>
                <Badge variant="outline">{paceConfig[roadmap.recommendedPace]}</Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Durée totale</div>
              <div className="text-xl font-semibold text-gray-900">
                {roadmap.estimatedTotalDuration}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Progression</span>
              <span className="text-sm font-medium">
                {completedCount}/{tasks.length} tâches
              </span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Tasks Timeline */}
      <div className="space-y-4">
        {tasks
          .sort((a, b) => a.order - b.order)
          .map((task, index) => {
            const type = typeConfig[task.type];
            const TypeIcon = type.icon;
            const isExpanded = expandedTask === task.id;
            const isCompleted = completedTasks.has(task.id);

            return (
              <Card
                key={task.id}
                className={`transition-all ${isCompleted ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start p-4">
                  {/* Task Number */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-medium mr-4">
                    {index + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className={`font-semibold ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${type.color} text-xs`}>
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {type.label}
                          </Badge>
                          <span className="text-xs text-gray-500 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {task.estimatedDuration}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant={isCompleted ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleComplete(task.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {isCompleted ? 'Terminé' : 'Marquer fait'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        >
                          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-gray-600 mb-4">{task.description}</p>

                        {/* Target Competences */}
                        {task.targetCompetences.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                              Compétences visées :
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {task.targetCompetences.map((comp, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {comp}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Resources */}
                        {task.resources.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-2">
                              Ressources :
                            </p>
                            <div className="space-y-2">
                              {task.resources.map((resource, i) => (
                                <a
                                  key={i}
                                  href={resource.url || '#'}
                                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                                >
                                  {getResourceIcon(resource.type)}
                                  {resource.title}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
