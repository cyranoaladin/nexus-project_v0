/** Collection and execution are separate evidence. No declaration is a pass. */
export function collectionArgv(lane) {
  if(!lane || !Array.isArray(lane.argv) || !lane.argv.every(arg=>typeof arg==='string'))throw new Error('INVALID_TEST_LANE');
  if(lane.argv.some(arg=>/^--(?:passWithNoTests|watch|watchAll|onlyFailures|listTests|list|shard|test-only|test-name-pattern|test-rerun-failures|lf|last-failed|reruns)(?:=|$)/.test(arg)))throw new Error('FORBIDDEN_TEST_OPTION');
  if(lane.runner==='jest')return [...lane.argv,'--listTests','--json'];
  if(lane.runner==='playwright')return [...lane.argv,'--list','--reporter=json'];
  if(lane.runner==='python')return [...lane.argv,'--collect-only'];
  if(lane.runner==='node')return [...lane.argv];
  throw new Error('UNKNOWN_TEST_RUNNER');
}
export function expectedRunIdentity(env=process.env){
  if(env.GITHUB_RUN_ID){
    if(!/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID)||!/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT??''))throw new Error('INVALID_GITHUB_RUN_IDENTITY');
    return {kind:'GITHUB_ACTIONS',githubRunId:env.GITHUB_RUN_ID,githubRunAttempt:env.GITHUB_RUN_ATTEMPT};
  }
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(env.NEXUS_QUALIFICATION_RUN_ID??''))throw new Error('LOCAL_QUALIFICATION_RUN_ID_REQUIRED');
  return {kind:'LOCAL_QUALIFICATION',qualificationRunId:env.NEXUS_QUALIFICATION_RUN_ID};
}
export function reconcileTestEvidence(collection,reports,{scope='FINAL'}={}) {
  const blockers=[],lanes=[],unique=new Map(),pendingRehearsals=[];let executions=0;
  if(!['FINAL','CI'].includes(scope))throw new Error('INVALID_QUALIFICATION_SCOPE');
  const knownPaths=new Set(collection.paths);
  const assigned=new Set(collection.lanes.flatMap(lane=>lane.collected));
  for(const path of knownPaths)if(!assigned.has(path))blockers.push(`ORPHAN_TEST_PATH:${path}`);
  for(const lane of collection.lanes) {
    if(scope==='CI'&&lane.kind==='REHEARSAL'){
      pendingRehearsals.push({id:lane.id,collected:lane.collected});
      if(reports.some(report=>report.laneId===lane.id))blockers.push(`UNEXPECTED_CI_REHEARSAL_REPORT:${lane.id}`);
      continue;
    }
    const candidates=reports.filter(report=>report.laneId===lane.id);
    if(candidates.length===0){blockers.push(`MISSING_EXECUTION_REPORT:${lane.id}`);continue;}
    if(candidates.length!==1){blockers.push(`AMBIGUOUS_EXECUTION_REPORT:${lane.id}`);continue;}
    const report=candidates[0];
    if(report.schemaVersion!==2||report.clean!==true||collection.clean!==true
      ||report.tree!==collection.tree||!collection.runIdentity
      ||JSON.stringify(report.runIdentity)!==JSON.stringify(collection.runIdentity)
      ||JSON.stringify(report.driver)!==JSON.stringify(lane.driver??null)
      ||report.producedBy!==(lane.producedBy??null)||report.driverGroup!==(lane.producedBy??lane.id)
      ||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(report.executionNonce??'')
      ||report.nativeReportFile!==`${lane.id}.native.json`||report.nativeVerified!==true
      ||!/^[a-f0-9]{64}$/.test(report.nativeReportSha256??'')
      ||report.nativeReportSha256Actual!==report.nativeReportSha256
      ||report.nativeLaunchFile!==`${lane.id}.native.json.launch.json`
      ||report.nativeProvenanceFile!==`${lane.id}.native.json.provenance.json`
      ||!/^[a-f0-9]{64}$/.test(report.nativeLaunchSha256??'')||!/^[a-f0-9]{64}$/.test(report.nativeProvenanceSha256??'')
      ||!/^[a-f0-9]{64}$/.test(report.reportSha256??'')
      ||report.signal!==null||!Array.isArray(report.tests)||!Array.isArray(report.collected)||!Array.isArray(report.blockers)){
      blockers.push(`INVALID_EXECUTION_ENVELOPE:${lane.id}`);continue;
    }
    if(lane.producedBy){
      const producer=reports.find(candidate=>candidate.laneId===lane.producedBy);
      if(!producer||producer.executionNonce!==report.executionNonce||producer.exitCode!==report.exitCode
        ||producer.signal!==report.signal||JSON.stringify(producer.runIdentity)!==JSON.stringify(report.runIdentity))
        blockers.push(`DRIVER_GROUP_MISMATCH:${lane.producedBy}`);
    }
    if(lane.kind==='REHEARSAL'&&(!collection.qualificationTarget
      ||JSON.stringify(report.qualificationTarget)!==JSON.stringify(collection.qualificationTarget)))
      blockers.push(`REHEARSAL_TARGET_MISMATCH:${lane.id}`);
    if(JSON.stringify(report.argv)!==JSON.stringify(lane.argv))blockers.push(`EXECUTION_ARGV_MISMATCH:${lane.id}`);
    if(JSON.stringify([...(report.collected??[])].sort())!==JSON.stringify([...lane.collected].sort()))blockers.push(`EXECUTION_COLLECTION_MISMATCH:${lane.id}`);
    for(const blocker of report.blockers??[])blockers.push(`EXECUTION_BLOCKER:${lane.id}:${blocker}`);
    if(report.sourceFingerprint!==collection.sourceFingerprint || report.sourceSha!==collection.sourceSha)blockers.push(`STALE_EXECUTION_REPORT:${lane.id}`);
    if(report.exitCode!==0)blockers.push(`FAILED_RUNNER:${lane.id}`);
    if(report.signal)blockers.push(`SIGNALLED_RUNNER:${lane.id}`);
    const tests=report.tests??[];const executed=new Set(tests.map(test=>test.path));
    if(tests.length===0)blockers.push(`EMPTY_EXECUTION_REPORT:${lane.id}`);
    for(const path of lane.collected)if(!executed.has(path))blockers.push(`MISSING_EXECUTED_PATH:${lane.id}:${path}`);
    for(const path of executed)if(!lane.collected.includes(path))blockers.push(`UNEXPECTED_EXECUTED_PATH:${lane.id}:${path}`);
    const occurrenceKey=test=>JSON.stringify([test.path,test.occurrenceId??test.title,test.project??null]);
    if(lane.testItems?.length){
      const remaining=new Map();for(const test of tests){const key=occurrenceKey(test);remaining.set(key,(remaining.get(key)??0)+1);}
      for(const test of lane.testItems){const key=occurrenceKey(test),count=remaining.get(key)??0;
        if(!count)blockers.push(`MISSING_EXECUTED_OCCURRENCE:${lane.id}:${key}`);else remaining.set(key,count-1);}
      for(const [key,count] of remaining)if(count)blockers.push(`UNEXPECTED_EXECUTED_OCCURRENCE:${lane.id}:${key}`);
    }
    const statuses={passed:0,failed:0,skipped:0,todo:0,pending:0,unknown:0};
    for(const test of tests) {
      executions++;statuses[Object.hasOwn(statuses,test.status)?test.status:'unknown']++;
      if(test.status!=='passed')blockers.push(`NON_PASSING_TEST:${lane.id}:${test.path}:${test.title}`);
      if(test.attempts>1||test.retry>0)blockers.push(`RETRIED_TEST:${lane.id}:${test.path}:${test.title}`);
      for(const condition of test.forbiddenConditions??[])blockers.push(`FORBIDDEN_TEST_CONDITION:${lane.id}:${condition}`);
      const key=JSON.stringify([test.path,test.line??null,test.column??null,test.title,test.project??null,test.logicalOccurrence??0]);
      if(!unique.has(key))unique.set(key,{...test,lanes:[lane.id]});
      else unique.get(key).lanes.push(lane.id);
    }
    lanes.push({id:lane.id,runner:lane.runner,kind:lane.kind,suites:new Set(tests.map(test=>test.path)).size,
      tests:tests.length,statuses,reportSha256:report.reportSha256??null});
  }
  for(const report of reports)if(!collection.lanes.some(lane=>lane.id===report.laneId))blockers.push(`UNKNOWN_REPORT_LANE:${report.laneId}`);
  const ownership=collection.paths.map(path=>({path,owner:collection.lanes.find(lane=>lane.kind==='PRIMARY'&&lane.collected.includes(path))?.id
    ??collection.lanes.find(lane=>lane.collected.includes(path))?.id??null,
    lanes:collection.lanes.filter(lane=>lane.collected.includes(path)).map(lane=>lane.id)}));
  return {schemaVersion:2,sourceSha:collection.sourceSha,sourceFingerprint:collection.sourceFingerprint,
    tree:collection.tree,runIdentity:collection.runIdentity,scope,pendingRehearsals,
    releaseQualified:scope==='FINAL'&&blockers.length===0,
    verdict:blockers.length?'QUALIFICATION_BLOCKED':pendingRehearsals.length?'CI_QUALIFIED_MANUAL_PENDING':scope==='FINAL'?'EXECUTION_QUALIFIED':'CI_EXECUTION_QUALIFIED',
    blockers:[...new Set(blockers)].sort(),ownership,lanes,uniqueTests:[...unique.values()],
    totals:{paths:collection.paths.length,uniqueSuites:new Set([...unique.values()].map(test=>test.path)).size,
      uniqueTests:unique.size,executions,additionalExecutions:executions-unique.size}};
}
