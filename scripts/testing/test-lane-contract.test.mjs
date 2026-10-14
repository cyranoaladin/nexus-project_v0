import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionArgv, reconcileTestEvidence } from './test-lane-contract.mjs';
import { flattenPlaywright, assertFreshEvidence, readNativeEvidence, exportNativeEvidence, normalizeReport } from './test-lane-runtime.mjs';
import path from 'node:path';
import {mkdtempSync,writeFileSync,readFileSync,symlinkSync,rmSync,statSync,existsSync,readdirSync} from 'node:fs';
import {mkdirSync,chmodSync,copyFileSync,cpSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import * as runtime from './test-lane-runtime.mjs';
import {tmpdir} from 'node:os';
import {createLaunchPlan,readLaunchPlan,readNativeBundle} from './native-provenance.mjs';
const lane={id:'integration',runner:'jest',kind:'PRIMARY',argv:['--config','jest.integration.config.js','--runInBand','--testPathPatterns=(one|two)\\.real\\.test\\.ts','--testPathIgnorePatterns=excluded','--runTestsByPath','one.real.test.ts']};
function copyFixtureDependencies(directory,names){
  const dependencyRoot=realpathSync(path.resolve('node_modules')),copied=new Set();
  function copyDependency(name,from=process.cwd()){
    let packageDirectory;
    for(let current=from;;current=path.dirname(current)){
      const candidate=path.join(current,'node_modules',name);
      if(existsSync(path.join(candidate,'package.json'))){packageDirectory=realpathSync(candidate);break;}
      if(current===path.dirname(current))throw new Error('SYNTHETIC_DEPENDENCY_MISSING');
    }
    assert.equal(packageDirectory.startsWith(dependencyRoot+path.sep),true);
    if(copied.has(packageDirectory))return;copied.add(packageDirectory);
    const relative=path.relative(dependencyRoot,packageDirectory),destination=path.join(directory,'node_modules',relative);
    mkdirSync(path.dirname(destination),{recursive:true});cpSync(packageDirectory,destination,{recursive:true});
    const manifest=JSON.parse(readFileSync(path.join(packageDirectory,'package.json')));
    for(const dependency of Object.keys(manifest.dependencies??{}))copyDependency(dependency,packageDirectory);
    for(const dependency of Object.keys(manifest.optionalDependencies??{})){
      if(existsSync(path.join(dependencyRoot,dependency,'package.json'))
        ||existsSync(path.join(packageDirectory,'node_modules',dependency,'package.json')))copyDependency(dependency,packageDirectory);
    }
  }
  for(const name of names)copyDependency(name);
}
test('collection preserves every effective filter without splitting a quoted OR expression',()=>{
  assert.deepEqual(collectionArgv(lane),[...lane.argv,'--listTests','--json']);
});
test('Playwright collection preserves project, grep, positional path and repetition',()=>{
  const pw={...lane,runner:'playwright',argv:['test','--config=pw.ts','--project=webkit','one.spec.ts','--grep=one|two','--repeat-each=20','--retries=0']};
  assert.deepEqual(collectionArgv(pw),[...pw.argv,'--list','--reporter=json']);
});
test('a forbidden no-tests or focused option cannot be hidden in a registered lane',()=>{
  for(const arg of ['--passWithNoTests','--passWithNoTests=true','--watch','--onlyFailures','--test-only','--test-name-pattern=one',
    '--test-rerun-failures=last.json','--lf','--last-failed','--reruns=1'])assert.throws(()=>collectionArgv({...lane,argv:[...lane.argv,arg]}),/FORBIDDEN_TEST_OPTION/);
});
test('registered native browser roots cannot escape or alias the source repository',()=>{
  for(const testRoot of ['/outside','../outside','e2e/../outside','e2e//aria','e2e\\aria','e2e/./aria']){
    assert.throws(()=>runtime.validateRegistry({schemaVersion:1,lanes:[{id:'pw-fixture',runner:'playwright',kind:'PRIMARY',argv:['test'],testRoot}]}),/INVALID_TEST_ROOT/);
  }
});
const collection={sourceFingerprint:'d'.repeat(64),sourceSha:'a'.repeat(40),tree:'b'.repeat(40),clean:true,runIdentity:{kind:'GITHUB_ACTIONS',githubRunId:'123',githubRunAttempt:'1'},paths:['one.test.ts','two.test.ts'],lanes:[
  {id:'unit',kind:'PRIMARY',runner:'jest',argv:['--config','unit.js'],collected:['one.test.ts','two.test.ts']},
  {id:'repeat',kind:'SUPPLEMENTAL',runner:'jest',argv:['--config','repeat.js'],collected:['one.test.ts']}]};
const report=(id,tests)=>({schemaVersion:2,laneId:id,sourceFingerprint:collection.sourceFingerprint,sourceSha:collection.sourceSha,tree:collection.tree,clean:true,runIdentity:collection.runIdentity,driver:null,producedBy:null,driverGroup:id,executionNonce:'00000000-0000-4000-8000-000000000001',nativeReportFile:`${id}.native.json`,nativeReportSha256:'e'.repeat(64),nativeReportSha256Actual:'e'.repeat(64),nativeVerified:true,reportSha256:'f'.repeat(64),exitCode:0,
  signal:null,
  nativeLaunchFile:`${id}.native.json.launch.json`,nativeLaunchSha256:'1'.repeat(64),
  nativeProvenanceFile:`${id}.native.json.provenance.json`,nativeProvenanceSha256:'2'.repeat(64),
  argv:collection.lanes.find(lane=>lane.id===id)?.argv,collected:collection.lanes.find(lane=>lane.id===id)?.collected,blockers:[],
  tests:tests.map(([path,title,status='passed'])=>({path,title,status,project:null})),suites:[]});
/** Synthetic producer bytes for verifier tests, never qualification evidence. */
function attachFixtureProducer(file,lane,envelope){
  const repositoryRoot=process.cwd(),runner=lane.runner,argv=lane.argv??[];
  const context={sourceSha:collection.sourceSha,tree:collection.tree,sourceFingerprint:collection.sourceFingerprint,
    runIdentity:collection.runIdentity,executionNonce:'00000000-0000-4000-8000-000000000001',laneId:lane.id??'unit',
    driverGroup:lane.producedBy??lane.id??'unit',runner,argv,producerSources:[],producerRepositoryRoot:repositoryRoot,
    runtimeOptions:runtime.qualifiedRuntimeOptions(lane)};
  const raw=runner==='node'?[process.execPath,'--test','--test-reporter=./scripts/testing/node-json-reporter.mjs',...argv]
    :runner==='jest'?[process.execPath,path.resolve('node_modules/jest/bin/jest.js'),...argv,'--json',`--outputFile=${file}`,
      '--reporters','default','--reporters','./scripts/testing/jest-native-reporter.mjs']
    :[process.execPath,path.resolve('node_modules/@playwright/test/cli.js'),...argv,'--reporter=./scripts/testing/playwright-native-reporter.mjs'];
  const launch={schemaVersion:'nexus-test-producer-launch/v1',context,producerNonce:'00000000-0000-4000-8000-000000000002',
    producerSources:context.producerSources,invocation:{commandLine:raw,repositoryRoot,
      runtimeOptions:context.runtimeOptions,canonicalEntrypoint:runner==='node'?null:raw[1]}};
  const launchBytes=JSON.stringify(launch)+'\n',nativeBytes=readFileSync(file),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  writeFileSync(file+'.launch.json',launchBytes,{mode:0o600});
  const seal=JSON.stringify({schemaVersion:'nexus-test-native-provenance/v1',producerNonce:launch.producerNonce,
    launchSha256:sha(launchBytes),nativeSha256:sha(nativeBytes),nativeByteLength:nativeBytes.length})+'\n';
  writeFileSync(file+'.provenance.json',seal,{mode:0o600});
  if(envelope)Object.assign(envelope,{nativeLaunchFile:`${context.laneId}.native.json.launch.json`,nativeLaunchSha256:sha(launchBytes),
    nativeProvenanceFile:`${context.laneId}.native.json.provenance.json`,nativeProvenanceSha256:sha(seal)});
  return [context];
}
test('duplicate supplemental executions never inflate unique test totals',()=>{
  const result=reconcileTestEvidence(collection,[report('unit',[['one.test.ts','same'],['two.test.ts','other']]),report('repeat',[['one.test.ts','same']])]);
  assert.deepEqual(result.blockers,[]);assert.equal(result.totals.uniqueTests,2);assert.equal(result.totals.executions,3);
});
test('homonymous assertions in one lane stay distinct while the same supplementary occurrences deduplicate',()=>{
  const first=report('unit',[['one.test.ts','same'],['one.test.ts','same'],['two.test.ts','other']]);
  first.tests=first.tests.map((value,index)=>({...value,logicalOccurrence:index===1?1:0}));
  const repeat=report('repeat',[['one.test.ts','same'],['one.test.ts','same']]);
  repeat.tests=repeat.tests.map((value,index)=>({...value,logicalOccurrence:index}));
  const result=reconcileTestEvidence(collection,[first,repeat]);
  assert.equal(result.totals.uniqueTests,3);assert.equal(result.totals.additionalExecutions,2);
});
test('Jest normalization preserves source location and distinct logical occurrences',()=>{
  const native=jestNative();native.numTotalTests=2;native.numPassedTests=2;
  native.testResults[0].assertionResults[0].location={line:12,column:4};
  native.testResults[0].assertionResults.push({...native.testResults[0].assertionResults[0]});
  const tests=normalizeReport({runner:'jest'},native,'');
  assert.equal(tests[0].line,12);assert.equal(tests[0].column,4);
  assert.equal(tests[0].logicalOccurrence,0);assert.equal(tests[1].logicalOccurrence,1);
});
test('execution blockers, retried tests and drifted argv or collection cannot be cleared by a passing status',()=>{
  const passing=report('unit',[['one.test.ts','same'],['two.test.ts','other']]);
  for(const change of [{blockers:['SOURCE_CHANGED_DURING_TEST']},{blockers:['RETRIED_TEST']},
    {argv:['--config','weakened.js']},{collected:['one.test.ts']},
    {tests:passing.tests.map(test=>({...test,attempts:2}))}]) {
    const result=reconcileTestEvidence(collection,[{...passing,...change},report('repeat',[['one.test.ts','same']])]);
    assert.ok(result.blockers.length>0);
  }
});
test('an assigned file missing from the real execution report remains blocking',()=>{
  const result=reconcileTestEvidence(collection,[report('unit',[['one.test.ts','same']]),report('repeat',[['one.test.ts','same']])]);
  assert.ok(result.blockers.includes('MISSING_EXECUTED_PATH:unit:two.test.ts'));
});
test('skips, todos, failures, stale source and failed runner exits are blocking',()=>{
  for(const status of ['skipped','todo','failed','pending']){
    const result=reconcileTestEvidence(collection,[report('unit',[['one.test.ts','same',status],['two.test.ts','other']]),report('repeat',[['one.test.ts','same']])]);
    assert.ok(result.blockers.some(blocker=>blocker.startsWith('NON_PASSING_TEST:')));
  }
  for(const change of [{sourceFingerprint:'c'.repeat(64)},{sourceSha:'b'.repeat(40)},{exitCode:1}]){
    const result=reconcileTestEvidence(collection,[{...report('unit',[['one.test.ts','same'],['two.test.ts','other']]),...change},report('repeat',[['one.test.ts','same']])]);
    assert.ok(result.blockers.length>0);
  }
});
test('manual lanes without a report are not credited as executed',()=>{
  const manual={...collection,lanes:[{id:'manual',kind:'REHEARSAL',runner:'playwright',argv:['test'],collected:['one.test.ts','two.test.ts']}]};
  assert.deepEqual(reconcileTestEvidence(manual,[]).blockers,['MISSING_EXECUTION_REPORT:manual']);
});
test('Playwright native paths resolve against its testDir rather than the repository root',()=>{
  const native={config:{rootDir:path.resolve('e2e/auth')},suites:[{title:'accounts.spec.ts',file:'accounts.spec.ts',specs:[
    {title:'session authority',file:'accounts.spec.ts',tests:[{expectedStatus:'passed',projectName:'chromium',results:[{status:'passed'}]}]}]}]};
  assert.equal(flattenPlaywright(native)[0].path,'e2e/auth/accounts.spec.ts');
  native.suites[0].specs[0].file=path.resolve('e2e/auth/accounts.spec.ts');
  assert.equal(flattenPlaywright(native)[0].path,'e2e/auth/accounts.spec.ts');
});
test('container Playwright paths use an explicit source root and preserve individual repeat occurrences',()=>{
  const native={config:{rootDir:'/app/e2e/aria'},suites:[{title:'visual.spec.ts',specs:[0,1].map(index=>({
    id:`test-id-repeat:${index}`,title:'viewport',file:'visual.spec.ts',line:42,column:3,
    tests:[{projectName:'aria-mobile',expectedStatus:'passed',results:[{status:'passed',retry:0}]}]}))}]};
  const result=flattenPlaywright(native,'e2e/aria');
  assert.equal(result[0].path,'e2e/aria/visual.spec.ts');
  assert.notEqual(result[0].occurrenceId,result[1].occurrenceId);
  assert.equal(result[0].title,result[1].title);
  assert.equal(result[0].line,42);
  native.suites[0].specs[0].file='../escape.spec.ts';
  assert.throws(()=>flattenPlaywright(native,'e2e/aria'),/PLAYWRIGHT_PATH_OUTSIDE_TEST_ROOT/);
});
test('a missing collected test occurrence is blocking even when its file executed successfully',()=>{
  const detailed={...collection,lanes:collection.lanes.map(lane=>lane.id==='unit'?{...lane,testItems:[
    {path:'one.test.ts',title:'same',occurrenceId:'a'},{path:'one.test.ts',title:'same',occurrenceId:'b'},
    {path:'two.test.ts',title:'other',occurrenceId:'c'}]}:lane)};
  const passing=report('unit',[['one.test.ts','same'],['two.test.ts','other']]);
  passing.tests=passing.tests.map((test,index)=>({...test,occurrenceId:index?'c':'a'}));
  assert.ok(reconcileTestEvidence(detailed,[passing,report('repeat',[['one.test.ts','same']])]).blockers
    .some(blocker=>blocker.startsWith('MISSING_EXECUTED_OCCURRENCE:unit:')));
});
test('native evidence must be a fresh regular file and existing or symlinked proof is preserved',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'nexus-evidence-test-'));
  try{
    const file=path.join(dir,'native.json');assertFreshEvidence([file]);writeFileSync(file,'{"suites":[]}',{mode:0o600});
    assert.throws(()=>assertFreshEvidence([file]),/EVIDENCE_ALREADY_EXISTS/);
    assert.equal(readNativeEvidence(file).value.suites.length,0);
    const link=path.join(dir,'link.json');symlinkSync(file,link);
    assert.throws(()=>readNativeEvidence(link),/INVALID_NATIVE_EVIDENCE/);
    assert.equal(readFileSync(file,'utf8'),'{"suites":[]}');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('a container native report is exported privately and never overwrites existing evidence',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'nexus-native-export-'));
  try{
    const source=path.join(dir,'source.json'),output=path.join(dir,'output.json');
    writeFileSync(source,'{"stats":{"expected":1},"suites":[]}');
    assert.throws(()=>exportNativeEvidence(source,'relative.json'),/ABSOLUTE/);
    const [context]=attachFixtureProducer(source,{runner:'jest',id:'unit',argv:[]});
    exportNativeEvidence(source,output,context);
    assert.equal(statSync(output).mode&0o777,0o600);
    assert.deepEqual(readNativeEvidence(output).value,readNativeEvidence(source).value);
    assert.deepEqual(readFileSync(output),readFileSync(source));
    assert.deepEqual(readFileSync(output+'.launch.json'),readFileSync(source+'.launch.json'));
    assert.deepEqual(readFileSync(output+'.provenance.json'),readFileSync(source+'.provenance.json'));
    const bytes=readFileSync(output);assert.throws(()=>exportNativeEvidence(source,output,context),/ALREADY_EXISTS/);
    assert.deepEqual(readFileSync(output),bytes);
    writeFileSync(source,'not json');const invalid=path.join(dir,'invalid.json');
    assert.throws(()=>exportNativeEvidence(source,invalid,context),/INVALID_NATIVE/);assert.equal(existsSync(invalid),false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('export cannot invent producer provenance for a native JSON without launch companions',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-native-missing-producer-'));
  try{
    const source=path.join(directory,'native.json'),destination=path.join(directory,'export.json');
    writeFileSync(source,JSON.stringify({stats:{expected:1},suites:[]}));
    assert.throws(()=>exportNativeEvidence(source,destination,{laneId:'unit',executionNonce:'00000000-0000-4000-8000-000000000001'}),/PROVENANCE/);
    assert.equal(existsSync(destination),false);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
const jestNative=()=>({success:true,wasInterrupted:false,numTotalTests:1,numPassedTests:1,numFailedTests:0,
  numPendingTests:0,numTodoTests:0,numTotalTestSuites:1,numPassedTestSuites:1,numFailedTestSuites:0,
  numPendingTestSuites:0,numRuntimeErrorTestSuites:0,testResults:[{name:path.resolve('one.test.ts'),status:'passed',
    assertionResults:[{fullName:'one assertion',status:'passed',invocations:1,retryReasons:[],retryMessages:[],failureMessages:[],failureDetails:[],failing:false}]}]});
test('Jest native evidence reconciles counters and rejects runtime errors, retries and expected failures',()=>{
  const native=jestNative();assert.equal(normalizeReport({runner:'jest'},native,'').length,1);
  for(const alter of [value=>value.numFailedTests=1,value=>value.numTotalTests=2,
    value=>value.testResults[0].testExecError={code:'synthetic'},
    value=>value.testResults[0].assertionResults[0].invocations=2,
    value=>value.testResults[0].assertionResults[0].retryReasons=['synthetic'],
    value=>value.testResults[0].assertionResults[0].failing=true]){
    const bad=jestNative();alter(bad);assert.throws(()=>normalizeReport({runner:'jest'},bad,''),/INVALID_NATIVE/);
  }
});
const playwrightNative=()=>({config:{rootDir:'/app/e2e'},errors:[],stats:{expected:1,unexpected:0,skipped:0,flaky:0},
  suites:[{title:'one.spec.ts',specs:[{id:'one-id',title:'one assertion',file:'one.spec.ts',line:1,column:1,ok:true,
    tests:[{projectName:'chromium',expectedStatus:'passed',status:'expected',annotations:[],results:[{status:'passed',retry:0,errors:[]}]}]}]}]});
test('Playwright native evidence refuses contradictions, masked retries and annotations while collection remains separate',()=>{
  assert.equal(normalizeReport({runner:'playwright'},playwrightNative(),'',{testRoot:'e2e'}).length,1);
  for(const alter of [value=>value.stats.expected=2,value=>value.stats.flaky=1,
    value=>value.suites[0].specs[0].ok=false,value=>value.suites[0].specs[0].tests[0].status='flaky',
    value=>value.suites[0].specs[0].tests[0].results[0].retry=1,
    value=>value.suites[0].specs[0].tests[0].results[0].errors=[{message:'synthetic'}],
    value=>value.suites[0].specs[0].tests[0].annotations=[{type:'skip'}]]){
    const bad=playwrightNative();alter(bad);assert.throws(()=>normalizeReport({runner:'playwright'},bad,'',{testRoot:'e2e'}),/INVALID_NATIVE/);
  }
  const list=playwrightNative();list.suites[0].specs[0].tests[0].results=[];
  assert.equal(flattenPlaywright(list,'e2e').length,1);
});
test('Node native structured evidence counts nested tests and refuses inconsistent summaries',()=>{
  const lane={runner:'node',argv:['one.test.mjs']};
  const value={schemaVersion:'node-test-native/v1',tests:[{file:path.resolve('one.test.mjs'),title:'nested assertion',
    type:'test',status:'passed',line:4,column:2}],summary:{success:true,counts:{tests:1,passed:1,failed:0,cancelled:0,skipped:0,todo:0,suites:0}}};
  assert.equal(normalizeReport(lane,value,'').length,1);
  for(const bad of [{...value,summary:{...value.summary,counts:{...value.summary.counts,tests:2}}},
    {...value,tests:[{...value.tests[0],file:path.resolve('outside.test.mjs')}]}]){
    assert.throws(()=>normalizeReport(lane,bad,''),/INVALID_NATIVE/);
  }
});
test('well-formed failing native reports retain their exact outcomes for the closed gate',()=>{
  const jest=jestNative();jest.success=false;jest.numPassedTests=0;jest.numFailedTests=1;
  jest.numPassedTestSuites=0;jest.numFailedTestSuites=1;jest.testResults[0].status='failed';
  jest.testResults[0].assertionResults[0].status='failed';jest.testResults[0].assertionResults[0].failureMessages=['PRIVATE_FAILURE_SENTINEL'];
  const outcomes=normalizeReport({runner:'jest'},jest,'',null,{allowNonPassing:true});
  assert.equal(outcomes.length,1);assert.equal(outcomes[0].status,'failed');assert.equal(JSON.stringify(outcomes).includes('PRIVATE_FAILURE_SENTINEL'),false);
  const pw=playwrightNative();pw.stats.expected=0;pw.stats.unexpected=1;pw.suites[0].specs[0].ok=false;
  pw.suites[0].specs[0].tests[0].status='unexpected';pw.suites[0].specs[0].tests[0].results[0].status='failed';
  assert.equal(normalizeReport({runner:'playwright'},pw,'',{testRoot:'e2e'},{allowNonPassing:true})[0].status,'failed');
  const node={schemaVersion:'node-test-native/v1',tests:[{file:path.resolve('one.test.mjs'),title:'failed',type:'test',status:'failed'}],summary:{success:false,counts:{tests:1,passed:0,failed:1,cancelled:0,skipped:0,todo:0,suites:0}}};
  assert.equal(normalizeReport({runner:'node',argv:['one.test.mjs']},node,'',null,{allowNonPassing:true})[0].status,'failed');
  const python={schemaVersion:'pytest-native/v2',exitCode:1,tests:[{path:'test_one.py',title:'test_one',nodeid:'test_one.py::test_one',project:null,status:'failed',attempts:1,forbiddenMarks:[]}],phases:['setup','call','teardown'].map(when=>({nodeid:'test_one.py::test_one',when,status:when==='call'?'failed':'passed'}))};
  assert.equal(normalizeReport({runner:'python'},python,'',null,{allowNonPassing:true})[0].status,'failed');
  for(const [runner,native,argv] of [['jest',jest,[]],['playwright',pw,[]],['node',node,['one.test.mjs']],['python',python,[]]])assert.throws(()=>normalizeReport({runner,argv},native,'',{testRoot:'e2e'}),/INVALID_NATIVE/);
});
test('Python native identity, marker arrays and phase outcome are structurally mandatory',()=>{
  const python={schemaVersion:'pytest-native/v2',exitCode:0,tests:[{path:'test_one.py',title:'test_one',nodeid:'test_one.py::test_one',project:null,status:'passed',attempts:1,forbiddenMarks:[]}],phases:['setup','call','teardown'].map(when=>({nodeid:'test_one.py::test_one',when,status:'passed'}))};
  assert.equal(normalizeReport({runner:'python'},python,'').length,1);
  for(const change of [value=>delete value.tests[0].forbiddenMarks,value=>value.tests[0].nodeid='outside.py::test_one',value=>value.phases[2].status='failed']){
    const bad=structuredClone(python);change(bad);assert.throws(()=>normalizeReport({runner:'python'},bad,'',null,{allowNonPassing:true}),/INVALID_NATIVE/);
  }
});

test('all envelope identities, native verification and clean-source metadata are mandatory',()=>{
  const passing=report('unit',[['one.test.ts','same'],['two.test.ts','other']]);
  for(const change of [{schemaVersion:1},{tree:'c'.repeat(40)},{clean:false},{runIdentity:{...collection.runIdentity,githubRunAttempt:'2'}},
    {driver:{binary:'BASH',argv:['foreign.sh']}},{producedBy:'foreign'},{driverGroup:'foreign'},
    {executionNonce:'not-a-uuid'},{nativeReportFile:'../foreign.json'},{nativeVerified:false},
    {nativeReportSha256Actual:'a'.repeat(64)},{reportSha256:null}]){
    const result=reconcileTestEvidence(collection,[{...passing,...change},report('repeat',[['one.test.ts','same']])]);
    assert.ok(result.blockers.length>0,JSON.stringify(change));
  }
  for(const field of ['schemaVersion','tree','clean','runIdentity','driver','producedBy','driverGroup','executionNonce','nativeReportFile','nativeReportSha256','nativeVerified','reportSha256','signal']){
    const incomplete={...passing};delete incomplete[field];
    assert.ok(reconcileTestEvidence(collection,[incomplete,report('repeat',[['one.test.ts','same']])]).blockers.length>0,field);
  }
});
test('collector failure cannot expose private stderr in the actual runner public output',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-collector-redaction-'));
  try{
    mkdirSync(path.join(directory,'scripts/testing'),{recursive:true});mkdirSync(path.join(directory,'.github/governance'),{recursive:true});
    mkdirSync(path.join(directory,'node_modules/jest/bin'),{recursive:true});
    for(const name of ['run-test-lane.mjs','test-lane-runtime.mjs','test-lane-contract.mjs','node-json-reporter.mjs','check-zero-test-debt.mjs','native-provenance.mjs'])copyFileSync(path.resolve('scripts/testing',name),path.join(directory,'scripts/testing',name));
    symlinkSync(path.resolve('node_modules/typescript'),path.join(directory,'node_modules/typescript'),'dir');
    writeFileSync(path.join(directory,'node_modules/jest/bin/jest.js'),"console.error('PRIVATE_COLLECTOR_SENTINEL@example.test');process.exit(23);");
    writeFileSync(path.join(directory,'one.test.ts'),'');writeFileSync(path.join(directory,'.gitignore'),'.artifacts/\nnode_modules/typescript\n');
    writeFileSync(path.join(directory,'.github/governance/test-lanes.json'),JSON.stringify({schemaVersion:1,lanes:[{id:'jest-fixture',runner:'jest',kind:'PRIMARY',argv:[]}]}));
    execFileSync('git',['init','-q'],{cwd:directory});execFileSync('git',['add','.'],{cwd:directory});execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.test','commit','-qm','fixture'],{cwd:directory});
    const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8'}).trim();
    const result=spawnSync(process.execPath,['scripts/testing/run-test-lane.mjs','jest-fixture'],{cwd:directory,encoding:'utf8',env:{...process.env,GITHUB_RUN_ID:'',GITHUB_RUN_ATTEMPT:'',NEXUS_QUALIFICATION_RUN_ID:'00000000-0000-4000-8000-000000000001',NEXUS_EXPECTED_SOURCE_SHA:sha}});
    assert.notEqual(result.status,0);assert.equal((result.stdout+result.stderr).includes('PRIVATE_COLLECTOR_SENTINEL'),false);
    assert.equal(result.stderr.trim(),'TEST_LANE_EXECUTION_FAILED');
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('a grouped secondary report cannot come from another execution nonce or process result',()=>{
  const grouped={...collection,lanes:collection.lanes.map(lane=>lane.id==='repeat'?{...lane,producedBy:'unit'}:lane)};
  const secondary={...report('repeat',[['one.test.ts','same']]),producedBy:'unit',driverGroup:'unit'};
  assert.deepEqual(reconcileTestEvidence(grouped,[report('unit',[['one.test.ts','same'],['two.test.ts','other']]),secondary]).blockers,[]);
  const foreign={...secondary,executionNonce:'00000000-0000-4000-8000-000000000002'};
  assert.ok(reconcileTestEvidence(grouped,[report('unit',[['one.test.ts','same'],['two.test.ts','other']]),foreign]).blockers.some(value=>value.startsWith('DRIVER_GROUP_MISMATCH:')));
});
test('CI may report manual qualification pending but final qualification never credits it',()=>{
  const manual={...collection,lanes:collection.lanes.map(lane=>({...lane,kind:'REHEARSAL'}))};
  const ci=reconcileTestEvidence(manual,[],{scope:'CI'});
  assert.deepEqual(ci.blockers,[]);assert.equal(ci.verdict,'CI_QUALIFIED_MANUAL_PENDING');
  assert.equal(ci.releaseQualified,false);assert.equal(ci.pendingRehearsals.length,2);
  assert.equal(reconcileTestEvidence(manual,[]).blockers.length,2);
});
test('recursive execution loading verifies real native bytes and rejects altered, missing or symlinked proofs',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-native-verify-'));
  const nested=path.join(directory,'artifact','job');mkdirSync(nested,{recursive:true});
  try{
    const native=jestNative(),bytes=JSON.stringify(native),hash=createHash('sha256').update(bytes).digest('hex');
    const normalized=normalizeReport({runner:'jest'},native,'');
    const envelope=report('unit',[['one.test.ts','one assertion']]);
    for(const reserved of ['nativeVerified','nativeReportSha256Actual','reportSha256'])delete envelope[reserved];
    envelope.nativeReportSha256=hash;envelope.tests=normalized;
    const file=path.join(nested,'unit.report.json'),nativeFile=path.join(nested,'unit.native.json');
    writeFileSync(nativeFile,bytes);const contexts=attachFixtureProducer(nativeFile,collection.lanes[0],envelope);
    writeFileSync(file,JSON.stringify(envelope));
    assert.equal(runtime.loadExecutionReports(directory,collection.lanes,contexts).length,1);
    const loaded=runtime.loadExecutionReports(directory,collection.lanes,contexts)[0];
    assert.equal(loaded.nativeVerified,true);assert.match(loaded.reportSha256,/^[a-f0-9]{64}$/);
    writeFileSync(file,JSON.stringify({...envelope,tests:[]}));
    assert.throws(()=>runtime.loadExecutionReports(directory,collection.lanes,contexts),/INVALID_EXECUTION/);
    writeFileSync(file,JSON.stringify(envelope));writeFileSync(nativeFile,JSON.stringify({...native,numTotalTests:2}));
    assert.throws(()=>runtime.loadExecutionReports(directory,collection.lanes,contexts),/INVALID_EXECUTION/);
    rmSync(nativeFile);assert.throws(()=>runtime.loadExecutionReports(directory,collection.lanes,contexts),/INVALID_EXECUTION/);
    const other=path.join(directory,'other.json');writeFileSync(other,bytes);symlinkSync(other,nativeFile);
    assert.throws(()=>runtime.loadExecutionReports(directory,collection.lanes,contexts),/INVALID_EXECUTION/);
    assert.equal(readFileSync(other,'utf8'),bytes);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('source identity includes modes and refuses a test symlink outside its repository',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-source-mode-'));
  try{
    execFileSync('git',['init','-q'],{cwd:directory});
    const file=path.join(directory,'one.test.mjs');writeFileSync(file,'export {};');chmodSync(file,0o644);
    execFileSync('git',['add','.'],{cwd:directory});
    execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.test','commit','-qm','fixture'],{cwd:directory});
    const first=runtime.sourceIdentity(directory);assert.equal(first.clean,true);
    chmodSync(file,0o755);const second=runtime.sourceIdentity(directory);
    assert.notEqual(first.sourceFingerprint,second.sourceFingerprint);assert.equal(second.clean,false);
    symlinkSync(path.resolve('scripts/testing/test-lane-contract.test.mjs'),path.join(directory,'external.test.mjs'));
    assert.throws(()=>runtime.sourceIdentity(directory),/NON_REGULAR_SOURCE_INPUT/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('a registry refuses absent, recursive or incompatible driver groups',()=>{
  const primary={id:'producer',runner:'playwright',kind:'PRIMARY',argv:['test'],driver:{binary:'BASH',argv:['scripts/driver.sh']}};
  const secondary={id:'repeat',runner:'playwright',kind:'SUPPLEMENTAL',argv:['test','--repeat-each=20'],producedBy:'producer'};
  const valid={schemaVersion:1,lanes:[primary,secondary]};assert.equal(runtime.validateRegistry(valid),valid);
  for(const bad of [{...valid,lanes:[primary,{...secondary,producedBy:'absent'}]},
    {...valid,lanes:[{...primary,producedBy:'repeat'},secondary]},
    {...valid,lanes:[primary,{...secondary,runner:'jest'}]},
    {...valid,lanes:[{...primary,driver:{binary:'BASH',argv:['scripts/testing/run-test-lane.mjs']}},secondary]}]){
    assert.throws(()=>runtime.validateRegistry(bad),/INVALID_TEST_DRIVER/);
  }
});
test('the actual runner refuses dirty input and detects a clean-source mutation during nested Node execution',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-qualified-runner-'));
  try{
    mkdirSync(path.join(directory,'scripts/testing'),{recursive:true});mkdirSync(path.join(directory,'.github/governance'),{recursive:true});
    for(const name of ['run-test-lane.mjs','test-lane-runtime.mjs','test-lane-contract.mjs','node-json-reporter.mjs','check-zero-test-debt.mjs','native-provenance.mjs'])
      copyFileSync(path.resolve('scripts/testing',name),path.join(directory,'scripts/testing',name));
    const fixture=path.join(directory,'one.test.mjs');
    writeFileSync(fixture,"import test from 'node:test';import fs from 'node:fs';test('parent',async t=>{await t.test('nested',()=>{});if(process.env.SYNTHETIC_MUTATION==='1')fs.writeFileSync('sentinel','changed');});\n");
    writeFileSync(path.join(directory,'sentinel'),'original');writeFileSync(path.join(directory,'.gitignore'),'.artifacts/\nnode_modules\n');
    symlinkSync(path.resolve('node_modules'),path.join(directory,'node_modules'),'dir');
    writeFileSync(path.join(directory,'.github/governance/test-lanes.json'),JSON.stringify({schemaVersion:1,lanes:[{id:'node-fixture',runner:'node',kind:'PRIMARY',argv:['one.test.mjs']}]}));
    execFileSync('git',['init','-q'],{cwd:directory});execFileSync('git',['add','.'],{cwd:directory});
    execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.test','commit','-qm','fixture'],{cwd:directory});
    const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8'}).trim();
    const launchFile=path.join(directory,'.artifacts/launch-plan.json');mkdirSync(path.dirname(launchFile),{recursive:true});
    const fixtureLanes=JSON.parse(readFileSync(path.join(directory,'.github/governance/test-lanes.json'))).lanes;
    writeFileSync(launchFile,JSON.stringify(createLaunchPlan(runtime.sourceIdentity(directory),fixtureLanes,
      {kind:'LOCAL_QUALIFICATION',qualificationRunId:'00000000-0000-4000-8000-000000000001'})),{mode:0o600});
    const execute=(name,extra={})=>spawnSync(process.execPath,['scripts/testing/run-test-lane.mjs','node-fixture'],{cwd:directory,encoding:'utf8',env:{...process.env,
      GITHUB_RUN_ID:'',GITHUB_RUN_ATTEMPT:'',NEXUS_QUALIFICATION_RUN_ID:'00000000-0000-4000-8000-000000000001',NEXUS_EXPECTED_SOURCE_SHA:sha,
      NEXUS_TEST_LAUNCH_MANIFEST:launchFile,NEXUS_TEST_EVIDENCE_DIR:path.join(directory,'.artifacts',name),...extra}});
    writeFileSync(path.join(directory,'sentinel'),'dirty');const dirty=execute('dirty');assert.notEqual(dirty.status,0);
    assert.match(dirty.stderr,/CLEAN_SOURCE_TREE/);assert.equal(existsSync(path.join(directory,'.artifacts/dirty/node-fixture.native.json')),false);
    writeFileSync(path.join(directory,'sentinel'),'original');const passed=execute('passing');assert.equal(passed.status,0,passed.stdout+passed.stderr);
    const passing=JSON.parse(readFileSync(path.join(directory,'.artifacts/passing/node-fixture.report.json')));assert.equal(passing.tests.length,2);
    const preload=path.join(directory,'.artifacts/outside-source.cjs'),marker=path.join(directory,'.artifacts/preload-marker');
    writeFileSync(preload,`if(process.env.NEXUS_TEST_NATIVE_OUTPUT)require('node:fs').writeFileSync(${JSON.stringify(marker)},'unexpected preload');`);
    const inherited=execute('inherited',{NODE_OPTIONS:`--require=${preload}`});
    assert.equal(inherited.status,0,inherited.stdout+inherited.stderr);
    assert.equal(existsSync(marker),false,'the qualified producer must not inherit an external preload');
    const changed=execute('changed',{SYNTHETIC_MUTATION:'1'});assert.equal(changed.status,1);
    const failed=JSON.parse(readFileSync(path.join(directory,'.artifacts/changed/node-fixture.report.json')));
    assert.deepEqual(failed.blockers,['SOURCE_CHANGED_DURING_TEST']);
    writeFileSync(path.join(directory,'sentinel'),'original');
    writeFileSync(fixture,"import test from 'node:test'; test('focused', {only:true},()=>{});\n");
    execFileSync('git',['add','.'],{cwd:directory});
    execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.test','commit','-qm','focused fixture'],{cwd:directory});
    const focusedSha=execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8'}).trim();
    const focused=execute('focused',{NEXUS_EXPECTED_SOURCE_SHA:focusedSha});
    assert.notEqual(focused.status,0);assert.match(focused.stderr,/QUALIFICATION_TEST_DEBT/);
    assert.equal(existsSync(path.join(directory,'.artifacts/focused/node-fixture.native.json')),false);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('non-passing normalization cannot certify incomplete or duplicated passing Python phases',()=>{
  const python={schemaVersion:'pytest-native/v2',exitCode:0,tests:[{path:'test_one.py',title:'test_one',nodeid:'test_one.py::test_one',project:null,status:'passed',attempts:1,forbiddenMarks:[]}],phases:['setup','call','teardown'].map(when=>({nodeid:'test_one.py::test_one',when,status:'passed'}))};
  for(const phases of [['setup','call','setup'],['call','setup','teardown'],['setup','call']]){
    const bad=structuredClone(python);bad.phases=phases.map(when=>({nodeid:'test_one.py::test_one',when,status:'passed'}));
    assert.throws(()=>normalizeReport({runner:'python'},bad,'',null,{allowNonPassing:true}),/INVALID_NATIVE/);
  }
});

test('Playwright manifests preserve observed skips and expected-failure outcomes without qualifying them',()=>{
  for(const [expectedStatus,observedStatus,runnerStatus,normalizedStatus] of [
    ['passed','skipped','skipped','skipped'],['failed','failed','expected','failed'],['failed','passed','unexpected','passed'],
  ]){
    const native=playwrightNative();const t=native.suites[0].specs[0].tests[0];
    t.expectedStatus=expectedStatus;t.status=runnerStatus;t.results[0].status=observedStatus;
    native.stats={expected:0,unexpected:0,skipped:0,flaky:0};native.stats[runnerStatus]=1;
    const actual=normalizeReport({runner:'playwright'},native,'',{testRoot:'e2e'},{allowNonPassing:true})[0];
    assert.equal(actual.status,normalizedStatus);
    if(expectedStatus!=='passed')assert.ok(actual.forbiddenConditions.includes('EXPECTED_NON_PASSING_RESULT'));
  }
});

test('the actual loader rederives native global failures even when envelope blockers are removed',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-native-global-errors-'));
  try{
    for(const flags of [{success:false},{wasInterrupted:true}]){
      const native={...jestNative(),...flags},bytes=JSON.stringify(native);
      const envelope=report('unit',[['one.test.ts','one assertion']]);
      for(const reserved of ['nativeVerified','nativeReportSha256Actual','reportSha256'])delete envelope[reserved];
      envelope.nativeReportSha256=createHash('sha256').update(bytes).digest('hex');
      envelope.tests=normalizeReport({runner:'jest'},native,'',null,{allowNonPassing:true});
      envelope.blockers=[];
      writeFileSync(path.join(directory,'unit.native.json'),bytes);
      const contexts=attachFixtureProducer(path.join(directory,'unit.native.json'),collection.lanes[0],envelope);
      writeFileSync(path.join(directory,'unit.report.json'),JSON.stringify(envelope));
      assert.throws(()=>runtime.loadExecutionReports(directory,collection.lanes,contexts),/INVALID_EXECUTION/);
    }
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('the actual loader rejects failing suites even if every flattened assertion passes',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-native-suite-errors-'));
  try{
    const jest=jestNative();jest.numPassedTestSuites=0;jest.numFailedTestSuites=1;jest.testResults[0].status='failed';
    const pw=playwrightNative();pw.config.rootDir=path.resolve('e2e');pw.suites[0].specs[0].ok=false;
    const node={schemaVersion:'node-test-native/v1',tests:[
      {file:path.resolve('one.test.mjs'),title:'suite failed in teardown',type:'suite',status:'failed'},
      {file:path.resolve('one.test.mjs'),title:'one assertion',type:'test',status:'passed'}],
      summary:{success:true,counts:{tests:1,suites:1,passed:1,failed:0,cancelled:0,skipped:0,todo:0}}};
    for(const [runner,native,argv,testRoot] of [['jest',jest,[]],['playwright',pw,['test'],'e2e'],['node',node,['one.test.mjs']]]){
      const lane={id:'unit',runner,argv,testRoot},bytes=JSON.stringify(native);
      const envelope=report('unit',[]);
      for(const reserved of ['nativeVerified','nativeReportSha256Actual','reportSha256'])delete envelope[reserved];
      envelope.nativeReportSha256=createHash('sha256').update(bytes).digest('hex');
      envelope.tests=normalizeReport(lane,native,'',lane,{allowNonPassing:true});envelope.blockers=[];
      writeFileSync(path.join(directory,'unit.native.json'),bytes);
      const contexts=attachFixtureProducer(path.join(directory,'unit.native.json'),lane,envelope);
      writeFileSync(path.join(directory,'unit.report.json'),JSON.stringify(envelope));
      assert.throws(()=>runtime.loadExecutionReports(directory,[lane],contexts),/INVALID_EXECUTION/,runner);
    }
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('the actual loader rejects a failed Node runner with passing assertions and a cleared envelope',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-node-global-errors-'));
  try{
    const lane={id:'unit',runner:'node',argv:['one.test.mjs']};
    const native={schemaVersion:'node-test-native/v1',tests:[{file:path.resolve('one.test.mjs'),title:'one assertion',type:'test',status:'passed'}],
      summary:{success:false,counts:{tests:1,suites:0,passed:1,failed:0,cancelled:0,skipped:0,todo:0}}};
    const bytes=JSON.stringify(native),envelope=report('unit',[]);
    for(const reserved of ['nativeVerified','nativeReportSha256Actual','reportSha256'])delete envelope[reserved];
    envelope.nativeReportSha256=createHash('sha256').update(bytes).digest('hex');
    envelope.tests=normalizeReport(lane,native,'',lane,{allowNonPassing:true});envelope.blockers=[];
    writeFileSync(path.join(directory,'unit.native.json'),bytes);const contexts=attachFixtureProducer(path.join(directory,'unit.native.json'),lane,envelope);
    writeFileSync(path.join(directory,'unit.report.json'),JSON.stringify(envelope));
    assert.throws(()=>runtime.loadExecutionReports(directory,[lane],contexts),/INVALID_EXECUTION/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('Node suite identities and titles belong to the registered files independently of their assertions',()=>{
  const lane={runner:'node',argv:['one.test.mjs']},native={schemaVersion:'node-test-native/v1',tests:[
    {file:path.resolve('one.test.mjs'),title:'suite',type:'suite',status:'passed'},
    {file:path.resolve('one.test.mjs'),title:'one assertion',type:'test',status:'passed'}],
    summary:{success:true,counts:{tests:1,suites:1,passed:1,failed:0,cancelled:0,skipped:0,todo:0}}};
  for(const change of [{file:path.resolve('outside.test.mjs')},{title:''},{file:null}]){
    const bad=structuredClone(native);Object.assign(bad.tests[0],change);
    assert.throws(()=>normalizeReport(lane,bad,'',null,{allowNonPassing:true}),/INVALID_NATIVE/);
  }
});
test('source inventory includes both standard Python test file naming conventions',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-python-inventory-'));
  try{
    execFileSync('git',['init','-q'],{cwd:directory});
    for(const file of ['test_one.py','two_test.py','helper.py'])writeFileSync(path.join(directory,file),'# fixture\n');
    execFileSync('git',['add','.'],{cwd:directory});
    execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.test','commit','-qm','fixture'],{cwd:directory});
    const identity=runtime.sourceIdentity(directory);assert.deepEqual(identity.paths,['test_one.py','two_test.py']);
    const result=reconcileTestEvidence({...identity,lanes:[]},[]);
    assert.ok(result.blockers.includes('ORPHAN_TEST_PATH:two_test.py'));
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('native bundle replay, missing companions and producer drift fail against the external challenge',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-native-challenge-'));
  try{
    const file=path.join(directory,'unit.native.json'),lane=collection.lanes[0],envelope=report('unit',[]);
    for(const reserved of ['nativeVerified','nativeReportSha256Actual','reportSha256'])delete envelope[reserved];
    const native=jestNative();writeFileSync(file,JSON.stringify(native));
    const [context]=attachFixtureProducer(file,lane,envelope);
    envelope.nativeReportSha256=readNativeEvidence(file).sha256;envelope.tests=normalizeReport(lane,native,'');
    const reportPath=path.join(directory,'unit.report.json');writeFileSync(reportPath,JSON.stringify(envelope));
    assert.equal(runtime.loadExecutionReports(directory,[lane],[context]).length,1);
    assert.throws(()=>runtime.loadExecutionReports(directory,[lane]),/INVALID_EXECUTION/);
    const fresh={...context,executionNonce:'00000000-0000-4000-8000-000000000003'};
    writeFileSync(reportPath,JSON.stringify({...envelope,executionNonce:fresh.executionNonce}));
    assert.throws(()=>runtime.loadExecutionReports(directory,[lane],[fresh]),/INVALID_EXECUTION/);
    writeFileSync(reportPath,JSON.stringify(envelope));
    for(const changed of [{...context,laneId:'other'},{...context,driverGroup:'other'},
      {...context,producerSources:[{path:'outside/jest-native-reporter.mjs',sha256:'0'.repeat(64)}]},
      {...context,argv:['--config','different.js']}]){
      assert.throws(()=>runtime.loadExecutionReports(directory,[lane],[changed]),/INVALID_EXECUTION/);
    }
    for(const suffix of ['.launch.json','.provenance.json']){
      const companion=file+suffix,bytes=readFileSync(companion);rmSync(companion);
      assert.throws(()=>runtime.loadExecutionReports(directory,[lane],[context]),/INVALID_EXECUTION/);
      writeFileSync(companion,bytes);
      writeFileSync(companion,JSON.stringify({forged:true}));
      assert.throws(()=>runtime.loadExecutionReports(directory,[lane],[context]),/INVALID_EXECUTION/);
      writeFileSync(companion,bytes);
    }
    assert.equal(runtime.loadExecutionReports(directory,[lane],[context]).length,1);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('Jest lanes that require source locations cannot normalize assertions without real locations',()=>{
  const lane={runner:'jest',argv:['--testLocationInResults']};
  for(const location of [undefined,{line:0,column:1},{line:1,column:-1},{line:'1',column:0}]){
    const native=jestNative();native.testResults[0].assertionResults[0].location=location;
    assert.throws(()=>normalizeReport(lane,native,'',null,{allowNonPassing:true}),/INVALID_NATIVE/);
  }
  const native=jestNative();native.testResults[0].assertionResults[0].location={line:1,column:0};
  assert.equal(normalizeReport(lane,native,'').length,1);
});
test('the actual Python producer binds three phases and native bytes in a clean disposable Git repository',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-python-producer-'));
  try{
    mkdirSync(path.join(directory,'scripts/testing'),{recursive:true});mkdirSync(path.join(directory,'.github/governance'),{recursive:true});
    for(const name of ['run-test-lane.mjs','test-lane-runtime.mjs','test-lane-contract.mjs','node-json-reporter.mjs',
      'check-zero-test-debt.mjs','native-provenance.mjs','pytest_evidence_plugin.py'])
      copyFileSync(path.resolve('scripts/testing',name),path.join(directory,'scripts/testing',name));
    symlinkSync(path.resolve('node_modules'),path.join(directory,'node_modules'),'dir');
    writeFileSync(path.join(directory,'.gitignore'),'.artifacts/\nnode_modules\n__pycache__/\n.pytest_cache/\n');
    writeFileSync(path.join(directory,'one_test.py'),'def test_bound_phases():\n    assert 2 + 2 == 4\n\ndef test_other_case():\n    assert 3 + 3 == 6\n');
    const lane={id:'python-fixture',runner:'python',kind:'PRIMARY',argv:['-m','pytest','one_test.py','-q']};
    writeFileSync(path.join(directory,'.github/governance/test-lanes.json'),JSON.stringify({schemaVersion:1,lanes:[lane]}));
    execFileSync('git',['init','-q'],{cwd:directory});execFileSync('git',['add','.'],{cwd:directory});
    execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.test','commit','-qm','fixture'],{cwd:directory});
    const identity={kind:'LOCAL_QUALIFICATION',qualificationRunId:'00000000-0000-4000-8000-000000000001'};
    const source=runtime.sourceIdentity(directory),plan=createLaunchPlan(source,[lane],identity);
    const evidence=path.join(directory,'.artifacts/reports'),launchFile=path.join(directory,'.artifacts/launch.json');
    mkdirSync(path.dirname(launchFile),{recursive:true});writeFileSync(launchFile,JSON.stringify(plan),{mode:0o600});
    const result=spawnSync(process.execPath,['scripts/testing/run-test-lane.mjs',lane.id],{cwd:directory,encoding:'utf8',env:{...process.env,
      GITHUB_RUN_ID:'',GITHUB_RUN_ATTEMPT:'',NEXUS_QUALIFICATION_RUN_ID:identity.qualificationRunId,
      NEXUS_TEST_LAUNCH_MANIFEST:launchFile,NEXUS_EXPECTED_SOURCE_SHA:source.sourceSha,NEXUS_TEST_EVIDENCE_DIR:evidence,
      PYTEST_ADDOPTS:'-k bound_phases'}});
    assert.equal(result.status,0,result.stdout+result.stderr);
    const bundle=readNativeBundle(path.join(evidence,lane.id+'.native.json'),plan.contexts[0]);
    assert.equal(bundle.native.value.tests.length,2,'an inherited pytest filter must not remove a case from a collected file');
    assert.deepEqual(bundle.native.value.phases.map(phase=>phase.when),['setup','call','teardown','setup','call','teardown']);
    assert.equal(bundle.native.value.tests[0].path,'one_test.py');
    const nativeLine=bundle.launch.value.invocation.commandLine;assert.equal(nativeLine.includes('scripts.testing.pytest_evidence_plugin'),true);
    assert.equal(readLaunchPlan(launchFile,source,[lane],identity,evidence).length,1);
    const inside=path.join(evidence,'copied-plan.json');copyFileSync(launchFile,inside);
    assert.throws(()=>readLaunchPlan(inside,source,[lane],identity,evidence),/PROVENANCE/);
    const alias=path.join(directory,'.artifacts/reports-alias');symlinkSync(evidence,alias,'dir');
    assert.throws(()=>readLaunchPlan(path.join(alias,'copied-plan.json'),source,[lane],identity,evidence),/PROVENANCE/);
    assert.equal(runtime.sourceIdentity(directory).clean,true);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('a self-consistent launch cannot substitute its CLI root or normalize a grep expression',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-lane-producer-invocation-'));
  try{
    const lane={...collection.lanes[0],argv:['--config','unit.js','--grep=./name']},file=path.join(directory,'unit.native.json');
    const native=jestNative(),envelope=report('unit',[]);
    for(const reserved of ['nativeVerified','nativeReportSha256Actual','reportSha256'])delete envelope[reserved];
    writeFileSync(file,JSON.stringify(native));const [context]=attachFixtureProducer(file,lane,envelope);
    envelope.tests=normalizeReport(lane,native,'');envelope.nativeReportSha256=readNativeEvidence(file).sha256;
    const pristine=readNativeEvidence(file+'.launch.json').value;
    for(const alter of [launch=>{launch.invocation.repositoryRoot='/foreign/source';launch.invocation.canonicalEntrypoint='/foreign/source/node_modules/jest/bin/jest.js';
      launch.invocation.commandLine[1]=launch.invocation.canonicalEntrypoint;},
      launch=>{launch.invocation.commandLine[1]='/foreign/fake-jest.js';},
      launch=>{launch.invocation.commandLine=launch.invocation.commandLine.map(arg=>arg==='--grep=./name'?'--grep=name':arg);}]){
      const launch=structuredClone(pristine);alter(launch);writeFileSync(file+'.launch.json',JSON.stringify(launch));
      const seal=readNativeEvidence(file+'.provenance.json').value;seal.launchSha256=readNativeEvidence(file+'.launch.json').sha256;
      writeFileSync(file+'.provenance.json',JSON.stringify(seal));
      envelope.nativeLaunchSha256=seal.launchSha256;envelope.nativeProvenanceSha256=readNativeEvidence(file+'.provenance.json').sha256;
      writeFileSync(path.join(directory,'unit.report.json'),JSON.stringify(envelope));
      assert.throws(()=>runtime.loadExecutionReports(directory,[lane],[context]),/INVALID_EXECUTION/);
    }
  }finally{rmSync(directory,{recursive:true,force:true});}
});

for (const inContainer of [false, true]) test(`actual Jest and Playwright producers seal their own final native reports in a clean source fixture (${inContainer ? 'isolated container driver' : 'direct producers'})`,()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-native-browser-jest-'));
  try{
    mkdirSync(path.join(directory,'scripts/testing'),{recursive:true});mkdirSync(path.join(directory,'.github/governance'),{recursive:true});
    for(const name of ['run-test-lane.mjs','test-lane-runtime.mjs','test-lane-contract.mjs','check-zero-test-debt.mjs',
      'native-provenance.mjs','jest-native-reporter.mjs','playwright-native-reporter.mjs'])
      copyFileSync(path.resolve('scripts/testing',name),path.join(directory,'scripts/testing',name));
    copyFixtureDependencies(directory,['jest','@playwright/test','typescript']);
    writeFileSync(path.join(directory,'.gitignore'),'.artifacts/\nnode_modules/\n');
    writeFileSync(path.join(directory,'jest.fixture.config.cjs'),"module.exports={testEnvironment:'node',testMatch:['**/fixture.test.cjs']};\n");
    writeFileSync(path.join(directory,'jest.config.cjs'),"throw new Error('THE_EXPLICIT_REGISTERED_CONFIG_MUST_BE_USED');\n");
    writeFileSync(path.join(directory,'fixture.test.cjs'),"test('native Jest case',()=>expect(2+2).toBe(4));\n");
    mkdirSync(path.join(directory,'e2e'));writeFileSync(path.join(directory,'e2e/fixture.spec.cjs'),"const {test,expect}=require('@playwright/test');test('native Playwright case',()=>expect(2+2).toBe(4));\n");
    writeFileSync(path.join(directory,'playwright.fixture.config.cjs'),"module.exports={testDir:'./e2e',forbidOnly:true,retries:0,workers:1,outputDir:'.artifacts/pw'};\n");
    if (inContainer) writeFileSync(path.join(directory,'scripts/testing/container-fixture-driver.mjs'),`
      import {spawnSync} from 'node:child_process';import path from 'node:path';
      const image=process.env.NEXUS_NATIVE_CONTAINER_IMAGE, executable=process.env.NEXUS_NATIVE_CONTAINER_NODE;
      if(!image||!executable)throw new Error('QUALIFIED_NATIVE_CONTAINER_RUNTIME_REQUIRED');
      const evidence=path.dirname(process.env.NEXUS_TEST_NATIVE_OUTPUT);
      const args=['run','--rm','--network=none','--user',process.getuid()+':'+process.getgid(),
        '--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=1g','--cpus=1','--pids-limit=128',
        '--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--workdir','/app',
        '--mount','type=bind,src='+process.cwd()+',dst=/app,readonly',
        '--mount','type=bind,src='+evidence+',dst='+evidence];
      for(const key of ['NEXUS_TEST_LAUNCH_CONTEXTS','NEXUS_TEST_LANE_ID','NEXUS_TEST_NATIVE_OUTPUT','PYTEST_DISABLE_PLUGIN_AUTOLOAD'])
        args.push('--env',key+'='+process.env[key]);
      args.push(image,executable,'node_modules/jest/bin/jest.js','--config','jest.fixture.config.cjs','--runInBand',
        '--testLocationInResults','--json','--outputFile='+process.env.NEXUS_TEST_NATIVE_OUTPUT,
        '--reporters','default','--reporters','./scripts/testing/jest-native-reporter.mjs');
      const result=spawnSync('docker',args,{stdio:'inherit'});process.exit(result.status??1);
    `);
    const lanes=[{id:'jest-fixture',runner:'jest',kind:'PRIMARY',argv:['--config','jest.fixture.config.cjs','--runInBand','--testLocationInResults'],
      ...(inContainer ? {driver:{binary:'NODE',argv:['scripts/testing/container-fixture-driver.mjs'],nativeRepositoryRoot:'/app'}} : {})},
      {id:'pw-fixture',runner:'playwright',kind:'PRIMARY',argv:['test','--config=playwright.fixture.config.cjs','--forbid-only']}];
    writeFileSync(path.join(directory,'.github/governance/test-lanes.json'),JSON.stringify({schemaVersion:1,lanes}));
    execFileSync('git',['init','-q'],{cwd:directory});execFileSync('git',['add','.'],{cwd:directory});
    execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.test','commit','-qm','fixture'],{cwd:directory});
    const identity={kind:'LOCAL_QUALIFICATION',qualificationRunId:'00000000-0000-4000-8000-000000000001'};
    const source=runtime.sourceIdentity(directory),plan=createLaunchPlan(source,lanes,identity);
    const launchFile=path.join(directory,'.artifacts/launch.json');mkdirSync(path.dirname(launchFile),{recursive:true});
    writeFileSync(launchFile,JSON.stringify(plan),{mode:0o600});
    for(const lane of inContainer ? lanes.slice(0,1) : lanes){
      const evidence=path.join(directory,'.artifacts',lane.id),result=spawnSync(process.execPath,['scripts/testing/run-test-lane.mjs',lane.id],
        {cwd:directory,encoding:'utf8',env:{...process.env,GITHUB_RUN_ID:'',GITHUB_RUN_ATTEMPT:'',NEXUS_QUALIFICATION_RUN_ID:identity.qualificationRunId,
          NEXUS_TEST_LAUNCH_MANIFEST:launchFile,NEXUS_EXPECTED_SOURCE_SHA:source.sourceSha,NEXUS_TEST_EVIDENCE_DIR:evidence}});
      const diagnostic=path.join(evidence,'runner-error.private.json');
      const producerFailure=existsSync(diagnostic)?JSON.parse(readFileSync(diagnostic)).errorMessage:'';
      assert.equal(result.status,0,`${lane.id}: ${result.stdout}${result.stderr}${producerFailure}`);
      const context=plan.contexts.find(context=>context.laneId===lane.id),bundle=readNativeBundle(path.join(evidence,lane.id+'.native.json'),context);
      assert.equal(bundle.launch.value.invocation.canonicalEntrypoint.startsWith(path.join(inContainer?'/app':directory,'node_modules')+path.sep),true);
      const collectedLane={...lane,testRoot:lane.runner==='playwright'?'e2e':null};
      assert.equal(runtime.loadExecutionReports(evidence,[collectedLane],[context])[0].tests.length,1);
    }
    assert.equal(runtime.sourceIdentity(directory).clean,true);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('ARIA requirement evidence consumes seven existing native producers without launching duplicate tests',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'nexus-native-aria-view-'));
  try{
    mkdirSync(path.join(directory,'scripts/testing'),{recursive:true});mkdirSync(path.join(directory,'scripts/aria'),{recursive:true});mkdirSync(path.join(directory,'.github/governance'),{recursive:true});
    for(const name of ['run-test-lane.mjs','test-lane-runtime.mjs','test-lane-contract.mjs','check-zero-test-debt.mjs',
      'native-provenance.mjs','jest-native-reporter.mjs','playwright-native-reporter.mjs','verified-lane-view.mjs'])
      copyFileSync(path.resolve('scripts/testing',name),path.join(directory,'scripts/testing',name));
    for(const name of ['generate-test-evidence.ts','qualification-evidence.ts','check-test-traceability.ts'])copyFileSync(path.resolve('scripts/aria',name),path.join(directory,'scripts/aria',name));
    copyFixtureDependencies(directory,['jest','tsx','typescript','@playwright/test']);
    writeFileSync(path.join(directory,'jest.config.cjs'),"throw new Error('EXPLICIT_REGISTERED_CONFIG_REQUIRED');\n");
    writeFileSync(path.join(directory,'.gitignore'),'.artifacts/\nnode_modules/\n');
    writeFileSync(path.join(directory,'.gitignore'),'.artifacts/\nnode_modules\n');
    const definitions=[['unit','U001'],['api','A001'],['integration','I001'],['sse','U002'],['architecture','H001'],['db','D001'],['concurrency','D002']];
    const ids=(prefix,count)=>Array.from({length:count},(_,i)=>prefix+String(i+1).padStart(3,'0'));
    const tags={unit:[...ids('U',64).filter(id=>id!=='U002'),...ids('P',19),...ids('ARIA-B-R',99)],
      api:ids('A',20),integration:ids('I',24),sse:['U002'],architecture:ids('H',12),db:['D001'],concurrency:ids('D',21).filter(id=>id!=='D001')};
    const lanes=definitions.map(([name,id])=>{
      writeFileSync(path.join(directory,`${name}.test.cjs`),`test('${tags[name].join(' ')} qualified native fixture',()=>expect(2+2).toBe(4));\n`);
      writeFileSync(path.join(directory,`jest.${name}.config.cjs`),`module.exports={testEnvironment:'node',testMatch:['**/${name}.test.cjs']};\n`);
      return {id:`jest-aria-${name}`,runner:'jest',kind:'PRIMARY',argv:['--config',`jest.${name}.config.cjs`,'--runInBand','--testLocationInResults']};
    });
    const projects=['aria-desktop','aria-mobile','aria-a11y','aria-smoke'];
    mkdirSync(path.join(directory,'e2e'));
    const browserTags=[ids('E',26).filter(id=>!['E002','E003'].includes(id)),['E002'],['E003'],ids('S',10)];
    for(const [index,project] of projects.entries()){
      writeFileSync(path.join(directory,`e2e/${project}.spec.cjs`),`const {test,expect}=require('@playwright/test');test('${browserTags[index].join(' ')} requirement tags',()=>expect(2+2).toBe(4));\n`);
      lanes.push({id:`pw-aria-${project}`,runner:'playwright',kind:'PRIMARY',testRoot:'e2e',
        argv:['test','--config=playwright.fixture.config.cjs',`--project=${project}`,'--forbid-only']});
    }
    writeFileSync(path.join(directory,'playwright.fixture.config.cjs'),`module.exports={testDir:'./e2e',forbidOnly:true,retries:0,workers:1,
      outputDir:'.artifacts/pw',projects:${JSON.stringify(projects.map(name=>({name,testMatch:`**/${name}.spec.cjs`})))} };\n`);
    const requirements=ids('CR-',64);
    mkdirSync(path.join(directory,'docs/superpowers/plans'),{recursive:true});mkdirSync(path.join(directory,'data/aria/testing'),{recursive:true});
    writeFileSync(path.join(directory,'docs/superpowers/plans/2026-08-30-aria-b-conversation-foundation.md'),requirements.map(id=>
      '| '+[id,'fixture requirement','P0 fixture','U001','A001','I001','D001','E001','H001','U002','S001','fixture expected'].join(' | ')+' |').join('\n'));
    writeFileSync(path.join(directory,'data/aria/testing/aria-b-evidence.v1.json'),JSON.stringify({schemaVersion:1,requirements:requirements.map(requirementId=>({requirementId,expectedResult:'fixture expected'}))}));
    writeFileSync(path.join(directory,'.github/governance/test-lanes.json'),JSON.stringify({schemaVersion:1,lanes}));
    writeFileSync(path.join(directory,'scripts/aria/view-fixture.ts'),`
      import {generateAriaTestEvidence,readVerifiedAriaTestEvidence,assertSavedAriaTestEvidence} from './generate-test-evidence';
      import {runAriaTestTraceabilityCheck} from './check-test-traceability';
      try {
        const action=process.argv[2];
        if(action==='trace'){runAriaTestTraceabilityCheck();process.exit(0);}
        const value=action==='generate'?generateAriaTestEvidence(process.cwd(),{execute:()=>{throw new Error('DUPLICATE_TEST_LAUNCH_FORBIDDEN')}} as never)
          :action==='saved'?assertSavedAriaTestEvidence(process.cwd()):readVerifiedAriaTestEvidence(process.cwd());
        process.stdout.write(JSON.stringify(value)+'\\n');
      }catch(error) {console.error('ARIA_VIEW_REFUSED');console.error(error?.message);process.exitCode=1;}
    `);
    execFileSync('git',['init','-q'],{cwd:directory});execFileSync('git',['add','.'],{cwd:directory});
    execFileSync('git',['-c','user.name=Synthetic','-c','user.email=synthetic@example.test','commit','-qm','fixture'],{cwd:directory});
    const identity={kind:'LOCAL_QUALIFICATION',qualificationRunId:'00000000-0000-4000-8000-000000000001'},source=runtime.sourceIdentity(directory);
    const launch=path.join(directory,'.artifacts/launch.json'),reports=path.join(directory,'.artifacts/reports');
    mkdirSync(path.dirname(launch),{recursive:true});writeFileSync(launch,JSON.stringify(createLaunchPlan(source,lanes,identity)),{mode:0o600});
    const env={...process.env,GITHUB_RUN_ID:'',GITHUB_RUN_ATTEMPT:'',NEXUS_QUALIFICATION_RUN_ID:identity.qualificationRunId,
      NEXUS_EXPECTED_SOURCE_SHA:source.sourceSha,NEXUS_TEST_LAUNCH_MANIFEST:launch,NEXUS_TEST_EVIDENCE_DIR:reports,NEXUS_TEST_ARIA_REPORTS_DIR:reports};
    for(const lane of lanes){
      const result=spawnSync(process.execPath,['scripts/testing/run-test-lane.mjs',lane.id],{cwd:directory,encoding:'utf8',env});
      const diagnostic=path.join(reports,'runner-error.private.json');
      assert.equal(result.status,0,result.stdout+result.stderr+(existsSync(diagnostic)?JSON.parse(readFileSync(diagnostic)).errorMessage:'')+
        '\n'+JSON.stringify(readdirSync(directory)));
    }
    const nativeBefore=Object.fromEntries(readdirSync(reports).map(file=>[file,shaFile(path.join(reports,file))]));
    const verifyBefore=spawnSync(process.execPath,['--input-type=module','--eval',
      "import {readVerifiedLaneView} from './scripts/testing/verified-lane-view.mjs';console.log(JSON.stringify(readVerifiedLaneView(process.cwd(),'jest')));"],
      {cwd:directory,encoding:'utf8',env});
    assert.equal(verifyBefore.status,0,verifyBefore.stderr);
    const view=(action,extra={})=>spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/aria/view-fixture.ts',action],{cwd:directory,encoding:'utf8',env:{...env,...extra}});
    const generated=view('generate');assert.equal(generated.status,0,generated.stdout+generated.stderr);
    const saved=JSON.parse(readFileSync(path.join(directory,'.artifacts/aria/qualification/jest-evidence.json')));
    assert.equal(saved.proofKind,'DERIVED_FROM_VERIFIED_NATIVE_REPORTS');assert.equal(saved.sources.length,7);
    assert.equal(saved.cases.length,259,'these are requirement identifiers, not counts of executed tests');
    const traced=view('trace');assert.equal(traced.status,0,traced.stdout+traced.stderr);
    assert.match(traced.stdout,/CRITICAL_REQUIREMENTS=64/);assert.match(traced.stdout,/ARIA_QUALIFICATION_CASES_PASSED=295/);
    assert.equal(view('saved').status,0);assert.equal(view('generate').status,1,'immutable derived proof must not be overwritten');
    assert.deepEqual(Object.fromEntries(readdirSync(reports).map(file=>[file,shaFile(path.join(reports,file))])),nativeBefore);
    const missing=path.join(reports,'jest-aria-concurrency.report.json'),retained=readFileSync(missing);rmSync(missing);
    assert.equal(view('read').status,1);writeFileSync(missing,retained,{mode:0o600});
    assert.equal(view('read',{NEXUS_QUALIFICATION_RUN_ID:'00000000-0000-4000-8000-000000000002'}).status,1);
    saved.cases[0].title='forged assertion';writeFileSync(path.join(directory,'.artifacts/aria/qualification/jest-evidence.json'),JSON.stringify(saved));
    assert.equal(view('saved').status,1,'derived evidence must be rederived from native originals');
    assert.equal(runtime.sourceIdentity(directory).clean,true);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
function shaFile(file){return createHash('sha256').update(readFileSync(file)).digest('hex');}
