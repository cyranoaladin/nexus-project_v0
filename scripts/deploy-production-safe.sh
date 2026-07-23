#!/usr/bin/env bash
set -euo pipefail

echo "Deployment helper disabled: the public repository must not contain production topology or commands." >&2
echo "Use the owner-controlled private runbook after written publication and deployment approval." >&2
exit 1
