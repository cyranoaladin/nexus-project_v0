import { EventEmitter as NodeEventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../utils/logger';
import type { Event, EventQueue, BaseEvent } from './types';

export class EventEmitter {
  private emitter: NodeEventEmitter;
  private queue: EventQueue;
  private logger = getLogger();
  private processingInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Array<(event: Event) => void | Promise<void>>>;

  constructor() {
    this.emitter = new NodeEventEmitter();
    this.queue = {
      events: [],
      processing: false,
    };
    this.listeners = new Map();
    this.logger.debug('EventEmitter initialized');
  }

  emit(event: Omit<Event, 'id' | 'timestamp'>): void {
    const fullEvent: Event = {
      ...event,
      id: uuidv4(),
      timestamp: new Date(),
    } as Event;

    this.logger.info('Event emitted', {
      id: fullEvent.id,
      type: fullEvent.type,
      source: fullEvent.source,
    });

    this.queue.events.push(fullEvent);
    this.emitter.emit('event', fullEvent);
    this.emitter.emit(fullEvent.type, fullEvent);
  }

  on(eventType: string, listener: (event: Event) => void | Promise<void>): void {
    this.logger.debug('Registering event listener', { eventType });
    
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)?.push(listener);
    this.emitter.on(eventType, listener);
  }

  once(eventType: string, listener: (event: Event) => void | Promise<void>): void {
    this.logger.debug('Registering one-time event listener', { eventType });
    this.emitter.once(eventType, listener);
  }

  off(eventType: string, listener: (event: Event) => void | Promise<void>): void {
    this.logger.debug('Removing event listener', { eventType });
    
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    
    this.emitter.off(eventType, listener);
  }

  getQueue(): EventQueue {
    return { ...this.queue };
  }

  getQueueSize(): number {
    return this.queue.events.length;
  }

  getEvents(filter?: { type?: Event['type']; source?: string; since?: Date }): Event[] {
    let events = [...this.queue.events];

    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.source) {
        events = events.filter(e => e.source === filter.source);
      }
      if (filter.since) {
        events = events.filter(e => e.timestamp >= filter.since!);
      }
    }

    return events;
  }

  clearQueue(): void {
    const clearedCount = this.queue.events.length;
    this.queue.events = [];
    this.logger.debug('Event queue cleared', { clearedCount });
  }

  startProcessing(
    processor: (event: Event) => Promise<void>,
    options: { intervalMs?: number; maxBatchSize?: number } = {}
  ): void {
    const { intervalMs = 1000, maxBatchSize = 10 } = options;

    if (this.processingInterval) {
      this.logger.warn('Event processing already started');
      return;
    }

    this.logger.info('Starting event processing', { intervalMs, maxBatchSize });

    this.processingInterval = setInterval(async () => {
      if (this.queue.processing || this.queue.events.length === 0) {
        return;
      }

      this.queue.processing = true;
      const batch = this.queue.events.splice(0, maxBatchSize);

      this.logger.debug('Processing event batch', {
        batchSize: batch.length,
        remainingInQueue: this.queue.events.length,
      });

      for (const event of batch) {
        try {
          await processor(event);
          this.logger.debug('Event processed successfully', {
            id: event.id,
            type: event.type,
          });
        } catch (error) {
          this.logger.error('Error processing event', {
            id: event.id,
            type: event.type,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.queue.processing = false;
    }, intervalMs);
  }

  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      this.logger.info('Event processing stopped');
    }
  }

  isProcessing(): boolean {
    return this.queue.processing;
  }

  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
      this.emitter.removeAllListeners(eventType);
      this.logger.debug('Removed all listeners for event type', { eventType });
    } else {
      this.listeners.clear();
      this.emitter.removeAllListeners();
      this.logger.debug('Removed all listeners');
    }
  }
}

let globalEmitter: EventEmitter | null = null;

export function getEventEmitter(): EventEmitter {
  if (!globalEmitter) {
    globalEmitter = new EventEmitter();
  }
  return globalEmitter;
}
