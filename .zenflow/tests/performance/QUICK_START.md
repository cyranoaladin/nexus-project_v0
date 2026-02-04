# Performance Testing - Quick Start Guide

## Run Performance Tests

```bash
# Run all performance benchmarks
npm run test:performance

# Results will be saved to:
# .zenflow/tests/performance/results.json
```

## Expected Output

```
PERFORMANCE BENCHMARK RESULTS
================================================================================

SMALL TESTS:
----------------------------------------------------------------------------

✓ PASS Small sync (5 files, 100 lines each)
  Iterations: 3
  Threshold: Duration: 30000.00ms, Memory: 100.00MB, Peak: 150.00MB
  Average:   Duration: 12345.67ms, Memory: 45.23MB, Peak: 67.89MB
  Min:       Duration: 11234.56ms, Memory: 42.10MB, Peak: 65.43MB
  Max:       Duration: 13456.78ms, Memory: 48.36MB, Peak: 70.25MB
  P95:       Duration: 13200.00ms, Memory: 47.50MB, Peak: 69.80MB

...

SUMMARY: 8 passed, 0 failed
================================================================================
```

## Compare with Baseline

First time:
```bash
# Run tests
npm run test:performance

# Save as baseline
cp .zenflow/tests/performance/results.json \
   .zenflow/tests/performance/baseline.json
```

Future runs:
```bash
# Run tests
npm run test:performance

# Compare with baseline
node scripts/compare-performance.js
```

## Profiling

```bash
# Run with detailed profiling
npm run test:performance:profile

# Results saved to:
# .zenflow/tests/performance/profiles/profile-<timestamp>.json
# .zenflow/tests/performance/snapshots/*.heapsnapshot
```

## Analyze Heap Snapshots

1. Run profiling tests to generate heap snapshots
2. Open Chrome DevTools
3. Go to Memory tab
4. Click "Load" and select a `.heapsnapshot` file from:
   `.zenflow/tests/performance/snapshots/`

## Performance Targets

| Category | Files | Target   | Memory  |
|----------|-------|----------|---------|
| Small    | < 10  | < 30s    | < 100MB |
| Medium   | 10-100| < 2min   | < 200MB |
| Large    | 100+  | < 10min  | < 300MB |

## Troubleshooting

### Tests timing out
Increase timeout in `jest.config.performance.js`:
```javascript
testTimeout: 1800000, // 30 minutes
```

### Out of memory
Increase heap size:
```bash
node --max-old-space-size=8192 \
  node_modules/.bin/jest \
  --config jest.config.performance.js
```

### Inconsistent results
- Close other applications
- Run multiple times and compare median values
- Disable CPU throttling/power saving
- Use a consistent test environment

## More Information

- Full documentation: `.zenflow/tests/performance/README.md`
- Performance characteristics: `docs/performance-characteristics.md`
