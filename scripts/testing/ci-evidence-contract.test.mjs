import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedCiContext,validateGitHubRun,validateGitHubArtifact,validateAttestation,validatePublicManifest,evidenceArtifactName} from './ci-evidence-contract.mjs';

const sourceSha='1'.repeat(40),githubSha='2'.repeat(40),tree='3'.repeat(40),planHash='4'.repeat(64),cipherHash='5'.repeat(64);
const env={GITHUB_REPOSITORY:'cyranoaladin/nexus-project_v0',GITHUB_REPOSITORY_ID:'1031512009',GITHUB_RUN_ID:'12345',GITHUB_RUN_ATTEMPT:'2',
  GITHUB_REF:'refs/pull/346/merge',GITHUB_SHA:githubSha,GITHUB_EVENT_NAME:'pull_request',NEXUS_EXPECTED_SOURCE_SHA:sourceSha,
  NEXUS_EXPECTED_SOURCE_BRANCH:'fix/core-v2-v1only-invitation-contract',NEXUS_EXPECTED_SOURCE_TREE:tree,NEXUS_TEST_LAUNCH_SHA256:planHash};
const context={repository:'cyranoaladin/nexus-project_v0',repositoryId:1031512009,workflowId:185409165,runId:12345,runAttempt:2,
  ref:env.GITHUB_REF,githubSha,sourceSha,sourceBranch:env.NEXUS_EXPECTED_SOURCE_BRANCH,tree,planHash,event:'pull_request'};
const run={id:12345,run_attempt:2,workflow_id:185409165,path:'.github/workflows/ci.yml',event:'pull_request',head_sha:sourceSha,
  head_branch:context.sourceBranch,repository:{id:1031512009,full_name:context.repository},head_repository:{id:1031512009,full_name:context.repository}};
const name='corev2-private-12345-2-unit';
const artifact={id:123, name,expired:false,size_in_bytes:200,digest:`sha256:${'6'.repeat(64)}`,
  workflow_run:{id:12345,repository_id:1031512009,head_repository_id:1031512009,head_sha:sourceSha,head_branch:context.sourceBranch}};
const baseUri=`https://github.com/${context.repository}`;
const certificate={subjectAlternativeName:`${baseUri}/.github/workflows/ci.yml@${context.ref}`,issuer:'https://token.actions.githubusercontent.com',
  sourceRepositoryURI:baseUri,sourceRepositoryIdentifier:'1031512009',sourceRepositoryDigest:githubSha,sourceRepositoryRef:context.ref,
  buildSignerURI:`${baseUri}/.github/workflows/ci.yml@${context.ref}`,buildSignerDigest:githubSha,
  buildConfigURI:`${baseUri}/.github/workflows/ci.yml@${context.ref}`,buildConfigDigest:githubSha,runnerEnvironment:'github-hosted',
  runInvocationURI:`${baseUri}/actions/runs/12345/attempts/2`};
const verified=[{verificationResult:{signature:{certificate},statement:{subject:[{name:'payload.gpg',digest:{sha256:cipherHash}}],predicateType:'https://slsa.dev/provenance/v1'}}}];
const manifest={schemaVersion:'nexus-ci-private-evidence/v1',repository:context.repository,repositoryId:context.repositoryId,
  workflowId:context.workflowId,runId:context.runId,runAttempt:context.runAttempt,githubSha,githubRef:context.ref,
  sourceSha,tree,planHash,label:'unit',cipherSha256:cipherHash,cipherBytes:101};
