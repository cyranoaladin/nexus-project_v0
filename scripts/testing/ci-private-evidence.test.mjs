import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,cpSync,readFileSync,writeFileSync,readdirSync,rmSync,lstatSync,symlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {artifactRedirectAllowed,downloadArtifact,githubJson,decryptRecipientFile,ownEvidenceDirectory,removeOwnedDirectory,assertOwnedDirectory} from './ci-private-evidence.mjs';
const api='https://api.github.com/repos/cyranoaladin/nexus-project_v0/actions/artifacts/123/zip';
const sha=bytes=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const secret=randomBytes(16).toString('hex');
async function fixture(fn){const root=mkdtempSync(path.join(tmpdir(),'nexus-private-ci-'));try{return await fn(root);}finally{rmSync(root,{recursive:true,force:true});}}
test('artifact download verifies exact ZIP bytes and preserves private mode',()=>fixture(async root=>{
  const bytes=Buffer.from('binary fixture\x00\xff'),output=path.join(root,'download.zip');
  const result=await downloadArtifact(api,output,sha(bytes),{token:secret,fetchFn:async(url,options)=>{
    assert.equal(url,api);assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,`Bearer ${secret}`);return new Response(bytes);
  }});
  assert.deepEqual(readFileSync(output),bytes);assert.equal(result.bytes,bytes.length);assert.equal(lstatSync(output).mode&0o777,0o600);
}));
for(const kind of ['same-length corruption','public permissions'])test(`artifact download rejects ${kind} during fsync instead of accepting the network hash`,()=>fixture(async root=>{
  const bytes=Buffer.from('binary fixture'),output=path.join(root,'download.zip'),original=fs.fsyncSync;let changed=false;
  fs.fsyncSync=fd=>{if(!changed){changed=true;if(kind==='same-length corruption')fs.writeSync(fd,Buffer.from('X'),0,1,0);else fs.fchmodSync(fd,0o644);}return original(fd);};
  try{await assert.rejects(downloadArtifact(api,output,sha(bytes),{token:secret,fetchFn:async()=>new Response(bytes)}),/CI_PRIVATE_EVIDENCE_REFUSED/);
    assert.equal(changed,true);assert.deepEqual(readdirSync(root),[]);
  }finally{fs.fsyncSync=original;}
}));
test('artifact redirect strips Authorization before accessing signed storage',()=>fixture(async root=>{
  const bytes=Buffer.from('encrypted fixture'),storage='https://resultssa.blob.core.windows.net/actions/fixture?sas=private-fixture';let requests=0;
  await downloadArtifact(api,path.join(root,'download.zip'),sha(bytes),{token:secret,fetchFn:async(url,options)=>{
    requests++;if(requests===1){assert.equal(options.headers.Authorization,`Bearer ${secret}`);return new Response(null,{status:302,headers:{location:storage}});}
    assert.equal(url,storage);assert.deepEqual(options.headers,{});return new Response(bytes);
  }});assert.equal(requests,2);
}));
for(const value of ['http://resultssa.blob.core.windows.net/data','https://resultssa.blob.core.windows.net.evil.test/data','https://evil.test/data',
  'https://user:password@resultssa.blob.core.windows.net/data','https://resultssa.blob.core.windows.net/data#fragment','invalid'])
  test('artifact download refuses untrusted redirect destinations',()=>fixture(async root=>{
    let count=0;const output=path.join(root,'download.zip');assert.equal(artifactRedirectAllowed(value),false);
    await assert.rejects(downloadArtifact(api,output,sha(Buffer.from('x')),{token:secret,fetchFn:async()=>{count++;return new Response(null,{status:302,headers:{location:value}});}}));
    assert.equal(count,1);assert.deepEqual(readdirSync(root),[]);
  }));
