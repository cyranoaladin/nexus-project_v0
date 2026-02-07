#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(
  __dirname,
  '../.zenflow/tests/performance/baseline.json'
);
const CURRENT_PATH = path.join(
  __dirname,
  '../.zenflow/tests/performance/results.json'
);

function loadResults(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function compareMetrics(baseline, current, metricName) {
  const diff = current - baseline;
  const percentChange = ((diff / baseline) * 100).toFixed(2);
  const isRegression = diff > 0;
  
  return {
    baseline,
    current,
    diff,
    percentChange,
    isRegression,
  };
}

function compareResults(baseline, current) {
  const comparison = {
    timestamp: new Date().toISOString(),
    baselineDate: baseline.timestamp,
    currentDate: current.timestamp,
    regressions: [],
    improvements: [],
    details: [],
  };

  for (const currentResult of current.results) {
    const baselineResult = baseline.results.find(
      r => r.name === currentResult.name && r.category === currentResult.category
    );

    if (!baselineResult) {
      console.warn(`No baseline found for: ${currentResult.name}`);
      continue;
    }

    const durationComp = compareMetrics(
      baselineResult.metrics.avg.durationMs,
      currentResult.metrics.avg.durationMs,
      'duration'
    );

    const memoryComp = compareMetrics(
      baselineResult.metrics.avg.memoryUsedMB,
      currentResult.metrics.avg.memoryUsedMB,
      'memory'
    );

    const detail = {
      name: currentResult.name,
      category: currentResult.category,
      duration: durationComp,
      memory: memoryComp,
      passed: currentResult.passed,
      baselinePassed: baselineResult.passed,
    };

    comparison.details.push(detail);

    if (durationComp.isRegression && Math.abs(durationComp.percentChange) > 10) {
      comparison.regressions.push({
        test: currentResult.name,
        metric: 'duration',
        ...durationComp,
      });
    } else if (!durationComp.isRegression && Math.abs(durationComp.percentChange) > 10) {
      comparison.improvements.push({
        test: currentResult.name,
        metric: 'duration',
        ...durationComp,
      });
    }

    if (memoryComp.isRegression && Math.abs(memoryComp.percentChange) > 15) {
      comparison.regressions.push({
        test: currentResult.name,
        metric: 'memory',
        ...memoryComp,
      });
    } else if (!memoryComp.isRegression && Math.abs(memoryComp.percentChange) > 15) {
      comparison.improvements.push({
        test: currentResult.name,
        metric: 'memory',
        ...memoryComp,
      });
    }
  }

  return comparison;
}

function printComparison(comparison) {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE COMPARISON');
  console.log('='.repeat(80));
  console.log(`Baseline: ${comparison.baselineDate}`);
  console.log(`Current:  ${comparison.currentDate}`);
  console.log('='.repeat(80) + '\n');

  if (comparison.regressions.length > 0) {
    console.log('\x1b[31m⚠ REGRESSIONS DETECTED:\x1b[0m');
    for (const regression of comparison.regressions) {
      console.log(
        `  - ${regression.test} (${regression.metric}): ` +
        `${regression.baseline.toFixed(2)} → ${regression.current.toFixed(2)} ` +
        `(+${regression.percentChange}%)`
      );
    }
    console.log('');
  }

  if (comparison.improvements.length > 0) {
    console.log('\x1b[32m✓ IMPROVEMENTS:\x1b[0m');
    for (const improvement of comparison.improvements) {
      console.log(
        `  - ${improvement.test} (${improvement.metric}): ` +
        `${improvement.baseline.toFixed(2)} → ${improvement.current.toFixed(2)} ` +
        `(${improvement.percentChange}%)`
      );
    }
    console.log('');
  }

  console.log('DETAILED COMPARISON:');
  console.log('-'.repeat(80));

  for (const detail of comparison.details) {
    const status = detail.passed ? '✓' : '✗';
    const statusColor = detail.passed ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`\n${statusColor}${status}\x1b[0m ${detail.name} (${detail.category})`);
    console.log(
      `  Duration: ${detail.duration.baseline.toFixed(2)}ms → ` +
      `${detail.duration.current.toFixed(2)}ms (${detail.duration.percentChange}%)`
    );
    console.log(
      `  Memory:   ${detail.memory.baseline.toFixed(2)}MB → ` +
      `${detail.memory.current.toFixed(2)}MB (${detail.memory.percentChange}%)`
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log(
    `SUMMARY: ${comparison.regressions.length} regressions, ` +
    `${comparison.improvements.length} improvements`
  );
  console.log('='.repeat(80) + '\n');

  const comparisonPath = path.join(
    __dirname,
    '../.zenflow/tests/performance/comparison.json'
  );
  fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2));
  console.log(`Comparison saved to: ${comparisonPath}\n`);

  return comparison.regressions.length === 0;
}

function main() {
  const baseline = loadResults(BASELINE_PATH);
  const current = loadResults(CURRENT_PATH);

  if (!baseline) {
    console.error('\nNo baseline results found. Run:');
    console.error('  npm run test:performance');
    console.error('  cp .zenflow/tests/performance/results.json .zenflow/tests/performance/baseline.json\n');
    process.exit(1);
  }

  if (!current) {
    console.error('\nNo current results found. Run:');
    console.error('  npm run test:performance\n');
    process.exit(1);
  }

  const comparison = compareResults(baseline, current);
  const passed = printComparison(comparison);

  process.exit(passed ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { compareResults, printComparison };
