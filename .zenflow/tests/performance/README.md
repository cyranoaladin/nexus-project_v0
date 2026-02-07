# Zenflow Performance Testing

This directory contains performance benchmarks and profiling tools for the Zenflow sync system.

## Overview

Performance testing ensures that the sync system meets the required performance targets:

- **Small sync** (< 10 files): < 30 seconds
- **Medium sync** (10-100 files): < 2 minutes
- **Large sync** (100+ files): < 10 minutes

## Running Performance Tests

### Run all performance benchmarks

```bash
npm run test:performance
```

This command runs all benchmark tests with garbage collection enabled and increased heap size.

### Watch mode for development

```bash
npm run test:performance:watch
```

### Run with detailed profiling

```bash
npm run test:performance:profile
```

This generates detailed CPU profiling data that can be analyzed with Chrome DevTools.

## Test Structure

### Benchmark Tests (`sync-benchmarks.test.ts`)

Comprehensive benchmarks for different sync scenarios:

- **Small syncs**: 5-10 files, 100 lines each
- **Medium syncs**: 30-50 files, 150-200 lines each
- **Large syncs**: 100-150 files, 300+ lines each
- **Many worktrees**: 14+ worktrees with various file counts
- **Conflict detection**: Performance of conflict detection algorithms
- **Validation**: Pre-sync validation performance

### Profiling Tests (`profiling-examples.test.ts`)

Detailed profiling of individual operations:

- Memory usage tracking
- Heap snapshot generation
- Function-level performance metrics
- Bottleneck identification

## Results and Analysis

### Benchmark Results

After running tests, results are exported to:

```
.zenflow/tests/performance/results.json
```

The results include:

- Duration (average, min, max, p50, p95, p99)
- Memory usage (used, peak)
- Pass/fail status based on thresholds

### Profiling Data

Profiling data is saved to:

```
.zenflow/tests/performance/profiles/profile-<timestamp>.json
```

Contains:

- Function call counts
- Duration statistics (avg, min, max, total)
- Memory deltas

### Heap Snapshots

Heap snapshots are saved to:

```
.zenflow/tests/performance/snapshots/
```

Analyze with Chrome DevTools:

1. Open Chrome DevTools
2. Go to Memory tab
3. Click "Load" and select the `.heapsnapshot` file

## Performance Targets

### By Sync Size

| Category | Files | Target Duration | Target Memory |
|----------|-------|----------------|---------------|
| Small    | < 10  | < 30s          | < 100MB       |
| Medium   | 10-100| < 2min         | < 200MB       |
| Large    | 100+  | < 10min        | < 300MB       |

### By Operation Type

| Operation          | Target Duration | Notes                           |
|--------------------|----------------|---------------------------------|
| Conflict Detection | < 30s          | For up to 50 files              |
| Validation         | < 15s          | Pre-sync checks                 |
| Batch Sync (3 WT)  | < 1min         | Small worktrees                 |
| Batch Sync (14 WT) | < 10min        | Many worktrees, medium size     |

## Helpers and Utilities

### RepoGenerator

Generates test repositories and worktrees:

```typescript
import { TestRepoGenerator } from './helpers/repo-generator';

const generator = new TestRepoGenerator({
  name: 'test-repo',
  numWorktrees: 3,
  filesPerWorktree: 30,
  linesPerFile: 150,
  basePath: '/tmp/zenflow-tests',
});

const repoPath = await generator.create();
const worktreePaths = await generator.createWorktrees(repoPath);
await generator.populateWorktree(worktreePaths[0], 'medium');
```

### PerformanceMonitor

Measures performance metrics:

```typescript
import { PerformanceMonitor } from './helpers/performance-metrics';

const result = await PerformanceMonitor.runBenchmark(
  'My Benchmark',
  'medium',
  async () => {
    // Code to benchmark
  },
  {
    durationMs: 60000,
    memoryUsedMB: 150,
    peakMemoryMB: 200,
  },
  5 // iterations
);
```

### Profiler

Detailed profiling of functions:

```typescript
import { Profiler } from './profiler';

const profiler = new Profiler();

const { result, profile } = await profiler.profile(
  'myFunction',
  async () => {
    // Code to profile
  }
);

profiler.takeHeapSnapshot('after-operation');
profiler.printSummary();
profiler.exportToJSON('profile.json');
```

## Optimizing Performance

### Common Bottlenecks

1. **Git Operations**: Most time-consuming operations
   - Use `git diff --stat` instead of full diff when possible
   - Batch Git commands where feasible
   - Cache Git client instances

2. **File I/O**: Reading/writing large numbers of files
   - Use streaming for large files
   - Batch file operations
   - Use native Node.js APIs (fs.promises)

3. **Memory Usage**: Large repositories can consume significant memory
   - Stream large outputs instead of buffering
   - Clear caches after operations
   - Use `--expose-gc` and call `global.gc()` when safe

4. **Conflict Detection**: Can be slow for many files
   - Early exit when first conflict found (if appropriate)
   - Use merge-tree for efficient conflict detection
   - Cache conflict detection results when safe

### Optimization Techniques

1. **Parallel Operations**
   - Run independent validations in parallel
   - Use Promise.all() for concurrent operations
   - Limit concurrency to avoid overwhelming the system

2. **Caching**
   - Cache Git client instances
   - Cache worktree lists
   - Cache validation results (with appropriate TTL)

3. **Lazy Loading**
   - Load data only when needed
   - Defer expensive operations until necessary
   - Use streaming for large data sets

4. **Resource Management**
   - Close file handles promptly
   - Release locks as soon as possible
   - Clean up temporary files

## Continuous Performance Monitoring

### In CI/CD

Add to your CI pipeline:

```yaml
- name: Run Performance Tests
  run: npm run test:performance
  
- name: Upload Performance Results
  uses: actions/upload-artifact@v2
  with:
    name: performance-results
    path: .zenflow/tests/performance/results.json
```

### Performance Regression Detection

Compare current results with baseline:

```bash
# Save baseline
cp .zenflow/tests/performance/results.json .zenflow/tests/performance/baseline.json

# After changes, compare
node scripts/compare-performance.js
```

## Troubleshooting

### Tests Timing Out

Increase timeout in `jest.config.performance.js`:

```javascript
testTimeout: 1800000, // 30 minutes
```

### Out of Memory Errors

Increase Node.js heap size:

```bash
node --max-old-space-size=8192 node_modules/.bin/jest --config jest.config.performance.js
```

### Inconsistent Results

- Ensure no other heavy processes are running
- Run tests multiple times and use median values
- Use a dedicated test environment
- Disable CPU throttling and power saving modes

## Best Practices

1. **Consistent Environment**: Run tests on the same hardware/environment
2. **Warm-up**: Discard first iteration to account for JIT compilation
3. **Garbage Collection**: Enable with `--expose-gc` for accurate memory measurements
4. **Isolation**: Run performance tests separately from unit/integration tests
5. **Multiple Iterations**: Run benchmarks 3-5 times, report median and p95
6. **Realistic Data**: Use realistic file sizes and repository structures
7. **Document Baselines**: Keep historical performance data for comparison

## Contributing

When adding new performance tests:

1. Follow the existing test structure
2. Set appropriate timeouts (be generous but reasonable)
3. Clean up test repositories after tests
4. Document expected performance characteristics
5. Update this README if adding new test categories
