import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,statSync,symlinkSync,linkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const helper=path.resolve('scripts/testing/private-test-archive.py');
const magic=Buffer.from('NEXUS-PRIVATE-ARCHIVE\x00\x01');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function record(type,value,bytes=Buffer.alloc(0)){
  return rawRecord(type,Buffer.from(JSON.stringify(value)),bytes);
}
function rawRecord(type,header,bytes=Buffer.alloc(0)){
  const prefix=Buffer.alloc(5);prefix[0]=type;prefix.writeUInt32BE(header.length,1);
  return Buffer.concat([prefix,header,bytes]);
}
function invalidFirstFile(kind,header,bytes=Buffer.alloc(0)){
  const index={schemaVersion:'nexus-private-test-archive/v1',files:[{path:'reports/unit/a',size:bytes.length,sha256:sha(bytes)}],totalBytes:bytes.length};
  return Buffer.concat([magic,rawRecord(kind,Buffer.from(header),bytes),record(2,index)]);
}
function archive(entries,alter=x=>x){
  const files=entries.map(([name,bytes])=>({path:name,size:bytes.length,sha256:sha(bytes)}));
  return Buffer.concat([magic,...entries.map(([name,bytes])=>record(1,{path:name,size:bytes.length},bytes)),
    record(2,alter({schemaVersion:'nexus-private-test-archive/v1',files,totalBytes:files.reduce((sum,f)=>sum+f.size,0)}))]);
}
function fixture(fn){const root=mkdtempSync(path.join(tmpdir(),'nexus-private-archive-'));try{return fn(root);}finally{rmSync(root,{recursive:true,force:true});}}
function invoke(args){return spawnSync('python3',[helper,...args],{encoding:'utf8',maxBuffer:1024*1024});}
function extract(root,bytes){const input=path.join(root,'evidence.bin'),output=path.join(root,'unsealed');writeFileSync(input,bytes,{mode:0o600});return {result:invoke(['extract','--input',input,'--output',output]),output};}
function refused(result){assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(result.stderr,'PRIVATE_ARCHIVE_REFUSED\n');}
test('private archive round-trip preserves native bytes, empty and Unicode files with private modes',()=>fixture(root=>{
  const reports=path.join(root,'reports'),attachments=path.join(root,'attachments');mkdirSync(reports,{mode:0o700});mkdirSync(attachments,{mode:0o700});
  const bytes=Buffer.from([0,255,1,2,10]);writeFileSync(path.join(reports,'native.json'),bytes);writeFileSync(path.join(attachments,'résumé.log'),Buffer.alloc(0));
  const input=path.join(root,'evidence.bin'),output=path.join(root,'unsealed');
  const created=invoke(['create','--output',input,'--reports',`core-v2=${reports}`,'--attachments',`core-v2=${attachments}`]);assert.equal(created.status,0,created.stderr);
  assert.equal(statSync(input).mode&0o777,0o600);
  const result=invoke(['extract','--input',input,'--output',output]);assert.equal(result.status,0,result.stderr);
  assert.deepEqual(readFileSync(path.join(output,'payload/reports/core-v2/native.json')),bytes);
  assert.equal(readFileSync(path.join(output,'payload/attachments/core-v2/résumé.log')).length,0);
  assert.equal(statSync(output).mode&0o777,0o700);assert.equal(statSync(path.join(output,'payload/reports/core-v2/native.json')).mode&0o777,0o600);
  assert.equal(JSON.parse(readFileSync(path.join(output,'payload/INDEX.json'))).files.length,2);
}));
test('private archive extraction verifies the complete index before publishing any bytes',()=>fixture(root=>{
  const {result,output}=extract(root,archive([['reports/unit/native.json',Buffer.from('native')]]));assert.equal(result.status,0,result.stderr);
  assert.equal(readFileSync(path.join(output,'payload/reports/unit/native.json'),'utf8'),'native');
}));
for(const name of ['/escape','reports/unit/../escape','reports/unit/a\\b','reports/unit/.env.local','reports/unit/private-key.asc','reports/unit/credentials.json','reports/unit/.auth/session.json','reports/unit/storage-state.json','reports/unit/a\u0000b']){
  test(`private archive refuses unsafe entry ${JSON.stringify(name)} without creating a destination`,()=>fixture(root=>{
    const {result,output}=extract(root,archive([[name,Buffer.from('secret fixture')]]));refused(result);assert.equal(readdirSync(root).includes(path.basename(output)),false);
  }));
}
for(const [label,bytes] of [
  ['duplicate',archive([['reports/unit/a',Buffer.from('one')],['reports/unit/a',Buffer.from('two')]])],
  ['file-prefix collision',archive([['reports/unit/a',Buffer.alloc(0)],['reports/unit/a/b',Buffer.alloc(0)]])],
  ['wrong hash',archive([['reports/unit/a',Buffer.from('native')]],v=>({...v,files:v.files.map(f=>({...f,sha256:'0'.repeat(64)}))}))],
  ['wrong total',archive([['reports/unit/a',Buffer.from('native')]],v=>({...v,totalBytes:v.totalBytes+1}))],
  ['missing index',Buffer.concat([magic,record(1,{path:'reports/unit/a',size:1},Buffer.from('a'))])],
  ['trailing bytes',Buffer.concat([archive([['reports/unit/a',Buffer.alloc(0)]]),Buffer.from('x')])],
  ['truncated',archive([['reports/unit/a',Buffer.alloc(0)]]).subarray(0,-1)],
  ['unknown record',invalidFirstFile(3,'{"path":"reports/unit/a","size":0}')],
  ['oversized file',Buffer.concat([magic,record(1,{path:'reports/unit/a',size:512*1024*1024+1})])],
  ['oversized header',Buffer.concat([magic,Buffer.from([1,127,255,255,255])])],
  ['duplicate JSON key',invalidFirstFile(1,'{"path":"reports/unit/a","size":0,"size":0}')],
  ['boolean index size',archive([['reports/unit/a',Buffer.from('a')]],v=>({...v,files:v.files.map(f=>({...f,size:true}))}))],
  ['boolean file size',invalidFirstFile(1,'{"path":"reports/unit/a","size":false}')],
  ['floating file size',invalidFirstFile(1,'{"path":"reports/unit/a","size":0.0}')],
  ['negative file size',Buffer.concat([magic,record(1,{path:'reports/unit/a',size:-1})])],
  ['extra metadata field',invalidFirstFile(1,'{"path":"reports/unit/a","size":0,"link":"elsewhere"}')],
  ['reverse prefix collision',archive([['reports/unit/a/b',Buffer.alloc(0)],['reports/unit/a',Buffer.alloc(0)]])],
  ['extra index record',archive([['reports/unit/a',Buffer.alloc(0)]],v=>({...v,files:[...v.files,...v.files]}))],
  ['missing index record',archive([['reports/unit/a',Buffer.alloc(0)]],v=>({...v,files:[]}))],
])test(`private archive refuses ${label}`,()=>fixture(root=>{const {result,output}=extract(root,bytes);refused(result);assert.equal(readdirSync(root).includes(path.basename(output)),false);}));
for(const kind of ['file symlink','directory symlink','ancestor symlink','hardlink','environment','credential'])test(`private archive creation refuses ${kind} and leaves no archive`,()=>fixture(root=>{
  const source=path.join(root,'source');mkdirSync(source);writeFileSync(path.join(root,'original'),'bytes');let selected=source;
  if(kind==='file symlink')symlinkSync(path.join(root,'original'),path.join(source,'report.json'));
  if(kind==='directory symlink')symlinkSync(root,path.join(source,'linked'));
  if(kind==='ancestor symlink'){const alias=path.join(root,'alias');symlinkSync(source,alias);selected=alias;}
  if(kind==='hardlink')linkSync(path.join(root,'original'),path.join(source,'report.json'));
  if(kind==='environment')writeFileSync(path.join(source,'.env'),'sensitive fixture');
  if(kind==='credential')writeFileSync(path.join(source,'test-credentials.json'),'sensitive fixture');
  const output=path.join(root,'evidence.bin');refused(invoke(['create','--output',output,'--reports',`unit=${selected}`]));assert.equal(readdirSync(root).includes('evidence.bin'),false);
}));
test('private archive preserves preexisting extraction destination',()=>fixture(root=>{
  const output=path.join(root,'unsealed');mkdirSync(output);writeFileSync(path.join(output,'retained'),'original');
  const {result}=extract(root,archive([['reports/unit/native.json',Buffer.from('native')]]));refused(result);assert.equal(readFileSync(path.join(output,'retained'),'utf8'),'original');
}));
test('private archive preserves preexisting archive',()=>fixture(root=>{
  const source=path.join(root,'source');mkdirSync(source);writeFileSync(path.join(source,'native.json'),'native');const output=path.join(root,'evidence.bin');writeFileSync(output,'original');
  refused(invoke(['create','--output',output,'--reports',`unit=${source}`]));assert.equal(readFileSync(output,'utf8'),'original');
}));
function artifactZip(root,entries){
  const file=path.join(root,'artifact.zip');
  const result=spawnSync('python3',['-c',
    "import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED) as z:\n for name,value,mode in json.loads(sys.argv[2]):\n  i=zipfile.ZipInfo(name);i.external_attr=mode<<16;i.compress_type=zipfile.ZIP_DEFLATED;z.writestr(i,value.encode())",
    file,JSON.stringify(entries)],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);return file;
}
test('GitHub artifact ZIP extraction preserves exactly the two expected sealed files privately',()=>fixture(root=>{
  const input=artifactZip(root,[['manifest.json','{}',0o100600],['payload.gpg','encrypted bytes',0o100600]]),output=path.join(root,'downloaded');
  const result=invoke(['artifact-zip','--input',input,'--output',output,'--kind','evidence']);assert.equal(result.status,0,result.stderr);
  assert.equal(readFileSync(path.join(output,'payload/payload.gpg'),'utf8'),'encrypted bytes');assert.equal(statSync(path.join(output,'payload/manifest.json')).mode&0o777,0o600);
}));
test('GitHub launch-plan ZIP extraction accepts its sole external challenge file',()=>fixture(root=>{
  const input=artifactZip(root,[['launch.json','{"contexts":[]}',0o100600]]),output=path.join(root,'downloaded');
  const result=invoke(['artifact-zip','--input',input,'--output',output,'--kind','plan']);assert.equal(result.status,0,result.stderr);
  assert.equal(readFileSync(path.join(output,'payload/launch.json'),'utf8'),'{"contexts":[]}');
}));
test('GitHub artifact ZIP refuses a raw filename truncated at NUL by ZipInfo',()=>fixture(root=>{
  const input=artifactZip(root,[['launch.jsonXsuffix','{}',0o100600]]),bytes=readFileSync(input),name=Buffer.from('launch.jsonXsuffix');let count=0;
  for(let offset=bytes.indexOf(name);offset!==-1;offset=bytes.indexOf(name,offset+name.length)){bytes[offset+11]=0;count++;}
  assert.equal(count,2);writeFileSync(input,bytes);const output=path.join(root,'downloaded');
  refused(invoke(['artifact-zip','--input',input,'--output',output,'--kind','plan']));assert.equal(readdirSync(root).includes('downloaded'),false);
}));
test('GitHub artifact ZIP verifies overlapped payloads before any output mutation',()=>fixture(root=>{
  const input=artifactZip(root,[['manifest.json','{}',0o100600],['payload.gpg','bytes',0o100600]]),bytes=readFileSync(input);
  const central=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));assert.ok(central>0);
  bytes.writeUInt32LE(bytes.readUInt32LE(central+20)+50,central+20);writeFileSync(input,bytes);
  const result=instrument(root,"original=m.os.mkdir\ndef changed(*args,**kwargs):\n print('DESTINATION_WRITE_OCCURRED');return original(*args,**kwargs)\nm.os.mkdir=changed",
    "m.extract_artifact_zip(os.path.join(root,'artifact.zip'),os.path.join(root,'downloaded'),'evidence')");
  refused(result);assert.equal(readdirSync(root).includes('downloaded'),false);
}));
test('GitHub artifact ZIP refuses a ZIP64 locator before the standard library can override the central-directory budget',()=>fixture(root=>{
  const input=artifactZip(root,[['manifest.json','{}',0o100600],['payload.gpg','bytes',0o100600]]),original=readFileSync(input);
  const end=original.subarray(-22),prefix=original.subarray(0,-22),zip64=Buffer.alloc(56),locator=Buffer.alloc(20),forged=Buffer.from(end);
  zip64.writeUInt32LE(0x06064b50,0);zip64.writeBigUInt64LE(44n,4);zip64.writeUInt16LE(45,12);zip64.writeUInt16LE(45,14);
  zip64.writeBigUInt64LE(2n,24);zip64.writeBigUInt64LE(2n,32);zip64.writeBigUInt64LE(BigInt(end.readUInt32LE(12)),40);
  zip64.writeBigUInt64LE(BigInt(end.readUInt32LE(16)),48);
  locator.writeUInt32LE(0x07064b50,0);locator.writeBigUInt64LE(BigInt(prefix.length),8);locator.writeUInt32LE(1,16);
  forged.writeUInt32LE(76,12);forged.writeUInt32LE(prefix.length,16);
  writeFileSync(input,Buffer.concat([prefix,zip64,locator,forged]));
  const result=instrument(root,"original=m.zipfile.ZipFile\ndef forbidden(*args,**kwargs):\n print('ZIPFILE_ALLOCATION_REACHED');return original(*args,**kwargs)\nm.zipfile.ZipFile=forbidden",
    "m.extract_artifact_zip(os.path.join(root,'artifact.zip'),os.path.join(root,'downloaded'),'evidence')");
  refused(result);assert.equal(readdirSync(root).includes('downloaded'),false);
}));
for(const kind of ['local header','CRC'])test(`GitHub artifact ZIP validates ${kind} before reserving any destination`,()=>fixture(root=>{
  const input=artifactZip(root,[['manifest.json','{}',0o100600],['payload.gpg','bytes',0o100600]]),bytes=readFileSync(input);
  if(kind==='local header')bytes.writeUInt32LE(0,0);
  else{const offset=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));assert.ok(offset>0);bytes.writeUInt32LE((bytes.readUInt32LE(offset+16)^1)>>>0,offset+16);}
  writeFileSync(input,bytes);
  const result=instrument(root,"original=m.os.mkdir\ndef changed(*args,**kwargs):\n print('DESTINATION_WRITE_OCCURRED');return original(*args,**kwargs)\nm.os.mkdir=changed",
    "m.extract_artifact_zip(os.path.join(root,'artifact.zip'),os.path.join(root,'downloaded'),'evidence')");
  refused(result);assert.equal(readdirSync(root).includes('downloaded'),false);
}));
test('GitHub artifact ZIP detects a destination truncated during fsync',()=>fixture(root=>{
  artifactZip(root,[['manifest.json','{}',0o100600],['payload.gpg','bytes',0o100600]]);
  const body="original=m.os.fsync\ndef changed(fd):\n if os.path.exists(os.path.join(root,'downloaded/.staging/payload.gpg')) and os.fstat(fd).st_ino==os.stat(os.path.join(root,'downloaded/.staging/payload.gpg')).st_ino:\n  os.ftruncate(fd,0)\n return original(fd)\nm.os.fsync=changed";
  refused(instrument(root,body,"m.extract_artifact_zip(os.path.join(root,'artifact.zip'),os.path.join(root,'downloaded'),'evidence')"));
  assert.equal(readdirSync(root).includes('downloaded'),false);
}));
test('GitHub artifact ZIP refuses a destination ancestor replaced during publication',()=>fixture(root=>{
  artifactZip(root,[['manifest.json','{}',0o100600],['payload.gpg','bytes',0o100600]]);mkdirSync(path.join(root,'destination-parent'));
  const body="original=m.os.rename\ndef changed(source,destination,*args,**kwargs):\n result=original(source,destination,*args,**kwargs)\n if source=='.staging' and destination=='payload':\n  original(os.path.join(root,'destination-parent'),os.path.join(root,'destination-parent-moved'))\n  os.mkdir(os.path.join(root,'destination-parent'))\n return result\nm.os.rename=changed";
  refused(instrument(root,body,"m.extract_artifact_zip(os.path.join(root,'artifact.zip'),os.path.join(root,'destination-parent/downloaded'),'evidence')"));
  assert.deepEqual(readdirSync(path.join(root,'destination-parent')),[]);assert.deepEqual(readdirSync(path.join(root,'destination-parent-moved')),[]);
}));
for(const [label,entries] of [
  ['traversal',[['../manifest.json','{}',0o100600],['payload.gpg','bytes',0o100600]]],
  ['symlink',[['manifest.json','{}',0o100600],['payload.gpg','elsewhere',0o120777]]],
  ['duplicate',[['manifest.json','{}',0o100600],['manifest.json','{}',0o100600]]],
  ['extra entry',[['manifest.json','{}',0o100600],['payload.gpg','bytes',0o100600],['extra','bytes',0o100600]]],
  ['key file',[['manifest.json','{}',0o100600],['private.key','secret fixture',0o100600]]],
])test(`GitHub artifact ZIP refuses ${label} before reserving an output`,()=>fixture(root=>{
  const input=artifactZip(root,entries),output=path.join(root,'downloaded');refused(invoke(['artifact-zip','--input',input,'--output',output,'--kind','evidence']));
  assert.equal(readdirSync(root).includes('downloaded'),false);
}));

