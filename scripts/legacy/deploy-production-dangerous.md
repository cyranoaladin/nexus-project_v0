# ⚠️ DANGEROUS DEPLOYMENT SCRIPT - HISTORICAL DOCUMENTATION ⚠️

## Incident: P0-3 - Destructive deployment script

This script was moved to legacy/ on 2026-04-29 as part of P0 hardening.

## DANGEROUS COMMANDS

This script contained the following destructive command:

```bash
docker compose -f ${COMPOSE_FILE} down --volumes --remove-orphans
```

**This command DELETES ALL DOCKER VOLUMES including the database.**

## Original Script Location

- **Original:** `scripts/deploy-production.sh`
- **Moved to:** `scripts/legacy/deploy-production-dangerous.sh` (2026-04-29)
- **Converted to:** `scripts/legacy/deploy-production-dangerous.md` (2026-04-29)

## Why This Script Is Dangerous

1. **`down --volumes`** - Removes all Docker volumes, including:
   - Database volume (nexus-postgres-prod)
   - Any other persistent volumes
   - **Data loss is irreversible without backup**

2. **`--remove-orphans`** - Removes containers not defined in compose file
   - May remove related services
   - Can break dependencies

3. **No backup verification** - Does not check for recent DB backup before execution

4. **No safeguards** - Originally had no confirmation mechanism

## Safe Alternative

Use `scripts/deploy-production-safe.sh` instead, which includes:
- Refuses to run if repo is dirty
- Shows current commit
- Requires CONFIRM_PRODUCTION_DEPLOY=yes
- Checks for recent DB backup
- Automatic SSL backup before git pull
- `git pull --ff-only`
- Build nexus-app only (no postgres restart)
- **NEVER** calls `docker compose down`
- **NEVER** calls `--volumes`
- Healthcheck and rollback instructions

## If You Absolutely Must Reconstruct This Script (NOT RECOMMENDED)

1. Take a full DB backup first
2. Confirm you understand volumes will be deleted
3. Set CONFIRM_DANGEROUS_DEPLOY=yes environment variable
4. Have a rollback plan ready
5. Get explicit approval from production lead

## Original Script Logic (FOR REFERENCE ONLY - DO NOT EXECUTE)

The original script performed the following steps:

1. SSH into server and pull latest changes
2. Stop and remove all containers with volumes cleanup
3. Force remove any remaining nexus containers
4. Build and start containers
5. Wait for containers to be healthy
6. Verify deployment
7. Health check
8. Show recent logs

## Contract Test

The contract test `__tests__/config/deploy-contract.test.ts` now verifies:
- No destructive docker commands in active production scripts
- Legacy dangerous scripts are not in scripts/ root directory

## Decision

This script was converted to documentation on 2026-04-29 as part of P0 hardening.
The executable .sh file was deleted to prevent accidental execution.

**DO NOT USE THIS SCRIPT IN PRODUCTION WITHOUT EXPLICIT APPROVAL.**
