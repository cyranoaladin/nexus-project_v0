"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Zap, Clock, ShieldAlert } from "lucide-react";

interface CoachAlert {
  id: string;
  studentName: string;
  message: string;
  type: 'DIAGNOSTIC_FAIL' | 'ABSENCE' | 'STAGNATION' | 'CREDIT_LOW';
  priority: 'HIGH' | 'MEDIUM';
}

interface PriorityAlertsProps {
  alerts: CoachAlert[];
}

export function PriorityAlerts({ alerts }: PriorityAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <Card className="bg-surface-card border-white/10 shadow-premium">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Alertes Prioritaires
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className={`p-3 rounded-lg border flex gap-3 ${
              alert.priority === 'HIGH' 
                ? 'bg-rose-500/10 border-rose-500/20' 
                : 'bg-amber-500/10 border-amber-500/20'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {alert.type === 'DIAGNOSTIC_FAIL' && <Zap className="w-4 h-4 text-rose-400" />}
              {alert.type === 'ABSENCE' && <Clock className="w-4 h-4 text-amber-400" />}
              {alert.type === 'STAGNATION' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-white">{alert.studentName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                  alert.priority === 'HIGH' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {alert.priority}
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-tight">{alert.message}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
