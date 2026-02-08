#!/usr/bin/env node

/**
 * TypeScript Error Threshold Checker
 * 
 * This script runs the TypeScript compiler and ensures the number of errors
 * does not exceed a specified threshold. This helps prevent TypeScript error
 * regression in the CI pipeline.
 * 
 * Usage:
 *   node check-typescript-errors.js [threshold]
 * 
 * Exit codes:
 *   0 - Success: Error count is within threshold
 *   1 - Failure: Error count exceeds threshold or compilation failed
 */

const { execSync } = require('child_process');
const path = require('path');

const THRESHOLD = parseInt(process.argv[2] || '0', 10);
const projectRoot = path.resolve(__dirname, '../..');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 TypeScript Error Threshold Checker');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📍 Project Root: ${projectRoot}`);
console.log(`🎯 Error Threshold: ${THRESHOLD}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

try {
  console.log('🔍 Running TypeScript compiler...\n');
  
  // Run tsc --noEmit and capture output
  const output = execSync('npm run typecheck', {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // If we reach here, tsc succeeded with 0 errors
  console.log('✅ TypeScript compilation successful!');
  console.log('📈 Errors found: 0');
  console.log(`📊 Threshold: ${THRESHOLD}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Result: PASS - No TypeScript errors detected');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
  
} catch (error) {
  // tsc failed, let's count the errors
  const output = error.stdout || error.stderr || '';
  
  // Count TypeScript errors (lines matching "error TS")
  const errorLines = output.split('\n').filter(line => line.match(/error TS\d+:/));
  const errorCount = errorLines.length;
  
  console.log('📈 Errors found:', errorCount);
  console.log('📊 Threshold:', THRESHOLD);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (errorCount > THRESHOLD) {
    console.log('❌ Result: FAIL - Error count exceeds threshold');
    console.log(`   ${errorCount} errors > ${THRESHOLD} allowed`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Error Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Group errors by file
    const errorsByFile = {};
    errorLines.forEach(line => {
      const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+):/);
      if (match) {
        const [, file, lineNum, col, errorCode] = match;
        if (!errorsByFile[file]) {
          errorsByFile[file] = [];
        }
        errorsByFile[file].push({ line: lineNum, col, code: errorCode, fullLine: line });
      }
    });
    
    // Print grouped errors
    Object.entries(errorsByFile).forEach(([file, errors]) => {
      console.log(`\n📄 ${file} (${errors.length} error${errors.length > 1 ? 's' : ''})`);
      errors.slice(0, 5).forEach(err => {
        console.log(`   Line ${err.line}: ${err.code}`);
      });
      if (errors.length > 5) {
        console.log(`   ... and ${errors.length - 5} more`);
      }
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 To fix: Run `npm run typecheck` locally to see full details');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
    
  } else {
    console.log('✅ Result: PASS - Error count within threshold');
    console.log(`   ${errorCount} errors ≤ ${THRESHOLD} allowed`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (errorCount > 0) {
      console.log('\n⚠️  Warning: TypeScript errors detected but within threshold');
      console.log('   Consider fixing these errors to improve code quality');
      
      // Show first few errors as a sample
      console.log('\n📋 Sample Errors:');
      errorLines.slice(0, 3).forEach(line => {
        console.log(`   ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
      });
      if (errorLines.length > 3) {
        console.log(`   ... and ${errorLines.length - 3} more`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(0);
  }
}
