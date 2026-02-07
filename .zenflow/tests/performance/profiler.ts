import { performance, PerformanceObserver } from 'perf_hooks';
import * as v8 from 'v8';
import * as fs from 'fs';
import * as path from 'path';

export interface ProfileData {
  functionName: string;
  duration: number;
  startTime: number;
  endTime: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
}

export class Profiler {
  private profiles: Map<string, ProfileData[]> = new Map();
  private observer?: PerformanceObserver;
  private heapSnapshots: Array<{ name: string; path: string }> = [];

  constructor() {
    this.setupPerformanceObserver();
  }

  private setupPerformanceObserver(): void {
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        if (entry.entryType === 'measure') {
          console.log(`[PROFILE] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
        }
      }
    });
    this.observer.observe({ entryTypes: ['measure'] });
  }

  mark(name: string): void {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark: string): void {
    performance.measure(name, startMark, endMark);
  }

  async profile<T>(
    functionName: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; profile: ProfileData }> {
    const startMark = `${functionName}-start`;
    const endMark = `${functionName}-end`;
    const measureName = `${functionName}-duration`;

    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();
    
    this.mark(startMark);
    
    const result = await fn();
    
    this.mark(endMark);
    this.measure(measureName, startMark, endMark);
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();

    const profile: ProfileData = {
      functionName,
      duration: endTime - startTime,
      startTime,
      endTime,
      memoryBefore,
      memoryAfter,
    };

    if (!this.profiles.has(functionName)) {
      this.profiles.set(functionName, []);
    }
    this.profiles.get(functionName)!.push(profile);

    return { result, profile };
  }

  takeHeapSnapshot(name: string): string {
    const snapshotPath = path.join(
      process.cwd(),
      '.zenflow/tests/performance/snapshots',
      `${name}-${Date.now()}.heapsnapshot`
    );

    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });

    const snapshot = v8.writeHeapSnapshot(snapshotPath);
    
    this.heapSnapshots.push({ name, path: snapshot });
    console.log(`[HEAP SNAPSHOT] Saved to: ${snapshot}`);
    
    return snapshot;
  }

  getProfileSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    for (const [functionName, profiles] of this.profiles.entries()) {
      const durations = profiles.map(p => p.duration);
      const memoryDeltas = profiles.map(p => 
        (p.memoryAfter.heapUsed - p.memoryBefore.heapUsed) / 1024 / 1024
      );

      summary[functionName] = {
        calls: profiles.length,
        duration: {
          avg: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          total: durations.reduce((a, b) => a + b, 0),
        },
        memory: {
          avgDeltaMB: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
          minDeltaMB: Math.min(...memoryDeltas),
          maxDeltaMB: Math.max(...memoryDeltas),
        },
      };
    }

    return summary;
  }

  printSummary(): void {
    const summary = this.getProfileSummary();

    console.log('\n' + '='.repeat(80));
    console.log('PROFILING SUMMARY');
    console.log('='.repeat(80) + '\n');

    for (const [functionName, stats] of Object.entries(summary)) {
      console.log(`Function: ${functionName}`);
      console.log(`  Calls: ${stats.calls}`);
      console.log(`  Duration:`);
      console.log(`    Average: ${stats.duration.avg.toFixed(2)}ms`);
      console.log(`    Min: ${stats.duration.min.toFixed(2)}ms`);
      console.log(`    Max: ${stats.duration.max.toFixed(2)}ms`);
      console.log(`    Total: ${stats.duration.total.toFixed(2)}ms`);
      console.log(`  Memory:`);
      console.log(`    Avg Delta: ${stats.memory.avgDeltaMB.toFixed(2)}MB`);
      console.log(`    Min Delta: ${stats.memory.minDeltaMB.toFixed(2)}MB`);
      console.log(`    Max Delta: ${stats.memory.maxDeltaMB.toFixed(2)}MB`);
      console.log('');
    }

    if (this.heapSnapshots.length > 0) {
      console.log('Heap Snapshots:');
      for (const snapshot of this.heapSnapshots) {
        console.log(`  - ${snapshot.name}: ${snapshot.path}`);
      }
      console.log('');
    }

    console.log('='.repeat(80) + '\n');
  }

  exportToJSON(filePath: string): void {
    const data = {
      timestamp: new Date().toISOString(),
      summary: this.getProfileSummary(),
      heapSnapshots: this.heapSnapshots,
      profiles: Array.from(this.profiles.entries()).map(([name, profiles]) => ({
        functionName: name,
        profiles,
      })),
    };

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`[PROFILER] Results exported to: ${filePath}`);
  }

  clear(): void {
    this.profiles.clear();
    this.heapSnapshots = [];
    performance.clearMarks();
    performance.clearMeasures();
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.clear();
  }
}

export const globalProfiler = new Profiler();
