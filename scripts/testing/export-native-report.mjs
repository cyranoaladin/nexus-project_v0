#!/usr/bin/env node
import {exportNativeEvidence} from './test-lane-runtime.mjs';
import {producerContextFromEnv} from './native-provenance.mjs';
process.umask(0o077);
try {
  if(process.argv.length!==5)throw new Error('INVALID_ARGUMENTS');
  exportNativeEvidence(process.argv[2],process.argv[3],producerContextFromEnv(process.argv[4]));
}catch{
  console.error('NATIVE_EVIDENCE_EXPORT_REFUSED');
  process.exitCode=1;
}
