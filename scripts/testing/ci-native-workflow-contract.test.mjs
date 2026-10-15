import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
import {inspectNativeCiWorkflow} from './ci-native-workflow-contract.mjs';
const load=()=>YAML.parse(fs.readFileSync('.github/workflows/ci.yml','utf8'));
const registered=JSON.parse(fs.readFileSync('.github/governance/test-lanes.json','utf8'));
const producers=JSON.parse(fs.readFileSync('.github/governance/ci-test-producers.json','utf8')).producers;
const inspect=workflow=>inspectNativeCiWorkflow(workflow,registered,producers);
test('the real CI workflow executes every registered CI lane once and requires exact-run encrypted native reports',()=>assert.deepEqual(inspect(load()),{ok:true,blockers:[]}));
for(const [label,mutate,expected] of [
  ['plan dependency',workflow=>{workflow.jobs.unit.needs=[];},'NATIVE_CI_PLAN_NEED:unit'],
  ['plaintext export',workflow=>workflow.jobs.unit.steps.push({uses:'actions/upload-artifact@'+'1'.repeat(40),with:{path:'raw.log'}}),'NATIVE_CI_PLAINTEXT_UPLOAD:unit'],
  ['test execution',workflow=>{workflow.jobs.unit.steps=workflow.jobs.unit.steps.filter(step=>step.run!=='node scripts/testing/run-test-lane.mjs jest-unit');},'NATIVE_CI_EFFECTIVE_LANES:unit'],
  ['same lane repeated',workflow=>workflow.jobs.unit.steps.push({run:'node scripts/testing/run-test-lane.mjs jest-unit'}),'NATIVE_CI_EFFECTIVE_LANES:unit'],
  ['native evidence gate',workflow=>{workflow.jobs['ci-success'].steps=workflow.jobs['ci-success'].steps.filter(step=>!step.run?.includes('--require-execution'));},'NATIVE_CI_EXECUTION_GATE'],
  ['gate dependency',workflow=>{workflow.jobs['ci-success'].needs=workflow.jobs['ci-success'].needs.filter(key=>key!=='core-v2-foundation');},'NATIVE_CI_AGGREGATE_NEED:core-v2-foundation'],
])test(`native CI contract refuses loss of ${label}`,()=>{const workflow=load();mutate(workflow);assert.ok(inspect(workflow).blockers.includes(expected));});