test('artifact download refuses a mismatched digest and removes only its newly created output',()=>fixture(async root=>{
  const output=path.join(root,'download.zip');writeFileSync(path.join(root,'retained'),'original');
  await assert.rejects(downloadArtifact(api,output,sha(Buffer.from('expected')),{token:secret,fetchFn:async()=>new Response('actual')}));
  assert.deepEqual(readdirSync(root),['retained']);assert.equal(readFileSync(path.join(root,'retained'),'utf8'),'original');
}));
test('artifact download preserves a preexisting output and does not issue a request',()=>fixture(async root=>{
  const output=path.join(root,'download.zip');writeFileSync(output,'original');let called=false;
  await assert.rejects(downloadArtifact(api,output,sha(Buffer.from('x')),{token:secret,fetchFn:async()=>{called=true;return new Response('x');}}));
  assert.equal(called,false);assert.equal(readFileSync(output,'utf8'),'original');
}));
test('artifact download refuses an output symlink without modifying its target',()=>fixture(async root=>{
  writeFileSync(path.join(root,'retained'),'original');symlinkSync(path.join(root,'retained'),path.join(root,'download.zip'));
  await assert.rejects(downloadArtifact(api,path.join(root,'download.zip'),sha(Buffer.from('x')),{token:secret,fetchFn:async()=>new Response('x')}));
  assert.equal(readFileSync(path.join(root,'retained'),'utf8'),'original');
}));
test('artifact download limits redirects and never silently retries a failed request',()=>fixture(async root=>{
  let requests=0;await assert.rejects(downloadArtifact(api,path.join(root,'download.zip'),sha(Buffer.from('x')),{token:secret,fetchFn:async()=>{
    requests++;return new Response(null,{status:302,headers:{location:'https://resultssa.blob.core.windows.net/data'}});
  }}));assert.equal(requests,4);assert.deepEqual(readdirSync(root),[]);
}));
test('artifact download rejects foreign API repositories before any request or write',()=>fixture(async root=>{
  let called=false;await assert.rejects(downloadArtifact(api.replace('cyranoaladin','other'),path.join(root,'download.zip'),sha(Buffer.from('x')),{token:secret,fetchFn:async()=>{called=true;return new Response('x');}}));
  assert.equal(called,false);assert.deepEqual(readdirSync(root),[]);
}));
test('GitHub JSON reads pin the API repository, media type and version',async()=>{
  const result=await githubJson(api,{token:secret,fetchFn:async(url,options)=>{
    assert.equal(url,api);assert.equal(options.redirect,'error');assert.equal(options.headers['X-GitHub-Api-Version'],'2022-11-28');return new Response('{"id":123}');
  }});assert.deepEqual(result,{id:123});
});
test('GitHub JSON refuses redirects, failures and malformed content',async()=>{
  for(const response of [new Response(null,{status:302}),new Response('raw sensitive-fixture',{status:403}),new Response('raw sensitive-fixture')])
    await assert.rejects(githubJson(api,{token:secret,fetchFn:async()=>response}),error=>error.message==='CI_PRIVATE_EVIDENCE_REFUSED');
});
test('decrypt timeout waits for process close and drains delayed stdout before the caller can clean private files',()=>fixture(async root=>{
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();let killed=false,closed=false,settled=false;
  child.kill=()=>{killed=true;setTimeout(()=>{child.stdout.emit('data',Buffer.from('late plaintext fixture'));closed=true;child.emit('close',null,'SIGKILL');},25);};
  const output=path.join(root,'clear.bin'),pending=decryptRecipientFile(root,'synthetic.gpg',output,{spawnFn:()=>child,timeoutMs:5});
  pending.then(()=>{settled=true;},()=>{settled=true;});
  await new Promise(resolve=>setTimeout(resolve,15));assert.equal(killed,true);assert.equal(settled,false);assert.equal(closed,false);
  await assert.rejects(pending,/CI_PRIVATE_EVIDENCE_REFUSED/);assert.equal(closed,true);assert.equal(readFileSync(output).length,0);
  assert.equal(child.stdout.listenerCount('data'),0);assert.equal(child.stderr.listenerCount('data'),0);
}));
test('private cleanup clears its held original directory and preserves a replacement and all its files',()=>fixture(async root=>{
  const directory=path.join(root,'owned'),owner=ownEvidenceDirectory(directory);writeFileSync(path.join(directory,'clear.bin'),'sensitive fixture');
  fs.renameSync(directory,path.join(root,'moved'));mkdirSync(directory,{mode:0o700});writeFileSync(path.join(directory,'retained'),'original');
  assert.throws(()=>assertOwnedDirectory(owner));removeOwnedDirectory(owner);
  assert.equal(readFileSync(path.join(directory,'retained'),'utf8'),'original');assert.deepEqual(readdirSync(path.join(root,'moved')),[]);
}));
test('private cleanup remains attached to a parent FD when the parent pathname is replaced',()=>fixture(async root=>{
  const parent=path.join(root,'parent');mkdirSync(parent);const directory=path.join(parent,'owned'),owner=ownEvidenceDirectory(directory);
  writeFileSync(path.join(directory,'clear.bin'),'sensitive fixture');fs.renameSync(parent,path.join(root,'parent-moved'));
  mkdirSync(parent);mkdirSync(path.join(parent,'owned'));writeFileSync(path.join(parent,'owned/retained'),'original');
  assert.throws(()=>assertOwnedDirectory(owner));removeOwnedDirectory(owner);
  assert.equal(readFileSync(path.join(parent,'owned/retained'),'utf8'),'original');assert.deepEqual(readdirSync(path.join(root,'parent-moved')),[]);
}));
test('private cleanup unlinks an internal symlink without touching its external target',()=>fixture(async root=>{
  const owner=ownEvidenceDirectory(path.join(root,'owned'));mkdirSync(path.join(root,'retained'));writeFileSync(path.join(root,'retained/file'),'original');
  symlinkSync(path.join(root,'retained'),path.join(owner.path,'linked'));removeOwnedDirectory(owner);
  assert.equal(readFileSync(path.join(root,'retained/file'),'utf8'),'original');assert.deepEqual(readdirSync(root),['retained']);
}));
for(const name of ['reports','receipts','gnupg'])test(`sensitive ${name} child capability keeps writes in its held directory after symlink substitution`,()=>fixture(async root=>{
  const parent=ownEvidenceDirectory(path.join(root,'owned')),child=ownEvidenceDirectory(path.join(parent.bound,name));
  const original=path.join(root,'moved'),external=path.join(root,'external');mkdirSync(external,{mode:0o700});
  fs.renameSync(path.join(parent.path,name),original);symlinkSync(external,path.join(parent.path,name));
  const held=child.bound??child.path;writeFileSync(path.join(held,'clear.bin'),'sensitive fixture',{flag:'wx',mode:0o600});
  try{assert.deepEqual(readdirSync(external),[]);assert.throws(()=>assertOwnedDirectory(child));}
  finally{removeOwnedDirectory(child);removeOwnedDirectory(parent);}
  assert.deepEqual(readdirSync(external),[]);assert.deepEqual(readdirSync(original),[]);
}));
test('a real native Node producer is sealed and decrypted unchanged by both isolated fixture recipients',()=>fixture(async directory=>{
  const repository=path.join(directory,'source'),keyrings=[path.join(directory,'recipient-one'),path.join(directory,'recipient-two')];mkdirSync(repository);
  const scripts=['scripts/testing/ci-private-evidence.mjs','scripts/testing/ci-evidence-contract.mjs','scripts/testing/test-lane-runtime.mjs',
    'scripts/testing/native-provenance.mjs','scripts/testing/test-lane-contract.mjs','scripts/testing/check-zero-test-debt.mjs',
    'scripts/testing/prepare-test-launch.mjs','scripts/testing/run-test-lane.mjs','scripts/testing/node-json-reporter.mjs',
    'scripts/testing/private-test-archive.py','scripts/testing/owned-evidence-directory.py','scripts/release/encrypt-release-archive.mjs'];
  for(const file of scripts){mkdirSync(path.dirname(path.join(repository,file)),{recursive:true});copyFileSync(path.resolve(file),path.join(repository,file));}
  mkdirSync(path.join(repository,'node_modules'));cpSync(path.resolve('node_modules/typescript'),path.join(repository,'node_modules/typescript'),{recursive:true});
  writeFileSync(path.join(repository,'.gitignore'),'node_modules/\n');
  const run=(binary,args,options={})=>{const result=spawnSync(binary,args,{cwd:repository,encoding:'utf8',maxBuffer:1024**2,...options});
    assert.equal(result.status,0,result.stderr);return result.stdout;};
  mkdirSync(path.join(repository,'.github/governance'),{recursive:true});mkdirSync(path.join(repository,'security'));
  writeFileSync(path.join(repository,'native.test.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';test('fixture assertion',()=>assert.equal(2+2,4));\n");
  writeFileSync(path.join(repository,'.github/governance/test-lanes.json'),JSON.stringify({schemaVersion:1,lanes:[{id:'node-native',kind:'PRIMARY',runner:'node',argv:['native.test.mjs']}]}));
  writeFileSync(path.join(repository,'.github/governance/ci-test-producers.json'),JSON.stringify({schemaVersion:'nexus-ci-test-producers/v1',producers:{unit:['node-native']}}));
  for(let i=0;i<keyrings.length;i++){
    const home=keyrings[i];mkdirSync(home,{mode:0o700});
    run('gpg',['--no-options','--homedir',home,'--batch','--pinentry-mode','loopback','--passphrase','','--quick-generate-key',`Nexus synthetic recipient ${i}`,'future-default','default','1d']);
    writeFileSync(path.join(repository,'security',i?'qualification-recipient.asc':'release-recipient.asc'),run('gpg',['--no-options','--homedir',home,'--armor','--export']));
  }
  const recipientListing=run('gpg',['--no-options','--homedir',keyrings[1],'--with-colons','--fingerprint','--list-secret-keys']);
  const recipientFingerprint=recipientListing.split('\n').find(line=>line.startsWith('fpr:')).split(':')[9];
  const transport=path.join(repository,'scripts/testing/ci-private-evidence.mjs');
  writeFileSync(transport,readFileSync(transport,'utf8').replace('DC8C0686E449BB106FF5B5380770E66EF507FFCB',recipientFingerprint));
  try{
    run('git',['init','-q']);run('git',['add','.']);run('git',['-c','user.name=Synthetic','-c','user.email=fixture@invalid.test','commit','-qm','synthetic native evidence fixture']);
    const sourceSha=run('git',['rev-parse','HEAD']).trim(),tree=run('git',['rev-parse','HEAD^{tree}']).trim(),launch=path.join(directory,'launch.json'),reports=path.join(directory,'reports');
    const env={...process.env,GITHUB_REPOSITORY:'cyranoaladin/nexus-project_v0',GITHUB_REPOSITORY_ID:'1031512009',GITHUB_RUN_ID:'12345',GITHUB_RUN_ATTEMPT:'1',
      GITHUB_REF:'refs/pull/346/merge',GITHUB_SHA:'2'.repeat(40),GITHUB_EVENT_NAME:'pull_request',NEXUS_EXPECTED_SOURCE_SHA:sourceSha,
      NEXUS_EXPECTED_SOURCE_TREE:tree,NEXUS_EXPECTED_SOURCE_BRANCH:'fix/core-v2-v1only-invitation-contract',NEXUS_TEST_EVIDENCE_DIR:reports,NEXUS_TEST_LAUNCH_MANIFEST:launch};
    run(process.execPath,['scripts/testing/prepare-test-launch.mjs'],{env});env.NEXUS_TEST_LAUNCH_SHA256=sha(readFileSync(launch)).slice(7);
    run(process.execPath,['scripts/testing/run-test-lane.mjs','node-native'],{env});const original=readFileSync(path.join(reports,'node-native.native.json'));
    const sealed=path.join(directory,'sealed');run(process.execPath,['scripts/testing/ci-private-evidence.mjs','seal','unit',reports,sealed],{env});
    assert.deepEqual(readdirSync(sealed).sort(),['manifest.json','payload.gpg']);const manifest=JSON.parse(readFileSync(path.join(sealed,'manifest.json')));
    assert.equal(manifest.cipherSha256,sha(readFileSync(path.join(sealed,'payload.gpg'))).slice(7));assert.equal(manifest.sourceSha,sourceSha);
    for(let i=0;i<keyrings.length;i++){
      const clear=path.join(directory,`clear-${i}.bin`),unsealed=path.join(directory,`unsealed-${i}`);
      run('gpg',['--no-options','--homedir',keyrings[i],'--batch','--output',clear,'--decrypt',path.join(sealed,'payload.gpg')]);
      run('python3',['scripts/testing/private-test-archive.py','extract','--input',clear,'--output',unsealed]);
      assert.deepEqual(readFileSync(path.join(unsealed,'payload/reports/unit/node-native.native.json')),original);
      assert.equal(JSON.parse(readFileSync(path.join(unsealed,'payload/reports/unit/node-native.report.json'))).tests.length,1);
    }
    const attached=path.join(directory,'derived');mkdirSync(attached);writeFileSync(path.join(attached,'view.json'),'{"derived":true}');
    const derivedSealed=path.join(directory,'derived-sealed');run(process.execPath,['scripts/testing/ci-private-evidence.mjs','seal-attachments','aria-evidence',attached,derivedSealed],{env});
    const derivedClear=path.join(directory,'derived-clear.bin'),derivedUnsealed=path.join(directory,'derived-unsealed');
    run('gpg',['--no-options','--homedir',keyrings[0],'--batch','--output',derivedClear,'--decrypt',path.join(derivedSealed,'payload.gpg')]);
    run('python3',['scripts/testing/private-test-archive.py','extract','--input',derivedClear,'--output',derivedUnsealed]);
    assert.equal(readFileSync(path.join(derivedUnsealed,'payload/attachments/aria-evidence/view.json'),'utf8'),'{"derived":true}');
    assert.deepEqual(readdirSync(path.join(derivedUnsealed,'payload')).sort(),['INDEX.json','attachments']);
    const race=path.join(directory,'race.mjs');
    writeFileSync(race,`import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
      import {fetchProducerReports} from ${JSON.stringify('file://'+transport)};
      const original=fs.mkdirSync;let moved,replaced,calls=0;
      fs.mkdirSync=(directory,...args)=>{if(String(directory).endsWith('/gnupg')&&!moved){
        replaced=fs.realpathSync(path.dirname(directory));moved=replaced+'-moved';fs.renameSync(replaced,moved);
        original(replaced,{mode:0o700});fs.writeFileSync(path.join(replaced,'retained'),'original');}
        return original(directory,...args);};
      globalThis.fetch=async()=>{calls++;return new Response('unavailable',{status:503});};
      try{await assert.rejects(fetchProducerReports(['unit'],${JSON.stringify(path.join(directory,'race-output'))}));
        assert.equal(calls,1);assert.ok(moved);assert.deepEqual(fs.readdirSync(replaced),['retained']);
        assert.equal(fs.readFileSync(path.join(replaced,'retained'),'utf8'),'original');assert.deepEqual(fs.readdirSync(moved),[]);
      }finally{fs.mkdirSync=original;}
    `);
    run(process.execPath,[race],{env:{...env,GH_TOKEN:secret,
      NEXUS_CI_EVIDENCE_PRIVATE_KEY:run('gpg',['--no-options','--homedir',keyrings[1],'--batch','--armor','--export-secret-keys'])}});
    assert.equal(run('git',['status','--porcelain']), '');
  }finally{for(const home of keyrings)spawnSync('gpgconf',['--homedir',home,'--kill','gpg-agent'],{stdio:'ignore'});}
}));
