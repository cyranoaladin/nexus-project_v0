import { EventEmitter, getEventEmitter } from './emitter';
import type { Event, CommitEvent, FileChangeEvent } from './types';
import { createMockCommitEvent, createMockFileChangeEvent } from '../../tests/helpers/mock-factories';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

jest.mock('../utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  afterEach(() => {
    emitter.stopProcessing();
    emitter.removeAllListeners();
  });

  describe('emit', () => {
    it('should emit an event with id and timestamp', () => {
      const listener = jest.fn();
      emitter.on('commit', listener);

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as CommitEvent;
      expect(event).toMatchObject({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
      });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should add event to queue', () => {
      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      const queue = emitter.getQueue();
      expect(queue.events).toHaveLength(1);
      expect(queue.events[0].type).toBe('commit');
    });

    it('should emit to both generic and specific event listeners', () => {
      const genericListener = jest.fn();
      const specificListener = jest.fn();

      emitter.on('event', genericListener);
      emitter.on('commit', specificListener);

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      expect(genericListener).toHaveBeenCalledTimes(1);
      expect(specificListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('on and off', () => {
    it('should register and call event listener', () => {
      const listener = jest.fn();
      emitter.on('commit', listener);

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should remove event listener', () => {
      const listener = jest.fn();
      emitter.on('commit', listener);
      emitter.off('commit', listener);

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on('commit', listener1);
      emitter.on('commit', listener2);

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('once', () => {
    it('should call listener only once', () => {
      const listener = jest.fn();
      emitter.once('commit', listener);

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'def456',
        commit_message: 'Another commit',
        author: 'Test User',
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('queue management', () => {
    it('should return queue size', () => {
      expect(emitter.getQueueSize()).toBe(0);

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      expect(emitter.getQueueSize()).toBe(1);
    });

    it('should clear queue', () => {
      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      expect(emitter.getQueueSize()).toBe(1);
      emitter.clearQueue();
      expect(emitter.getQueueSize()).toBe(0);
    });
  });

  describe('getEvents', () => {
    beforeEach(() => {
      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree1',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'file_change' as const,
        source: 'watcher',
        worktree: '/path/to/worktree2',
        branch: 'feature/test',
        files_changed: ['file1.ts'],
        change_type: 'modified',
      });
    });

    it('should return all events without filter', () => {
      const events = emitter.getEvents();
      expect(events).toHaveLength(2);
    });

    it('should filter events by type', () => {
      const events = emitter.getEvents({ type: 'commit' as const });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('commit');
    });

    it('should filter events by source', () => {
      const events = emitter.getEvents({ source: 'watcher' });
      expect(events).toHaveLength(1);
      expect(events[0].source).toBe('watcher');
    });

    it('should filter events by timestamp', () => {
      const cutoff = new Date(Date.now() - 1000);
      const events = emitter.getEvents({ since: cutoff });
      expect(events).toHaveLength(2);
    });
  });

  describe('processing', () => {
    it('should process events from queue', async () => {
      const processedEvents: Event[] = [];
      const processor = jest.fn(async (event: Event) => {
        processedEvents.push(event);
      });

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      emitter.startProcessing(processor, { intervalMs: 100 });

      await new Promise(resolve => setTimeout(resolve, 250));

      expect(processor).toHaveBeenCalledTimes(1);
      expect(processedEvents).toHaveLength(1);
      expect(emitter.getQueueSize()).toBe(0);

      emitter.stopProcessing();
    });

    it('should handle processing errors', async () => {
      const processor = jest.fn(async () => {
        throw new Error('Processing error');
      });

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      emitter.startProcessing(processor, { intervalMs: 100 });

      await new Promise(resolve => setTimeout(resolve, 250));

      expect(processor).toHaveBeenCalled();

      emitter.stopProcessing();
    });

    it('should respect max batch size', async () => {
      const processor = jest.fn(async () => {});

      for (let i = 0; i < 15; i++) {
        // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
        emitter.emit({
          type: 'commit' as const,
          source: 'test',
          worktree: '/path/to/worktree',
          branch: 'feature/test',
          commit_hash: `abc${i}`,
          commit_message: `Test commit ${i}`,
          author: 'Test User',
        });
      }

      expect(emitter.getQueueSize()).toBe(15);

      emitter.startProcessing(processor, { intervalMs: 100, maxBatchSize: 5 });

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(processor).toHaveBeenCalledTimes(5);
      expect(emitter.getQueueSize()).toBe(10);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(processor).toHaveBeenCalledTimes(10);
      expect(emitter.getQueueSize()).toBe(5);

      emitter.stopProcessing();
    });

    it('should not start processing if already started', () => {
      const processor = jest.fn(async () => {});
      
      emitter.startProcessing(processor);
      emitter.startProcessing(processor);

      expect(emitter.isProcessing()).toBe(false);
      
      emitter.stopProcessing();
    });

    it('should stop processing', () => {
      const processor = jest.fn(async () => {});
      
      emitter.startProcessing(processor);
      emitter.stopProcessing();

      expect(emitter.isProcessing()).toBe(false);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for specific event type', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      emitter.on('commit', listener1);
      emitter.on('commit', listener2);
      emitter.on('file_change', listener3);

      emitter.removeAllListeners('commit');

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'file_change' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        files_changed: ['file1.ts'],
        change_type: 'modified',
      });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });

    it('should remove all listeners for all events', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on('commit', listener1);
      emitter.on('file_change', listener2);

      emitter.removeAllListeners();

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'commit' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        commit_hash: 'abc123',
        commit_message: 'Test commit',
        author: 'Test User',
      });

      // @ts-expect-error - EventEmitter.emit type narrowing issue with Omit<Event>
      emitter.emit({
        type: 'file_change' as const,
        source: 'test',
        worktree: '/path/to/worktree',
        branch: 'feature/test',
        files_changed: ['file1.ts'],
        change_type: 'modified',
      });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('getEventEmitter singleton', () => {
    it('should return same instance', () => {
      const emitter1 = getEventEmitter();
      const emitter2 = getEventEmitter();
      expect(emitter1).toBe(emitter2);
    });
  });
});
