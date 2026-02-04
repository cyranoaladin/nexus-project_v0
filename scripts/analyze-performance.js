#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const RESULTS_PATH = path.join(
  __dirname,
  '../.zenflow/tests/performance/results.json'
);

function analyzeResults(results) {
  const analysis = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.results.length,
      passed: 0,
      failed: 0,
    },
    slowest: [],
    memoryIntensive: [],
    recommendations: [],
  };

  for (const result of results.results) {
    if (result.passed) {
      analysis.summary.passed++;
    } else {
      analysis.summary.failed++;
    }

    const avgDuration = result.metrics.avg.durationMs;
    const avgMemory = result.metrics.avg.memoryUsedMB;
    const threshold = result.threshold;

    if (avgDuration > threshold.durationMs * 0.8) {
      analysis.slowest.push({
        name: result.name,
        category: result.category,
        duration: avgDuration,
        threshold: threshold.durationMs,
        utilizationPercent: (avgDuration / threshold.durationMs * 100).toFixed(1),
      });
    }

    if (avgMemory > threshold.memoryUsedMB * 0.8) {
      analysis.memoryIntensive.push({
        name: result.name,
        category: result.category,
        memory: avgMemory,
        threshold: threshold.memoryUsedMB,
        utilizationPercent: (avgMemory / threshold.memoryUsedMB * 100).toFixed(1),
      });
    }
  }

  analysis.slowest.sort((a, b) => b.duration - a.duration);
  analysis.memoryIntensive.sort((a, b) => b.memory - a.memory);

  generateRecommendations(analysis);

  return analysis;
}

function generateRecommendations(analysis) {
  if (analysis.slowest.length > 0) {
    const slowest = analysis.slowest[0];
    
    if (slowest.category === 'large') {
      analysis.recommendations.push({
        priority: 'HIGH',
        category: 'Performance',
        issue: `Large syncs are approaching time limits (${slowest.utilizationPercent}% of threshold)`,
        recommendations: [
          'Implement parallel processing for batch operations',
          'Optimize Git operations with better caching',
          'Consider incremental sync for repeated operations',
          'Profile to identify specific bottlenecks in Git operations',
        ],
      });
    }

    if (slowest.category === 'medium' && slowest.utilizationPercent > 90) {
      analysis.recommendations.push({
        priority: 'MEDIUM',
        category: 'Performance',
        issue: `Medium syncs are using ${slowest.utilizationPercent}% of allowed time`,
        recommendations: [
          'Optimize conflict detection algorithm',
          'Improve diff analysis efficiency',
          'Cache validation results where safe',
          'Consider lazy loading of file contents',
        ],
      });
    }
  }

  if (analysis.memoryIntensive.length > 0) {
    const mostMemory = analysis.memoryIntensive[0];
    
    if (mostMemory.utilizationPercent > 85) {
      analysis.recommendations.push({
        priority: 'MEDIUM',
        category: 'Memory',
        issue: `High memory usage detected (${mostMemory.utilizationPercent}% of threshold)`,
        recommendations: [
          'Implement streaming for large file operations',
          'Clear caches more aggressively',
          'Run garbage collection after large operations',
          'Consider chunking large operations',
          'Investigate memory leaks with heap snapshots',
        ],
      });
    }
  }

  if (analysis.summary.failed > 0) {
    analysis.recommendations.push({
      priority: 'CRITICAL',
      category: 'Reliability',
      issue: `${analysis.summary.failed} performance tests failed`,
      recommendations: [
        'Review failed tests for performance regressions',
        'Consider increasing thresholds if requirements changed',
        'Profile failed tests to identify bottlenecks',
        'Check if system resources were limited during tests',
      ],
    });
  }

  const passRate = (analysis.summary.passed / analysis.summary.total * 100).toFixed(1);
  
  if (passRate < 90) {
    analysis.recommendations.push({
      priority: 'HIGH',
      category: 'Overall',
      issue: `Low pass rate: ${passRate}%`,
      recommendations: [
        'Comprehensive performance optimization needed',
        'Review all failing tests for common patterns',
        'Consider architectural changes for scalability',
        'Implement performance monitoring in production',
      ],
    });
  } else if (passRate === 100) {
    analysis.recommendations.push({
      priority: 'INFO',
      category: 'Success',
      issue: 'All performance tests passed',
      recommendations: [
        'Monitor performance over time to detect gradual regressions',
        'Consider tightening thresholds for future improvements',
        'Document successful optimizations for future reference',
        'Establish baseline for future comparisons',
      ],
    });
  }
}

function printAnalysis(analysis) {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE ANALYSIS');
  console.log('='.repeat(80));
  console.log(`Analysis Date: ${analysis.timestamp}`);
  console.log(`Tests Passed: ${analysis.summary.passed}/${analysis.summary.total}`);
  console.log(`Pass Rate: ${(analysis.summary.passed / analysis.summary.total * 100).toFixed(1)}%`);
  console.log('='.repeat(80) + '\n');

  if (analysis.slowest.length > 0) {
    console.log('SLOWEST OPERATIONS:');
    console.log('-'.repeat(80));
    for (const slow of analysis.slowest.slice(0, 5)) {
      console.log(
        `  ${slow.name} (${slow.category}): ` +
        `${slow.duration.toFixed(0)}ms / ${slow.threshold.toFixed(0)}ms ` +
        `(${slow.utilizationPercent}%)`
      );
    }
    console.log('');
  }

  if (analysis.memoryIntensive.length > 0) {
    console.log('MEMORY INTENSIVE OPERATIONS:');
    console.log('-'.repeat(80));
    for (const mem of analysis.memoryIntensive.slice(0, 5)) {
      console.log(
        `  ${mem.name} (${mem.category}): ` +
        `${mem.memory.toFixed(1)}MB / ${mem.threshold.toFixed(1)}MB ` +
        `(${mem.utilizationPercent}%)`
      );
    }
    console.log('');
  }

  if (analysis.recommendations.length > 0) {
    console.log('RECOMMENDATIONS:');
    console.log('-'.repeat(80));
    
    const byPriority = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      INFO: [],
    };
    
    for (const rec of analysis.recommendations) {
      byPriority[rec.priority].push(rec);
    }
    
    for (const [priority, recs] of Object.entries(byPriority)) {
      if (recs.length === 0) continue;
      
      const color = {
        CRITICAL: '\x1b[31m',
        HIGH: '\x1b[33m',
        MEDIUM: '\x1b[36m',
        INFO: '\x1b[32m',
      }[priority];
      
      console.log(`\n${color}${priority} PRIORITY:\x1b[0m`);
      
      for (const rec of recs) {
        console.log(`\n  ${rec.category}: ${rec.issue}`);
        for (const suggestion of rec.recommendations) {
          console.log(`    - ${suggestion}`);
        }
      }
    }
    console.log('');
  }

  console.log('='.repeat(80) + '\n');

  const analysisPath = path.join(
    __dirname,
    '../.zenflow/tests/performance/analysis.json'
  );
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`Analysis saved to: ${analysisPath}\n`);
}

function main() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error('\nNo performance results found. Run:');
    console.error('  npm run test:performance\n');
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'));
  const analysis = analyzeResults(results);
  printAnalysis(analysis);
}

if (require.main === module) {
  main();
}

module.exports = { analyzeResults, printAnalysis };
