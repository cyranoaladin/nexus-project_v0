#!/usr/bin/env node
/** Confidential native reports: exact API artifact + OIDC verification + closed archive. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {expectedCiContext,validateGitHubRun,validateGitHubArtifact,validateAttestation,validatePublicManifest,evidenceArtifactName} from './ci-evidence-contract.mjs';
import {sourceIdentity,registry,readNativeEvidence,secureWrite,loadExecutionReports} from './test-lane-runtime.mjs';
import {readLaunchPlan} from './native-provenance.mjs';
import {expectedRunIdentity} from './test-lane-contract.mjs';

const MAX_DOWNLOAD=3*1024**3,MAX_JSON=16*1024**2,TIMEOUT=120_000;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ghSha256='7469124f706944133d6a169691dd1c6c3511b12e85878d255e044e2948df4c9b';
const recipientFingerprint='DC8C0686E449BB106FF5B5380770E66EF507FFCB';
const fail=()=>{throw new Error('CI_PRIVATE_EVIDENCE_REFUSED');};
const directoryCapabilities=new Map();
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function childEnvironment(){const env={...process.env};delete env.NEXUS_CI_EVIDENCE_PRIVATE_KEY;return env;}
function invoke(command,args,{input,maxBuffer=MAX_JSON,env=childEnvironment(),descriptors=[]}={}){
  const result=spawnSync(command,args,{cwd:root,encoding:'utf8',input,env,maxBuffer,timeout:TIMEOUT,stdio:['pipe','pipe','pipe',...descriptors]});
  if(result.status!==0||result.signal||result.error)fail();return result.stdout;
}
function canonicalDirectory(directory){
  if(typeof directory!=='string'||!path.isAbsolute(directory)||path.normalize(directory)!==directory)fail();
  const capability=[...directoryCapabilities.values()].find(owner=>directory===owner.bound||directory.startsWith(owner.bound+'/'));
  if(capability){const held=fs.fstatSync(capability.fd);
    if(held.dev!==capability.dev||held.ino!==capability.ino||!held.isDirectory()||held.uid!==process.geteuid()||(held.mode&0o777)!==0o700)fail();
    let component=capability.bound;for(const part of directory.slice(component.length).split('/').filter(Boolean)){
      component=path.join(component,part);const entry=fs.lstatSync(component);if(!entry.isDirectory()||entry.isSymbolicLink())fail();}
    return directory;
  }
  if(fs.realpathSync(directory)!==directory)fail();
  const stat=fs.lstatSync(directory);if(!stat.isDirectory()||stat.isSymbolicLink())fail();return directory;
}
export function ownEvidenceDirectory(directory,{existing=false}={}){
  const parent=canonicalDirectory(path.dirname(directory)),name=path.basename(directory),before=fs.statSync(parent);
  const flags=fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW;
  const borrowed=[...directoryCapabilities.values()].some(owner=>owner.bound===parent);
  const parentFd=fs.openSync(parent,borrowed?flags&~fs.constants.O_NOFOLLOW:flags);let fd;
  try{const bound=fs.fstatSync(parentFd);if(bound.dev!==before.dev||bound.ino!==before.ino)fail();
    const anchored=`/proc/self/fd/${parentFd}/${name}`;if(!existing)fs.mkdirSync(anchored,{mode:0o700});
    const created=fs.lstatSync(anchored);fd=fs.openSync(anchored,flags);const owned=fs.fstatSync(fd);
    if(!owned.isDirectory()||owned.uid!==process.geteuid()||(owned.mode&0o777)!==0o700
      ||created.dev!==owned.dev||created.ino!==owned.ino||fs.readdirSync(anchored).length!==0)fail();
    const owner={path:directory,name,parent,parentFd,fd,dev:owned.dev,ino:owned.ino,parentDev:bound.dev,parentIno:bound.ino};
    owner.bound=`/proc/${process.pid}/fd/${fd}`;directoryCapabilities.set(fd,owner);
    assertOwnedDirectory(owner);return owner;
  }catch{if(fd!==undefined){directoryCapabilities.delete(fd);fs.closeSync(fd);}fs.closeSync(parentFd);fail();}
}
export function assertOwnedDirectory(owner){
  const parent=fs.statSync(canonicalDirectory(owner.parent)),current=fs.lstatSync(owner.path),held=fs.fstatSync(owner.fd);
  if(parent.dev!==owner.parentDev||parent.ino!==owner.parentIno||!current.isDirectory()||current.dev!==owner.dev||current.ino!==owner.ino
    ||held.dev!==owner.dev||held.ino!==owner.ino||held.uid!==process.geteuid()||(held.mode&0o777)!==0o700)fail();
}
export function closeOwnedDirectory(owner){directoryCapabilities.delete(owner.fd);fs.closeSync(owner.fd);fs.closeSync(owner.parentFd);}
export function removeOwnedDirectory(owner){
  try{const result=spawnSync('python3',[path.join(root,'scripts/testing/owned-evidence-directory.py'),owner.name,String(owner.dev),String(owner.ino)],
    {stdio:['ignore','pipe','pipe',owner.parentFd,owner.fd],env:childEnvironment(),timeout:TIMEOUT});
    if(result.status!==0||result.signal||result.error)fail();
  }finally{closeOwnedDirectory(owner);}
}
function ownTemporaryDirectory(parent,prefix){const directory=fs.mkdtempSync(path.join(canonicalDirectory(parent),prefix));return ownEvidenceDirectory(directory,{existing:true});}
function readPrivate(file,limit=MAX_JSON){
  canonicalDirectory(path.dirname(file));
  const before=fs.lstatSync(file);if(!before.isFile()||before.nlink!==1||before.size>limit)fail();
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try{const opened=fs.fstatSync(fd),bytes=fs.readFileSync(fd),after=fs.fstatSync(fd),current=fs.lstatSync(file);
    const same=other=>other.isFile()&&other.nlink===1&&other.dev===before.dev&&other.ino===before.ino&&other.size===before.size
      &&other.mtimeMs===before.mtimeMs&&other.ctimeMs===before.ctimeMs;
    if(!same(opened)||!same(after)||!same(current)||bytes.length!==before.size)fail();return bytes;
  }finally{fs.closeSync(fd);}
}
async function hashFile(file){
  canonicalDirectory(path.dirname(file));const before=fs.lstatSync(file);
  if(!before.isFile()||before.nlink!==1||before.size<=0||before.size>MAX_DOWNLOAD
    ||before.uid!==process.geteuid()||(before.mode&0o777)!==0o600)fail();
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try{const opened=fs.fstatSync(fd),sha=createHash('sha256'),buffer=Buffer.alloc(1024**2);let count=0;
    if(opened.dev!==before.dev||opened.ino!==before.ino||opened.nlink!==1)fail();
    for(let size;(size=fs.readSync(fd,buffer,0,buffer.length,null))>0;){count+=size;if(count>MAX_DOWNLOAD)fail();sha.update(buffer.subarray(0,size));}
    const after=fs.fstatSync(fd),current=fs.lstatSync(file);
    for(const stat of [after,current])if(!stat.isFile()||stat.nlink!==1||stat.dev!==opened.dev||stat.ino!==opened.ino
      ||stat.size!==opened.size||stat.mtimeMs!==opened.mtimeMs||stat.ctimeMs!==opened.ctimeMs)fail();
    if(count!==opened.size)fail();return {sha256:sha.digest('hex'),bytes:count};
  }finally{fs.closeSync(fd);}
}
function apiPath(suffix){return `https://api.github.com/repos/${expectedCiContext().repository}/${suffix}`;}
export function artifactRedirectAllowed(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash
    &&(url.hostname.endsWith('.blob.core.windows.net')||url.hostname.endsWith('.actions.githubusercontent.com')
      ||url.hostname==='artifacts.githubusercontent.com'||url.hostname==='api.github.com');}catch{return false;}
}
async function responseBytes(response,limit){
  if(!response.ok||!response.body)fail();const chunks=[];let count=0;
  for await(const chunk of response.body){count+=chunk.length;if(count>limit){await response.body.cancel().catch(()=>{});fail();}chunks.push(chunk);}
  return Buffer.concat(chunks,count);
}
export async function githubJson(url,{token,fetchFn=fetch}={}){
  if(!url.startsWith('https://api.github.com/repos/cyranoaladin/nexus-project_v0/')||typeof token!=='string'||!token)fail();
  const response=await fetchFn(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
    redirect:'error',signal:AbortSignal.timeout(TIMEOUT)});
  try{return JSON.parse((await responseBytes(response,MAX_JSON)).toString('utf8'));}catch{fail();}
}
export async function downloadArtifact(url,destination,expectedDigest,{token,fetchFn=fetch}={}){
  if(!/^https:\/\/api\.github\.com\/repos\/cyranoaladin\/nexus-project_v0\/actions\/artifacts\/[1-9][0-9]*\/zip$/.test(url)
    ||!/^sha256:[a-f0-9]{64}$/.test(expectedDigest)||typeof token!=='string'||!token)fail();
  canonicalDirectory(path.dirname(destination));
  const fd=fs.openSync(destination,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  const owned=fs.fstatSync(fd);let completed=false;
  try{
    let response;
    for(let redirects=0;redirects<=3;redirects++){
      response=await fetchFn(url,{headers:new URL(url).hostname==='api.github.com'?{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}:{},
        redirect:'manual',signal:AbortSignal.timeout(TIMEOUT)});
      if(![301,302,303,307,308].includes(response.status))break;
      const location=response.headers.get('location');await response.body?.cancel();
      if(redirects===3||!artifactRedirectAllowed(location))fail();url=location;
    }
    if(!response.ok||!response.body)fail();const sha=createHash('sha256');let count=0;
    for await(const chunk of response.body){count+=chunk.length;if(count>MAX_DOWNLOAD)fail();sha.update(chunk);
      let offset=0;while(offset<chunk.length){const written=fs.writeSync(fd,chunk,offset,chunk.length-offset);if(!written)fail();offset+=written;}}
    if(count===0||`sha256:${sha.digest('hex')}`!==expectedDigest)fail();fs.fsyncSync(fd);
    const current=fs.lstatSync(destination),after=fs.fstatSync(fd);
    if(!current.isFile()||current.nlink!==1||current.dev!==owned.dev||current.ino!==owned.ino||after.size!==count||current.size!==count
      ||current.uid!==process.geteuid()||(current.mode&0o777)!==0o600)fail();
    const stored=await hashFile(destination);if(`sha256:${stored.sha256}`!==expectedDigest||stored.bytes!==count)fail();
    completed=true;return {bytes:count,sha256:expectedDigest.slice(7)};
  }finally{fs.closeSync(fd);if(!completed){const current=fs.lstatSync(destination,{throwIfNoEntry:false});
    if(current&&current.dev===owned.dev&&current.ino===owned.ino)fs.unlinkSync(destination);}}
}
export function qualifiedGitHubCli(){
  const binary=process.env.NEXUS_GH_BINARY;
  if(!binary||!path.isAbsolute(binary)||digest(readPrivate(binary,128*1024**2))!==ghSha256)fail();return binary;
}
function tokenValue(){const token=process.env.GH_TOKEN??process.env.GITHUB_TOKEN;if(token)return token;
  const result=invoke(qualifiedGitHubCli(),['auth','token']);if(!result.trim())fail();return result.trim();}
function verifyOidc(file,expected,sha256,subjectName='payload.gpg'){
  const args=['attestation','verify',file,'--hostname','github.com','--repo',expected.repository,
    '--cert-identity',`https://github.com/${expected.repository}/.github/workflows/ci.yml@${expected.ref}`,
    '--cert-oidc-issuer','https://token.actions.githubusercontent.com','--source-digest',expected.githubSha,'--source-ref',expected.ref,
    '--signer-digest',expected.githubSha,'--deny-self-hosted-runners','--digest-alg','sha256',
    '--predicate-type','https://slsa.dev/provenance/v1','--format','json'];
  const entries=JSON.parse(invoke(qualifiedGitHubCli(),args));validateAttestation(entries,expected,sha256,subjectName);return entries;
}
function producerMap(){const value=JSON.parse(readPrivate(path.join(root,'.github/governance/ci-test-producers.json')));
  const lanes=registry().lanes,assigned=Object.values(value.producers??{}).flat();
  if(value.schemaVersion!=='nexus-ci-test-producers/v1'||assigned.length!==lanes.filter(lane=>lane.kind!=='REHEARSAL').length
    ||new Set(assigned).size!==assigned.length||lanes.filter(lane=>lane.kind!=='REHEARSAL').some(lane=>!assigned.includes(lane.id)))fail();
  return value.producers;
}
function currentSource(expected){const source=sourceIdentity(root);
  if(!source.clean||source.sourceSha!==expected.sourceSha||source.tree!==expected.tree)fail();return source;}
function currentPlan(expected){const file=process.env.NEXUS_TEST_LAUNCH_MANIFEST;
  if(!file||readNativeEvidence(file).sha256!==expected.planHash)fail();
  const source=currentSource(expected),lanes=registry().lanes;
  return {source,lanes,contexts:readLaunchPlan(file,source,lanes,expectedRunIdentity(),path.resolve(process.env.NEXUS_TEST_EVIDENCE_DIR??'.artifacts/test-evidence'))};
}
function archiveCommand(args){
  const owners=[...directoryCapabilities.values()].filter(owner=>args.some(argument=>argument.includes(owner.bound)));
  return JSON.parse(invoke('python3',[path.join(root,'scripts/testing/private-test-archive.py'),...args,
    ...owners.flatMap((owner,index)=>['--owner-fd',`${owner.bound}=${index+3}`])],{descriptors:owners.map(owner=>owner.fd)}));
}
export async function sealProducer(label,reports,output,attachments=[]){
  const expected=expectedCiContext(),allowed=producerMap()[label];if(!allowed)fail();
  canonicalDirectory(reports);const plan=currentPlan(expected),found=loadExecutionReports(reports,plan.lanes,plan.contexts);
  if(found.some(report=>!allowed.includes(report.laneId)))fail();
  return sealDirectories(expected,label,output,[['reports',reports],...attachments.map(directory=>['attachments',directory])]);
}
export async function sealAttachedEvidence(label,attachments,output){
  if(!['aria-evidence','ci-qualification'].includes(label))fail();const expected=expectedCiContext();currentPlan(expected);
  return sealDirectories(expected,label,output,[['attachments',attachments]]);
}
async function sealDirectories(expected,label,output,roots){
  if(roots.length<1||roots.length>2||new Set(roots.map(([category])=>category)).size!==roots.length)fail();
  for(const [,directory] of roots)canonicalDirectory(directory);
  const outputOwner=ownEvidenceDirectory(output),temporaryOwner=ownTemporaryDirectory(path.dirname(output),'.native-seal-'),temporary=temporaryOwner.bound;let completed=false;
  try{const plaintext=path.join(temporary,'native.bin'),args=['create','--output',plaintext];
    for(const [category,directory] of roots)args.push(`--${category}`,`${label}=${directory}`);
    archiveCommand(args);const cipher=path.join(outputOwner.bound,'payload.gpg');
    invoke(process.execPath,[path.join(root,'scripts/release/encrypt-release-archive.mjs'),plaintext,path.join(root,'security/release-recipient.asc'),cipher,
      path.join(root,'security/qualification-recipient.asc')]);
    const fingerprint=await hashFile(cipher);currentPlan(expected);
    const manifest={schemaVersion:'nexus-ci-private-evidence/v1',repository:expected.repository,repositoryId:expected.repositoryId,
      workflowId:expected.workflowId,runId:expected.runId,runAttempt:expected.runAttempt,githubSha:expected.githubSha,githubRef:expected.ref,
      sourceSha:expected.sourceSha,tree:expected.tree,planHash:expected.planHash,label,cipherSha256:fingerprint.sha256,cipherBytes:fingerprint.bytes};
    validatePublicManifest(manifest,expected,label,fingerprint.sha256,fingerprint.bytes);secureWrite(path.join(outputOwner.bound,'manifest.json'),manifest);
    assertOwnedDirectory(outputOwner);assertOwnedDirectory(temporaryOwner);completed=true;return manifest;
  }finally{try{removeOwnedDirectory(temporaryOwner);}finally{if(completed)closeOwnedDirectory(outputOwner);else removeOwnedDirectory(outputOwner);}}
}
async function exactArtifact(expected,label,token,{artifactId}={}){
  validateGitHubRun(await githubJson(apiPath(`actions/runs/${expected.runId}`),{token}),expected);
  let metadata;
  if(artifactId){if(!/^[1-9][0-9]*$/.test(String(artifactId)))fail();metadata=await githubJson(apiPath(`actions/artifacts/${artifactId}`),{token});}
  else{const found=[];for(let page=1;page<=20;page++){
    const response=await githubJson(apiPath(`actions/runs/${expected.runId}/artifacts?per_page=100&page=${page}`),{token});
    if(!Array.isArray(response.artifacts)||response.artifacts.length>100)fail();found.push(...response.artifacts.filter(artifact=>artifact.name===evidenceArtifactName(expected,label)));
    if(response.artifacts.length<100)break;if(page===20)fail();}
    if(found.length!==1)fail();metadata=await githubJson(apiPath(`actions/artifacts/${found[0].id}`),{token});}
  return validateGitHubArtifact(metadata,expected,label);
}
async function fetchArtifact(expected,label,temporary,token,kind,options){
  const metadata=await exactArtifact(expected,label,token,options),zip=path.join(temporary,'download.zip'),unpacked=path.join(temporary,'downloaded');
  await downloadArtifact(apiPath(`actions/artifacts/${metadata.id}/zip`),zip,metadata.digest,{token});
  archiveCommand(['artifact-zip','--input',zip,'--output',unpacked,'--kind',kind]);
  const after=await exactArtifact(expected,label,token,{artifactId:metadata.id});if(JSON.stringify(after)!==JSON.stringify(metadata))fail();
  secureWrite(path.join(temporary,'api-artifact.json'),metadata);return path.join(unpacked,'payload');
}
export async function fetchLaunch(output,artifactId){
  const expected=expectedCiContext(),token=tokenValue(),temporaryOwner=ownTemporaryDirectory(path.dirname(output),'.launch-fetch-'),temporary=temporaryOwner.bound;
  let created;
  try{const directory=await fetchArtifact(expected,'launch',temporary,token,'plan',{artifactId}),file=path.join(directory,'launch.json');
    if(readNativeEvidence(file).sha256!==expected.planHash)fail();verifyOidc(file,expected,expected.planHash,'launch.json');
    const source=currentSource(expected),lanes=registry().lanes;
    readLaunchPlan(file,source,lanes,expectedRunIdentity(),path.resolve(process.env.NEXUS_TEST_EVIDENCE_DIR??'.artifacts/test-evidence'));
    currentSource(expected);assertOwnedDirectory(temporaryOwner);
    fs.copyFileSync(file,output,fs.constants.COPYFILE_EXCL);created=fs.lstatSync(output);fs.chmodSync(output,0o600);currentPlan(expected);
    created=null;return {sourceSha:expected.sourceSha,runId:expected.runId,runAttempt:expected.runAttempt};
  }finally{try{if(created){const current=fs.lstatSync(output,{throwIfNoEntry:false});if(current&&current.dev===created.dev&&current.ino===created.ino)fs.unlinkSync(output);}}
    finally{removeOwnedDirectory(temporaryOwner);}}
}
function importRecipient(home,key){
  // Nature of the key is proven after import: exactly one secret primary with the pinned fingerprint.
  if(typeof key!=='string'||key.length===0||Buffer.byteLength(key)>128*1024)fail();
  invoke('gpg',['--no-options','--homedir',home,'--batch','--no-tty','--import'],{input:key});
  const listing=invoke('gpg',['--no-options','--homedir',home,'--batch','--with-colons','--fingerprint','--list-secret-keys']);
  const lines=listing.split('\n'),primaries=[];for(let i=0;i<lines.length;i++)if(lines[i].startsWith('sec:')){
    const fingerprint=lines.slice(i+1).find(line=>line.startsWith('fpr:'));if(!fingerprint)fail();primaries.push(fingerprint.split(':')[9]);}
  if(primaries.length!==1||primaries[0]!==recipientFingerprint)fail();
}
export async function decryptRecipientFile(home,input,output,{spawnFn=spawn,timeoutMs=TIMEOUT}={}){
  const fd=fs.openSync(output,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  let bytes=0;
  try{await new Promise((resolve,reject)=>{
    const child=spawnFn('gpg',['--no-options','--homedir',home,'--batch','--no-tty','--output','-','--decrypt',input],{env:childEnvironment(),stdio:['ignore','pipe','pipe']});
    let failed=false;
    const refuse=()=>{failed=true;child.kill('SIGKILL');};
    const timer=setTimeout(refuse,timeoutMs),drain=()=>{};
    const write=chunk=>{if(failed)return;try{bytes+=chunk.length;if(bytes>MAX_DOWNLOAD)fail();let offset=0;
      while(offset<chunk.length){const count=fs.writeSync(fd,chunk,offset,chunk.length-offset);if(!count)fail();offset+=count;}}
      catch{refuse();}};
    child.stderr.on('data',drain);child.on('error',refuse);child.stdout.on('error',refuse);child.stderr.on('error',refuse);child.stdout.on('data',write);
    child.once('close',(code,signal)=>{clearTimeout(timer);child.stdout.removeListener('data',write);child.stderr.removeListener('data',drain);
      child.removeListener('error',refuse);child.stdout.removeListener('error',refuse);child.stderr.removeListener('error',refuse);
      if(failed||code!==0||signal||bytes===0)reject(new Error('CI_PRIVATE_EVIDENCE_REFUSED'));else resolve();});
  });fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
export async function fetchProducerReports(labels,output){
  const expected=expectedCiContext(),token=tokenValue(),map=producerMap();
  if(!Array.isArray(labels)||!labels.length||new Set(labels).size!==labels.length||labels.some(label=>!Object.hasOwn(map,label)))fail();
  const key=process.env.NEXUS_CI_EVIDENCE_PRIVATE_KEY;delete process.env.NEXUS_CI_EVIDENCE_PRIVATE_KEY;
  const outputOwner=ownEvidenceDirectory(output);let temporaryOwner,homeOwner,completed=false;
  const publishedOwners=[];
  try{temporaryOwner=ownTemporaryDirectory(path.dirname(output),'.native-fetch-');
    homeOwner=ownEvidenceDirectory(path.join(temporaryOwner.bound,'gnupg'));
    importRecipient(homeOwner.bound,key);const plan=currentPlan(expected);
    const reportsOwner=ownEvidenceDirectory(path.join(outputOwner.bound,'reports'));publishedOwners.push(reportsOwner);
    const attachmentsOwner=ownEvidenceDirectory(path.join(outputOwner.bound,'attachments'));publishedOwners.push(attachmentsOwner);
    const receiptsOwner=ownEvidenceDirectory(path.join(outputOwner.bound,'receipts'));publishedOwners.push(receiptsOwner);
    for(const label of labels){const workOwner=ownEvidenceDirectory(path.join(temporaryOwner.bound,label)),work=workOwner.bound;
      try{
      const directory=await fetchArtifact(expected,label,work,token,'evidence'),cipher=path.join(directory,'payload.gpg'),fingerprint=await hashFile(cipher);
      const manifest=JSON.parse(readPrivate(path.join(directory,'manifest.json')));validatePublicManifest(manifest,expected,label,fingerprint.sha256,fingerprint.bytes);
      const attestation=verifyOidc(cipher,expected,fingerprint.sha256);const plaintext=path.join(work,'native.bin'),unsealed=path.join(work,'unsealed');
      await decryptRecipientFile(homeOwner.bound,cipher,plaintext);archiveCommand(['extract','--input',plaintext,'--output',unsealed]);fs.unlinkSync(plaintext);
      const archiveIndex=JSON.parse(readPrivate(path.join(unsealed,'payload/INDEX.json')));
      if(archiveIndex.files.some(file=>!file.path.startsWith(`reports/${label}/`)&&!file.path.startsWith(`attachments/${label}/`)))fail();
      const native=path.join(unsealed,'payload/reports',label),found=loadExecutionReports(native,plan.lanes,plan.contexts);
      if(found.length!==map[label].length||map[label].some(id=>!found.some(report=>report.laneId===id))||found.some(report=>!map[label].includes(report.laneId)))fail();
      fs.renameSync(native,path.join(reportsOwner.bound,label));const attached=path.join(unsealed,'payload/attachments',label);
      if(fs.existsSync(attached))fs.renameSync(attached,path.join(attachmentsOwner.bound,label));
      secureWrite(path.join(receiptsOwner.bound,`${label}.json`),{manifest,artifact:JSON.parse(readPrivate(path.join(work,'api-artifact.json'))),attestation,archiveIndex});
      assertOwnedDirectory(workOwner);
      }finally{removeOwnedDirectory(workOwner);}
    }
    currentPlan(expected);validateGitHubRun(await githubJson(apiPath(`actions/runs/${expected.runId}`),{token}),expected);
    for(const owner of publishedOwners)assertOwnedDirectory(owner);
    assertOwnedDirectory(homeOwner);assertOwnedDirectory(outputOwner);assertOwnedDirectory(temporaryOwner);completed=true;
    return {sourceSha:expected.sourceSha,runId:expected.runId,runAttempt:expected.runAttempt,producers:labels.length,lanes:labels.flatMap(label=>map[label]).length};
  }finally{
    if(homeOwner)spawnSync('gpgconf',['--homedir',homeOwner.bound,'--kill','gpg-agent'],{stdio:'ignore',env:childEnvironment()});
    // Attempt every cleanup even if one fails; retain no plaintext or keyring on
    // the original capability, and never traverse a replacement pathname.
    const failures=[];
    for(const owner of [homeOwner,...publishedOwners.reverse(),temporaryOwner,outputOwner].filter(Boolean)){
      try{if(completed&&owner!==homeOwner&&owner!==temporaryOwner)closeOwnedDirectory(owner);else removeOwnedDirectory(owner);}
      catch(error){failures.push(error);}
    }
    if(failures.length)fail();
  }
}
async function main(){process.umask(0o077);const [command,...args]=process.argv.slice(2);let result;
  if(command==='seal'&&args.length>=3)result=await sealProducer(args[0],path.resolve(args[1]),path.resolve(args[2]),args.slice(3).map(file=>path.resolve(file)));
  else if(command==='seal-attachments'&&args.length===3)result=await sealAttachedEvidence(args[0],path.resolve(args[1]),path.resolve(args[2]));
  else if(command==='fetch-plan'&&args.length===2)result=await fetchLaunch(path.resolve(args[0]),args[1]);
  else if(command==='fetch-reports'&&args.length===2)result=await fetchProducerReports(args[0]==='ALL'?Object.keys(producerMap()):args[0].split(','),path.resolve(args[1]));
  else fail();console.log(JSON.stringify(result));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('CI_PRIVATE_EVIDENCE_REFUSED');process.exitCode=1;});
