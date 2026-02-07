# Integration Tests

This directory contains integration tests for the Zenflow sync system.

## Test Files

### 1. `rule-workflow-integration.test.ts`
Tests the integration between the Rule Engine and Workflow Engine:
- Rule triggers executing workflows
- Multiple rules triggering different workflows
- Rule conditions with workflow execution
- Error handling in workflow actions

### 2. `git-sync-integration.test.ts`
Tests the integration between Git Client and Sync Manager:
- Worktree operations with sync
- Diff analysis and conflict detection
- Complete sync flows (success and conflict scenarios)
- Sync history tracking and rollback

### 3. `config-validation-integration.test.ts`
Tests the integration between Config Loader and Validator:
- Loading and validating configurations
- Applying default values
- Error handling for invalid configurations
- Config merging with defaults

### 4. `cli-core-integration.test.ts`
Tests the integration between CLI commands and core engines:
- Rule validation through CLI simulation
- Workflow execution through CLI simulation
- Config management
- Sync operations

### 5. `sync-flow-e2e.test.ts`
End-to-end tests for complete sync flows:
- Successful sync scenarios (add, modify, delete files)
- Conflict detection and handling
- Validation failures
- Dry-run mode
- Batch sync operations
- Sync history and rollback

## Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npx jest .zenflow/tests/integration/git-sync-integration.test.ts

# Run with coverage
npm run test:coverage
```

## Test Environment

All tests use temporary directories and Git repositories to ensure isolation and repeatability. Tests clean up after themselves automatically.

## Coverage

Integration tests focus on:
- Component interactions
- End-to-end workflows
- Error propagation between components
- State management across operations
