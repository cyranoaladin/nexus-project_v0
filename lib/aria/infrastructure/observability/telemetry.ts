import { logger } from '@/lib/middleware/logger';
import type {
  AriaConversationTelemetryEvent,
  AriaConversationTelemetrySink,
} from '../../domain/observability/telemetry';

export const ariaConversationTelemetrySink: AriaConversationTelemetrySink = Object.freeze({
  record(event: AriaConversationTelemetryEvent) {
    logger.info({ ariaConversation: event }, 'ARIA conversation lifecycle');
  },
});
