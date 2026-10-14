/** GitHub/OIDC metadata is verified before any confidential evidence is opened. */
export const EVIDENCE_REPOSITORY='cyranoaladin/nexus-project_v0';
export const EVIDENCE_REPOSITORY_ID=1031512009;
export const EVIDENCE_WORKFLOW_ID=185409165;
const fail=()=>{throw new Error('CI_EVIDENCE_REFUSED');};
const sha40=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const sha256=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const integer=value=>Number.isSafeInteger(value)&&value>0;
function decimal(value){if(typeof value!=='string'||!(/^[1-9][0-9]*$/).test(value)||!integer(Number(value)))fail();return Number(value);}
function labelValue(value){if(typeof value!=='string'||!(/^[a-z0-9][a-z0-9_-]{0,63}$/).test(value))fail();return value;}
export function expectedCiContext(env=process.env){
  if(env.GITHUB_REPOSITORY!==EVIDENCE_REPOSITORY||env.GITHUB_REPOSITORY_ID!==String(EVIDENCE_REPOSITORY_ID)
    ||!sha40(env.GITHUB_SHA)||!sha40(env.NEXUS_EXPECTED_SOURCE_SHA)||!sha40(env.NEXUS_EXPECTED_SOURCE_TREE)
    ||!sha256(env.NEXUS_TEST_LAUNCH_SHA256))fail();
  const isPull=env.GITHUB_EVENT_NAME==='pull_request'&&/^refs\/pull\/[1-9][0-9]*\/merge$/.test(env.GITHUB_REF??'');
  const isMain=env.GITHUB_EVENT_NAME==='push'&&env.GITHUB_REF==='refs/heads/main';
  const branch=env.NEXUS_EXPECTED_SOURCE_BRANCH;
  if(!isPull&&!isMain||typeof branch!=='string'||!branch||branch.length>255||branch.startsWith('/')||branch.endsWith('/')
    ||branch.includes('..')||branch.includes('//')||!(/^[a-zA-Z0-9_./-]+$/).test(branch)
    ||isMain&&(branch!=='main'||env.GITHUB_SHA!==env.NEXUS_EXPECTED_SOURCE_SHA))fail();
  return {repository:EVIDENCE_REPOSITORY,repositoryId:EVIDENCE_REPOSITORY_ID,workflowId:EVIDENCE_WORKFLOW_ID,
    runId:decimal(env.GITHUB_RUN_ID),runAttempt:decimal(env.GITHUB_RUN_ATTEMPT),ref:env.GITHUB_REF,
    githubSha:env.GITHUB_SHA,sourceSha:env.NEXUS_EXPECTED_SOURCE_SHA,sourceBranch:branch,
    tree:env.NEXUS_EXPECTED_SOURCE_TREE,planHash:env.NEXUS_TEST_LAUNCH_SHA256,event:env.GITHUB_EVENT_NAME};
}
export function validateGitHubRun(run,expected){
  if(!run||run.id!==expected.runId||run.run_attempt!==expected.runAttempt||run.workflow_id!==expected.workflowId
    ||run.path!=='.github/workflows/ci.yml'||run.event!==expected.event||run.head_sha!==expected.sourceSha
    ||run.head_branch!==expected.sourceBranch
    ||[run.repository,run.head_repository].some(repo=>!repo||repo.id!==expected.repositoryId||repo.full_name!==expected.repository))fail();
  return run;
}
export function evidenceArtifactName(expected,label){return `corev2-private-${expected.runId}-${expected.runAttempt}-${labelValue(label)}`;}
export function validateGitHubArtifact(artifact,expected,label){
  const run=artifact?.workflow_run;
  if(!artifact||!integer(artifact.id)||artifact.name!==evidenceArtifactName(expected,label)||artifact.expired!==false
    ||!integer(artifact.size_in_bytes)||artifact.size_in_bytes>3*1024**3
    ||typeof artifact.digest!=='string'||!/^sha256:[a-f0-9]{64}$/.test(artifact.digest)
    ||!run||run.id!==expected.runId||run.repository_id!==expected.repositoryId||run.head_repository_id!==expected.repositoryId
    ||run.head_sha!==expected.sourceSha||run.head_branch!==expected.sourceBranch)fail();
  return artifact;
}
export function validateAttestation(entries,expected,cipherSha256,subjectName='payload.gpg'){
  if(!['payload.gpg','launch.json'].includes(subjectName)||!sha256(cipherSha256)||!Array.isArray(entries)||entries.length<1||entries.length>64)fail();
  const base=`https://github.com/${expected.repository}`,workflow=`${base}/.github/workflows/ci.yml@${expected.ref}`;
  const claims={subjectAlternativeName:workflow,issuer:'https://token.actions.githubusercontent.com',sourceRepositoryURI:base,
    sourceRepositoryIdentifier:String(expected.repositoryId),sourceRepositoryDigest:expected.githubSha,sourceRepositoryRef:expected.ref,
    buildSignerURI:workflow,buildSignerDigest:expected.githubSha,buildConfigURI:workflow,buildConfigDigest:expected.githubSha,
    runnerEnvironment:'github-hosted',runInvocationURI:`${base}/actions/runs/${expected.runId}/attempts/${expected.runAttempt}`};
  const match=entries.find(entry=>{
    const certificate=entry?.verificationResult?.signature?.certificate,statement=entry?.verificationResult?.statement;
    return certificate&&Object.entries(claims).every(([key,value])=>certificate[key]===value)
      &&statement?.predicateType==='https://slsa.dev/provenance/v1'&&Array.isArray(statement.subject)&&statement.subject.length===1
      &&statement.subject[0]?.name===subjectName&&statement.subject[0]?.digest?.sha256===cipherSha256;
  });
  if(!match)fail();return match;
}
export function validatePublicManifest(manifest,expected,label,cipherSha256,cipherBytes){
  if(!sha256(cipherSha256)||!integer(cipherBytes)||cipherBytes>3*1024**3)fail();
  const wanted={schemaVersion:'nexus-ci-private-evidence/v1',repository:expected.repository,repositoryId:expected.repositoryId,
    workflowId:expected.workflowId,runId:expected.runId,runAttempt:expected.runAttempt,githubSha:expected.githubSha,githubRef:expected.ref,
    sourceSha:expected.sourceSha,tree:expected.tree,planHash:expected.planHash,label:labelValue(label),cipherSha256,cipherBytes};
  if(!manifest||Array.isArray(manifest)||Object.keys(manifest).length!==Object.keys(wanted).length
    ||Object.entries(wanted).some(([key,value])=>manifest[key]!==value))fail();
  return manifest;
}
