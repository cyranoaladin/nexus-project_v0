if (global.gc) {
  console.log('✓ Garbage collection is enabled');
} else {
  console.warn('⚠ Garbage collection is not enabled. Run with --expose-gc for better memory profiling.');
}

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

console.log('Performance test environment initialized');
console.log(`Node version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`CPU cores: ${require('os').cpus().length}`);
console.log(`Total memory: ${(require('os').totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
