"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, Info, Bell } from "lucide-react";

interface Alert {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  studentName: string;
  date: string;
}

interface AlertsConsolidatedProps {
  alerts: Alert[];
}

export function AlertsConsolidated({ alerts }: AlertsConsolidatedProps) {
  if (alerts.length === 0) return null;

  return (
    <Card className="bg-surface-card border-white/10 shadow-premium">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-brand-accent" />
          Alertes & Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className={`p-3 rounded-lg border flex gap-3 ${
              alert.type === 'CRITICAL' 
                ? 'bg-error/10 border-error/20' 
                : alert.type === 'WARNING'
                ? 'bg-warning/10 border-warning/20'
                : 'bg-info/10 border-info/20'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {alert.type === 'CRITICAL' && <AlertCircle className="w-4 h-4 text-error" />}
              {alert.type === 'WARNING' && <AlertTriangle className="w-4 h-4 text-warning" />}
              {alert.type === 'INFO' && <Info className="w-4 h-4 text-info" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-white mb-0.5">{alert.studentName}</p>
              <p className="text-xs text-neutral-300 leading-relaxed">{alert.message}</p>
              <p className="text-[10px] text-neutral-500 mt-1">
                {new Date(alert.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
