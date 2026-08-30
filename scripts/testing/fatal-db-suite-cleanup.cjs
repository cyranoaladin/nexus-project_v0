'use strict';

async function runFatalDbSuiteCleanup(cleanup, disconnect) {
  try {
    await cleanup();
  } finally {
    await disconnect();
  }
}

module.exports = { runFatalDbSuiteCleanup };
