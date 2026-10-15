/** Producer evidence binds native bytes to an external, pre-execution challenge.
 * Authenticity of a CI artifact is a separate GitHub/OIDC verification. */
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,lstatSync,realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readNativeEvidence,secureWrite,assertFreshEvidence,qualifiedRuntimeOptions,currentRuntimeOptions} from './test-lane-runtime.mjs';

const producerPaths={node:'scripts/testing/node-json-reporter.mjs',jest:'scripts/testing/jest-native-reporter.mjs',
  playwright:'scripts/testing/playwright-native-reporter.mjs',python:'scripts/testing/pytest_evidence_plugin.py'};
const jsSupport=['scripts/testing/native-provenance.mjs','scripts/testing/test-lane-contract.mjs','scripts/testing/test-lane-runtime.mjs'];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw new Error('INVALID_NATIVE_PROVENANCE');};
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
function sourcePaths(runner){
  if(!Object.hasOwn(producerPaths,runner))fail();
  return [producerPaths[runner],...(runner==='python'?[]:jsSupport)].sort();
}
function expectedContext(source,lane,runIdentity,executionNonce,parent=lane){
  if(!source.clean||!uuid.test(executionNonce)||!/^[a-f0-9]{40}$/.test(source.sourceSha)
    ||!/^[a-f0-9]{40}$/.test(source.tree)||!/^[a-f0-9]{64}$/.test(source.sourceFingerprint))fail();
  const producerSources=sourcePaths(lane.runner).map(file=>{
    const input=source.inputs.find(input=>input.path===file);
    if(!input||input.type!=='REGULAR_FILE'||!/^[a-f0-9]{64}$/.test(input.sha256))fail();
    return {path:file,sha256:input.sha256};
  });
  return {sourceSha:source.sourceSha,tree:source.tree,sourceFingerprint:source.sourceFingerprint,runIdentity,
    executionNonce,laneId:lane.id,driverGroup:lane.producedBy??lane.id,runner:lane.runner,argv:lane.argv,producerSources,
    producerRepositoryRoot:parent.driver?.nativeRepositoryRoot??source.repositoryRoot,
    runtimeOptions:qualifiedRuntimeOptions(lane)};
}
export function createLaunchPlan(source,lanes,runIdentity){
  const nonces=new Map();
  return {schemaVersion:'nexus-test-launch-plan/v1',contexts:lanes.map(lane=>{
    const group=lane.producedBy??lane.id;
    if(!nonces.has(group))nonces.set(group,randomUUID());
    return expectedContext(source,lane,runIdentity,nonces.get(group),lanes.find(candidate=>candidate.id===group));
  })};
}
function canonicalDirectory(directory){
  try{return realpathSync(directory);}catch(error){
    if(error.code!=='ENOENT')fail();
    const parent=path.dirname(directory);if(parent===directory)fail();
    return path.join(canonicalDirectory(parent),path.basename(directory));
  }
}
export function readLaunchPlan(file,source,lanes,runIdentity,reportsDirectory){
  if(typeof file!=='string'||!path.isAbsolute(file))fail();
  if(typeof reportsDirectory!=='string'||!path.isAbsolute(reportsDirectory))fail();
  const relative=path.relative(canonicalDirectory(reportsDirectory),realpathSync(file));
  if(relative===''||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))fail();
  const plan=readNativeEvidence(file).value;
  if(plan.schemaVersion!=='nexus-test-launch-plan/v1'||!Array.isArray(plan.contexts)||plan.contexts.length!==lanes.length)fail();
  const nonceGroups=new Map(),groupNonces=new Map();
  for(const lane of lanes){
    const matches=plan.contexts.filter(context=>context.laneId===lane.id);
    if(matches.length!==1)fail();
    const context=matches[0];
    if(!same(context,expectedContext(source,lane,runIdentity,context.executionNonce,
      lanes.find(candidate=>candidate.id===(lane.producedBy??lane.id)))))fail();
    if(nonceGroups.has(context.executionNonce)&&nonceGroups.get(context.executionNonce)!==context.driverGroup)fail();
    if(groupNonces.has(context.driverGroup)&&groupNonces.get(context.driverGroup)!==context.executionNonce)fail();
    nonceGroups.set(context.executionNonce,context.driverGroup);groupNonces.set(context.driverGroup,context.executionNonce);
  }
  return plan.contexts;
}
function secureBytes(file,bytes){
  mkdirSync(path.dirname(file),{recursive:true,mode:0o700});writeFileSync(file,bytes,{mode:0o600,flag:'wx'});
}
function expandOptions(argv){
  return argv.flatMap(arg=>{const match=/^(--[^=]+)=(.*)$/.exec(arg);return match?[match[1],match[2]]:[arg];});
}
function canonicalToken(value,repositoryRoot){
  if(value.startsWith('./'))return value.slice(2);
  if(path.isAbsolute(value)&&value.startsWith(repositoryRoot+path.sep))return path.relative(repositoryRoot,value).split(path.sep).join('/');
  return value;
}
/** Strip only known reporter instrumentation, preserving effective argument order. */
function assertInvocation(context,invocation,nativeFile){
  const raw=invocation?.commandLine,repositoryRoot=invocation?.repositoryRoot;
  if(!Array.isArray(raw)||raw.length<2||!raw.every(arg=>typeof arg==='string'&&arg.length)
    ||typeof repositoryRoot!=='string'||!path.isAbsolute(repositoryRoot)||repositoryRoot!==context.producerRepositoryRoot)fail();
  if(!same(invocation.runtimeOptions,context.runtimeOptions))fail();
  const entrypoints={jest:['node_modules/jest/bin/jest.js'],playwright:['node_modules/@playwright/test/cli.js','node_modules/playwright/cli.js']};
  if(entrypoints[context.runner]&&!entrypoints[context.runner].some(file=>invocation.canonicalEntrypoint===path.join(repositoryRoot,file)))fail();
  if(entrypoints[context.runner]){
    const allowed=[...entrypoints[context.runner],`node_modules/.bin/${context.runner==='jest'?'jest':'playwright'}`];
    if(!allowed.some(file=>path.resolve(repositoryRoot,raw[1])===path.join(repositoryRoot,file)))fail();
  }
  const original=expandOptions(raw.slice(context.runner==='jest'||context.runner==='playwright'?2:1)),actual=[];
  let nodeTest=0,nodeReporter=0,pythonPlugin=0,jestJson=0,jestOutput=0,jestReporter=0,playwrightReporter=0;
  for(let i=0;i<original.length;i++){
    const token=original[i],next=original[i+1];
    if(context.runner==='node'&&token==='--test'){nodeTest++;continue;}
    if(context.runner==='node'&&token==='--test-reporter'){
      if(canonicalToken(next??'',repositoryRoot)!==producerPaths.node)fail();nodeReporter++;i++;continue;
    }
    if(context.runner==='python'&&token==='-p'&&next==='scripts.testing.pytest_evidence_plugin'){pythonPlugin++;i++;continue;}
    if(context.runner==='jest'&&token==='--json'){jestJson++;continue;}
    if(context.runner==='jest'&&token==='--outputFile'){
      if(path.resolve(repositoryRoot,next??'')!==nativeFile)fail();jestOutput++;i++;continue;
    }
    if(context.runner==='jest'&&token==='--reporters'&&(next==='default'||canonicalToken(next??'',repositoryRoot)===producerPaths.jest)){
      if(next!=='default')jestReporter++;i++;continue;
    }
    if(context.runner==='playwright'&&token==='--reporter'&&canonicalToken(next??'',repositoryRoot)===producerPaths.playwright){
      playwrightReporter++;i++;continue;
    }
    actual.push(token);
  }
  if(context.runner==='node'&&(nodeTest!==1||nodeReporter!==1))fail();
  if(context.runner==='python'&&pythonPlugin!==1)fail();
  if(context.runner==='jest'&&(jestJson!==1||jestOutput!==1||jestReporter!==1))fail();
  // Configured Playwright reporters are also valid; launch below records them.
  if(context.runner==='playwright'&&playwrightReporter>1)fail();
  const expected=expandOptions(context.argv);
  if(!same(actual,expected))fail();
}
function currentSources(context,repositoryRoot){
  const files=sourcePaths(context.runner);
  if(!same(context.producerSources.map(source=>source.path),files))fail();
  return files.map(file=>{
    const absolute=path.join(repositoryRoot,file),stat=lstatSync(absolute);
    if(!stat.isFile()||stat.nlink!==1||realpathSync(absolute)!==absolute)fail();
    return {path:file,sha256:hash(readFileSync(absolute))};
  });
}
export function producerContextFromEnv(laneId=process.env.NEXUS_TEST_LANE_ID){
  const contexts=JSON.parse(process.env.NEXUS_TEST_LAUNCH_CONTEXTS??'null');
  if(!Array.isArray(contexts))fail();
  const matches=contexts.filter(context=>context.laneId===laneId);if(matches.length!==1)fail();return matches[0];
}
export function beginNativeProducer(sourceUrl){
  const context=producerContextFromEnv(),repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  if(repositoryRoot!==context.producerRepositoryRoot)fail();
  const ownFile=fileURLToPath(sourceUrl);
  if(ownFile!==path.join(repositoryRoot,producerPaths[context.runner])||realpathSync(ownFile)!==ownFile)fail();
  if(!process.env.NEXUS_TEST_NATIVE_OUTPUT||!path.isAbsolute(process.env.NEXUS_TEST_NATIVE_OUTPUT))fail();
  const nativeFile=process.env.NEXUS_TEST_NATIVE_OUTPUT;
  assertFreshEvidence([nativeFile,nativeFile+'.launch.json',nativeFile+'.provenance.json']);
  const producerSources=currentSources(context,repositoryRoot);if(!same(producerSources,context.producerSources))fail();
  const commandLine=readFileSync('/proc/self/cmdline','utf8').split('\0').filter(Boolean);
  const invocation={commandLine,repositoryRoot,runtimeOptions:currentRuntimeOptions(),canonicalEntrypoint:context.runner==='jest'||context.runner==='playwright'
    ?realpathSync(path.resolve(repositoryRoot,commandLine[1])):null};
  assertInvocation(context,invocation,nativeFile);
  const launch={schemaVersion:'nexus-test-producer-launch/v1',context,producerNonce:randomUUID(),producerSources,invocation};
  const bytes=Buffer.from(JSON.stringify(launch)+'\n');secureBytes(nativeFile+'.launch.json',bytes);
  return {nativeFile,launch,launchSha256:hash(bytes)};
}
export function sealNativeProducer(receipt,originalBytes){
  if(originalBytes!==undefined)secureBytes(receipt.nativeFile,originalBytes);
  const {nativeFile,launch}=receipt;
  if(!same(currentSources(launch.context,launch.invocation.repositoryRoot),launch.producerSources))fail();
  const start=readNativeEvidence(nativeFile+'.launch.json');if(start.sha256!==receipt.launchSha256)fail();
  const native=readNativeEvidence(nativeFile);
  if(originalBytes!==undefined&&native.sha256!==hash(originalBytes))fail();
  secureWrite(nativeFile+'.provenance.json',{schemaVersion:'nexus-test-native-provenance/v1',producerNonce:launch.producerNonce,
    launchSha256:start.sha256,nativeSha256:native.sha256,nativeByteLength:native.bytes.length});
}
export function readNativeBundle(nativeFile,expected){
  try{
    if(!expected)fail();
    const native=readNativeEvidence(nativeFile),launch=readNativeEvidence(nativeFile+'.launch.json'),provenance=readNativeEvidence(nativeFile+'.provenance.json');
    const start=launch.value,seal=provenance.value;
    if(start.schemaVersion!=='nexus-test-producer-launch/v1'||seal.schemaVersion!=='nexus-test-native-provenance/v1'
      ||!uuid.test(start.producerNonce)||!same(start.context,expected)||!same(start.producerSources,expected.producerSources)
      ||seal.producerNonce!==start.producerNonce||seal.launchSha256!==launch.sha256||seal.nativeSha256!==native.sha256
      ||seal.nativeByteLength!==native.bytes.length)fail();
    const args=expandOptions(start.invocation.commandLine),index=args.indexOf('--outputFile');
    const originalOutput=index>=0?path.resolve(start.invocation.repositoryRoot,args[index+1]):nativeFile;
    assertInvocation(expected,start.invocation,originalOutput);
    return {native,launch,provenance};
  }catch{fail();}
}
export function exportNativeBundle(source,destination,expected){
  if(!path.isAbsolute(destination))throw new Error('NATIVE_DESTINATION_MUST_BE_ABSOLUTE');
  const bundle=readNativeBundle(source,expected),destinations=[destination,destination+'.launch.json',destination+'.provenance.json'];
  assertFreshEvidence(destinations);
  secureBytes(destinations[0],bundle.native.bytes);secureBytes(destinations[1],bundle.launch.bytes);secureBytes(destinations[2],bundle.provenance.bytes);
  readNativeBundle(destination,expected);
}
