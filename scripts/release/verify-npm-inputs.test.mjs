import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifyArchive,NPM_INPUT_PINS} from './verify-npm-inputs.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const archive=Buffer.from('synthetic-public-package-archive');
const integrity='sha512-'+createHash('sha512').update(archive).digest('base64');
const pin={name:'synthetic-package',version:'1.0.0',sha256:createHash('sha256').update(archive).digest('hex'),integrity};
const signature=sign('sha256',Buffer.from(`${pin.name}@${pin.version}:${integrity}`),privateKey).toString('base64');
const metadata={name:pin.name,version:pin.version,dist:{tarball:`https://registry.npmjs.org/${pin.name}/-/${pin.name}-${pin.version}.tgz`,integrity,
  signatures:[{keyid:'test-key',sig:signature}]}};
test('a signed, digest-pinned registry archive verifies without executing package code',()=>{
  assert.equal(verifyArchive(archive,metadata,pin,publicKey,'test-key').sha256,pin.sha256);
});
test('archive corruption refuses before composition',()=>{
  assert.throws(()=>verifyArchive(Buffer.from('modified'),metadata,pin,publicKey,'test-key'),/SHA256_MISMATCH/);
});
test('metadata cannot change the package identity, version, URL or declared integrity',()=>{
  for(const change of [{name:'other'},{version:'2.0.0'},{dist:{...metadata.dist,tarball:'https://untrusted.example/package.tgz'}},{dist:{...metadata.dist,integrity:'sha512-wrong'}}])
    assert.throws(()=>verifyArchive(archive,{...metadata,...change},pin,publicKey,'test-key'),/METADATA_MISMATCH/);
});
test('a wrong signature or signing-key identity refuses',()=>{
  for(const signature of [{keyid:'different-key',sig:metadata.dist.signatures[0].sig},{keyid:'test-key',sig:Buffer.from('forged').toString('base64')}])
    assert.throws(()=>verifyArchive(archive,{...metadata,dist:{...metadata.dist,signatures:[signature]}},pin,publicKey,'test-key'),/SIGNATURE_INVALID/);
});
test('every bundled advisory fix is an independently signed and pinned compatible input',()=>{
  assert.deepEqual(NPM_INPUT_PINS.map(pin=>[pin.name,pin.version]),[
    ['npm','11.21.0'],['brace-expansion','5.0.12'],['http-cache-semantics','4.3.0'],
    ['undici','6.29.0'],['ip-address','10.7.1'],['postcss-selector-parser','7.1.6']]);
});
test('the composer rejects traversal, links, duplicate entries and oversized members before extraction',()=>{
  const execution=spawnSync('python3',['-c',`
import importlib.util,io,tarfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('builder',Path('scripts/release/build-npm-security.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
for name,kind,size,duplicate in [('package/../escape',tarfile.REGTYPE,0,False),('package/link',tarfile.SYMTYPE,0,False),('package/link',tarfile.LNKTYPE,0,False),('package/a',tarfile.REGTYPE,0,True),('package/a',tarfile.REGTYPE,21*1024*1024,False)]:
 raw=io.BytesIO()
 with tarfile.open(fileobj=raw,mode='w:gz') as t:
  entry=tarfile.TarInfo(name);entry.type=kind;entry.size=size;t.addfile(entry,io.BytesIO(b'x'*size))
  if duplicate:t.addfile(entry,io.BytesIO(b'x'*size))
 try:m.load_archive(raw.getvalue())
 except RuntimeError:continue
 raise AssertionError('unsafe archive accepted')
`],{encoding:'utf8'});assert.equal(execution.status,0,execution.stderr);
});
test('source qualification refuses a forged SHA, changed recipe or dirty tree, while preliminary evidence stays explicitly unqualified',()=>{
  const execution=spawnSync('python3',['-c',`
import importlib.util,tempfile,subprocess,shutil
from pathlib import Path
spec=importlib.util.spec_from_file_location('builder',Path('scripts/release/build-npm-security.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 r=Path(d);b=r/'scripts/release/build-npm-security.py';b.parent.mkdir(parents=True)
 shutil.copyfile('scripts/release/build-npm-security.py',b);shutil.copyfile('scripts/release/verify-npm-inputs.mjs',b.with_name('verify-npm-inputs.mjs'))
 def git(*args):return subprocess.check_output(['git',*args],cwd=r,text=True).strip()
 git('init','-q');git('add','.');git('-c','user.name=Nexus Qualification','-c','user.email=qualification@example.invalid','commit','-qm','synthetic recipe')
 sha=git('rev-parse','HEAD');assert m.verify_source_binding(b,sha)['qualified'] is True
 for change in ['forged','dirty','recipe']:
  if change=='dirty':(r/'unexpected').write_text('untracked')
  if change=='recipe':b.write_text(b.read_text()+'# change\\n')
  try:m.verify_source_binding(b,'b'*40 if change=='forged' else sha)
  except RuntimeError:pass
  else:raise AssertionError('unqualified source accepted')
 assert m.verify_source_binding(b,sha,preliminary=True)['qualified'] is False
`],{encoding:'utf8'});assert.equal(execution.status,0,execution.stderr);
});
