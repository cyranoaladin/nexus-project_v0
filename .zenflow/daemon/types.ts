export interface DaemonConfig {
  eventProcessingInterval: number;
  maxBatchSize: number;
  healthCheckPort: number;
  schedulerEnabled: boolean;
}

export interface ScheduledTask {
  id: string;
  name: string;
  workflow: string;
  cron: string;
  inputs?: Record<string, unknown>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  components: {
    eventQueue: {
      status: 'ok' | 'warning' | 'error';
      size: number;
    };
    ruleEngine: {
      status: 'ok' | 'error';
      rulesLoaded: number;
    };
    scheduler: {
      status: 'ok' | 'error';
      tasksScheduled: number;
    };
  };
  message?: string;
}