const clone=value=>structuredClone(value);
test('CI context distinguishes the source PR SHA from the OIDC merge SHA',()=>assert.deepEqual(expectedCiContext(env),context));
test('CI context accepts a main push only when source and OIDC SHA agree',()=>{
  const actual=expectedCiContext({...env,GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_SHA:sourceSha,NEXUS_EXPECTED_SOURCE_BRANCH:'main'});
  assert.equal(actual.sourceSha,actual.githubSha);assert.equal(actual.ref,'refs/heads/main');
});
test('GitHub API run is attached to exact immutable repository, workflow, source, run and attempt',()=>assert.equal(validateGitHubRun(run,context),run));
test('GitHub API artifact binds a single named artifact to the same run and source',()=>assert.equal(validateGitHubArtifact(artifact,context,'unit'),artifact));
test('OIDC verification accepts all required claims within one verified certificate entry',()=>assert.equal(validateAttestation(verified,context,cipherHash),verified[0]));
test('OIDC verification binds the sole external launch challenge as a separate explicit subject',()=>{
  const proof=clone(verified);proof[0].verificationResult.statement.subject[0]={name:'launch.json',digest:{sha256:planHash}};
  assert.equal(validateAttestation(proof,context,planHash,'launch.json'),proof[0]);
  assert.throws(()=>validateAttestation(proof,context,planHash));assert.throws(()=>validateAttestation(proof,context,planHash,'other'));
});
test('public manifest permits only bounded nonsensitive provenance metadata',()=>assert.equal(validatePublicManifest(manifest,context,'unit',cipherHash,101),manifest));
test('evidence artifact name includes the run and attempt, without a mutable SHA-only lookup',()=>assert.equal(evidenceArtifactName(context,'unit'),name));
for(const [field,value] of [
  ['GITHUB_REPOSITORY','other/repository'],['GITHUB_REPOSITORY_ID','999'],['GITHUB_RUN_ID','0'],['GITHUB_RUN_ID','123.0'],
  ['GITHUB_RUN_ATTEMPT','02'],['GITHUB_SHA','z'.repeat(40)],['GITHUB_EVENT_NAME','workflow_dispatch'],
  ['GITHUB_REF','refs/pull/346/head'],['GITHUB_REF','refs/heads/other'],['NEXUS_EXPECTED_SOURCE_SHA',''],
  ['NEXUS_EXPECTED_SOURCE_BRANCH','../main'],['NEXUS_EXPECTED_SOURCE_TREE','short'],['NEXUS_TEST_LAUNCH_SHA256',''],
])test(`CI context refuses altered ${field}`,()=>assert.throws(()=>expectedCiContext({...env,[field]:value}),/CI_EVIDENCE_REFUSED/));
test('main context refuses a different source SHA',()=>assert.throws(()=>expectedCiContext({...env,GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',NEXUS_EXPECTED_SOURCE_BRANCH:'main'})));
for(const [field,value] of [['id',12346],['run_attempt',1],['workflow_id',123],['path','.github/workflows/other.yml'],['event','push'],['head_sha',githubSha],['head_branch','other']])
  test(`GitHub run refuses altered ${field}`,()=>{const valueRun=clone(run);valueRun[field]=value;assert.throws(()=>validateGitHubRun(valueRun,context));});
for(const field of ['repository','head_repository'])test(`GitHub run refuses ${field} from a fork or another repository`,()=>{
  const valueRun=clone(run);valueRun[field].id=123;assert.throws(()=>validateGitHubRun(valueRun,context));
});
for(const [field,value] of [['id',0],['name','corev2-private-12345-1-unit'],['expired',true],['size_in_bytes',0],['size_in_bytes',3*1024**3+1],['digest','sha256:invalid']])
  test(`GitHub artifact refuses altered ${field}`,()=>{const valueArtifact=clone(artifact);valueArtifact[field]=value;assert.throws(()=>validateGitHubArtifact(valueArtifact,context,'unit'));});
for(const [field,value] of [['id',12346],['repository_id',123],['head_repository_id',123],['head_sha',githubSha],['head_branch','other']])
  test(`GitHub artifact refuses altered workflow_run.${field}`,()=>{const valueArtifact=clone(artifact);valueArtifact.workflow_run[field]=value;assert.throws(()=>validateGitHubArtifact(valueArtifact,context,'unit'));});
for(const field of Object.keys(certificate))test(`OIDC refuses wrong or absent certificate ${field}`,()=>{
  for(const remove of [false,true]){const proof=clone(verified),cert=proof[0].verificationResult.signature.certificate;
    if(remove)delete cert[field];else cert[field]=`${cert[field]}-other`;assert.throws(()=>validateAttestation(proof,context,cipherHash));}
});
test('OIDC refuses claims split across separate verified entries',()=>{
  const proof=[clone(verified[0]),clone(verified[0])];delete proof[0].verificationResult.signature.certificate.runInvocationURI;
  delete proof[1].verificationResult.signature.certificate.sourceRepositoryIdentifier;assert.throws(()=>validateAttestation(proof,context,cipherHash));
});
test('OIDC refuses an unsigned predicate pretending to supply run identity',()=>{
  const proof=clone(verified);delete proof[0].verificationResult.signature.certificate.runInvocationURI;
  proof[0].verificationResult.statement.predicate={runId:12345,runAttempt:2};assert.throws(()=>validateAttestation(proof,context,cipherHash));
});
for(const mutation of [
  proof=>proof[0].verificationResult.statement.subject[0].digest.sha256='0'.repeat(64),
  proof=>proof[0].verificationResult.statement.subject[0].name='another-file',
  proof=>proof[0].verificationResult.statement.predicateType='another-type',
  proof=>proof[0].verificationResult.statement.subject.push(clone(proof[0].verificationResult.statement.subject[0])),
  proof=>{proof[0].verificationResult.signature.certificate.sourceRepositoryDigest=sourceSha;},
])test('OIDC rejects mismatched subjects, predicates and PR source substitution',()=>{const proof=clone(verified);mutation(proof);assert.throws(()=>validateAttestation(proof,context,cipherHash));});
test('OIDC refuses more than the bounded verification entries',()=>assert.throws(()=>validateAttestation(Array.from({length:65},()=>clone(verified[0])),context,cipherHash)));
for(const field of Object.keys(manifest))test(`public manifest refuses altered ${field}`,()=>{
  const value=clone(manifest);value[field]=typeof value[field]==='number'?value[field]+1:`${value[field]}-other`;
  assert.throws(()=>validatePublicManifest(value,context,'unit',cipherHash,101));
});
test('public manifest refuses secret fields and arbitrary metadata',()=>assert.throws(()=>validatePublicManifest({...manifest,token:'sensitive-fixture'},context,'unit',cipherHash,101)));
for(const label of ['../unit','UNIT','unit/other','','a'.repeat(65)])test('artifact naming refuses unsafe labels',()=>assert.throws(()=>evidenceArtifactName(context,label)));
