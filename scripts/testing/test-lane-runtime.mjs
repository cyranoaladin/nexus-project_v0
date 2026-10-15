import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync,lstatSync,openSync,closeSync,fstatSync,readdirSync,constants,realpathSync} from 'node:fs';
import path from 'node:path';
import {collectionArgv} from './test-lane-contract.mjs';
import {readNativeBundle,exportNativeBundle} from './native-provenance.mjs';
export const root=process.cwd();
export function qualifiedRuntimeOptions(lane){
  const nodeOptions=lane.env?.NODE_OPTIONS??'';
  if(!['','--experimental-vm-modules'].includes(nodeOptions)
    ||lane.env?.PYTEST_ADDOPTS||lane.env?.PYTEST_PLUGINS
    ||lane.env?.PYTEST_DISABLE_PLUGIN_AUTOLOAD!==undefined&&lane.env.PYTEST_DISABLE_PLUGIN_AUTOLOAD!=='1')
    throw new Error('INVALID_TEST_RUNTIME_OPTIONS');
  return {nodeOptions,pytestAddopts:'',pytestPlugins:'',pytestDisablePluginAutoload:'1'};
}
export function currentRuntimeOptions(env=process.env){
  return {nodeOptions:env.NODE_OPTIONS??'',pytestAddopts:env.PYTEST_ADDOPTS??'',
    pytestPlugins:env.PYTEST_PLUGINS??'',pytestDisablePluginAutoload:env.PYTEST_DISABLE_PLUGIN_AUTOLOAD??''};
}
export function qualifiedLaneEnvironment(lane,inherited=process.env){
  const options=qualifiedRuntimeOptions(lane),env={...inherited,...lane.env};
  for(const key of ['NODE_OPTIONS','PYTEST_ADDOPTS','PYTEST_PLUGINS','NODE_TEST_CONTEXT'])delete env[key];
  if(options.nodeOptions)env.NODE_OPTIONS=options.nodeOptions;
  env.PYTEST_DISABLE_PLUGIN_AUTOLOAD=options.pytestDisablePluginAutoload;
  return env;
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(args,cwd=root)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024});
export function sourceIdentity(repositoryRoot=root){
  const paths=[...new Set(git(['ls-files','-z','--cached','--others','--exclude-standard'],repositoryRoot).split('\0').filter(Boolean))]
    .filter(file=>existsSync(path.join(repositoryRoot,file))).sort();
  const inputs=paths.map(file=>{
    const absolute=path.join(repositoryRoot,file),metadata=lstatSync(absolute);
    if(!metadata.isFile())throw new Error('NON_REGULAR_SOURCE_INPUT_REFUSED');
    return {path:file,type:'REGULAR_FILE',mode:metadata.mode&0o777,sha256:hash(readFileSync(absolute))};
  });
  const sourceSha=git(['rev-parse','HEAD'],repositoryRoot).trim(),tree=git(['rev-parse','HEAD^{tree}'],repositoryRoot).trim();
  return {sourceSha,tree,repositoryRoot:realpathSync(repositoryRoot),clean:git(['status','--porcelain=v1','--untracked-files=all'],repositoryRoot).trim()==='',
    sourceFingerprint:hash(JSON.stringify(inputs)),inputs,
    paths:paths.filter(file=>/\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file)||/(?:^|\/)(?:test_[^/]+|[^/]+_test)\.py$/.test(file))};
}
export function validateRegistry(value){
  if(value.schemaVersion!==1||!Array.isArray(value.lanes)||!value.lanes.length)throw new Error('INVALID_TEST_REGISTRY');
  const ids=new Set();for(const lane of value.lanes){
    if(!/^[a-z][a-z0-9-]+$/.test(lane.id)||ids.has(lane.id))throw new Error('INVALID_TEST_LANE_ID');
    if(!['PRIMARY','SUPPLEMENTAL','REHEARSAL'].includes(lane.kind))throw new Error('INVALID_TEST_LANE_KIND');
    ids.add(lane.id);collectionArgv(lane);qualifiedRuntimeOptions(lane);
    if(lane.testRoot!==undefined&&(typeof lane.testRoot!=='string'||path.isAbsolute(lane.testRoot)
      ||lane.testRoot.includes('\\')||lane.testRoot.split('/').some(part=>!part||part==='.'||part==='..')))
      throw new Error('INVALID_TEST_ROOT');
    if(lane.driver&&(!['NODE','BASH'].includes(lane.driver.binary)||!Array.isArray(lane.driver.argv)||!lane.driver.argv.length
      ||!lane.driver.argv.every(arg=>typeof arg==='string'&&arg.length>0)
      ||lane.driver.argv.some(arg=>arg.includes('run-test-lane.mjs'))
      ||path.isAbsolute(lane.driver.argv[0])||lane.driver.argv[0].split('/').includes('..')
      ||lane.driver.nativeRepositoryRoot!==undefined&&lane.driver.nativeRepositoryRoot!=='/app'))throw new Error('INVALID_TEST_DRIVER');
  }
  for(const lane of value.lanes)if(lane.producedBy){
    const parent=value.lanes.find(candidate=>candidate.id===lane.producedBy);
    if(!parent||parent===lane||parent.producedBy||!parent.driver||parent.runner!==lane.runner
      ||lane.driver||lane.kind!=='SUPPLEMENTAL'||value.lanes.filter(candidate=>candidate.producedBy===parent.id).length!==1)
      throw new Error('INVALID_TEST_DRIVER_GROUP');
  }
  return value;
}
export function registry(){return validateRegistry(JSON.parse(readFileSync('.github/governance/test-lanes.json','utf8')));}
const relative=file=>path.isAbsolute(file)?path.relative(root,file).split(path.sep).join('/'):file.split(path.sep).join('/');
export function assertFreshEvidence(files){for(const file of files){try{lstatSync(file);throw new Error('EVIDENCE_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}}}
export function readNativeEvidence(file){
  let descriptor;
  try{
    const before=lstatSync(file);if(!before.isFile()||before.nlink!==1||before.size>128*1024*1024)throw new Error('INVALID_NATIVE_EVIDENCE');
    descriptor=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const opened=fstatSync(descriptor);
    if(!opened.isFile()||opened.nlink!==1||opened.size>128*1024*1024||opened.ino!==before.ino||opened.dev!==before.dev)throw new Error('INVALID_NATIVE_EVIDENCE');
    const bytes=readFileSync(descriptor),after=fstatSync(descriptor);
    if(after.ino!==opened.ino||after.dev!==opened.dev||after.size!==opened.size||after.nlink!==1
      ||after.mtimeMs!==opened.mtimeMs||after.ctimeMs!==opened.ctimeMs||bytes.length!==after.size)throw new Error('INVALID_NATIVE_EVIDENCE');
    const current=lstatSync(file);if(!current.isFile()||current.ino!==after.ino||current.dev!==after.dev
      ||current.nlink!==1||current.size!==after.size||current.mtimeMs!==after.mtimeMs||current.ctimeMs!==after.ctimeMs)throw new Error('INVALID_NATIVE_EVIDENCE');
    return {value:JSON.parse(bytes.toString('utf8')),sha256:hash(bytes),bytes};
  }catch{throw new Error('INVALID_NATIVE_EVIDENCE');}finally{if(descriptor!==undefined)closeSync(descriptor);}
}
export function secureWrite(file,value){mkdirSync(path.dirname(file),{recursive:true,mode:0o700});writeFileSync(file,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});}
export const exportNativeEvidence=exportNativeBundle;
export function loadExecutionReports(directory,lanes,contexts){
  const reports=[];let entries=0;
  try{
    if(!Array.isArray(contexts))throw new Error('EXPECTED_LAUNCH_CONTEXTS_REQUIRED');
    const visit=(folder,depth)=>{
      if(depth>8||!lstatSync(folder).isDirectory()||lstatSync(folder).isSymbolicLink())throw new Error('INVALID_REPORT_DIRECTORY');
      for(const entry of readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
        if(++entries>1000)throw new Error('TOO_MANY_REPORT_ENTRIES');
        const file=path.join(folder,entry.name);
        if(entry.isSymbolicLink())throw new Error('REPORT_SYMLINK_REFUSED');
        if(entry.isDirectory()){visit(file,depth+1);continue;}
        if(!entry.name.endsWith('.report.json'))continue;
        const envelope=readNativeEvidence(file),report=envelope.value;
        const lane=lanes.find(candidate=>candidate.id===report.laneId);
        if(!lane||entry.name!==`${lane.id}.report.json`||report.nativeReportFile!==`${lane.id}.native.json`
          ||['nativeVerified','nativeReportSha256Actual','reportSha256'].some(key=>Object.hasOwn(report,key)))throw new Error('INVALID_REPORT_ENVELOPE');
        const matches=contexts.filter(context=>context.laneId===lane.id);
        if(matches.length!==1||report.executionNonce!==matches[0].executionNonce)throw new Error('NATIVE_LAUNCH_MISMATCH');
        const bundle=readNativeBundle(path.join(folder,report.nativeReportFile),matches[0]),evidence=bundle.native;
        if(report.nativeLaunchFile!==`${lane.id}.native.json.launch.json`||report.nativeProvenanceFile!==`${lane.id}.native.json.provenance.json`
          ||report.nativeLaunchSha256!==bundle.launch.sha256||report.nativeProvenanceSha256!==bundle.provenance.sha256)throw new Error('NATIVE_COMPANION_HASH_MISMATCH');
        if(evidence.sha256!==report.nativeReportSha256)throw new Error('NATIVE_HASH_MISMATCH');
        const parent=lane.producedBy?lanes.find(candidate=>candidate.id===lane.producedBy):lane;
        const expectedRoot=path.posix.join(parent.driver?.nativeRepositoryRoot??matches[0].producerRepositoryRoot,lane.testRoot??'.');
        if(lane.runner==='playwright'&&evidence.value.config?.rootDir!==expectedRoot)throw new Error('NATIVE_TEST_ROOT_MISMATCH');
        const tests=normalizeReport({...lane,nativeRepositoryRoot:matches[0].producerRepositoryRoot},evidence.value,'',lane,{allowNonPassing:true});
        if(JSON.stringify(tests)!==JSON.stringify(report.tests))throw new Error('NATIVE_ASSERTIONS_MISMATCH');
        if(!Array.isArray(report.blockers)||nativeReportBlockers(lane,evidence.value).some(code=>!report.blockers.includes(code)))
          throw new Error('NATIVE_GLOBAL_FAILURE_OMITTED');
        reports.push({...report,nativeVerified:true,nativeReportSha256Actual:evidence.sha256,reportSha256:envelope.sha256});
      }
    };
    if(existsSync(directory))visit(directory,0);
    return reports;
  }catch{throw new Error('INVALID_EXECUTION_REPORT_EVIDENCE');}
}
export function runnerInvocation(lane,args){
  if(lane.runner==='jest')return [process.execPath,['node_modules/jest/bin/jest.js',...args]];
  if(lane.runner==='playwright')return [process.execPath,['node_modules/@playwright/test/cli.js',...args]];
  if(lane.runner==='python')return ['python3',args];
  if(lane.runner==='node')return [process.execPath,['--test','--test-reporter=./scripts/testing/node-json-reporter.mjs',...args]];
  throw new Error('UNKNOWN_TEST_RUNNER');
}
export function flattenPlaywright(report,testRoot){
  const result=[];
  const nativeRoot=report.config?.rootDir??root;
  const reportPath=file=>{
    const within=path.isAbsolute(file)?path.relative(nativeRoot,file):file;
    if(within.includes('\\')||path.isAbsolute(within)||within.split('/').some(part=>part==='..'||part===''))
      throw new Error('PLAYWRIGHT_PATH_OUTSIDE_TEST_ROOT');
    return testRoot?path.posix.join(testRoot,within):relative(path.resolve(nativeRoot,within));
  };
  function visit(suite,ancestors=[]){
    const titles=suite.title?[...ancestors,suite.title]:ancestors;
    for(const spec of suite.specs??[])for(const test of spec.tests??[]) {
      const outcomes=test.results??[];
      const status=!outcomes.length?'pending':outcomes.some(run=>['failed','timedOut','interrupted'].includes(run.status))?'failed'
        :outcomes.some(run=>run.status==='skipped')?'skipped':'passed';
      result.push({path:reportPath(spec.file??suite.file),title:[...titles,spec.title].join(' › '),project:test.projectName??test.projectId??null,
        line:spec.line??null,column:spec.column??null,occurrenceId:spec.id??null,
        status,expectedStatus:test.expectedStatus,attempts:outcomes.length,retry:Math.max(0,...outcomes.map(run=>run.retry??0))});
    }
    for(const child of suite.suites??[])visit(child,titles);
  }
  for(const suite of report.suites??[])visit(suite);
  return result;
}
/** Global runner failures are derived from native bytes by producer AND verifier. */
export function nativeReportBlockers(lane,native){
  const playwrightSuiteFailed=suite=>(suite.specs??[]).some(spec=>spec.ok!==true
    ||(spec.tests??[]).some(test=>test.status!=='expected'))
    ||(suite.suites??[]).some(playwrightSuiteFailed);
  const failure=lane.runner==='jest'?(native.success!==true||native.wasInterrupted!==false
      ||native.testResults?.some(suite=>suite.testExecError||suite.status!=='passed'||!suite.assertionResults?.length))
    :lane.runner==='playwright'?(native.errors?.length>0||native.stats?.unexpected>0||native.stats?.flaky>0
      ||native.suites?.some(playwrightSuiteFailed))
    :lane.runner==='python'?native.exitCode!==0
    :lane.runner==='node'?(native.summary?.success!==true||native.tests?.some(test=>test.status!=='passed')):true;
  return failure?['NATIVE_RUNNER_ERRORS']:[];
}
export function collectLane(lane,outputDir){
  if(lane.runner==='node')return {id:lane.id,runner:lane.runner,kind:lane.kind,argv:lane.argv,driver:lane.driver??null,producedBy:lane.producedBy??null,collected:lane.argv.filter(arg=>/\.(test|spec)\.[cm]?js$/.test(arg))};
  const args=collectionArgv(lane);const [binary,argv]=runnerInvocation(lane,args);
  const pythonOutput=path.resolve(outputDir,`${lane.id}.collection.${randomUUID()}.json`);
  // --list never executes fixtures. Keep their module-time safety preflight on
  // its explicit disposable target; execution retains the operator's real env.
  const env={...qualifiedLaneEnvironment(lane),E2E_DISPOSABLE_STACK:'1',
    CORE_V2_DATABASE_URL:'postgresql://postgres@localhost:5435/core_v2_e2e'};
  if(lane.runner==='python'){argv.push('-p','scripts.testing.pytest_evidence_plugin');env.NEXUS_TEST_COLLECTION_OUTPUT=pythonOutput;}
  const stdout=execFileSync(binary,argv,{cwd:root,env,encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
  let collected,testItems,testRoot;
  if(lane.runner==='jest')collected=JSON.parse(stdout.trim()).map(relative);
  else if(lane.runner==='playwright'){const report=JSON.parse(stdout.trim());testRoot=relative(report.config.rootDir);
    if(lane.testRoot!==undefined&&lane.testRoot!==testRoot)throw new Error('TEST_COLLECTION_ROOT_MISMATCH');
    testItems=flattenPlaywright(report,testRoot);collected=testItems.map(test=>test.path);}
  else {const report=readNativeEvidence(pythonOutput).value;testItems=report.collected;collected=testItems.map(test=>test.path);}
  collected=[...new Set(collected)].sort();if(collected.length===0)throw new Error(`EMPTY_TEST_COLLECTION:${lane.id}`);
  return {id:lane.id,runner:lane.runner,kind:lane.kind,argv:lane.argv,driver:lane.driver??null,producedBy:lane.producedBy??null,
    collected,testRoot:testRoot??null,testItems:testItems??null};
}
export function normalizeReport(lane,native,stdout,collection,{allowNonPassing=false}={}){
  const invalid=()=>{throw new Error('INVALID_NATIVE_TEST_REPORT');};
  const integer=value=>Number.isSafeInteger(value)&&value>=0;
  const empty=value=>value===undefined||Array.isArray(value)&&value.length===0;
  const count=(object,key,value)=>{if(!integer(object?.[key])||object[key]!==value)invalid();};
  const validPath=file=>{
    if(typeof file!=='string'||!file)invalid();
    const nativeRoot=lane.runner==='jest'?lane.driver?.nativeRepositoryRoot??lane.nativeRepositoryRoot??root:root;
    const result=path.isAbsolute(file)?path.relative(nativeRoot,file).split(path.sep).join('/'):file.split(path.sep).join('/');
    if(path.isAbsolute(result)||result.split('/').some(part=>part==='..'||part===''))invalid();
    return result;
  };
  const logicalOccurrences=tests=>{
    const occurrences=new Map();return tests.map(test=>{
      const key=JSON.stringify([test.path,test.line??null,test.column??null,test.title,test.project??null]);
      const logicalOccurrence=occurrences.get(key)??0;occurrences.set(key,logicalOccurrence+1);
      return {...test,logicalOccurrence};
    });
  };
  if(!native||typeof native!=='object')invalid();
  if(lane.runner==='jest'){
    if(typeof native.success!=='boolean'||typeof native.wasInterrupted!=='boolean'||!Array.isArray(native.testResults))invalid();
    if(!allowNonPassing&&(native.success!==true||native.wasInterrupted!==false))invalid();
    const tests=[],rawTests=[];
    for(const suite of native.testResults){
      if(!['passed','failed','pending'].includes(suite.status)||!Array.isArray(suite.assertionResults))invalid();
      if(!allowNonPassing&&(suite.status!=='passed'||suite.testExecError||!suite.assertionResults.length))invalid();
      for(const test of suite.assertionResults){
        if(typeof test.fullName!=='string'||!test.fullName||!['passed','failed','pending','todo'].includes(test.status))invalid();
        if(lane.argv?.some(arg=>arg==='--testLocationInResults'||arg==='--testLocationInResults=true')
          &&(!integer(test.location?.line)||test.location.line<1||!integer(test.location?.column)))invalid();
        const attempts=test.invocations??(test.status==='pending'||test.status==='todo'?0:undefined);
        if(!integer(attempts)||!['pending','todo'].includes(test.status)&&attempts<1)invalid();
        for(const field of ['retryReasons','retryMessages','failureMessages','failureDetails'])if(test[field]!==undefined&&!Array.isArray(test[field]))invalid();
        const forbiddenConditions=[];
        if(test.failing===true)forbiddenConditions.push('EXPECTED_FAILURE');
        if(!empty(test.retryReasons)||!empty(test.retryMessages)||attempts>1)forbiddenConditions.push('RETRIED_TEST');
        if(test.status==='passed'&&(!empty(test.failureMessages)||!empty(test.failureDetails)))forbiddenConditions.push('PASS_WITH_FAILURE_PAYLOAD');
        if(!allowNonPassing&&(test.status!=='passed'||forbiddenConditions.length))invalid();
        rawTests.push(test);
        tests.push({path:validPath(suite.name),title:test.fullName,status:test.status==='pending'?'skipped':test.status,project:null,
          line:test.location?.line??null,column:test.location?.column??null,attempts,retry:Math.max(0,attempts-1),forbiddenConditions});
      }
    }
    count(native,'numTotalTests',tests.length);
    for(const [field,status] of [['numPassedTests','passed'],['numFailedTests','failed'],['numPendingTests','pending'],['numTodoTests','todo']])count(native,field,rawTests.filter(test=>test.status===status).length);
    count(native,'numTotalTestSuites',native.testResults.length);
    for(const [field,status] of [['numPassedTestSuites','passed'],['numFailedTestSuites','failed'],['numPendingTestSuites','pending']])count(native,field,native.testResults.filter(suite=>suite.status===status).length);
    count(native,'numRuntimeErrorTestSuites',native.testResults.filter(suite=>suite.testExecError).length);
    return logicalOccurrences(tests);
  }
  if(lane.runner==='playwright'){
    if(!Array.isArray(native.suites)||native.errors!==undefined&&!Array.isArray(native.errors))invalid();
    if(!allowNonPassing&&!empty(native.errors))invalid();
    const counts={expected:0,unexpected:0,skipped:0,flaky:0},forbidden=[];
    const visit=suite=>{
      for(const spec of suite.specs??[]){
        if(typeof spec.ok!=='boolean'||!Array.isArray(spec.tests)||!spec.tests.length)invalid();
        if(!allowNonPassing&&spec.ok!==true)invalid();
        for(const test of spec.tests){
          if(!Object.hasOwn(counts,test.status)||!['passed','failed','timedOut','skipped','interrupted'].includes(test.expectedStatus)
            ||!Array.isArray(test.results)||test.annotations!==undefined&&!Array.isArray(test.annotations))invalid();
          counts[test.status]++;
          for(const result of test.results)if(!['passed','failed','timedOut','skipped','interrupted'].includes(result.status)||!integer(result.retry))invalid();
          const conditions=[];
          if(test.expectedStatus!=='passed')conditions.push('EXPECTED_NON_PASSING_RESULT');
          if(test.annotations?.some(annotation=>['skip','fixme','fail'].includes(annotation.type)))conditions.push('FORBIDDEN_ANNOTATION');
          if(test.results.length>1||test.results.some(result=>result.retry>0))conditions.push('RETRIED_TEST');
          if(test.results.some(result=>result.status==='passed'&&(result.error||!empty(result.errors))))conditions.push('PASS_WITH_FAILURE_PAYLOAD');
          if(!allowNonPassing&&(conditions.length||test.status!=='expected'||test.results.length!==1||test.results[0].status!=='passed'))invalid();
          forbidden.push(conditions);
        }
      }
      for(const child of suite.suites??[])visit(child);
    };
    for(const suite of native.suites)visit(suite);
    for(const [key,value] of Object.entries(counts))count(native.stats,key,value);
    const tests=flattenPlaywright(native,collection?.testRoot);if(tests.length!==forbidden.length)invalid();
    return tests.map((test,index)=>({...test,forbiddenConditions:forbidden[index]}));
  }
  if(lane.runner==='node'){
    if(native.schemaVersion!=='node-test-native/v1'||!Array.isArray(native.tests)||typeof native.summary?.success!=='boolean')invalid();
    const cases=native.tests.filter(test=>test.type==='test'),suites=native.tests.filter(test=>test.type==='suite');
    if(cases.length+suites.length!==native.tests.length||native.tests.some(test=>!['passed','failed','cancelled','skipped','todo'].includes(test.status)))invalid();
    for(const test of native.tests){
      const file=validPath(test.file);if(!lane.argv.includes(file)||typeof test.title!=='string'||!test.title)invalid();
    }
    if(!allowNonPassing&&(native.summary.success!==true||native.tests.some(test=>test.status!=='passed')))invalid();
    count(native.summary.counts,'tests',cases.length);count(native.summary.counts,'suites',suites.length);
    for(const key of ['passed','failed','cancelled','skipped','todo'])count(native.summary.counts,key,cases.filter(test=>test.status===key).length);
    return logicalOccurrences(cases.map(test=>{
      const file=validPath(test.file);if(!lane.argv.includes(file)||typeof test.title!=='string'||!test.title)invalid();
      return {path:file,title:test.title,status:test.status,project:null,line:test.line??null,column:test.column??null};
    }));
  }
  if(lane.runner==='python'){
    if(native.schemaVersion!=='pytest-native/v2'||!integer(native.exitCode)||!Array.isArray(native.tests)||!Array.isArray(native.phases))invalid();
    if(!allowNonPassing&&native.exitCode!==0)invalid();
    const ids=new Set();
    for(const test of native.tests){
      if(!['passed','failed','skipped','pending'].includes(test.status)||!integer(test.attempts)||!Array.isArray(test.forbiddenMarks)
        ||test.nodeid!==`${test.path}::${test.title}`||ids.has(test.nodeid))invalid();
      ids.add(test.nodeid);validPath(test.path);
      const phases=native.phases.filter(phase=>phase.nodeid===test.nodeid);
      if(phases.some(phase=>!['setup','call','teardown'].includes(phase.when)||!['passed','failed','skipped'].includes(phase.status)))invalid();
      if(test.attempts!==phases.filter(phase=>phase.when==='call').length)invalid();
      const status=phases.some(phase=>phase.status==='failed')?'failed':phases.some(phase=>phase.status==='skipped')?'skipped':phases.length===3?'passed':'pending';
      if(status!==test.status)invalid();
      if(test.status==='passed'&&(phases.length!==3||test.attempts!==1
        ||phases.some((phase,index)=>phase.when!==['setup','call','teardown'][index]||phase.status!=='passed')))invalid();
      if(!allowNonPassing){
        if(test.status!=='passed'||test.attempts!==1||test.forbiddenMarks.length)invalid();
        for(const when of ['setup','call','teardown'])if(phases.filter(phase=>phase.when===when&&phase.status==='passed').length!==1)invalid();
        if(phases.length!==3)invalid();
      }
    }
    if(native.phases.some(phase=>!ids.has(phase.nodeid)))invalid();
    return logicalOccurrences(native.tests.map(test=>({...test,forbiddenConditions:test.forbiddenMarks.length?['FORBIDDEN_MARK']:[]})));
  }
  invalid();
}
