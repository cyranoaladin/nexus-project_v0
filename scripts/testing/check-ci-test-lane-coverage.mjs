#!/usr/bin/env node
/** Effective argv collection; execution qualification requires real reports.
 * A workflow comment, config filename or manual declaration grants no pass. */
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {registry,sourceIdentity,collectLane,secureWrite,loadExecutionReports} from './test-lane-runtime.mjs';
import {reconcileTestEvidence,expectedRunIdentity} from './test-lane-contract.mjs';
import {inspectRepositoryTestDebt} from './check-zero-test-debt.mjs';
import {readLaunchPlan} from './native-provenance.mjs';
const output=path.resolve(process.env.NEXUS_TEST_EVIDENCE_DIR??'.artifacts/test-evidence');
const before=sourceIdentity(),registered=registry();const lanes=[],blockers=[];
const requireExecution=process.argv.includes('--require-execution');
const runIdentity=requireExecution?expectedRunIdentity():null;
const debt=inspectRepositoryTestDebt(before.inputs.map(input=>input.path));
if(debt.findings.length)blockers.push('QUALIFICATION_TEST_DEBT');
if(requireExecution&&before.sourceSha!==process.env.NEXUS_EXPECTED_SOURCE_SHA)blockers.push('QUALIFICATION_SOURCE_SHA_MISMATCH');
for(const lane of registered.lanes) {
  try{lanes.push(collectLane(lane,output));}
  catch(error){blockers.push(`COLLECTION_FAILED:${lane.id}`);
    // Bounded runner diagnostic (stderr tail): collection never sees credentials.
    const detail=String(error?.stderr||error?.message||'').trim().split('\n').slice(-20).join('\n');
    console.error(`COLLECTION_FAILED:${lane.id}\n${detail}`);}
}
const after=sourceIdentity();if(before.sourceSha!==after.sourceSha||before.sourceFingerprint!==after.sourceFingerprint
  ||before.tree!==after.tree||before.clean!==after.clean)blockers.push('SOURCE_CHANGED_DURING_COLLECTION');
const union=[...new Set(lanes.flatMap(lane=>lane.collected))].sort();
for(const file of before.paths)if(!union.includes(file))blockers.push(`ORPHAN_TEST_PATH:${file}`);
for(const file of union)if(!before.paths.includes(file))blockers.push(`UNKNOWN_COLLECTED_TEST_PATH:${file}`);
const collection={schemaVersion:2,proofKind:'COLLECTION_ONLY',sourceSha:before.sourceSha,sourceFingerprint:before.sourceFingerprint,
  clean:before.clean,tree:before.tree,runIdentity,inputs:before.inputs,paths:before.paths,lanes,union,
  testDebt:debt,blockers:[...new Set(blockers)].sort()};
secureWrite(path.join(output,'collection-manifest.json'),collection);
if(requireExecution) {
  let reports=[];
  try{
    const directory=path.resolve(process.env.NEXUS_TEST_REPORTS_DIR??output);
    const contexts=readLaunchPlan(process.env.NEXUS_TEST_LAUNCH_MANIFEST,before,registered.lanes,runIdentity,directory);
    reports=loadExecutionReports(directory,collection.lanes,contexts);
  }
  catch{blockers.push('INVALID_EXECUTION_REPORT_EVIDENCE');}
  const evidence=reconcileTestEvidence(collection,reports,{scope:process.argv.includes('--ci-scope')?'CI':'FINAL'});
  evidence.blockers=[...new Set([...blockers,...collection.blockers,...evidence.blockers])].sort();
  if(!before.clean)evidence.blockers.push('FINAL_SOURCE_TREE_DIRTY');
  if(evidence.blockers.length){evidence.verdict='QUALIFICATION_BLOCKED';evidence.releaseQualified=false;}
  secureWrite(path.join(output,'execution-manifest.json'),evidence);
  console.log(JSON.stringify({proofKind:'EXECUTION_RECONCILIATION',verdict:evidence.verdict,releaseQualified:evidence.releaseQualified,
    sourceSha:before.sourceSha,totals:evidence.totals,pendingRehearsals:evidence.pendingRehearsals.map(lane=>lane.id),blockers:evidence.blockers}));
  process.exit(evidence.blockers.length?1:0);
}
console.log(JSON.stringify({proofKind:collection.proofKind,sourceSha:before.sourceSha,paths:before.paths.length,
  jsTsNodePaths:before.paths.filter(file=>!file.endsWith('.py')).length,pythonPaths:before.paths.filter(file=>file.endsWith('.py')).length,
  union:union.length,lanes:lanes.length,blockers:collection.blockers}));
process.exit(collection.blockers.length?1:0);
