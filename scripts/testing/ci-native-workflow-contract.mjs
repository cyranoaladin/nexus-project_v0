/** A registry entry grants no CI coverage without its actual native producer. */
const head='${{ github.event.pull_request.head.sha || github.sha }}';
const resolveMatrix=(value,matrix)=>String(value??'').replace(/\$\{\{\s*matrix\.([a-zA-Z0-9_-]+)\s*\}\}/g,(_,key)=>String(matrix[key]??'UNRESOLVED'));
export function inspectNativeCiWorkflow(workflow,registered,producers){
  const blockers=[],jobs=workflow?.jobs??{},seen=new Map(),assigned=Object.values(producers).flat();
  const ciLanes=registered.lanes.filter(lane=>lane.kind!=='REHEARSAL');
  if(new Set(assigned).size!==assigned.length||assigned.length!==ciLanes.length||ciLanes.some(lane=>!assigned.includes(lane.id)))blockers.push('NATIVE_CI_PRODUCER_OWNERSHIP');
  const plan=jobs['test-launch-plan'];
  if(!plan||!plan.steps?.some(step=>step.run?.includes('node scripts/testing/prepare-test-launch.mjs'))
    ||!plan.steps?.some(step=>step.uses?.startsWith('actions/attest-build-provenance@')&&step.with?.['subject-name']==='launch.json')
    ||plan.outputs?.['artifact-id']!=='${{ steps.launch-upload.outputs.artifact-id }}')blockers.push('NATIVE_CI_EXTERNAL_PLAN');
  for(const [key,job] of Object.entries(jobs)){
    if(!job.env?.NEXUS_CI_EVIDENCE_LABEL)continue;
    const variants=job.strategy?.matrix?.include??[{}];
    for(const variant of variants){const label=resolveMatrix(job.env.NEXUS_CI_EVIDENCE_LABEL,variant),expected=producers[label];
      if(!expected){blockers.push(`NATIVE_CI_UNKNOWN_PRODUCER:${label}`);continue;}seen.set(label,(seen.get(label)??0)+1);
      const needs=Array.isArray(job.needs)?job.needs:[job.needs];if(!needs.includes('test-launch-plan'))blockers.push(`NATIVE_CI_PLAN_NEED:${key}`);
      const checkout=job.steps?.find(step=>step.uses?.startsWith('actions/checkout@')&&!step.with?.path);
      if(checkout?.with?.ref!==head||checkout?.with?.['fetch-depth']!==0)blockers.push(`NATIVE_CI_SOURCE_CHECKOUT:${key}`);
      const wantedPermissions={contents:'read',actions:'read','id-token':'write',attestations:'write'};
      if(JSON.stringify(job.permissions)!==JSON.stringify(wantedPermissions))blockers.push(`NATIVE_CI_PRODUCER_PERMISSIONS:${key}`);
      if(job.steps?.filter(step=>step.uses==='./.github/actions/native-test-evidence').length!==1)blockers.push(`NATIVE_CI_SETUP:${key}`);
      const seals=job.steps?.filter(step=>step.uses==='./.github/actions/seal-native-test-evidence');
      if(seals?.length!==1||seals[0].if!=='always()'||seals[0].with?.['producer-label']!=='${{ env.NEXUS_CI_EVIDENCE_LABEL }}')blockers.push(`NATIVE_CI_SEAL:${key}`);
      if(job.steps?.some(step=>step.uses?.startsWith('actions/upload-artifact@')))blockers.push(`NATIVE_CI_PLAINTEXT_UPLOAD:${key}`);
      const actual=job.steps?.flatMap(step=>{const command=resolveMatrix(step.run,variant);
        return [...command.matchAll(/(?:^|\n)node scripts\/testing\/run-test-lane\.mjs ([a-z][a-z0-9-]+)(?=\n|$)/g)].map(match=>match[1]);})??[];
      if(key==='aria-coverage'&&job.steps?.some(step=>step.run==='npm run test:aria:coverage'))actual.push(...expected);
      const independentlyExecuted=expected.filter(id=>!registered.lanes.find(lane=>lane.id===id)?.producedBy);
      if(actual.length!==independentlyExecuted.length||new Set(actual).size!==actual.length||independentlyExecuted.some(id=>!actual.includes(id)))blockers.push(`NATIVE_CI_EFFECTIVE_LANES:${label}`);
      if(job['continue-on-error']||job.steps?.some(step=>step['continue-on-error']))blockers.push(`NATIVE_CI_IGNORED_FAILURE:${key}`);
    }
  }
  for(const label of Object.keys(producers))if(seen.get(label)!==1)blockers.push(`NATIVE_CI_MISSING_OR_DUPLICATE_PRODUCER:${label}`);
  const aggregate=jobs['ci-success'],steps=aggregate?.steps??[],needs=aggregate?.needs??[];
  if(!steps.some(step=>step.run==='node scripts/testing/check-ci-test-lane-coverage.mjs --require-execution --ci-scope'&&!step.if))blockers.push('NATIVE_CI_EXECUTION_GATE');
  if(!steps.some(step=>step.run?.includes('ci-private-evidence.mjs fetch-reports ALL')&&step.env?.NEXUS_CI_EVIDENCE_PRIVATE_KEY))blockers.push('NATIVE_CI_VERIFIED_REPORT_FETCH');
  if(!steps.some(step=>step.run==='node scripts/github/assert-ci-needs.mjs'&&step.env?.CI_NEEDS_JSON==='${{ toJSON(needs) }}'))blockers.push('NATIVE_CI_ALL_DEPENDENCIES_GATE');
  for(const key of Object.keys(jobs).filter(key=>key!=='ci-success'))if(!needs.includes(key))blockers.push(`NATIVE_CI_AGGREGATE_NEED:${key}`);
  return {ok:!blockers.length,blockers:[...new Set(blockers)].sort()};
}
