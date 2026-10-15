#!/usr/bin/env node
import path from 'node:path';
import {registry,sourceIdentity,secureWrite} from './test-lane-runtime.mjs';
import {createLaunchPlan,readLaunchPlan} from './native-provenance.mjs';
import {expectedRunIdentity} from './test-lane-contract.mjs';
import {inspectRepositoryTestDebt} from './check-zero-test-debt.mjs';
process.umask(0o077);
try{
  const source=sourceIdentity(),lanes=registry().lanes,identity=expectedRunIdentity();
  if(!source.clean||source.sourceSha!==process.env.NEXUS_EXPECTED_SOURCE_SHA)throw new Error('QUALIFICATION_SOURCE_REFUSED');
  if(inspectRepositoryTestDebt(source.inputs.map(input=>input.path)).findings.length)throw new Error('QUALIFICATION_TEST_DEBT');
  const file=process.env.NEXUS_TEST_LAUNCH_MANIFEST;
  if(!file||!path.isAbsolute(file))throw new Error('INVALID_LAUNCH_PATH');
  secureWrite(file,createLaunchPlan(source,lanes,identity));
  readLaunchPlan(file,source,lanes,identity,path.resolve(process.env.NEXUS_TEST_REPORTS_DIR??process.env.NEXUS_TEST_EVIDENCE_DIR??'.artifacts/test-evidence'));
  console.log(JSON.stringify({sourceSha:source.sourceSha,lanes:lanes.length,proofKind:'PRE_EXECUTION_CHALLENGES'}));
}catch{console.error('TEST_LAUNCH_PREPARATION_REFUSED');process.exitCode=1;}
