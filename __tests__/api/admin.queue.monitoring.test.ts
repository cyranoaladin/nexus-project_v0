/** @jest-environment node */
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/queue', () => ({ connection: {} }));

jest.mock('bullmq', () => ({
  Queue: class {
    constructor() {}
    async getActive() { return []; }
    async getWaiting() { return []; }
    async getFailed() { return []; }
    async getCompleted() { return []; }
    async getDelayed() { return []; }
    async getJobCounts() { return { active: 0, waiting: 0, failed: 0, completed: 0, delayed: 0 }; }
  }
}));

describe('GET /api/admin/queue/ingest monitoring', () => {
  it('returns counts without touching real Redis', async () => {
    const mod = await import('@/app/api/admin/queue/ingest/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stats?.counts).toBeDefined();
  });
});
