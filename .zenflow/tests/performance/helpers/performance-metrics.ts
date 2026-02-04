import * as v8 from 'v8';

export interface PerformanceMetrics {
  durationMs: number;
  memoryUsedMB: number;
  peakMemoryMB: number;
  cpuTimeMs?: number;
}

export interface BenchmarkResult {
  name: string;
  category: 'small' | 'medium' | 'large';
  iterations: number;
  metrics: {
    avg: PerformanceMetrics;
    min: PerformanceMetrics;
    max: PerformanceMetrics;
    p50: PerformanceMetrics;
    p95: PerformanceMetrics;
    p99: PerformanceMetrics;
  };
  passed: boolean;
  threshold: PerformanceMetrics;
}

export class PerformanceMonitor {
  private startTime: number = 0;
  private startMemory: number = 0;
  private peakMemory: number = 0;
  private memoryInterval?: NodeJS.Timeout;

  start(): void {
    this.startTime = performance.now();
    this.startMemory = this.getMemoryUsage();
    this.peakMemory = this.startMemory;
    
    this.memoryInterval = setInterval(() => {
      const current = this.getMemoryUsage();
      if (current > this.peakMemory) {
        this.peakMemory = current;
      }
    }, 100);
  }

  stop(): PerformanceMetrics {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = undefined;
    }
    
    const endTime = performance.now();
    const endMemory = this.getMemoryUsage();
    
    return {
      durationMs: endTime - this.startTime,
      memoryUsedMB: endMemory - this.startMemory,
      peakMemoryMB: this.peakMemory,
    };
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024;
  }

  static formatMetrics(metrics: PerformanceMetrics): string {
    return `Duration: ${metrics.durationMs.toFixed(2)}ms, ` +
           `Memory: ${metrics.memoryUsedMB.toFixed(2)}MB, ` +
           `Peak: ${metrics.peakMemoryMB.toFixed(2)}MB`;
  }

  static async runBenchmark(
    name: string,
    category: 'small' | 'medium' | 'large',
    fn: () => Promise<void>,
    threshold: PerformanceMetrics,
    iterations: number = 5
  ): Promise<BenchmarkResult> {
    const results: PerformanceMetrics[] = [];
    
    for (let i = 0; i < iterations; i++) {
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const monitor = new PerformanceMonitor();
      monitor.start();
      
      try {
        await fn();
      } catch (err) {
        console.error(`Benchmark ${name} iteration ${i + 1} failed:`, err);
        throw err;
      }
      
      const metrics = monitor.stop();
      results.push(metrics);
    }
    
    results.sort((a, b) => a.durationMs - b.durationMs);
    
    const avg = PerformanceMonitor.calculateAverage(results);
    const min = results[0];
    const max = results[results.length - 1];
    const p50 = results[Math.floor(results.length * 0.5)];
    const p95 = results[Math.floor(results.length * 0.95)];
    const p99 = results[Math.floor(results.length * 0.99)];
    
    const passed = avg.durationMs <= threshold.durationMs &&
                   avg.memoryUsedMB <= threshold.memoryUsedMB;
    
    return {
      name,
      category,
      iterations,
      metrics: { avg, min, max, p50, p95, p99 },
      passed,
      threshold,
    };
  }

  private static calculateAverage(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const sum = metrics.reduce((acc, m) => ({
      durationMs: acc.durationMs + m.durationMs,
      memoryUsedMB: acc.memoryUsedMB + m.memoryUsedMB,
      peakMemoryMB: acc.peakMemoryMB + m.peakMemoryMB,
    }), {
      durationMs: 0,
      memoryUsedMB: 0,
      peakMemoryMB: 0,
    });
    
    return {
      durationMs: sum.durationMs / metrics.length,
      memoryUsedMB: sum.memoryUsedMB / metrics.length,
      peakMemoryMB: sum.peakMemoryMB / metrics.length,
    };
  }

  static printBenchmarkResults(results: BenchmarkResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE BENCHMARK RESULTS');
    console.log('='.repeat(80) + '\n');
    
    const grouped = results.reduce((acc, r) => {
      if (!acc[r.category]) {
        acc[r.category] = [];
      }
      acc[r.category].push(r);
      return acc;
    }, {} as Record<string, BenchmarkResult[]>);
    
    for (const [category, categoryResults] of Object.entries(grouped)) {
      console.log(`\n${category.toUpperCase()} TESTS:`);
      console.log('-'.repeat(80));
      
      for (const result of categoryResults) {
        const status = result.passed ? '✓ PASS' : '✗ FAIL';
        const statusColor = result.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`\n${statusColor}${status}\x1b[0m ${result.name}`);
        console.log(`  Iterations: ${result.iterations}`);
        console.log(`  Threshold: ${PerformanceMonitor.formatMetrics(result.threshold)}`);
        console.log(`  Average:   ${PerformanceMonitor.formatMetrics(result.metrics.avg)}`);
        console.log(`  Min:       ${PerformanceMonitor.formatMetrics(result.metrics.min)}`);
        console.log(`  Max:       ${PerformanceMonitor.formatMetrics(result.metrics.max)}`);
        console.log(`  P95:       ${PerformanceMonitor.formatMetrics(result.metrics.p95)}`);
      }
    }
    
    const totalPassed = results.filter(r => r.passed).length;
    const totalFailed = results.length - totalPassed;
    
    console.log('\n' + '='.repeat(80));
    console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed`);
    console.log('='.repeat(80) + '\n');
  }

  static exportResultsToJSON(results: BenchmarkResult[], filePath: string): void {
    const fs = require('fs');
    const data = {
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
      },
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}