function instrument(root,body,operation){
  const code=`import importlib.util,os,sys,signal\nspec=importlib.util.spec_from_file_location('transport',sys.argv[1])\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nroot=sys.argv[2]\n${body}\ntry:\n ${operation}\nexcept BaseException:\n print('PRIVATE_ARCHIVE_REFUSED',file=sys.stderr);sys.exit(1)\n`;
  return spawnSync('python3',['-c',code,helper,root],{encoding:'utf8',maxBuffer:1024*1024});
}
test('private archive caps directories during preflight before reserving the extraction destination',()=>fixture(root=>{
  writeFileSync(path.join(root,'evidence.bin'),archive([['reports/unit/deep/more/native.json',Buffer.from('native')]]));
  const body="m.MAX_ENTRIES=4\noriginal=m.os.mkdir\ndef changed(*args,**kwargs):\n print('DESTINATION_WRITE_OCCURRED');return original(*args,**kwargs)\nm.os.mkdir=changed";
  refused(instrument(root,body,"m.extract_archive(os.path.join(root,'evidence.bin'),os.path.join(root,'unsealed'))"));
  assert.equal(readdirSync(root).includes('unsealed'),false);
}));
test('private archive creation applies the same namespace entry budget as extraction',()=>fixture(root=>{
  mkdirSync(path.join(root,'source'));writeFileSync(path.join(root,'source/native.json'),'native');
  refused(instrument(root,'m.MAX_ENTRIES=3',"m.create_archive([('reports','unit',os.path.join(root,'source'))],os.path.join(root,'evidence.bin'))"));
  assert.equal(readdirSync(root).includes('evidence.bin'),false);
}));
test('private archive inventory stops reading directory entries once its cap is exceeded',()=>fixture(root=>{
  mkdirSync(path.join(root,'source'));writeFileSync(path.join(root,'source/native.json'),'native');
  const body=`m.MAX_ENTRIES=2\noriginal=m.os.scandir\nclass Bounded:\n def __enter__(self):return iter(self)\n def __exit__(self,*_):pass\n def __iter__(self):return self\n def __next__(self):\n  self.count=getattr(self,'count',0)+1\n  if self.count>3:\n   print('TOO_MANY_DIRECTORY_READS');raise AssertionError('UNBOUNDED_INVENTORY')\n  return type('Entry',(),{'name':'entry'+str(self.count)})()\nm.os.scandir=lambda *_:Bounded()\ndef forbidden_listdir(*_):\n print('UNBOUNDED_LISTDIR_USED');raise AssertionError('UNBOUNDED_LISTDIR')\nm.os.listdir=forbidden_listdir`;
  const result=instrument(root,body,"m.create_archive([('reports','unit',os.path.join(root,'source'))],os.path.join(root,'evidence.bin'))");refused(result);
  assert.equal(readdirSync(root).includes('evidence.bin'),false);
}));
for(const [label,body] of [
  ['replacement between stat and open',`original=m.os.open\ndef changed(name,flags,*args,**kwargs):\n if name=='native.json' and flags==m.READ:\n  os.unlink(os.path.join(root,'source/native.json'));os.symlink(os.path.join(root,'elsewhere'),os.path.join(root,'source/native.json'))\n return original(name,flags,*args,**kwargs)\nm.os.open=changed`],
  ['mutation during file reading',`original=m.os.read;done=False\ndef changed(fd,size):\n global done\n result=original(fd,size)\n if not done and os.fstat(fd).st_ino==os.stat(os.path.join(root,'source/native.json')).st_ino:\n  done=True\n  with open(os.path.join(root,'source/native.json'),'ab') as f:f.write(b'changed')\n return result\nm.os.read=changed`],
  ['added file after last read',`original=m.write_header\ndef changed(fd,kind,value):\n if kind==2:\n  with open(os.path.join(root,'source/new.json'),'wb') as f:f.write(b'added')\n return original(fd,kind,value)\nm.write_header=changed`],
  ['interrupted archive write',`original=m.write_all\ndef changed(fd,value):\n original(fd,value)\n raise KeyboardInterrupt()\nm.write_all=changed`],
])test(`private archive creation closes and removes its output after ${label}`,()=>fixture(root=>{
  mkdirSync(path.join(root,'source'));writeFileSync(path.join(root,'source/native.json'),'native');writeFileSync(path.join(root,'elsewhere'),'retained');
  const result=instrument(root,body,"m.create_archive([('reports','unit',os.path.join(root,'source'))],os.path.join(root,'evidence.bin'))");refused(result);
  assert.equal(readdirSync(root).includes('evidence.bin'),false);assert.equal(readFileSync(path.join(root,'elsewhere'),'utf8'),'retained');
}));
for(const [label,body] of [
  ['archive mutation after preflight',`original=m.preflight\ndef changed(fd,length):\n result=original(fd,length)\n with open(os.path.join(root,'evidence.bin'),'r+b') as f:f.seek(len(m.MAGIC)+5);f.write(b'x')\n return result\nm.preflight=changed`],
  ['disk full during copy',`original=m.write_all\ndef changed(fd,value):\n original(fd,value)\n raise OSError(28,'synthetic ENOSPC')\nm.write_all=changed`],
  ['interruption during copy',`original=m.write_all\ndef changed(fd,value):\n original(fd,value)\n raise KeyboardInterrupt()\nm.write_all=changed`],
  ['staging directory substitution',`original=m.os.fsync;done=False\ndef changed(fd):\n global done\n result=original(fd)\n stage=os.path.join(root,'unsealed/.staging')\n if not done and os.path.isdir(stage) and os.fstat(fd).st_ino==os.stat(stage).st_ino:\n  done=True;os.rename(stage,stage+'-retained');os.mkdir(stage,0o700)\n return result\nm.os.fsync=changed`],
  ['copied file mutation before publication',`original=m.os.fsync;done=False\ndef changed(fd):\n global done\n result=original(fd)\n stage=os.path.join(root,'unsealed/.staging')\n if not done and os.path.isdir(stage) and os.fstat(fd).st_ino==os.stat(stage).st_ino:\n  done=True\n  with open(os.path.join(stage,'reports/unit/native.json'),'wb') as f:f.write(b'altered')\n return result\nm.os.fsync=changed`],
  ['copied subdirectory substitution',`original=m.os.fsync;done=False\ndef changed(fd):\n global done\n result=original(fd)\n stage=os.path.join(root,'unsealed/.staging')\n if not done and os.path.isdir(stage) and os.fstat(fd).st_ino==os.stat(stage).st_ino:\n  done=True;sub=os.path.join(stage,'reports/unit');os.rename(sub,sub+'-retained');os.mkdir(sub,0o700)\n return result\nm.os.fsync=changed`],
  ['injected link before publication',`original=m.os.fsync;done=False\ndef changed(fd):\n global done\n result=original(fd)\n stage=os.path.join(root,'unsealed/.staging')\n if not done and os.path.isdir(stage) and os.fstat(fd).st_ino==os.stat(stage).st_ino:\n  done=True;os.symlink(os.path.join(root,'evidence.bin'),os.path.join(stage,'injected'))\n return result\nm.os.fsync=changed`],
])test(`private archive extraction publishes nothing after ${label}`,()=>fixture(root=>{
  writeFileSync(path.join(root,'evidence.bin'),archive([['reports/unit/native.json',Buffer.from('native')]]));
  const result=instrument(root,body,"m.extract_archive(os.path.join(root,'evidence.bin'),os.path.join(root,'unsealed'))");refused(result);
  assert.equal(readdirSync(root).includes('unsealed'),false);
}));
