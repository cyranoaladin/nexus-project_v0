"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, AlertTriangle, ArrowRight, User } from "lucide-react";
import Link from "next/link";

interface ChildCardProps {
  child: {
    id: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    academicTrack: string;
    nexusIndex?: number;
    nextSession?: {
      subject: string;
      scheduledAt: string;
    } | null;
    alerts?: string[];
    lastBilanDate?: string | null;
  };
}

export function ChildCard({ child }: ChildCardProps) {
  const hasAlerts = child.alerts && child.alerts.length > 0;

  return (
    <Card className="bg-surface-card border-white/10 hover:border-brand-accent/40 transition-all group overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent">
              <User className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">{child.firstName}</CardTitle>
              <p className="text-xs text-neutral-400">
                {child.gradeLevel} • {child.academicTrack.replace('_', ' ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">NexusIndex</p>
            <p className={`text-xl font-bold ${child.nexusIndex ? 'text-brand-accent' : 'text-neutral-600'}`}>
              {child.nexusIndex ?? '--'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alerts */}
        {hasAlerts && (
          <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-xs text-rose-200 truncate">{child.alerts![0]}</span>
          </div>
        )}

        {/* Prochaine Session */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-accent" />
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-500 uppercase font-bold">Prochaine séance</span>
              <span className="text-xs text-white truncate max-w-[120px]">
                {child.nextSession?.subject ?? 'Aucune programmée'}
              </span>
            </div>
          </div>
          {child.nextSession && (
            <span className="text-[10px] text-neutral-400">
              {new Date(child.nextSession.scheduledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>

        {/* Action Button */}
        <Link href={`/dashboard/parent/enfant/${child.id}`} className="block w-full">
          <Button variant="outline" className="w-full border-white/10 hover:bg-brand-accent hover:text-white group">
            Voir la progression
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
