#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {registry,sourceIdentity,collectLane,runnerInvocation,normalizeReport,nativeReportBlockers,secureWrite,assertFreshEvidence,qualifiedLaneEnvironment} from './test-lane-runtime.mjs';
import {expectedRunIdentity} from './test-lane-contract.mjs';
import {inspectRepositoryTestDebt} from './check-zero-test-debt.mjs';
import {readLaunchPlan,readNativeBundle} from './native-provenance.mjs';
process.umask(0o077);
function main(){
const id=process.argv[2];if(process.argv.length!==3)throw new Error('Usage: node scripts/testing/run-test-lane.mjs LANE_ID');
const runIdentity=expectedRunIdentity();
const registered=registry().lanes,lane=registered.find(lane=>lane.id===id);if(!lane)throw new Error('UNKNOWN_TEST_LANE');
if(lane.producedBy)throw new Error('TEST_LANE_REQUIRES_ITS_GROUP_PRODUCER');
const group=[lane,...registered.filter(member=>member.producedBy===id)];
if(group.length>2)throw new Error('UNSUPPORTED_TEST_DRIVER_GROUP');
const dir=path.resolve(process.env.NEXUS_TEST_EVIDENCE_DIR??'.artifacts/test-evidence');mkdirSync(dir,{recursive:true,mode:0o700});
const nativePaths=new Map(group.map(member=>[member.id,path.join(dir,`${member.id}.native.json`)]));
const stdoutPath=path.join(dir,`${id}.stdout.log`),stderrPath=path.join(dir,`${id}.stderr.log`);
assertFreshEvidence([...nativePaths.values()].flatMap(file=>[file,file+'.launch.json',file+'.provenance.json'])
  .concat([stdoutPath,stderrPath,...group.map(member=>path.join(dir,`${member.id}.report.json`))]));
const before=sourceIdentity();
if(!before.clean)throw new Error('QUALIFICATION_REQUIRES_CLEAN_SOURCE_TREE');
if(before.sourceSha!==process.env.NEXUS_EXPECTED_SOURCE_SHA)throw new Error('QUALIFICATION_SOURCE_SHA_MISMATCH');
if(inspectRepositoryTestDebt(before.inputs.map(input=>input.path)).findings.length)throw new Error('QUALIFICATION_TEST_DEBT');
const collections=new Map(group.map(member=>[member.id,collectLane(member,dir)]));
for(const collection of collections.values())for(const file of collection.collected)
  if(!before.paths.includes(file))throw new Error('COLLECTED_PATH_OUTSIDE_SOURCE_INVENTORY');
const collectedSource=sourceIdentity();
if(!collectedSource.clean||collectedSource.tree!==before.tree||collectedSource.sourceSha!==before.sourceSha
  ||collectedSource.sourceFingerprint!==before.sourceFingerprint)throw new Error('QUALIFICATION_SOURCE_CHANGED_DURING_COLLECTION');
const contexts=readLaunchPlan(process.env.NEXUS_TEST_LAUNCH_MANIFEST,before,registered,runIdentity,dir);
const nonce=contexts.find(context=>context.laneId===id).executionNonce;
let args=[...lane.argv],env=qualifiedLaneEnvironment(lane);
env.NEXUS_TEST_LAUNCH_CONTEXTS=JSON.stringify(contexts.filter(context=>context.driverGroup===id));
env.NEXUS_TEST_LANE_ID=id;env.NEXUS_TEST_NATIVE_OUTPUT=nativePaths.get(id);
if(group[1])env.NEXUS_TEST_SECONDARY_LANE_ID=group[1].id;
// A parent node:test process sets this private child marker. Each registered
// lane is a fresh runner, so it must install its own native reporter.
delete env.NODE_TEST_CONTEXT;
const nativePath=nativePaths.get(id);
let binary,argv;
if(lane.driver){
  if(!['NODE','BASH'].includes(lane.driver.binary)||lane.driver.argv.some(arg=>arg.includes('run-test-lane.mjs')))
    throw new Error('INVALID_OR_RECURSIVE_TEST_DRIVER');
  binary=lane.driver.binary==='NODE'?process.execPath:'bash';argv=[...lane.driver.argv];
  env.NEXUS_TEST_NATIVE_OUTPUT=nativePath;
  if(group[1])env.NEXUS_TEST_NATIVE_SECONDARY_OUTPUT=nativePaths.get(group[1].id);
}else{
  if(lane.runner==='jest')args.push('--json',`--outputFile=${nativePath}`,
    '--reporters','default','--reporters','./scripts/testing/jest-native-reporter.mjs');
  if(lane.runner==='playwright')args.push('--reporter=./scripts/testing/playwright-native-reporter.mjs');
  if(lane.runner==='python'){args.push('-p','scripts.testing.pytest_evidence_plugin');env.NEXUS_TEST_EXECUTION_OUTPUT=nativePath;}
  [binary,argv]=runnerInvocation(lane,args);
}
const execution=spawnSync(binary,argv,{env,encoding:'utf8',maxBuffer:128*1024*1024,stdio:['ignore','pipe','pipe']});
const stdout=execution.stdout??'',stderr=execution.stderr??'';
writeFileSync(stdoutPath,stdout,{mode:0o600,flag:'wx'});writeFileSync(stderrPath,stderr,{mode:0o600,flag:'wx'});
const after=sourceIdentity(),changed=before.sourceFingerprint!==after.sourceFingerprint||before.sourceSha!==after.sourceSha
  ||before.tree!==after.tree||!after.clean;
let failed=false;
for(const member of group){
  const collection=collections.get(member.id),blockers=[];
  if(changed)blockers.push('SOURCE_CHANGED_DURING_TEST');
  if(execution.status!==0)blockers.push('RUNNER_FAILED');
  let native=null,tests=[],nativeReportSha256=null,bundle=null;
  try{
    {
      const context=contexts.find(context=>context.laneId===member.id);
      bundle=readNativeBundle(nativePaths.get(member.id),context);
      const evidence=bundle.native;native=evidence.value;nativeReportSha256=evidence.sha256;
      if(member.runner==='playwright'){
        const expectedRoot=path.posix.join(context.producerRepositoryRoot,collection.testRoot??'.');
        if(native.config?.rootDir!==expectedRoot)throw new Error('NATIVE_TEST_ROOT_MISMATCH');
      }
      tests=normalizeReport({...member,nativeRepositoryRoot:context.producerRepositoryRoot},native,stdout,collection,{allowNonPassing:true});
      blockers.push(...nativeReportBlockers(member,native));
    }
  }catch{blockers.push('INVALID_OR_MISSING_NATIVE_REPORT');}
  if(!tests.length)blockers.push('NO_EXECUTED_TESTS');
  for(const test of tests){if(test.status!=='passed')blockers.push('NON_PASSING_TEST');if(test.attempts>1||test.retry>0)blockers.push('RETRIED_TEST');
    for(const condition of test.forbiddenConditions??[])blockers.push(condition);}
  for(const file of collection.collected)if(!tests.some(test=>test.path===file))blockers.push('MISSING_EXECUTED_PATH');
  const report={schemaVersion:2,laneId:member.id,sourceSha:before.sourceSha,sourceFingerprint:before.sourceFingerprint,tree:before.tree,clean:before.clean,
    runIdentity,
    executionNonce:nonce,driverGroup:id,argv:member.argv,driver:member.driver??null,producedBy:member.producedBy??null,
    collected:collection.collected,exitCode:execution.status??1,signal:execution.signal??null,
    nativeReportFile:path.basename(nativePaths.get(member.id)),nativeReportSha256,
    nativeLaunchFile:`${member.id}.native.json.launch.json`,nativeLaunchSha256:bundle?.launch.sha256??null,
    nativeProvenanceFile:`${member.id}.native.json.provenance.json`,nativeProvenanceSha256:bundle?.provenance.sha256??null,
    tests,blockers:[...new Set(blockers)]};
  secureWrite(path.join(dir,`${member.id}.report.json`),report);
  console.log(JSON.stringify({lane:member.id,suites:collection.collected.length,tests:tests.length,passed:tests.filter(test=>test.status==='passed').length,blockers:report.blockers}));
  if(report.blockers.length)failed=true;
}
process.exit(failed?1:0);
}
try{main();}catch(error){
  const safeCodes=new Set(['QUALIFICATION_REQUIRES_CLEAN_SOURCE_TREE','QUALIFICATION_SOURCE_SHA_MISMATCH',
    'QUALIFICATION_TEST_DEBT',
    'QUALIFICATION_SOURCE_CHANGED_DURING_COLLECTION','LOCAL_QUALIFICATION_RUN_ID_REQUIRED','INVALID_GITHUB_RUN_IDENTITY',
    'UNKNOWN_TEST_LANE','TEST_LANE_REQUIRES_ITS_GROUP_PRODUCER','EVIDENCE_ALREADY_EXISTS']);
  const code=safeCodes.has(error?.message)?error.message:'TEST_LANE_EXECUTION_FAILED';
  try{
    const directory=path.resolve(process.env.NEXUS_TEST_EVIDENCE_DIR??'.artifacts/test-evidence');
    secureWrite(path.join(directory,'runner-error.private.json'),{code,errorMessage:String(error?.message??''),
      stdout:Buffer.isBuffer(error?.stdout)?error.stdout.toString('utf8'):String(error?.stdout??''),
      stderr:Buffer.isBuffer(error?.stderr)?error.stderr.toString('utf8'):String(error?.stderr??'')});
  }catch{/* Never replace an existing proof or publish private collector diagnostics. */}
  console.error(code);process.exitCode=1;
}
