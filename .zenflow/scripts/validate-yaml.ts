#!/usr/bin/env ts-node

import path from 'path';
import { RuleLoader } from '../core/rules/loader';
import { WorkflowLoader } from '../core/workflows/loader';

const ZENFLOW_ROOT = path.resolve(__dirname, '..');
const RULES_DIR = path.join(ZENFLOW_ROOT, 'rules');
const WORKFLOWS_DIR = path.join(ZENFLOW_ROOT, 'workflows');

async function validateRules(): Promise<boolean> {
  console.log('🔍 Validating rules...\n');
  
  const loader = new RuleLoader(RULES_DIR);
  
  try {
    const rules = await loader.loadRules();
    console.log(`✅ Successfully validated ${rules.length} rule(s):`);
    rules.forEach(rule => {
      console.log(`   - ${rule.name} (v${rule.version})`);
    });
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ Rule validation failed:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);
    return false;
  }
}

async function validateWorkflows(): Promise<boolean> {
  console.log('🔍 Validating workflows...\n');
  
  const loader = new WorkflowLoader(WORKFLOWS_DIR);
  
  try {
    const workflows = await loader.loadWorkflows();
    console.log(`✅ Successfully validated ${workflows.length} workflow(s):`);
    workflows.forEach(workflow => {
      console.log(`   - ${workflow.name} (v${workflow.version}) - ${workflow.steps.length} steps`);
    });
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ Workflow validation failed:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}\n`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   Zenflow YAML Configuration Validator');
  console.log('═══════════════════════════════════════════════════\n');
  
  const rulesValid = await validateRules();
  const workflowsValid = await validateWorkflows();
  
  console.log('═══════════════════════════════════════════════════');
  
  if (rulesValid && workflowsValid) {
    console.log('✅ All YAML files are valid!\n');
    process.exit(0);
  } else {
    console.log('❌ Validation failed. Please fix the errors above.\n');
    process.exit(1);
  }
}

main();
