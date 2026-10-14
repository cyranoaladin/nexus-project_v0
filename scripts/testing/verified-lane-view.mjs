/** Derived requirement views consume existing native reports; they run no tests. */
import {realpathSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {registry,sourceIdentity,readNativeEvidence,loadExecutionReports} from './test-lane-runtime.mjs';
import {readLaunchPlan} from './native-provenance.mjs';
import {expectedRunIdentity,reconcileTestEvidence} from './test-lane-contract.mjs';

export const ARIA_NATIVE_LANES=Object.freeze({
  jest:Object.freeze([
    ['jest-aria-unit','unit'],['jest-aria-api','api'],['jest-aria-integration','integration'],
    ['jest-aria-sse','unit'],['jest-aria-architecture','architecture'],
    ['jest-aria-db','database'],['jest-aria-concurrency','concurrency'],
  ]),
  playwright:Object.freeze([
    ['pw-aria-aria-desktop','e2e'],['pw-aria-aria-mobile','e2e'],
    ['pw-aria-aria-a11y','e2e'],['pw-aria-aria-smoke','smoke'],
  ]),
});
export function readVerifiedLaneView(repositoryRoot,preset){
  const selected=ARIA_NATIVE_LANES[preset];
  if(!selected||realpathSync(repositoryRoot)!==process.cwd())throw new Error('INVALID_NATIVE_REQUIREMENT_VIEW');
  const directory=process.env.NEXUS_TEST_ARIA_REPORTS_DIR;
  if(!directory||!path.isAbsolute(directory))throw new Error('NATIVE_REQUIREMENT_REPORT_DIRECTORY_REQUIRED');
  const source=sourceIdentity(repositoryRoot),registered=registry().lanes,runIdentity=expectedRunIdentity();
  if(!source.clean||source.sourceSha!==process.env.NEXUS_EXPECTED_SOURCE_SHA)throw new Error('NATIVE_REQUIREMENT_SOURCE_MISMATCH');
  const lanes=selected.map(([id])=>{
    const lane=registered.find(lane=>lane.id===id);
    if(!lane||lane.runner!==(preset==='jest'?'jest':'playwright'))throw new Error('NATIVE_REQUIREMENT_REGISTRY_MISMATCH');
    return lane;
  });
  const planFile=process.env.NEXUS_TEST_LAUNCH_MANIFEST;
  const planHash=readNativeEvidence(planFile).sha256;
  const contexts=readLaunchPlan(planFile,source,registered,runIdentity,directory);
  const reports=loadExecutionReports(directory,registered,contexts).filter(report=>lanes.some(lane=>lane.id===report.laneId));
  const collection={...source,runIdentity,lanes:lanes.map(lane=>{
    const report=reports.find(report=>report.laneId===lane.id);
    if(!report||!Array.isArray(report.collected)||report.collected.some(file=>!source.paths.includes(file)))
      throw new Error('NATIVE_REQUIREMENT_COLLECTION_MISSING');
    return {...lane,collected:report.collected};
  })};
  collection.paths=[...new Set(collection.lanes.flatMap(lane=>lane.collected))].sort();
  const result=reconcileTestEvidence(collection,reports,{scope:'CI'});
  if(result.blockers.length)throw new Error('NATIVE_REQUIREMENT_EXECUTION_BLOCKED');
  const after=sourceIdentity(repositoryRoot);
  if(!after.clean||after.sourceSha!==source.sourceSha||after.tree!==source.tree
    ||after.sourceFingerprint!==source.sourceFingerprint||readNativeEvidence(planFile).sha256!==planHash)
    throw new Error('NATIVE_REQUIREMENT_SOURCE_CHANGED');
  return {
    schemaVersion:1,proofKind:'DERIVED_FROM_VERIFIED_NATIVE_REPORTS',
    qualificationScope:preset==='jest'?'ARIA_SEVEN_LANE_REQUIREMENT_VIEW':'ARIA_FOUR_BROWSER_REQUIREMENT_VIEW',
    headSha:source.sourceSha,tree:source.tree,sourceFingerprint:source.sourceFingerprint,runIdentity,
    launchPlanSha256:planHash,
    sources:reports.map(report=>({laneId:report.laneId,executionNonce:report.executionNonce,
      reportSha256:report.reportSha256,nativeReportSha256:report.nativeReportSha256,
      nativeLaunchSha256:report.nativeLaunchSha256,nativeProvenanceSha256:report.nativeProvenanceSha256})),
    assertions:reports.flatMap(report=>report.tests.map(test=>({...test,
      qualificationLane:selected.find(([id])=>id===report.laneId)[1]}))),
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    if(process.argv.length!==3)throw new Error('INVALID_VIEW_ARGUMENTS');
    process.stdout.write(JSON.stringify(readVerifiedLaneView(process.cwd(),process.argv[2]))+'\n');
  }catch{console.error('VERIFIED_NATIVE_REQUIREMENT_VIEW_REFUSED');process.exitCode=1;}
}
